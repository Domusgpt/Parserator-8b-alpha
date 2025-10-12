"use strict";
/**
 * @parserator/node-sdk - Official Node.js SDK for Parserator
 *
 * Transform any unstructured data into clean, structured JSON using AI.
 * Built on the revolutionary Architect-Extractor pattern for maximum efficiency.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SDK_INFO = exports.VERSION = exports.SlidingWindowRateLimiter = exports.RateLimiter = exports.CircuitBreaker = exports.retryWithCondition = exports.retry = exports.getValidationErrorMessage = exports.isValidUrl = exports.isValidApiKey = exports.isValidationType = exports.validateInputData = exports.validateSchemaStructure = exports.validateOutputSchema = exports.validateConfig = exports.validateParseRequest = exports.listAvailablePresets = exports.getPresetsByTag = exports.getPresetByName = exports.ALL_PRESETS = exports.DOCUMENT_PARSER = exports.LOG_PARSER = exports.CSV_PARSER = exports.CONTACT_PARSER = exports.INVOICE_PARSER = exports.EMAIL_PARSER = exports.ErrorFactory = exports.ServiceUnavailableError = exports.ParseFailedError = exports.TimeoutError = exports.NetworkError = exports.QuotaExceededError = exports.RateLimitError = exports.AuthenticationError = exports.ValidationError = exports.ParseratorError = exports.ParseratorClient = void 0;
exports.createClient = createClient;
exports.quickParse = quickParse;
// Main client export
var ParseratorClient_1 = require("./services/ParseratorClient");
Object.defineProperty(exports, "ParseratorClient", { enumerable: true, get: function () { return ParseratorClient_1.ParseratorClient; } });
// Error exports
var errors_1 = require("./errors");
Object.defineProperty(exports, "ParseratorError", { enumerable: true, get: function () { return errors_1.ParseratorError; } });
Object.defineProperty(exports, "ValidationError", { enumerable: true, get: function () { return errors_1.ValidationError; } });
Object.defineProperty(exports, "AuthenticationError", { enumerable: true, get: function () { return errors_1.AuthenticationError; } });
Object.defineProperty(exports, "RateLimitError", { enumerable: true, get: function () { return errors_1.RateLimitError; } });
Object.defineProperty(exports, "QuotaExceededError", { enumerable: true, get: function () { return errors_1.QuotaExceededError; } });
Object.defineProperty(exports, "NetworkError", { enumerable: true, get: function () { return errors_1.NetworkError; } });
Object.defineProperty(exports, "TimeoutError", { enumerable: true, get: function () { return errors_1.TimeoutError; } });
Object.defineProperty(exports, "ParseFailedError", { enumerable: true, get: function () { return errors_1.ParseFailedError; } });
Object.defineProperty(exports, "ServiceUnavailableError", { enumerable: true, get: function () { return errors_1.ServiceUnavailableError; } });
Object.defineProperty(exports, "ErrorFactory", { enumerable: true, get: function () { return errors_1.ErrorFactory; } });
// Preset exports
var presets_1 = require("./types/presets");
Object.defineProperty(exports, "EMAIL_PARSER", { enumerable: true, get: function () { return presets_1.EMAIL_PARSER; } });
Object.defineProperty(exports, "INVOICE_PARSER", { enumerable: true, get: function () { return presets_1.INVOICE_PARSER; } });
Object.defineProperty(exports, "CONTACT_PARSER", { enumerable: true, get: function () { return presets_1.CONTACT_PARSER; } });
Object.defineProperty(exports, "CSV_PARSER", { enumerable: true, get: function () { return presets_1.CSV_PARSER; } });
Object.defineProperty(exports, "LOG_PARSER", { enumerable: true, get: function () { return presets_1.LOG_PARSER; } });
Object.defineProperty(exports, "DOCUMENT_PARSER", { enumerable: true, get: function () { return presets_1.DOCUMENT_PARSER; } });
Object.defineProperty(exports, "ALL_PRESETS", { enumerable: true, get: function () { return presets_1.ALL_PRESETS; } });
Object.defineProperty(exports, "getPresetByName", { enumerable: true, get: function () { return presets_1.getPresetByName; } });
Object.defineProperty(exports, "getPresetsByTag", { enumerable: true, get: function () { return presets_1.getPresetsByTag; } });
Object.defineProperty(exports, "listAvailablePresets", { enumerable: true, get: function () { return presets_1.listAvailablePresets; } });
// Validation utilities
var validation_1 = require("./types/validation");
Object.defineProperty(exports, "validateParseRequest", { enumerable: true, get: function () { return validation_1.validateParseRequest; } });
Object.defineProperty(exports, "validateConfig", { enumerable: true, get: function () { return validation_1.validateConfig; } });
Object.defineProperty(exports, "validateOutputSchema", { enumerable: true, get: function () { return validation_1.validateOutputSchema; } });
Object.defineProperty(exports, "validateSchemaStructure", { enumerable: true, get: function () { return validation_1.validateSchemaStructure; } });
Object.defineProperty(exports, "validateInputData", { enumerable: true, get: function () { return validation_1.validateInputData; } });
Object.defineProperty(exports, "isValidationType", { enumerable: true, get: function () { return validation_1.isValidationType; } });
Object.defineProperty(exports, "isValidApiKey", { enumerable: true, get: function () { return validation_1.isValidApiKey; } });
Object.defineProperty(exports, "isValidUrl", { enumerable: true, get: function () { return validation_1.isValidUrl; } });
Object.defineProperty(exports, "getValidationErrorMessage", { enumerable: true, get: function () { return validation_1.getValidationErrorMessage; } });
// Utility exports
var retry_1 = require("./utils/retry");
Object.defineProperty(exports, "retry", { enumerable: true, get: function () { return retry_1.retry; } });
Object.defineProperty(exports, "retryWithCondition", { enumerable: true, get: function () { return retry_1.retryWithCondition; } });
Object.defineProperty(exports, "CircuitBreaker", { enumerable: true, get: function () { return retry_1.CircuitBreaker; } });
var rate_limiter_1 = require("./utils/rate-limiter");
Object.defineProperty(exports, "RateLimiter", { enumerable: true, get: function () { return rate_limiter_1.RateLimiter; } });
Object.defineProperty(exports, "SlidingWindowRateLimiter", { enumerable: true, get: function () { return rate_limiter_1.SlidingWindowRateLimiter; } });
const ParseratorClient_2 = require("./services/ParseratorClient");
// Default export
exports.default = ParseratorClient_2.ParseratorClient;
/**
 * Create a new Parserator client instance
 */
function createClient(config) {
    return new ParseratorClient_2.ParseratorClient(config);
}
/**
 * Quick parse function for simple use cases
 */
async function quickParse(apiKey, inputData, outputSchema, instructions) {
    const client = new ParseratorClient_2.ParseratorClient({
        apiKey,
        timeout: 10000,
        retries: 0
    });
    return client.parse({
        inputData,
        outputSchema,
        instructions
    });
}
/**
 * SDK version
 */
exports.VERSION = '1.0.0';
/**
 * SDK information
 */
exports.SDK_INFO = {
    name: '@parserator/node-sdk',
    version: exports.VERSION,
    description: 'Official Node.js SDK for Parserator - Intelligent data parsing using the Architect-Extractor pattern',
    author: 'Paul Phillips',
    repository: 'https://github.com/domusgpt/parserator',
    documentation: 'https://parserator.com/docs/sdk/node'
};
//# sourceMappingURL=index.js.map