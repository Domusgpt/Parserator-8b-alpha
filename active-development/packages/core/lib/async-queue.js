"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAsyncTaskQueue = createAsyncTaskQueue;
function createAsyncTaskQueue(options = {}) {
    const pending = [];
    const { onError, now = () => Date.now() } = options;
    const concurrency = Math.max(1, Math.floor(options.concurrency ?? 1));
    let inFlight = 0;
    let completed = 0;
    let failed = 0;
    let lastError;
    let lastDurationMs;
    let idlePromise;
    let resolveIdle;
    const notifyIdle = () => {
        if (pending.length === 0 && inFlight === 0 && resolveIdle) {
            resolveIdle();
            idlePromise = undefined;
            resolveIdle = undefined;
        }
    };
    const maybeResolveIdle = () => {
        if (pending.length === 0 && inFlight === 0) {
            notifyIdle();
        }
    };
    const processQueue = () => {
        while (inFlight < concurrency && pending.length > 0) {
            const task = pending.shift();
            if (!task) {
                break;
            }
            inFlight += 1;
            const startedAt = now();
            void task
                .run()
                .then(() => {
                completed += 1;
                lastDurationMs = now() - startedAt;
            })
                .catch(error => {
                failed += 1;
                lastError = error;
                lastDurationMs = now() - startedAt;
                onError?.(error);
            })
                .finally(() => {
                inFlight -= 1;
                maybeResolveIdle();
                processQueue();
            });
        }
        maybeResolveIdle();
    };
    return {
        enqueue(task) {
            return new Promise((resolve, reject) => {
                const wrapped = async () => {
                    try {
                        const result = await task();
                        resolve(result);
                    }
                    catch (error) {
                        reject(error);
                        throw error;
                    }
                };
                pending.push({
                    async run() {
                        try {
                            await wrapped();
                        }
                        catch (error) {
                            // wrapped already rejected—swallow to keep the queue alive.
                            throw error;
                        }
                    }
                });
                processQueue();
            });
        },
        onIdle() {
            if (pending.length === 0 && inFlight === 0) {
                return Promise.resolve();
            }
            if (!idlePromise) {
                idlePromise = new Promise(resolve => {
                    resolveIdle = resolve;
                });
            }
            return idlePromise;
        },
        size() {
            return pending.length + inFlight;
        },
        metrics() {
            return {
                pending: pending.length,
                inFlight,
                completed,
                failed,
                lastError,
                lastDurationMs
            };
        }
    };
}
//# sourceMappingURL=async-queue.js.map