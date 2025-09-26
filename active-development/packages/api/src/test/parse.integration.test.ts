/**
 * Integration tests for the Parse Service
 * Tests the full Architect-Extractor workflow
 */

import { GeminiService } from '../services/llm.service';
import { ParseService, IParseRequest } from '../services/parse.service';

// Mock Gemini service for testing
class MockGeminiService extends GeminiService {
  constructor() {
    super('mock-api-key', console);
  }

  async callGemini(prompt: string): Promise<any> {
    // Simulate Architect response
    if (prompt.includes('You are the Architect')) {
      return {
        content: JSON.stringify({
          steps: [
            {
              targetKey: 'name',
              description: 'Customer name',
              searchInstruction: 'Find the text after "Name:" or "Customer:"',
              validationType: 'string',
              isRequired: true
            },
            {
              targetKey: 'email',
              description: 'Email address',
              searchInstruction: 'Find the email address in the text',
              validationType: 'email',
              isRequired: true
            }
          ],
          totalSteps: 2,
          estimatedComplexity: 'low',
          architectConfidence: 0.9,
          estimatedExtractorTokens: 500,
          metadata: {
            createdAt: new Date().toISOString(),
            architectVersion: 'v2.1',
            sampleLength: 100
          }
        }),
        tokensUsed: 250,
        model: 'gemini-1.5-flash',
        finishReason: 'STOP',
        responseTimeMs: 800
      };
    }

    // Simulate Extractor response
    if (prompt.includes('You are the Extractor')) {
      return {
        content: JSON.stringify({
          extractedData: {
            name: 'John Doe',
            email: 'john@example.com'
          },
          extractionNotes: {
            name: 'clearly identified after Customer:',
            email: 'found valid email format'
          }
        }),
        tokensUsed: 180,
        model: 'gemini-1.5-flash',
        finishReason: 'STOP',
        responseTimeMs: 600
      };
    }

    throw new Error('Unexpected prompt in mock');
  }

  async testConnection(): Promise<boolean> {
    return true;
  }
}

describe('ParseService Integration Tests', () => {
  let parseService: ParseService;

  beforeEach(() => {
    const mockGeminiService = new MockGeminiService();
    parseService = new ParseService(mockGeminiService, undefined, console);
  });

  describe('parse', () => {
    it('should successfully parse simple customer data', async () => {
      const request: IParseRequest = {
        inputData: 'Customer: John Doe\nEmail: john@example.com\nPhone: 555-123-4567',
        outputSchema: {
          name: 'string',
          email: 'string'
        },
        instructions: 'Extract customer information'
      };

      const result = await parseService.parse(request);

      expect(result.success).toBe(true);
      expect(result.parsedData.name).toBe('John Doe');
      expect(result.parsedData.email).toBe('john@example.com');
      expect(result.metadata.confidence).toBeGreaterThan(0.8);
      expect(result.metadata.tokensUsed).toBeGreaterThan(0);
      expect(result.metadata.architectPlan.steps).toHaveLength(2);
      expect(result.metadata.systemContext.type).toBe('crm');
      expect(result.metadata.systemContext.confidence).toBeGreaterThanOrEqual(0.2);
      expect(result.metadata.systemContext.metrics.rawScore).toBeGreaterThanOrEqual(0);
      expect(result.metadata.systemContext.metrics.sourceBreakdown.schema).toBeGreaterThanOrEqual(0);
      expect(result.metadata.systemContext.metrics.domainHintsProvided).toBe(0);
    });

    it('should handle validation errors gracefully', async () => {
      const request: IParseRequest = {
        inputData: '', // Empty input
        outputSchema: {
          name: 'string'
        }
      };

      const result = await parseService.parse(request);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.code).toBe('EMPTY_INPUT_DATA');
      expect(result.error!.stage).toBe('validation');
      expect(result.metadata.systemContext.metrics.lowConfidenceFallback).toBe(true);
    });

    it('should provide detailed metadata', async () => {
      const request: IParseRequest = {
        inputData: 'Name: Jane Smith\nEmail: jane@test.com',
        outputSchema: {
          name: 'string',
          email: 'string'
        }
      };

      const result = await parseService.parse(request);

      expect(result.success).toBe(true);
      expect(result.metadata.stageBreakdown).toBeDefined();
      expect(result.metadata.stageBreakdown.architect.tokens).toBeGreaterThan(0);
      expect(result.metadata.stageBreakdown.extractor.tokens).toBeGreaterThan(0);
      expect(result.metadata.architectTokens + result.metadata.extractorTokens)
        .toBe(result.metadata.tokensUsed);
      expect(result.metadata.systemContext.summary).toContain('General-purpose');
      expect(result.metadata.systemContext.metrics).toBeDefined();
      expect(result.metadata.systemContext.metrics.explicitHintProvided).toBe(false);
    });
  });

  describe('getHealthStatus', () => {
    it('should return healthy status when services are working', async () => {
      const health = await parseService.getHealthStatus();

      expect(health.status).toBe('healthy');
      expect(health.services.gemini).toBe(true);
      expect(health.timestamp).toBeDefined();
    });
  });
});

describe('Real-world parsing scenarios', () => {
  let parseService: ParseService;

  beforeEach(() => {
    const mockGeminiService = new MockGeminiService();
    parseService = new ParseService(mockGeminiService, undefined, console);
  });

  it('should handle messy email data', async () => {
    const request: IParseRequest = {
      inputData: `
        Hi there,
        
        My name is John Doe and I'm interested in your services.
        You can reach me at john@example.com or call me at (555) 123-4567.
        
        Thanks!
        John
      `,
      outputSchema: {
        name: 'string',
        email: 'string'
      }
    };

    const result = await parseService.parse(request);

    expect(result.success).toBe(true);
    expect(result.parsedData.name).toBe('John Doe');
    expect(result.parsedData.email).toBe('john@example.com');
  });

  it('should handle structured data like CSV', async () => {
    const request: IParseRequest = {
      inputData: `
        Name,Email,Phone
        John Doe,john@example.com,555-123-4567
        Jane Smith,jane@test.com,555-987-6543
      `,
      outputSchema: {
        name: 'string',
        email: 'string'
      },
      instructions: 'Extract the first person\'s information'
    };

    const result = await parseService.parse(request);

    expect(result.success).toBe(true);
    expect(result.parsedData.name).toBe('John Doe');
    expect(result.parsedData.email).toBe('john@example.com');
  });
});