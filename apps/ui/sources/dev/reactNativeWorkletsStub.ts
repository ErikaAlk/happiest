// Vitest/node stub for `react-native-worklets`.
// The published ESM build uses extensionless relative imports that Node cannot resolve, and its
// initializer expects the native worklets runtime. Thread hops run synchronously here, matching
// `runOnJS` / `runOnUI` in the Reanimated stub.

export function runOnJS<TArgs extends unknown[], TResult>(fn: (...args: TArgs) => TResult) {
    return fn;
}

export function runOnUI<TArgs extends unknown[], TResult>(fn: (...args: TArgs) => TResult) {
    return fn;
}

export function scheduleOnRN<TArgs extends unknown[]>(fn: (...args: TArgs) => unknown, ...args: TArgs): void {
    fn(...args);
}

export function scheduleOnUI<TArgs extends unknown[]>(fn: (...args: TArgs) => unknown, ...args: TArgs): void {
    fn(...args);
}
