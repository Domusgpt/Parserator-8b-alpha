export interface AsyncTaskQueue {
  enqueue<T>(task: () => Promise<T> | T): Promise<T>;
  onIdle(): Promise<void>;
  size(): number;
}

export function createAsyncTaskQueue(): AsyncTaskQueue {
  const tasks: Array<() => Promise<void>> = [];
  let processing = false;
  let idlePromise: Promise<void> | undefined;
  let resolveIdle: (() => void) | undefined;

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
      } catch {
        // Individual enqueue promises handle their own rejections.
      } finally {
        processing = false;
        notifyIdle();
        processQueue();
      }
    })();
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

        tasks.push(async () => {
          try {
            await wrapped();
          } catch {
            // wrapped already rejected—swallow to keep the queue alive.
          }
        });

        processQueue();
      });
    },
    onIdle(): Promise<void> {
      if (!processing && tasks.length === 0) {
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
      return tasks.length + (processing ? 1 : 0);
    }
  };
}
