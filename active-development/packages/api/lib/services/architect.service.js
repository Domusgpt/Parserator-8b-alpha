"use strict";
/**
 * Architect Service for Parserator
 * Implements the first stage of the Architect-Extractor pattern
 * Creates detailed SearchPlans from output schemas and data samples
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ArchitectService = exports.ArchitectError = void 0;
const llm_service_1 = require("./llm.service");
/**
 * Error thrown when Architect service encounters issues
 */
class ArchitectError extends Error {
    constructor(message, code, details) {
        super(message);
        this.code = code;
        this.details = details;
        this.name = 'ArchitectError';
    }
}
exports.ArchitectError = ArchitectError;
/**
 * The Architect: First stage of the two-stage parsing process
 * Analyzes output schema and data sample to create a detailed SearchPlan
 */
class ArchitectService {
    constructor(geminiService, config, logger) {
        this.geminiService = geminiService;
        this.config = { ...ArchitectService.DEFAULT_CONFIG, ...config };
        this.logger = logger || console;
        this.logger.info('ArchitectService initialized', {
            promptVersion: this.config.promptVersion,
            maxSampleLength: this.config.maxSampleLength,
            service: 'architect'
        });
    }
    /**
     * Generate a SearchPlan from output schema and data sample
     */
    async generateSearchPlan(outputSchema, dataSample, userInstructions, requestId) {
        const startTime = Date.now();
        const operationId = requestId || this.generateOperationId();
        this.logger.info('Starting SearchPlan generation', {
            requestId: operationId,
            schemaFields: Object.keys(outputSchema).length,
            sampleLength: dataSample.length,
            hasInstructions: !!userInstructions,
            operation: 'generateSearchPlan'
        });
        try {
            // Validate inputs
            this.validateInputs(outputSchema, dataSample);
            // Create optimized data sample
            const optimizedSample = this.createOptimizedSample(dataSample);
            // Build the architect prompt
            const prompt = this.buildArchitectPrompt(outputSchema, optimizedSample, userInstructions);
            // Call Gemini with architect-specific options
            const llmOptions = {
                maxTokens: 2048,
                temperature: 0.1, // Low temperature for consistent planning
                timeoutMs: this.config.timeoutMs,
                requestId: operationId,
                model: 'gemini-1.5-flash'
            };
            const llmResponse = await this.geminiService.callGemini(prompt, llmOptions);
            // Parse and validate the response
            const searchPlan = this.parseArchitectResponse(llmResponse.content, operationId);
            // Validate the generated plan
            this.validateSearchPlan(searchPlan, outputSchema);
            // Calculate processing metrics
            const processingTimeMs = Date.now() - startTime;
            const result = {
                searchPlan,
                tokensUsed: llmResponse.tokensUsed,
                processingTimeMs,
                model: llmResponse.model,
                success: true
            };
            this.logger.info('SearchPlan generation completed', {
                requestId: operationId,
                stepsGenerated: searchPlan.steps.length,
                confidence: searchPlan.architectConfidence,
                complexity: searchPlan.estimatedComplexity,
                tokensUsed: llmResponse.tokensUsed,
                processingTimeMs,
                operation: 'generateSearchPlan'
            });
            return result;
        }
        catch (error) {
            const processingTimeMs = Date.now() - startTime;
            this.logger.error('SearchPlan generation failed', {
                requestId: operationId,
                error: error instanceof Error ? error.message : 'Unknown error',
                processingTimeMs,
                operation: 'generateSearchPlan'
            });
            if (error instanceof ArchitectError || error instanceof llm_service_1.LLMError) {
                return {
                    searchPlan: this.createEmptySearchPlan(),
                    tokensUsed: 0,
                    processingTimeMs,
                    model: 'gemini-1.5-flash',
                    success: false,
                    error: {
                        code: error.constructor.name === 'ArchitectError' ?
                            error.code : 'LLM_ERROR',
                        message: error.message,
                        details: {
                            requestId: operationId,
                            ...(error instanceof ArchitectError ? error.details : {})
                        }
                    }
                };
            }
            // Unexpected error
            throw new ArchitectError(`Unexpected error during SearchPlan generation: ${error instanceof Error ? error.message : 'Unknown error'}`, 'UNEXPECTED_ERROR', { requestId: operationId, originalError: error });
        }
    }
    /**
     * Build the optimized prompt for the Architect LLM
     */
    buildArchitectPrompt(outputSchema, dataSample, userInstructions) {
        const schemaJson = JSON.stringify(outputSchema, null, 2);
        const fieldCount = Object.keys(outputSchema).length;
        return `You are the Architect in a two-stage data parsing system. Your job is to analyze the user's desired output schema and a sample of their input data, then create a detailed SearchPlan for the Extractor to follow.

## YOUR TASK
Create a JSON SearchPlan that tells the Extractor exactly how to find each piece of data in the full input.

## OUTPUT SCHEMA (what the user wants)
\`\`\`json
${schemaJson}
\`\`\`

## DATA SAMPLE (representative portion of input)
\`\`\`
${dataSample}
\`\`\`

${userInstructions ? `## USER INSTRUCTIONS\n${userInstructions}\n` : ''}

## RESPONSE FORMAT
You must respond with ONLY a valid JSON object matching this exact structure:

\`\`\`json
{
  "steps": [
    {
      "targetKey": "fieldName",
      "description": "Clear description of what this data represents",
      "searchInstruction": "Direct, specific instruction for finding this data",
      "validationType": "string|email|number|iso_date|string_array|boolean|url|phone|json_object",
      "isRequired": true,
      "examples": ["example1", "example2"],
      "pattern": "optional regex pattern"
    }
  ],
  "totalSteps": ${fieldCount},
  "estimatedComplexity": "low|medium|high",
  "architectConfidence": 0.95,
  "estimatedExtractorTokens": 1500,
  "extractorInstructions": "Any special guidance for the Extractor",
  "metadata": {
    "createdAt": "${new Date().toISOString()}",
    "architectVersion": "${this.config.promptVersion}",
    "sampleLength": ${dataSample.length},
    "userInstructions": "${userInstructions || ''}"
  }
}
\`\`\`

## CRITICAL INSTRUCTIONS

1. **Each searchInstruction must be DIRECT and ACTIONABLE**
   - ❌ "Look for the customer name"
   - ✅ "Find the text after 'Customer:' or 'Name:' that appears to be a person's name"

2. **Use the data sample to understand patterns**
   - Identify how information is formatted
   - Note any delimiters, labels, or structural patterns
   - Create instructions that work for similar data

3. **Choose appropriate validationType**
   - string: General text
   - email: Email addresses
   - number: Numeric values
   - iso_date: Dates in ISO format (YYYY-MM-DD)
   - string_array: Multiple text values
   - boolean: True/false values
   - url: Web URLs
   - phone: Phone numbers
   - json_object: Nested objects

4. **Set confidence based on clarity**
   - High (0.9+): Clear patterns, well-structured data
   - Medium (0.7-0.89): Some ambiguity but patterns visible
   - Low (0.5-0.69): Messy data, unclear patterns

5. **Estimate complexity honestly**
   - low: Simple extraction, clear patterns
   - medium: Some context needed, moderate complexity
   - high: Complex reasoning, ambiguous patterns

6. **Provide helpful examples when patterns are clear**

Remember: The Extractor will follow your plan exactly. Make your instructions clear, specific, and actionable. Your searchInstructions are the key to accurate extraction.

RESPOND WITH ONLY THE JSON - NO EXPLANATIONS OR MARKDOWN FORMATTING.`;
    }
    /**
     * Parse and validate the Architect's JSON response
     */
    parseArchitectResponse(content, requestId) {
        try {
            // Clean the response - remove any markdown formatting
            let cleanContent = content.trim();
            // Remove markdown code blocks if present
            if (cleanContent.startsWith('```')) {
                cleanContent = cleanContent.replace(/^```[json]*\n?/, '').replace(/\n?```$/, '');
            }
            // Parse JSON
            const parsed = JSON.parse(cleanContent);
            // Validate required fields
            if (!parsed.steps || !Array.isArray(parsed.steps)) {
                throw new ArchitectError('Invalid response: missing or invalid steps array', 'INVALID_RESPONSE_FORMAT', { requestId, responsePreview: content.substring(0, 200) });
            }
            if (typeof parsed.architectConfidence !== 'number') {
                throw new ArchitectError('Invalid response: missing or invalid architectConfidence', 'INVALID_RESPONSE_FORMAT', { requestId, responsePreview: content.substring(0, 200) });
            }
            // Validate each step
            for (let i = 0; i < parsed.steps.length; i++) {
                this.validateSearchStep(parsed.steps[i], i, requestId);
            }
            // Set defaults for optional fields
            const searchPlan = {
                steps: parsed.steps,
                totalSteps: parsed.totalSteps || parsed.steps.length,
                estimatedComplexity: parsed.estimatedComplexity || 'medium',
                architectConfidence: parsed.architectConfidence,
                estimatedExtractorTokens: parsed.estimatedExtractorTokens || 1000,
                extractorInstructions: parsed.extractorInstructions,
                metadata: {
                    createdAt: parsed.metadata?.createdAt || new Date().toISOString(),
                    architectVersion: parsed.metadata?.architectVersion || this.config.promptVersion,
                    sampleLength: parsed.metadata?.sampleLength || 0,
                    userInstructions: parsed.metadata?.userInstructions
                }
            };
            return searchPlan;
        }
        catch (error) {
            if (error instanceof ArchitectError) {
                throw error;
            }
            if (error instanceof SyntaxError) {
                throw new ArchitectError('Invalid JSON response from Architect', 'JSON_PARSE_ERROR', {
                    requestId,
                    responsePreview: content.substring(0, 200),
                    parseError: error.message
                });
            }
            throw new ArchitectError(`Failed to parse Architect response: ${error instanceof Error ? error.message : 'Unknown error'}`, 'RESPONSE_PARSE_ERROR', { requestId, responsePreview: content.substring(0, 200) });
        }
    }
    /**
     * Validate a single SearchStep
     */
    validateSearchStep(step, index, requestId) {
        const requiredFields = ['targetKey', 'description', 'searchInstruction', 'validationType', 'isRequired'];
        for (const field of requiredFields) {
            if (!(field in step) || step[field] === null || step[field] === undefined) {
                throw new ArchitectError(`Step ${index}: missing required field '${field}'`, 'INVALID_SEARCH_STEP', { requestId, stepIndex: index, missingField: field });
            }
        }
        // Validate field types
        if (typeof step.targetKey !== 'string' || step.targetKey.trim().length === 0) {
            throw new ArchitectError(`Step ${index}: targetKey must be a non-empty string`, 'INVALID_SEARCH_STEP', { requestId, stepIndex: index, field: 'targetKey' });
        }
        if (typeof step.searchInstruction !== 'string' || step.searchInstruction.trim().length < 10) {
            throw new ArchitectError(`Step ${index}: searchInstruction must be at least 10 characters`, 'INVALID_SEARCH_STEP', { requestId, stepIndex: index, field: 'searchInstruction' });
        }
        const validTypes = [
            'string', 'email', 'number', 'iso_date', 'string_array',
            'boolean', 'url', 'phone', 'json_object'
        ];
        if (!validTypes.includes(step.validationType)) {
            throw new ArchitectError(`Step ${index}: invalid validationType '${step.validationType}'`, 'INVALID_SEARCH_STEP', { requestId, stepIndex: index, field: 'validationType', validTypes });
        }
        if (typeof step.isRequired !== 'boolean') {
            throw new ArchitectError(`Step ${index}: isRequired must be a boolean`, 'INVALID_SEARCH_STEP', { requestId, stepIndex: index, field: 'isRequired' });
        }
    }
    /**
     * Validate the complete SearchPlan against the output schema
     */
    validateSearchPlan(searchPlan, outputSchema) {
        // Check confidence threshold
        if (searchPlan.architectConfidence < this.config.minConfidenceThreshold) {
            throw new ArchitectError(`SearchPlan confidence ${searchPlan.architectConfidence} below threshold ${this.config.minConfidenceThreshold}`, 'LOW_CONFIDENCE', {
                confidence: searchPlan.architectConfidence,
                threshold: this.config.minConfidenceThreshold
            });
        }
        // Check field count limits
        if (searchPlan.steps.length > this.config.maxFieldCount) {
            throw new ArchitectError(`SearchPlan has ${searchPlan.steps.length} steps, exceeding limit of ${this.config.maxFieldCount}`, 'TOO_MANY_FIELDS', { stepCount: searchPlan.steps.length, limit: this.config.maxFieldCount });
        }
        // Verify all schema fields are covered
        const schemaKeys = Object.keys(outputSchema);
        const planKeys = searchPlan.steps.map(step => step.targetKey);
        const missingKeys = schemaKeys.filter(key => !planKeys.includes(key));
        if (missingKeys.length > 0) {
            throw new ArchitectError(`SearchPlan missing steps for schema fields: ${missingKeys.join(', ')}`, 'MISSING_SCHEMA_FIELDS', { missingFields: missingKeys, schemaFields: schemaKeys, planFields: planKeys });
        }
        // Check for duplicate target keys
        const duplicateKeys = planKeys.filter((key, index) => planKeys.indexOf(key) !== index);
        if (duplicateKeys.length > 0) {
            throw new ArchitectError(`SearchPlan has duplicate target keys: ${duplicateKeys.join(', ')}`, 'DUPLICATE_TARGET_KEYS', { duplicateKeys });
        }
    }
    /**
     * Create an optimized sample from the input data
     */
    createOptimizedSample(inputData) {
        if (inputData.length <= this.config.maxSampleLength) {
            return inputData;
        }
        // Try to get a representative sample
        const sample = inputData.substring(0, this.config.maxSampleLength);
        // Try to break at a natural boundary (sentence, line, etc.)
        const lastPeriod = sample.lastIndexOf('.');
        const lastNewline = sample.lastIndexOf('\n');
        const lastSpace = sample.lastIndexOf(' ');
        const breakPoint = Math.max(lastPeriod, lastNewline, lastSpace);
        if (breakPoint > this.config.maxSampleLength * 0.7) {
            return sample.substring(0, breakPoint);
        }
        return sample;
    }
    /**
     * Validate input parameters
     */
    validateInputs(outputSchema, dataSample) {
        if (!outputSchema || typeof outputSchema !== 'object') {
            throw new ArchitectError('Output schema must be a non-null object', 'INVALID_OUTPUT_SCHEMA');
        }
        const schemaKeys = Object.keys(outputSchema);
        if (schemaKeys.length === 0) {
            throw new ArchitectError('Output schema cannot be empty', 'EMPTY_OUTPUT_SCHEMA');
        }
        if (schemaKeys.length > this.config.maxFieldCount) {
            throw new ArchitectError(`Output schema has ${schemaKeys.length} fields, exceeding limit of ${this.config.maxFieldCount}`, 'SCHEMA_TOO_LARGE', { fieldCount: schemaKeys.length, limit: this.config.maxFieldCount });
        }
        if (!dataSample || typeof dataSample !== 'string') {
            throw new ArchitectError('Data sample must be a non-empty string', 'INVALID_DATA_SAMPLE');
        }
        if (dataSample.trim().length === 0) {
            throw new ArchitectError('Data sample cannot be empty or only whitespace', 'EMPTY_DATA_SAMPLE');
        }
    }
    /**
     * Create an empty SearchPlan for error cases
     */
    createEmptySearchPlan() {
        return {
            steps: [],
            totalSteps: 0,
            estimatedComplexity: 'high',
            architectConfidence: 0.0,
            estimatedExtractorTokens: 0,
            metadata: {
                createdAt: new Date().toISOString(),
                architectVersion: this.config.promptVersion,
                sampleLength: 0
            }
        };
    }
    /**
     * Generate unique operation ID for tracking
     */
    generateOperationId() {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 8);
        return `arch_${timestamp}_${random}`;
    }
    /**
     * Get current configuration
     */
    getConfig() {
        return { ...this.config };
    }
    /**
     * Update configuration
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.logger.info('ArchitectService configuration updated', {
            newConfig,
            service: 'architect'
        });
    }
}
exports.ArchitectService = ArchitectService;
// Default configuration optimized for planning efficiency
ArchitectService.DEFAULT_CONFIG = {
    maxSampleLength: 1000,
    minConfidenceThreshold: 0.7,
    maxFieldCount: 50,
    promptVersion: 'v2.1',
    timeoutMs: 20000
};
//# sourceMappingURL=architect.service.js.map