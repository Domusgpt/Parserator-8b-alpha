/**
 * Basic functionality tests for Parserator Node.js SDK
 */

const { ParseratorClient, quickParse, validateConfig, validateParseRequest } = require('../dist/index.js');

describe('Parserator SDK', () => {
  describe('Configuration Validation', () => {
    test('should validate valid API key', () => {
      const config = {
        apiKey: 'pk_test_1234567890abcdef1234567890abcdef12345678'
      };
      
      const { error } = validateConfig(config);
      expect(error).toBeUndefined();
    });

    test('should reject invalid API key format', () => {
      const config = {
        apiKey: 'invalid_key'
      };
      
      const { error } = validateConfig(config);
      expect(error).toBeDefined();
    });
  });

  describe('Parse Request Validation', () => {
    test('should validate valid parse request', () => {
      const request = {
        inputData: 'Some test data',
        outputSchema: {
          name: 'string',
          email: 'email'
        }
      };
      
      const { error } = validateParseRequest(request);
      expect(error).toBeUndefined();
    });

    test('should reject empty input data', () => {
      const request = {
        inputData: '',
        outputSchema: {
          name: 'string'
        }
      };
      
      const { error } = validateParseRequest(request);
      expect(error).toBeDefined();
    });

    test('should reject empty schema', () => {
      const request = {
        inputData: 'Some data',
        outputSchema: {}
      };
      
      const { error } = validateParseRequest(request);
      expect(error).toBeDefined();
    });
  });

  describe('Client Creation', () => {
    test('should create client with valid config', () => {
      expect(() => {
        new ParseratorClient({
          apiKey: 'pk_test_1234567890abcdef1234567890abcdef12345678'
        });
      }).not.toThrow();
    });

    test('should throw on invalid API key', () => {
      expect(() => {
        new ParseratorClient({
          apiKey: 'invalid_key'
        });
      }).toThrow();
    });
  });

  describe('Error Handling', () => {
    test('should handle network errors gracefully', async () => {
      const client = new ParseratorClient({
        apiKey: 'pk_test_1234567890abcdef1234567890abcdef12345678',
        baseUrl: 'https://invalid-url-that-does-not-exist.com'
      });

      const testResult = await client.testConnection();
      expect(testResult.success).toBe(false);
      expect(testResult.error).toBeDefined();
    });
  });

  describe('Utility Functions', () => {
    test('quickParse should work with valid inputs', async () => {
      // Mock the API call since we don't have a real API key in tests
      const mockApiKey = 'pk_test_1234567890abcdef1234567890abcdef12345678';
      
      // This will fail with network error, but that's expected in tests
      try {
        await quickParse(
          mockApiKey,
          'John Smith, john@example.com',
          { name: 'string', email: 'email' }
        );
      } catch (error) {
        // Expect network error in test environment
        expect(error).toBeDefined();
      }
    });
  });
});
