"use strict";
/**
 * Retry utility with exponential backoff for network requests
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CircuitBreaker = void 0;
exports.retry = retry;
exports.retryWithCondition = retryWithCondition;
/**
 * Retry a function with exponential backoff
 */
async function retry(fn, config) {
    const { maxRetries, baseDelay, maxDelay, backoffFactor } = config;
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        }
        catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            // Don't retry on the last attempt
            if (attempt === maxRetries) {
                break;
            }
            // Don't retry certain types of errors
            if (!shouldRetry(error)) {
                break;
            }
            // Calculate delay with exponential backoff
            const delay = Math.min(baseDelay * Math.pow(backoffFactor, attempt), maxDelay);
            // Add jitter to prevent thundering herd
            const jitteredDelay = delay + Math.random() * 1000;
            await sleep(jitteredDelay);
        }
    }
    throw lastError;
}
/**
 * Determine if an error should be retried
 */
function shouldRetry(error) {
    // Network errors should be retried
    if (error.code === 'ECONNRESET' || error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        return true;
    }
    // Axios errors
    if (error.response) {
        const status = error.response.status;
        // Retry on server errors (5xx)
        if (status >= 500) {
            return true;
        }
        // Retry on rate limiting (429)
        if (status === 429) {
            return true;
        }
        // Don't retry on client errors (4xx) except 429
        if (status >= 400 && status < 500) {
            return false;
        }
    }
    // Retry on timeout errors
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        return true;
    }
    // Default to retrying for unknown errors
    return true;
}
/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
/**
 * Retry with custom condition function
 */
async function retryWithCondition(fn, shouldRetryFn, config) {
    const { maxRetries, baseDelay, maxDelay, backoffFactor } = config;
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        }
        catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            // Don't retry on the last attempt
            if (attempt === maxRetries) {
                break;
            }
            // Check custom retry condition
            if (!shouldRetryFn(error, attempt)) {
                break;
            }
            // Calculate delay with exponential backoff
            const delay = Math.min(baseDelay * Math.pow(backoffFactor, attempt), maxDelay);
            // Add jitter
            const jitteredDelay = delay + Math.random() * 1000;
            await sleep(jitteredDelay);
        }
    }
    throw lastError;
}
/**
 * Circuit breaker pattern for retry logic
 */
class CircuitBreaker {
    constructor(failureThreshold = 5, recoveryTimeMs = 60000) {
        this.failureThreshold = failureThreshold;
        this.recoveryTimeMs = recoveryTimeMs;
        this.failureCount = 0;
        this.lastFailureTime = 0;
        this.state = 'CLOSED';
    }
    async execute(fn) {
        if (this.state === 'OPEN') {
            if (Date.now() - this.lastFailureTime >= this.recoveryTimeMs) {
                this.state = 'HALF_OPEN';
            }
            else {
                throw new Error('Circuit breaker is OPEN');
            }
        }
        try {
            const result = await fn();
            if (this.state === 'HALF_OPEN') {
                this.reset();
            }
            return result;
        }
        catch (error) {
            this.recordFailure();
            throw error;
        }
    }
    recordFailure() {
        this.failureCount++;
        this.lastFailureTime = Date.now();
        if (this.failureCount >= this.failureThreshold) {
            this.state = 'OPEN';
        }
    }
    reset() {
        this.failureCount = 0;
        this.state = 'CLOSED';
    }
    getState() {
        return this.state;
    }
}
exports.CircuitBreaker = CircuitBreaker;
//# sourceMappingURL=retry.js.map