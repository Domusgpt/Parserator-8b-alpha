/**
 * Rate limiter implementation for API calls
 */

export interface RateLimiterConfig {
  requestsPerSecond: number;
  burstSize?: number;
}

export class RateLimiter {
  private tokens: number;
  private lastRefillTime: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per millisecond
  
  constructor(config: RateLimiterConfig) {
    this.maxTokens = config.burstSize || config.requestsPerSecond;
    this.refillRate = config.requestsPerSecond / 1000; // per millisecond
    this.tokens = this.maxTokens;
    this.lastRefillTime = Date.now();
  }
  
  /**
   * Acquire a token (wait if necessary)
   */
  async acquire(tokensNeeded: number = 1): Promise<void> {
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
  tryAcquire(tokensNeeded: number = 1): boolean {
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
  getAvailableTokens(): number {
    this.refillTokens();
    return this.tokens;
  }
  
  private refillTokens(): void {
    const now = Date.now();
    const timePassed = now - this.lastRefillTime;
    const tokensToAdd = timePassed * this.refillRate;
    
    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefillTime = now;
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Sliding window rate limiter for more precise control
 */
export class SlidingWindowRateLimiter {
  private requests: number[] = [];
  
  constructor(
    private readonly maxRequests: number,
    private readonly windowMs: number
  ) {}
  
  async acquire(): Promise<void> {
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
  
  tryAcquire(): boolean {
    const now = Date.now();
    
    // Remove old requests outside the window
    this.requests = this.requests.filter(time => now - time < this.windowMs);
    
    if (this.requests.length < this.maxRequests) {
      this.requests.push(now);
      return true;
    }
    
    return false;
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
