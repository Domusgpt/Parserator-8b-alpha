/**
 * Rate limiter implementation for API calls
 */
export interface RateLimiterConfig {
    requestsPerSecond: number;
    burstSize?: number;
}
export declare class RateLimiter {
    private tokens;
    private lastRefillTime;
    private readonly maxTokens;
    private readonly refillRate;
    constructor(config: RateLimiterConfig);
    /**
     * Acquire a token (wait if necessary)
     */
    acquire(tokensNeeded?: number): Promise<void>;
    /**
     * Try to acquire tokens without waiting
     */
    tryAcquire(tokensNeeded?: number): boolean;
    /**
     * Get current number of available tokens
     */
    getAvailableTokens(): number;
    private refillTokens;
    private sleep;
}
/**
 * Sliding window rate limiter for more precise control
 */
export declare class SlidingWindowRateLimiter {
    private readonly maxRequests;
    private readonly windowMs;
    private requests;
    constructor(maxRequests: number, windowMs: number);
    acquire(): Promise<void>;
    tryAcquire(): boolean;
    private sleep;
}
//# sourceMappingURL=rate-limiter.d.ts.map