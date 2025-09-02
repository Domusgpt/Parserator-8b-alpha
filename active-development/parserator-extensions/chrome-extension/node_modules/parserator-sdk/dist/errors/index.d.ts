/**
 * Custom error classes for the Parserator SDK
 */
import { ErrorCode, ParseError } from '../types';
/**
 * Base error class for all Parserator SDK errors
 */
export declare class ParseratorError extends Error implements ParseError {
    readonly code: ErrorCode;
    readonly details?: Record<string, any>;
    readonly suggestion?: string;
    constructor(code: ErrorCode, message: string, details?: Record<string, any>, suggestion?: string);
    /**
     * Create error from API response
     */
    static fromApiResponse(data: any, status?: number): ParseratorError;
    /**
     * Convert to plain object for serialization
     */
    toJSON(): ParseError;
    /**
     * Get user-friendly error message with suggestion
     */
    getDisplayMessage(): string;
}
/**
 * Validation error for invalid input data
 */
export declare class ValidationError extends ParseratorError {
    constructor(message: string, details?: Record<string, any>);
}
/**
 * Authentication error for invalid API keys
 */
export declare class AuthenticationError extends ParseratorError {
    constructor(message?: string);
}
/**
 * Rate limiting error
 */
export declare class RateLimitError extends ParseratorError {
    readonly retryAfter?: number;
    constructor(message?: string, retryAfter?: number);
}
/**
 * Quota exceeded error
 */
export declare class QuotaExceededError extends ParseratorError {
    constructor(message?: string);
}
/**
 * Network connectivity error
 */
export declare class NetworkError extends ParseratorError {
    constructor(message?: string);
}
/**
 * Timeout error for requests that take too long
 */
export declare class TimeoutError extends ParseratorError {
    constructor(timeout: number);
}
/**
 * Parse operation failed error
 */
export declare class ParseFailedError extends ParseratorError {
    constructor(message: string, details?: Record<string, any>);
}
/**
 * Service unavailable error
 */
export declare class ServiceUnavailableError extends ParseratorError {
    constructor(message?: string);
}
/**
 * Error factory for creating appropriate error types
 */
export declare class ErrorFactory {
    static createFromCode(code: ErrorCode, message: string, details?: Record<string, any>): ParseratorError;
}
export default ParseratorError;
//# sourceMappingURL=index.d.ts.map