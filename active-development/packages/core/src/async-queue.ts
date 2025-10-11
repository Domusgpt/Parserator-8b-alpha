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

interface InternalTask {
  run(): Promise<void>;
}

export function createAsyncTaskQueue(options: AsyncTaskQueueOptions = {}): AsyncTaskQueue {
  const pending: InternalTask[] = [];
  const { onError, now = () => Date.now() } = options;
  const concurrency = Math.max(1, Math.floor(options.concurrency ?? 1));
  let inFlight = 0;
  let completed = 0;
  let failed = 0;
  let lastError: unknown;
  let lastDurationMs: number | undefined;
  let idlePromise: Promise<void> | undefined;
  let resolveIdle: (() => void) | undefined;

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
    enqueue<T>(task: () => Promise<T> | T): Promise<T> {
      return new Promise<T>((resolve, reject) => {
        const wrapped = async () => {
          try {
            const result = await task();
            resolve(result);
          } catch (error) {
            reject(error);
            throw error;
          }
        };

        pending.push({
          async run() {
            try {
              await wrapped();
            } catch (error) {
              // wrapped already rejected—swallow to keep the queue alive.
              throw error;
            }
          }
        });

        processQueue();
      });
    },
    onIdle(): Promise<void> {
      if (pending.length === 0 && inFlight === 0) {
        return Promise.resolve();
      }

      if (!idlePromise) {
        idlePromise = new Promise<void>(resolve => {
          resolveIdle = resolve;
        });
      }

      return idlePromise;
    },
    size(): number {
      return pending.length + inFlight;
    },
    metrics(): AsyncTaskQueueMetrics {
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
