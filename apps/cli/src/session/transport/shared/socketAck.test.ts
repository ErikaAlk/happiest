import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';

import { Server as SocketIoServer, type Socket as ServerSocket } from 'socket.io';
import { io as connectSocket, type Socket as ClientSocket } from 'socket.io-client';
import { afterEach, describe, expect, it } from 'vitest';

import { emitSocketWithAck } from './socketAck';

// Real socket.io on loopback: the server receives the event and never acknowledges it, or drops
// the connection, which is what a lost settlement response looks like to the session runner.
async function startSilentServer(onEvent: (socket: ServerSocket) => void): Promise<Readonly<{
    url: string;
    close: () => Promise<void>;
}>> {
    const httpServer: HttpServer = createServer();
    const ioServer = new SocketIoServer(httpServer);
    ioServer.on('connection', (socket) => {
        socket.on('settle', () => onEvent(socket));
    });
    await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
    const { port } = httpServer.address() as AddressInfo;
    return {
        url: `http://127.0.0.1:${port}`,
        close: async () => {
            await new Promise<void>((resolve) => ioServer.close(() => resolve()));
            httpServer.closeAllConnections();
        },
    };
}

async function connectClient(url: string): Promise<ClientSocket> {
    const socket = connectSocket(url, { transports: ['websocket'], reconnection: false });
    await new Promise<void>((resolve, reject) => {
        socket.once('connect', () => resolve());
        socket.once('connect_error', reject);
    });
    return socket;
}

describe('emitSocketWithAck', () => {
    const cleanups: Array<() => Promise<void> | void> = [];

    afterEach(async () => {
        while (cleanups.length > 0) {
            await cleanups.pop()?.();
        }
    });

    it('reports a missing acknowledgement as a retryable ack timeout', async () => {
        const server = await startSilentServer(() => {});
        cleanups.push(server.close);
        const socket = await connectClient(server.url);
        cleanups.push(() => { socket.close(); });

        const error = await emitSocketWithAck({ socket, event: 'settle', payload: {}, timeoutMs: 200 })
            .catch((cause: unknown) => cause);

        expect(error).toMatchObject({ code: 'socket_ack_timeout', retryable: true, event: 'settle', timeoutMs: 200 });
    });

    it('reports a connection dropped before the acknowledgement as a retryable disconnect', async () => {
        const server = await startSilentServer((serverSocket) => serverSocket.disconnect(true));
        cleanups.push(server.close);
        const socket = await connectClient(server.url);
        cleanups.push(() => { socket.close(); });

        const error = await emitSocketWithAck({ socket, event: 'settle', payload: {}, timeoutMs: 5_000 })
            .catch((cause: unknown) => cause);

        expect(error).toMatchObject({ code: 'socket_not_connected', retryable: true, event: 'settle' });
    });
});
