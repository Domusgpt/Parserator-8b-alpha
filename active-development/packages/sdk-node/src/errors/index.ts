/**
 * Custom error classes for the Parserator SDK
 */

import { ErrorCode, ParseError } from '../types';

/**
 * Base error class for all Parserator SDK errors
 */
export class ParseratorError extends Error implements ParseError {
  public readonly code: ErrorCode;
  public readonly details?: Record<string, any>;
  public readonly suggestion?: string;

  constructor(
    code: ErrorCode,
    message: string,
    details?: Record<string, any>,
    suggestion?: string
  ) {
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
  static fromApiResponse(data: any, status?: number): ParseratorError {
    return new ParseratorError(
      data.code || 'INTERNAL_ERROR',
      data.message || 'An unexpected error occurred',
      { ...data.details, status },
      data.suggestion
    );
  }

  /**
   * Convert to plain object for serialization
   */
  toJSON(): ParseError {
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
  getDisplayMessage(): string {
    let message = this.message;
    if (this.suggestion) {
      message += ` Suggestion: ${this.suggestion}`;
    }
    return message;
  }
}

/**
 * Validation error for invalid input data
 */
export class ValidationError extends ParseratorError {
  constructor(message: string, details?: Record<string, any>) {
    super(
      'INVALID_INPUT',
      `Validation failed: ${message}`,
      details,
      'Please check your input data and try again'
    );
    this.name = 'ValidationError';
  }
}

/**
 * Authentication error for invalid API keys
 */
export class AuthenticationError extends ParseratorError {
  constructor(message: string = 'Invalid API key') {
    super(
      'INVALID_API_KEY',
      message,
      undefined,
      'Please check that your API key is correct and has the required permissions'
    );
    this.name = 'AuthenticationError';
  }
}

/**
 * Rate limiting error
 */
export class RateLimitError extends ParseratorError {
  public readonly retryAfter?: number;

  constructor(message: string = 'Rate limit exceeded', retryAfter?: number) {
    super(
      'RATE_LIMIT_EXCEEDED',
      message,
      { retryAfter },
      retryAfter 
        ? `Please wait ${retryAfter} seconds before making another request`
        : 'Please slow down your request rate'
    );
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

/**
 * Quota exceeded error
 */
export class QuotaExceededError extends ParseratorError {
  constructor(message: string = 'API quota exceeded') {
    super(
      'QUOTA_EXCEEDED',
      message,
      undefined,
      'Please upgrade your plan or wait for your quota to reset'
    );
    this.name = 'QuotaExceededError';
  }
}

/**
 * Network connectivity error
 */
export class NetworkError extends ParseratorError {
  constructor(message: string = 'Network error') {
    super(
      'NETWORK_ERROR',
      message,
      undefined,
      'Please check your internet connection and try again'
    );
    this.name = 'NetworkError';
  }
}

/**
 * Timeout error for requests that take too long
 */
export class TimeoutError extends ParseratorError {
  constructor(timeout: number) {
    super(
      'TIMEOUT',
      `Request timed out after ${timeout}ms`,
      { timeout },
      'Try increasing the timeout value or reducing the size of your input data'
    );
    this.name = 'TimeoutError';
  }
}

/**
 * Parse operation failed error
 */
export class ParseFailedError extends ParseratorError {
  constructor(message: string, details?: Record<string, any>) {
    super(
      'PARSE_FAILED',
      message,
      details,
      'Try adjusting your output schema or providing clearer instructions'
    );
    this.name = 'ParseFailedError';
  }
}

/**
 * Service unavailable error
 */
export class ServiceUnavailableError extends ParseratorError {
  constructor(message: string = 'Service temporarily unavailable') {
    super(
      'SERVICE_UNAVAILABLE',
      message,
      undefined,
      'Please try again in a few moments'
    );
    this.name = 'ServiceUnavailableError';
  }
}

/**
 * Error factory for creating appropriate error types
 */
export class ErrorFactory {
  static createFromCode(code: ErrorCode, message: string, details?: Record<string, any>): ParseratorError {
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

// Export default
export default ParseratorError;
