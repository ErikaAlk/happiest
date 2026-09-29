import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';

type RequestDeadline = Readonly<{
    deadline: AbortSignal;
    callerSignal: AbortSignal | null;
}>;

const deadlinesByConfig = new WeakMap<InternalAxiosRequestConfig, RequestDeadline>();

function readCallerSignal(config: InternalAxiosRequestConfig): AbortSignal | null {
    const signal = config.signal;
    return signal instanceof AbortSignal ? signal : null;
}

// Mirrors the error axios' http adapter raises when its own timeout fires, so callers that
// classify timeouts keep working when the deadline wins the race.
function buildTimeoutError(config: InternalAxiosRequestConfig, request: unknown): AxiosError {
    const message = config.timeoutErrorMessage
        ?? (config.timeout ? `timeout of ${config.timeout}ms exceeded` : 'timeout exceeded');
    const code = config.transitional?.clarifyTimeoutError ? AxiosError.ETIMEDOUT : AxiosError.ECONNABORTED;
    return new AxiosError(message, code, config, request);
}

/**
 * Enforces each request's axios `timeout` with an abort signal. Under Bun (the shipped CLI
 * binary's runtime) axios' own timer does not fire once response headers have arrived and the
 * body stalls, which leaves the request, and every caller sharing it, pending forever.
 */
export function installAxiosRequestDeadline(client: Pick<AxiosInstance, 'interceptors'>): void {
    client.interceptors.request.use((config) => {
        const timeoutMs = typeof config.timeout === 'number' ? config.timeout : 0;
        if (timeoutMs <= 0) return config;
        const callerSignal = readCallerSignal(config);
        const deadline = AbortSignal.timeout(timeoutMs);
        config.signal = callerSignal ? AbortSignal.any([callerSignal, deadline]) : deadline;
        deadlinesByConfig.set(config, { deadline, callerSignal });
        return config;
    });
    client.interceptors.response.use(undefined, (error: unknown) => {
        if (!axios.isCancel(error)) throw error;
        const config = (error as { config?: InternalAxiosRequestConfig }).config;
        const requestDeadline = config ? deadlinesByConfig.get(config) : undefined;
        if (!config || !requestDeadline?.deadline.aborted || requestDeadline.callerSignal?.aborted) throw error;
        throw buildTimeoutError(config, (error as { request?: unknown }).request);
    });
}
