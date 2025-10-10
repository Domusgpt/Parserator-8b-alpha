"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAsyncTaskQueue = createAsyncTaskQueue;
function createAsyncTaskQueue() {
    const tasks = [];
    let processing = false;
    let idlePromise;
    let resolveIdle;
    const notifyIdle = () => {
        if (!processing && tasks.length === 0 && resolveIdle) {
            resolveIdle();
            idlePromise = undefined;
            resolveIdle = undefined;
        }
    };
    const processQueue = () => {
        if (processing) {
            return;
        }
        const task = tasks.shift();
        if (!task) {
            notifyIdle();
            return;
        }
        processing = true;
        void (async () => {
            try {
                await task();
            }
            catch {
                // Individual enqueue promises handle their own rejections.
            }
            finally {
                processing = false;
                notifyIdle();
                processQueue();
            }
        })();
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
                tasks.push(async () => {
                    try {
                        await wrapped();
                    }
                    catch {
                        // wrapped already rejected—swallow to keep the queue alive.
                    }
                });
                processQueue();
            });
        },
        onIdle() {
            if (!processing && tasks.length === 0) {
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
            return tasks.length + (processing ? 1 : 0);
        }
    };
}
//# sourceMappingURL=async-queue.js.map