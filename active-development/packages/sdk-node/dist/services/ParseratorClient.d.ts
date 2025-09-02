/**
 * Main Parserator SDK Client
 * Implements the Architect-Extractor pattern for intelligent data parsing
 */
import { ParseratorConfig, ParseRequest, ParseResponse, BatchParseRequest, BatchParseResponse, EventHandler, ProgressCallback } from '../types';
export declare class ParseratorClient {
    private readonly axios;
    private readonly config;
    private readonly rateLimiter;
    private eventHandlers;
    constructor(config: ParseratorConfig);
    /**
     * Parse unstructured data using the Architect-Extractor pattern
     */
    parse(request: ParseRequest): Promise<ParseResponse>;
    /**
     * Parse multiple items in batch with concurrency control
     */
    batchParse(request: BatchParseRequest, progressCallback?: ProgressCallback): Promise<BatchParseResponse>;
    /**
     * Test API connectivity and authentication
     */
    testConnection(): Promise<{
        success: boolean;
        latency: number;
        quotaRemaining?: number;
        error?: string;
    }>;
    /**
     * Get account usage statistics
     */
    getUsage(): Promise<{
        requestsThisMonth: number;
        tokensUsedThisMonth: number;
        quotaLimit: number;
        quotaRemaining: number;
        billingPeriod: {
            start: string;
            end: string;
        };
    }>;
    /**
     * Add event handler for monitoring parse operations
     */
    addEventListener(handler: EventHandler): void;
    /**
     * Remove event handler
     */
    removeEventListener(handler: EventHandler): void;
    /**
     * Update configuration
     */
    updateConfig(newConfig: Partial<ParseratorConfig>): void;
    private setupInterceptors;
    private emitEvent;
    private handleAxiosError;
    private getRetryConfig;
}
//# sourceMappingURL=ParseratorClient.d.ts.map