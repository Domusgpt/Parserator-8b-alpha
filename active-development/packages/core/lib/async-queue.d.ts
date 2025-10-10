export interface AsyncTaskQueueMetrics {
    pending: number;
    inFlight: number;
    completed: number;
    failed: number;
    lastError?: unknown;
    lastDurationMs?: number;
}
export interface AsyncTaskQueueOptions {
    concurrency?: number;
    onError?: (error: unknown) => void;
    now?: () => number;
}
export interface AsyncTaskQueue {
    enqueue<T>(task: () => Promise<T> | T): Promise<T>;
    onIdle(): Promise<void>;
    size(): number;
    metrics(): AsyncTaskQueueMetrics;
}
export declare function createAsyncTaskQueue(options?: AsyncTaskQueueOptions): AsyncTaskQueue;
//# sourceMappingURL=async-queue.d.ts.map