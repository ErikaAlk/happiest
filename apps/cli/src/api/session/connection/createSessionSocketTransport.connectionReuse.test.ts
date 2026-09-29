import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';

import { Server as SocketIoServer } from 'socket.io';
import { afterEach, describe, expect, it } from 'vitest';

import { createSessionSocketTransport } from './createSessionSocketTransport';

// A real local socket.io server that counts the TCP connections it accepts. Behind a proxy or on a
// high-latency link every new connection pays another handshake (about one second with TLS), so
// polling round trips must reuse established connections.
async function startCountingSocketServer(): Promise<Readonly<{
    url: string;
    tcpConnectionCount: () => number;
    close: () => Promise<void>;
}>> {
    const httpServer: HttpServer = createServer();
    let tcpConnections = 0;
    httpServer.on('connection', () => {
        tcpConnections += 1;
    });
    const ioServer = new SocketIoServer(httpServer, { path: '/v1/updates' });
    ioServer.on('connection', (socket) => {
        let pings = 0;
        socket.on('ping', (ack: (response: unknown) => void) => {
            pings += 1;
            ack(pings);
        });
    });
    await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
    const { port } = httpServer.address() as AddressInfo;
    return {
        url: `http://127.0.0.1:${port}`,
        tcpConnectionCount: () => tcpConnections,
        close: async () => {
            await new Promise<void>((resolve) => ioServer.close(() => resolve()));
            httpServer.closeAllConnections();
        },
    };
}

describe('createSessionSocketTransport connection reuse', () => {
    const cleanups: Array<() => Promise<void> | void> = [];

    afterEach(async () => {
        while (cleanups.length > 0) {
            await cleanups.pop()?.();
        }
    });

    it('reuses TCP connections across polling round trips when no proxy is configured', async () => {
        const server = await startCountingSocketServer();
        cleanups.push(server.close);

        const { socket } = createSessionSocketTransport({
            token: 'token-1',
            sessionId: 'session-1',
            serverUrl: server.url,
            transports: ['polling'],
            env: {},
        });
        cleanups.push(() => {
            socket.disconnect();
        });

        await new Promise<void>((resolve, reject) => {
            socket.once('connect', () => resolve());
            socket.once('connect_error', reject);
            socket.connect();
        });
        for (let round = 1; round <= 5; round += 1) {
            await expect(socket.timeout(5_000).emitWithAck('ping')).resolves.toBe(round);
        }

        // Polling holds at most two connections at once: the long-poll GET and the send POST.
        expect(server.tcpConnectionCount()).toBeLessThanOrEqual(2);
    });
});
