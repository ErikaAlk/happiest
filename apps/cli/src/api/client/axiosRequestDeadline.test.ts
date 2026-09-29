import axios, { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios';
import { describe, expect, it } from 'vitest';

import { installAxiosRequestDeadline } from './axiosRequestDeadline';

// Transport boundary modelled on Bun 1.3 (the runtime of the shipped CLI binary): once response
// headers arrive and the body stalls, axios' own `timeout` never fires. Only an abort signal can
// end the request, and the real http adapter then rejects with CanceledError.
const stalledBodyAdapter: AxiosAdapter = (config: InternalAxiosRequestConfig) =>
    new Promise((_resolve, reject) => {
        const signal = config.signal as AbortSignal | undefined;
        // The http adapter passes the request config to CanceledError, which exposes it as `config`.
        signal?.addEventListener('abort', () => reject(Object.assign(new axios.CanceledError(), { config })), { once: true });
    });

function createClient() {
    const client = axios.create({ adapter: stalledBodyAdapter });
    installAxiosRequestDeadline(client);
    return client;
}

describe('installAxiosRequestDeadline', () => {
    it('ends a request whose transport ignores axios timeout with the same timeout error axios raises', async () => {
        const client = createClient();

        const error = await client.get('http://127.0.0.1:9/v2/sessions/s1', { timeout: 50 }).catch((cause: unknown) => cause);

        expect(axios.isCancel(error)).toBe(false);
        expect(error).toBeInstanceOf(AxiosError);
        expect((error as AxiosError).code).toBe('ECONNABORTED');
        expect((error as AxiosError).message).toBe('timeout of 50ms exceeded');
    });

    it('keeps a caller abort distinguishable from the deadline', async () => {
        const client = createClient();
        const controller = new AbortController();

        const pending = client.get('http://127.0.0.1:9/v2/sessions/s1', { timeout: 10_000, signal: controller.signal })
            .catch((cause: unknown) => cause);
        controller.abort();

        expect(axios.isCancel(await pending)).toBe(true);
    });
});
