/**
 * Validation utilities and schemas for the Parserator SDK
 */
import Joi from 'joi';
import { ParseRequest, ParseratorConfig, ValidationType } from './index';
export declare const parseRequestSchema: Joi.ObjectSchema<any>;
export declare const configSchema: Joi.ObjectSchema<any>;
export declare const outputSchemaSchema: Joi.ObjectSchema<any>;
export declare function validateParseRequest(request: ParseRequest): Joi.ValidationResult;
export declare function validateConfig(config: ParseratorConfig): Joi.ValidationResult;
export declare function validateOutputSchema(schema: Record<string, any>): Joi.ValidationResult;
export declare function isValidationType(type: string): type is ValidationType;
export declare function isValidApiKey(apiKey: string): boolean;
export declare function isValidUrl(url: string): boolean;
export declare function validateSchemaStructure(schema: Record<string, any>): {
    valid: boolean;
    errors: string[];
    suggestions: string[];
};
export declare function validateInputData(data: string): {
    valid: boolean;
    errors: string[];
    warnings: string[];
    suggestions: string[];
};
export declare function getValidationErrorMessage(error: Joi.ValidationError): string;
//# sourceMappingURL=validation.d.ts.map