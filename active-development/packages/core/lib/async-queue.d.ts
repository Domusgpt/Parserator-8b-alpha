export interface AsyncTaskQueue {
    enqueue<T>(task: () => Promise<T> | T): Promise<T>;
    onIdle(): Promise<void>;
}
export declare function createAsyncTaskQueue(): AsyncTaskQueue;
//# sourceMappingURL=async-queue.d.ts.map