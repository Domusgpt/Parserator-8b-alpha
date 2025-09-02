"use strict";
/**
 * Jest test setup file
 * Configures the testing environment for Parserator API tests
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanup = exports.createMockSearchPlan = exports.createMockParseRequest = void 0;
// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.GEMINI_API_KEY = 'test-api-key';
// Mock console methods for cleaner test output
const originalConsole = { ...console };
beforeEach(() => {
    // Suppress console output during tests unless specifically needed
    jest.spyOn(console, 'log').mockImplementation(() => { });
    jest.spyOn(console, 'info').mockImplementation(() => { });
    jest.spyOn(console, 'warn').mockImplementation(() => { });
    jest.spyOn(console, 'error').mockImplementation(() => { });
});
afterEach(() => {
    // Restore console methods after each test
    jest.restoreAllMocks();
});
// Custom Jest matchers for Parserator-specific assertions
expect.extend({
    toBeValidParseResult(received) {
        const pass = (typeof received === 'object' &&
            received !== null &&
            typeof received.success === 'boolean' &&
            typeof received.parsedData === 'object' &&
            typeof received.metadata === 'object');
        if (pass) {
            return {
                message: () => `expected ${received} not to be a valid parse result`,
                pass: true,
            };
        }
        else {
            return {
                message: () => `expected ${received} to be a valid parse result with success, parsedData, and metadata`,
                pass: false,
            };
        }
    },
    toHaveValidMetadata(received) {
        if (!received.metadata) {
            return {
                message: () => `expected ${received} to have metadata`,
                pass: false,
            };
        }
        const metadata = received.metadata;
        const pass = (typeof metadata.confidence === 'number' &&
            metadata.confidence >= 0 &&
            metadata.confidence <= 1 &&
            typeof metadata.tokensUsed === 'number' &&
            metadata.tokensUsed >= 0 &&
            typeof metadata.processingTimeMs === 'number' &&
            metadata.processingTimeMs >= 0 &&
            typeof metadata.architectPlan === 'object');
        if (pass) {
            return {
                message: () => `expected ${received} not to have valid metadata`,
                pass: true,
            };
        }
        else {
            return {
                message: () => `expected ${received} to have valid metadata with confidence, tokensUsed, processingTimeMs, and architectPlan`,
                pass: false,
            };
        }
    },
});
// Helper functions for tests
const createMockParseRequest = (overrides = {}) => ({
    inputData: 'Customer: John Doe\nEmail: john@example.com',
    outputSchema: {
        name: 'string',
        email: 'string'
    },
    ...overrides
});
exports.createMockParseRequest = createMockParseRequest;
const createMockSearchPlan = (overrides = {}) => ({
    steps: [
        {
            targetKey: 'name',
            description: 'Customer name',
            searchInstruction: 'Find the text after "Customer:"',
            validationType: 'string',
            isRequired: true
        }
    ],
    totalSteps: 1,
    estimatedComplexity: 'low',
    architectConfidence: 0.9,
    estimatedExtractorTokens: 500,
    metadata: {
        createdAt: new Date().toISOString(),
        architectVersion: 'v2.1',
        sampleLength: 100
    },
    ...overrides
});
exports.createMockSearchPlan = createMockSearchPlan;
// Cleanup function for tests
const cleanup = () => {
    // Reset any global state if needed
    jest.clearAllMocks();
    jest.restoreAllMocks();
};
exports.cleanup = cleanup;
//# sourceMappingURL=setup.js.map