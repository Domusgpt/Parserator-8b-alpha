/**
 * Retry utility with exponential backoff for network requests
 */
import { RetryConfig } from '../types';
/**
 * Retry a function with exponential backoff
 */
export declare function retry<T>(fn: () => Promise<T>, config: RetryConfig): Promise<T>;
/**
 * Retry with custom condition function
 */
export declare function retryWithCondition<T>(fn: () => Promise<T>, shouldRetryFn: (error: any, attempt: number) => boolean, config: RetryConfig): Promise<T>;
/**
 * Circuit breaker pattern for retry logic
 */
export declare class CircuitBreaker {
    private readonly failureThreshold;
    private readonly recoveryTimeMs;
    private failureCount;
    private lastFailureTime;
    private state;
    constructor(failureThreshold?: number, recoveryTimeMs?: number);
    execute<T>(fn: () => Promise<T>): Promise<T>;
    private recordFailure;
    private reset;
    getState(): string;
}
//# sourceMappingURL=retry.d.ts.map