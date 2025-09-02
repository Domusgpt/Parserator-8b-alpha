"use strict";
/**
 * Rate limiter implementation for API calls
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SlidingWindowRateLimiter = exports.RateLimiter = void 0;
class RateLimiter {
    constructor(config) {
        this.maxTokens = config.burstSize || config.requestsPerSecond;
        this.refillRate = config.requestsPerSecond / 1000; // per millisecond
        this.tokens = this.maxTokens;
        this.lastRefillTime = Date.now();
    }
    /**
     * Acquire a token (wait if necessary)
     */
    async acquire(tokensNeeded = 1) {
        this.refillTokens();
        if (this.tokens >= tokensNeeded) {
            this.tokens -= tokensNeeded;
            return;
        }
        // Calculate how long to wait for enough tokens
        const tokensToWaitFor = tokensNeeded - this.tokens;
        const waitTimeMs = tokensToWaitFor / this.refillRate;
        await this.sleep(waitTimeMs);
        // Refill again after waiting
        this.refillTokens();
        this.tokens -= tokensNeeded;
    }
    /**
     * Try to acquire tokens without waiting
     */
    tryAcquire(tokensNeeded = 1) {
        this.refillTokens();
        if (this.tokens >= tokensNeeded) {
            this.tokens -= tokensNeeded;
            return true;
        }
        return false;
    }
    /**
     * Get current number of available tokens
     */
    getAvailableTokens() {
        this.refillTokens();
        return this.tokens;
    }
    refillTokens() {
        const now = Date.now();
        const timePassed = now - this.lastRefillTime;
        const tokensToAdd = timePassed * this.refillRate;
        this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
        this.lastRefillTime = now;
    }
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
exports.RateLimiter = RateLimiter;
/**
 * Sliding window rate limiter for more precise control
 */
class SlidingWindowRateLimiter {
    constructor(maxRequests, windowMs) {
        this.maxRequests = maxRequests;
        this.windowMs = windowMs;
        this.requests = [];
    }
    async acquire() {
        const now = Date.now();
        // Remove old requests outside the window
        this.requests = this.requests.filter(time => now - time < this.windowMs);
        if (this.requests.length < this.maxRequests) {
            this.requests.push(now);
            return;
        }
        // Calculate when the oldest request will expire
        const oldestRequest = this.requests[0];
        const waitTime = this.windowMs - (now - oldestRequest);
        await this.sleep(waitTime);
        // Try again after waiting
        return this.acquire();
    }
    tryAcquire() {
        const now = Date.now();
        // Remove old requests outside the window
        this.requests = this.requests.filter(time => now - time < this.windowMs);
        if (this.requests.length < this.maxRequests) {
            this.requests.push(now);
            return true;
        }
        return false;
    }
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
exports.SlidingWindowRateLimiter = SlidingWindowRateLimiter;
//# sourceMappingURL=rate-limiter.js.map