export interface AsyncTaskQueue {
    enqueue<T>(task: () => Promise<T> | T): Promise<T>;
    onIdle(): Promise<void>;
    size(): number;
}
export declare function createAsyncTaskQueue(): AsyncTaskQueue;
//# sourceMappingURL=async-queue.d.ts.map