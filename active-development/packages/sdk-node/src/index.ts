/**
 * @parserator/node-sdk - Official Node.js SDK for Parserator
 * 
 * Transform any unstructured data into clean, structured JSON using AI.
 * Built on the revolutionary Architect-Extractor pattern for maximum efficiency.
 */

// Main client export
export { ParseratorClient } from './services/ParseratorClient';

// Type exports
export {
  // Core types
  ParseRequest,
  ParseResponse,
  ParseOptions,
  ParseMetadata,
  ParseratorConfig,
  
  // Batch processing
  BatchParseRequest,
  BatchParseResponse,
  BatchOptions,
  
  // Architect-Extractor pattern
  SearchStep,
  SearchPlan,
  ValidationType,
  
  // Error types
  ParseError,
  ErrorCode,
  
  // Utility types
  ProgressCallback,
  EventHandler,
  ParseEvent,
  RetryConfig,
  
  // Schema types
  SchemaTemplate,
  SchemaValidationResult,
  SchemaValidationError,
  
  // Advanced types
  ParsePreset,
  AdvancedConfig
} from './types';

// Error exports
export {
  ParseratorError,
  ValidationError,
  AuthenticationError,
  RateLimitError,
  QuotaExceededError,
  NetworkError,
  TimeoutError,
  ParseFailedError,
  ServiceUnavailableError,
  ErrorFactory
} from './errors';

// Preset exports
export {
  EMAIL_PARSER,
  INVOICE_PARSER,
  CONTACT_PARSER,
  CSV_PARSER,
  LOG_PARSER,
  DOCUMENT_PARSER,
  ALL_PRESETS,
  getPresetByName,
  getPresetsByTag,
  listAvailablePresets
} from './types/presets';

// Validation utilities
export {
  validateParseRequest,
  validateConfig,
  validateOutputSchema,
  validateSchemaStructure,
  validateInputData,
  isValidationType,
  isValidApiKey,
  isValidUrl,
  getValidationErrorMessage
} from './types/validation';

// Utility exports
export { retry, retryWithCondition, CircuitBreaker } from './utils/retry';
export { RateLimiter, SlidingWindowRateLimiter } from './utils/rate-limiter';

import { ParseratorClient } from './services/ParseratorClient';
import { ParseratorConfig, ParseRequest, ParseResponse } from './types';

// Default export
export default ParseratorClient;

/**
 * Create a new Parserator client instance
 */
export function createClient(config: ParseratorConfig): ParseratorClient {
  return new ParseratorClient(config);
}

/**
 * Quick parse function for simple use cases
 */
export async function quickParse(
  apiKey: string,
  inputData: string,
  outputSchema: Record<string, any>,
  instructions?: string
): Promise<ParseResponse> {
  const client = new ParseratorClient({ apiKey });
  return client.parse({
    inputData,
    outputSchema,
    instructions
  });
}

/**
 * SDK version
 */
export const VERSION = '1.0.0';

/**
 * SDK information
 */
export const SDK_INFO = {
  name: '@parserator/node-sdk',
  version: VERSION,
  description: 'Official Node.js SDK for Parserator - Intelligent data parsing using the Architect-Extractor pattern',
  author: 'Paul Phillips',
  repository: 'https://github.com/domusgpt/parserator',
  documentation: 'https://parserator.com/docs/sdk/node'
};
