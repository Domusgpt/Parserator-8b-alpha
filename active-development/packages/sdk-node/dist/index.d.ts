/**
 * @parserator/node-sdk - Official Node.js SDK for Parserator
 *
 * Transform any unstructured data into clean, structured JSON using AI.
 * Built on the revolutionary Architect-Extractor pattern for maximum efficiency.
 */
export { ParseratorClient } from './services/ParseratorClient';
export { ParseRequest, ParseResponse, ParseOptions, ParseMetadata, ParseratorConfig, BatchParseRequest, BatchParseResponse, BatchOptions, SearchStep, SearchPlan, ValidationType, ParseError, ErrorCode, ProgressCallback, EventHandler, ParseEvent, RetryConfig, SchemaTemplate, SchemaValidationResult, SchemaValidationError, ParsePreset, AdvancedConfig } from './types';
export { ParseratorError, ValidationError, AuthenticationError, RateLimitError, QuotaExceededError, NetworkError, TimeoutError, ParseFailedError, ServiceUnavailableError, ErrorFactory } from './errors';
export { EMAIL_PARSER, INVOICE_PARSER, CONTACT_PARSER, CSV_PARSER, LOG_PARSER, DOCUMENT_PARSER, ALL_PRESETS, getPresetByName, getPresetsByTag, listAvailablePresets } from './types/presets';
export { validateParseRequest, validateConfig, validateOutputSchema, validateSchemaStructure, validateInputData, isValidationType, isValidApiKey, isValidUrl, getValidationErrorMessage } from './types/validation';
export { retry, retryWithCondition, CircuitBreaker } from './utils/retry';
export { RateLimiter, SlidingWindowRateLimiter } from './utils/rate-limiter';
import { ParseratorClient } from './services/ParseratorClient';
import { ParseratorConfig, ParseResponse } from './types';
export default ParseratorClient;
/**
 * Create a new Parserator client instance
 */
export declare function createClient(config: ParseratorConfig): ParseratorClient;
/**
 * Quick parse function for simple use cases
 */
export declare function quickParse(apiKey: string, inputData: string, outputSchema: Record<string, any>, instructions?: string): Promise<ParseResponse>;
/**
 * SDK version
 */
export declare const VERSION = "1.0.0";
/**
 * SDK information
 */
export declare const SDK_INFO: {
    name: string;
    version: string;
    description: string;
    author: string;
    repository: string;
    documentation: string;
};
//# sourceMappingURL=index.d.ts.map