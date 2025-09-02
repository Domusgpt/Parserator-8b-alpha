/**
 * Jest test setup file
 * Configures the testing environment for Parserator API tests
 */
declare global {
    namespace jest {
        interface Matchers<R> {
            toBeValidParseResult(): R;
            toHaveValidMetadata(): R;
        }
    }
}
export declare const createMockParseRequest: (overrides?: {}) => {
    inputData: string;
    outputSchema: {
        name: string;
        email: string;
    };
};
export declare const createMockSearchPlan: (overrides?: {}) => {
    steps: {
        targetKey: string;
        description: string;
        searchInstruction: string;
        validationType: string;
        isRequired: boolean;
    }[];
    totalSteps: number;
    estimatedComplexity: string;
    architectConfidence: number;
    estimatedExtractorTokens: number;
    metadata: {
        createdAt: string;
        architectVersion: string;
        sampleLength: number;
    };
};
export declare const cleanup: () => void;
//# sourceMappingURL=setup.d.ts.map