/**
 * Validation utilities and schemas for the Parserator SDK
 */

import Joi from 'joi';
import { ParseRequest, ParseOptions, ParseratorConfig, ValidationType } from './index';

// Validation schemas using Joi
export const parseRequestSchema = Joi.object({
  inputData: Joi.string().required().min(1).max(1000000),
  outputSchema: Joi.object().required(),
  instructions: Joi.string().optional().max(10000),
  options: Joi.object({
    timeout: Joi.number().min(1000).max(300000).default(30000),
    retries: Joi.number().min(0).max(5).default(3),
    validateOutput: Joi.boolean().default(true),
    includeMetadata: Joi.boolean().default(true),
    confidenceThreshold: Joi.number().min(0).max(1).default(0.8)
  }).optional()
}).required();

export const configSchema = Joi.object({
  apiKey: Joi.string().pattern(/^pk_(live|test)_[a-zA-Z0-9]{32,}$/).required(),
  baseUrl: Joi.string().uri().default('https://api.parserator.com'),
  timeout: Joi.number().min(1000).max(300000).default(30000),
  retries: Joi.number().min(0).max(10).default(3),
  defaultOptions: Joi.object().optional(),
  debug: Joi.boolean().default(false)
}).required();

export const outputSchemaSchema = Joi.object().pattern(
  Joi.string(),
  Joi.alternatives().try(
    Joi.string().valid('string', 'number', 'boolean', 'email', 'phone', 'date', 'iso_date', 'url', 'string_array', 'number_array', 'object'),
    Joi.object({
      type: Joi.string().valid('string', 'number', 'boolean', 'email', 'phone', 'date', 'iso_date', 'url', 'string_array', 'number_array', 'object').required(),
      required: Joi.boolean().default(true),
      description: Joi.string().optional(),
      examples: Joi.array().items(Joi.any()).optional(),
      validation: Joi.object().optional()
    })
  )
);

// Validation functions
export function validateParseRequest(request: ParseRequest): Joi.ValidationResult {
  return parseRequestSchema.validate(request, { allowUnknown: false });
}

export function validateConfig(config: ParseratorConfig): Joi.ValidationResult {
  return configSchema.validate(config, { allowUnknown: false });
}

export function validateOutputSchema(schema: Record<string, any>): Joi.ValidationResult {
  return outputSchemaSchema.validate(schema, { allowUnknown: false });
}

// Type guards
export function isValidationType(type: string): type is ValidationType {
  const validTypes: ValidationType[] = [
    'string', 'number', 'boolean', 'email', 'phone', 'date', 
    'iso_date', 'url', 'string_array', 'number_array', 'object', 'custom'
  ];
  return validTypes.includes(type as ValidationType);
}

export function isValidApiKey(apiKey: string): boolean {
  return /^pk_(live|test)_[a-zA-Z0-9]{32,}$/.test(apiKey);
}

export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

// Schema validation helpers
export function validateSchemaStructure(schema: Record<string, any>): {
  valid: boolean;
  errors: string[];
  suggestions: string[];
} {
  const errors: string[] = [];
  const suggestions: string[] = [];

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
    } else if (typeof value === 'object' && value !== null) {
      if (!value.type || !isValidationType(value.type)) {
        errors.push(`Missing or invalid type for field "${key}"`);
      }
    } else {
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
export function validateInputData(data: string): {
  valid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];

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
export function getValidationErrorMessage(error: Joi.ValidationError): string {
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
