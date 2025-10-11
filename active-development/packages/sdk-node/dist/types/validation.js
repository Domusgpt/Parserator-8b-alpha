"use strict";
/**
 * Validation utilities and schemas for the Parserator SDK
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.outputSchemaSchema = exports.configSchema = exports.parseRequestSchema = void 0;
exports.validateParseRequest = validateParseRequest;
exports.validateConfig = validateConfig;
exports.validateOutputSchema = validateOutputSchema;
exports.isValidationType = isValidationType;
exports.isValidApiKey = isValidApiKey;
exports.isValidUrl = isValidUrl;
exports.validateSchemaStructure = validateSchemaStructure;
exports.validateInputData = validateInputData;
exports.getValidationErrorMessage = getValidationErrorMessage;
const joi_1 = __importDefault(require("joi"));
// Validation schemas using Joi
exports.parseRequestSchema = joi_1.default.object({
    inputData: joi_1.default.string().required().min(1).max(1000000),
    outputSchema: joi_1.default.object().min(1).required(),
    instructions: joi_1.default.string().optional().max(10000),
    options: joi_1.default.object({
        timeout: joi_1.default.number().min(1000).max(300000).default(30000),
        retries: joi_1.default.number().min(0).max(5).default(3),
        validateOutput: joi_1.default.boolean().default(true),
        includeMetadata: joi_1.default.boolean().default(true),
        confidenceThreshold: joi_1.default.number().min(0).max(1).default(0.8),
        leanLLM: joi_1.default.object({
            allowOptionalFields: joi_1.default.boolean(),
            defaultConfidence: joi_1.default.number().min(0).max(1),
            maxInputCharacters: joi_1.default.number().integer().min(1).max(120000),
            planConfidenceGate: joi_1.default.number().min(0).max(1),
            maxInvocationsPerParse: joi_1.default.number().integer().min(0).max(256),
            maxTokensPerParse: joi_1.default.number().integer().min(0)
        }).optional()
    }).optional()
}).required();
exports.configSchema = joi_1.default.object({
    apiKey: joi_1.default.string().pattern(/^pk_(live|test)_[a-zA-Z0-9]{32,}$/).required(),
    baseUrl: joi_1.default.string().uri().default('https://api.parserator.com'),
    timeout: joi_1.default.number().min(1000).max(300000).default(30000),
    retries: joi_1.default.number().min(0).max(10).default(3),
    defaultOptions: joi_1.default.object().optional(),
    debug: joi_1.default.boolean().default(false)
}).required();
exports.outputSchemaSchema = joi_1.default.object().pattern(joi_1.default.string(), joi_1.default.alternatives().try(joi_1.default.string().valid('string', 'number', 'boolean', 'email', 'phone', 'date', 'iso_date', 'url', 'string_array', 'number_array', 'object'), joi_1.default.object({
    type: joi_1.default.string().valid('string', 'number', 'boolean', 'email', 'phone', 'date', 'iso_date', 'url', 'string_array', 'number_array', 'object').required(),
    required: joi_1.default.boolean().default(true),
    description: joi_1.default.string().optional(),
    examples: joi_1.default.array().items(joi_1.default.any()).optional(),
    validation: joi_1.default.object().optional()
})));
// Validation functions
function validateParseRequest(request) {
    return exports.parseRequestSchema.validate(request, { allowUnknown: false });
}
function validateConfig(config) {
    return exports.configSchema.validate(config, { allowUnknown: false });
}
function validateOutputSchema(schema) {
    return exports.outputSchemaSchema.validate(schema, { allowUnknown: false });
}
// Type guards
function isValidationType(type) {
    const validTypes = [
        'string', 'number', 'boolean', 'email', 'phone', 'date',
        'iso_date', 'url', 'string_array', 'number_array',
        'currency', 'percentage', 'address', 'name',
        'object', 'custom'
    ];
    return validTypes.includes(type);
}
function isValidApiKey(apiKey) {
    return /^pk_(live|test)_[a-zA-Z0-9]{32,}$/.test(apiKey);
}
function isValidUrl(url) {
    try {
        new URL(url);
        return true;
    }
    catch {
        return false;
    }
}
// Schema validation helpers
function validateSchemaStructure(schema) {
    const errors = [];
    const suggestions = [];
    if (Object.keys(schema).length === 0) {
        errors.push('Schema cannot be empty');
        suggestions.push('Add at least one field to your output schema');
    }
    for (const [key, value] of Object.entries(schema)) {
        if (typeof key !== 'string' || key.trim() === '') {
            errors.push(`Invalid key: "${key}"`);
            continue;
        }
        if (typeof value === 'string') {
            if (!isValidationType(value)) {
                errors.push(`Invalid type "${value}" for field "${key}"`);
                suggestions.push(`Use one of: string, number, boolean, email, phone, date, iso_date, url, string_array, number_array, object`);
            }
        }
        else if (typeof value === 'object' && value !== null) {
            if (!value.type || !isValidationType(value.type)) {
                errors.push(`Missing or invalid type for field "${key}"`);
            }
        }
        else {
            errors.push(`Invalid schema definition for field "${key}"`);
            suggestions.push(`Field definitions should be either a type string or an object with a type property`);
        }
    }
    return {
        valid: errors.length === 0,
        errors,
        suggestions
    };
}
// Input data validation
function validateInputData(data) {
    const errors = [];
    const warnings = [];
    const suggestions = [];
    if (!data || data.trim() === '') {
        errors.push('Input data cannot be empty');
        return { valid: false, errors, warnings, suggestions };
    }
    if (data.length > 1000000) {
        errors.push('Input data exceeds maximum size of 1MB');
        suggestions.push('Consider breaking large data into smaller chunks for batch processing');
    }
    if (data.length < 10) {
        warnings.push('Input data is very short - parsing may not be optimal');
        suggestions.push('Provide more context or examples for better parsing results');
    }
    // Check for potential issues
    const lines = data.split('\n');
    if (lines.length > 10000) {
        warnings.push('Input data has many lines - consider if all are necessary');
    }
    return {
        valid: errors.length === 0,
        errors,
        warnings,
        suggestions
    };
}
// Error message helpers
function getValidationErrorMessage(error) {
    const details = error.details[0];
    const path = details.path.join('.');
    switch (details.type) {
        case 'any.required':
            return `${path} is required`;
        case 'string.empty':
            return `${path} cannot be empty`;
        case 'string.pattern.base':
            if (path === 'apiKey') {
                return 'API key must be in format: pk_live_... or pk_test_...';
            }
            return `${path} format is invalid`;
        case 'number.min':
            return `${path} must be at least ${details.context?.limit}`;
        case 'number.max':
            return `${path} must be at most ${details.context?.limit}`;
        default:
            return details.message;
    }
}
//# sourceMappingURL=validation.js.map