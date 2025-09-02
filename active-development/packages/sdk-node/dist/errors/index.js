"use strict";
/**
 * Custom error classes for the Parserator SDK
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorFactory = exports.ServiceUnavailableError = exports.ParseFailedError = exports.TimeoutError = exports.NetworkError = exports.QuotaExceededError = exports.RateLimitError = exports.AuthenticationError = exports.ValidationError = exports.ParseratorError = void 0;
/**
 * Base error class for all Parserator SDK errors
 */
class ParseratorError extends Error {
    constructor(code, message, details, suggestion) {
        super(message);
        this.name = 'ParseratorError';
        this.code = code;
        this.details = details;
        this.suggestion = suggestion;
        // Maintains proper stack trace for where our error was thrown (only available on V8)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, ParseratorError);
        }
    }
    /**
     * Create error from API response
     */
    static fromApiResponse(data, status) {
        return new ParseratorError(data.code || 'INTERNAL_ERROR', data.message || 'An unexpected error occurred', { ...data.details, status }, data.suggestion);
    }
    /**
     * Convert to plain object for serialization
     */
    toJSON() {
        return {
            code: this.code,
            message: this.message,
            details: this.details,
            suggestion: this.suggestion
        };
    }
    /**
     * Get user-friendly error message with suggestion
     */
    getDisplayMessage() {
        let message = this.message;
        if (this.suggestion) {
            message += ` Suggestion: ${this.suggestion}`;
        }
        return message;
    }
}
exports.ParseratorError = ParseratorError;
/**
 * Validation error for invalid input data
 */
class ValidationError extends ParseratorError {
    constructor(message, details) {
        super('INVALID_INPUT', `Validation failed: ${message}`, details, 'Please check your input data and try again');
        this.name = 'ValidationError';
    }
}
exports.ValidationError = ValidationError;
/**
 * Authentication error for invalid API keys
 */
class AuthenticationError extends ParseratorError {
    constructor(message = 'Invalid API key') {
        super('INVALID_API_KEY', message, undefined, 'Please check that your API key is correct and has the required permissions');
        this.name = 'AuthenticationError';
    }
}
exports.AuthenticationError = AuthenticationError;
/**
 * Rate limiting error
 */
class RateLimitError extends ParseratorError {
    constructor(message = 'Rate limit exceeded', retryAfter) {
        super('RATE_LIMIT_EXCEEDED', message, { retryAfter }, retryAfter
            ? `Please wait ${retryAfter} seconds before making another request`
            : 'Please slow down your request rate');
        this.name = 'RateLimitError';
        this.retryAfter = retryAfter;
    }
}
exports.RateLimitError = RateLimitError;
/**
 * Quota exceeded error
 */
class QuotaExceededError extends ParseratorError {
    constructor(message = 'API quota exceeded') {
        super('QUOTA_EXCEEDED', message, undefined, 'Please upgrade your plan or wait for your quota to reset');
        this.name = 'QuotaExceededError';
    }
}
exports.QuotaExceededError = QuotaExceededError;
/**
 * Network connectivity error
 */
class NetworkError extends ParseratorError {
    constructor(message = 'Network error') {
        super('NETWORK_ERROR', message, undefined, 'Please check your internet connection and try again');
        this.name = 'NetworkError';
    }
}
exports.NetworkError = NetworkError;
/**
 * Timeout error for requests that take too long
 */
class TimeoutError extends ParseratorError {
    constructor(timeout) {
        super('TIMEOUT', `Request timed out after ${timeout}ms`, { timeout }, 'Try increasing the timeout value or reducing the size of your input data');
        this.name = 'TimeoutError';
    }
}
exports.TimeoutError = TimeoutError;
/**
 * Parse operation failed error
 */
class ParseFailedError extends ParseratorError {
    constructor(message, details) {
        super('PARSE_FAILED', message, details, 'Try adjusting your output schema or providing clearer instructions');
        this.name = 'ParseFailedError';
    }
}
exports.ParseFailedError = ParseFailedError;
/**
 * Service unavailable error
 */
class ServiceUnavailableError extends ParseratorError {
    constructor(message = 'Service temporarily unavailable') {
        super('SERVICE_UNAVAILABLE', message, undefined, 'Please try again in a few moments');
        this.name = 'ServiceUnavailableError';
    }
}
exports.ServiceUnavailableError = ServiceUnavailableError;
/**
 * Error factory for creating appropriate error types
 */
class ErrorFactory {
    static createFromCode(code, message, details) {
        switch (code) {
            case 'INVALID_API_KEY':
                return new AuthenticationError(message);
            case 'RATE_LIMIT_EXCEEDED':
                return new RateLimitError(message, details?.retryAfter);
            case 'QUOTA_EXCEEDED':
                return new QuotaExceededError(message);
            case 'NETWORK_ERROR':
                return new NetworkError(message);
            case 'TIMEOUT':
                return new TimeoutError(details?.timeout || 30000);
            case 'PARSE_FAILED':
                return new ParseFailedError(message, details);
            case 'SERVICE_UNAVAILABLE':
                return new ServiceUnavailableError(message);
            case 'INVALID_INPUT':
            case 'INVALID_SCHEMA':
            case 'VALIDATION_FAILED':
                return new ValidationError(message, details);
            default:
                return new ParseratorError(code, message, details);
        }
    }
}
exports.ErrorFactory = ErrorFactory;
// Export default
exports.default = ParseratorError;
//# sourceMappingURL=index.js.map