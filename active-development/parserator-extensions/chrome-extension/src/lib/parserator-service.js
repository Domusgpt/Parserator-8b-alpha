/**
 * Parserator Service for Chrome Extension
 * Handles all API communication with Parserator backend
 */

class ParseratorService {
  constructor() {
    this.baseUrl = 'https://app-5108296280.us-central1.run.app';
    this.apiKey = null;
    this.timeout = 30000;
  }

  /**
   * Initialize service with stored configuration
   */
  async initialize() {
    const config = await this.getStoredConfig();
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://app-5108296280.us-central1.run.app';
    this.timeout = config.timeout || 30000;
  }

  /**
   * Get stored configuration from Chrome storage
   */
  async getStoredConfig() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(['apiKey', 'baseUrl', 'timeout'], (result) => {
        resolve({
          apiKey: result.apiKey || '',
          baseUrl: result.baseUrl || 'https://app-5108296280.us-central1.run.app',
          timeout: result.timeout || 30000
        });
      });
    });
  }

  /**
   * Save configuration to Chrome storage
   */
  async saveConfig(config) {
    return new Promise((resolve) => {
      chrome.storage.sync.set(config, () => {
        this.apiKey = config.apiKey;
        this.baseUrl = config.baseUrl || this.baseUrl;
        this.timeout = config.timeout || this.timeout;
        resolve();
      });
    });
  }

  /**
   * Check if service is properly configured
   */
  isConfigured() {
    return this.apiKey && this.apiKey.length > 0;
  }

  /**
   * Create request headers
   */
  getHeaders() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': 'parserator-chrome-extension/1.0.1'
    };
  }

  /**
   * Make HTTP request with error handling
   */
  async makeRequest(endpoint, options = {}) {
    if (!this.isConfigured()) {
      throw new Error('Parserator not configured. Please set your API key in options.');
    }

    const url = `${this.baseUrl}${endpoint}`;
    const requestOptions = {
      method: options.method || 'GET',
      headers: this.getHeaders(),
      ...options
    };

    if (options.body) {
      requestOptions.body = JSON.stringify(options.body);
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);
      
      requestOptions.signal = controller.signal;

      const response = await fetch(url, requestOptions);
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timeout. Please try again.');
      }
      throw error;
    }
  }

  /**
   * Parse text with given schema
   */
  async parse(inputData, outputSchema, instructions = '') {
    this.validateParseInput(inputData, outputSchema);

    const response = await this.makeRequest('/v1/parse', {
      method: 'POST',
      body: {
        inputData,
        outputSchema,
        instructions
      }
    });

    if (!response.success) {
      throw new Error(response.error?.message || 'Parse operation failed');
    }

    return response;
  }

  /**
   * Get usage statistics
   */
  async getUsage() {
    return await this.makeRequest('/v1/usage');
  }

  /**
   * Test API connection
   */
  async testConnection() {
    try {
      const response = await this.makeRequest('/health');
      return response.status === 'healthy';
    } catch (error) {
      return false;
    }
  }

  /**
   * Get API information
   */
  async getApiInfo() {
    return await this.makeRequest('/v1/info');
  }

  /**
   * Validate parse input parameters
   */
  validateParseInput(inputData, outputSchema) {
    if (!inputData || typeof inputData !== 'string') {
      throw new Error('Input data must be a non-empty string');
    }

    if (inputData.trim().length === 0) {
      throw new Error('Input data cannot be empty or only whitespace');
    }

    if (inputData.length > 100000) {
      throw new Error('Input data exceeds maximum length of 100KB');
    }

    if (!outputSchema || typeof outputSchema !== 'object') {
      throw new Error('Output schema must be a non-null object');
    }

    if (Object.keys(outputSchema).length === 0) {
      throw new Error('Output schema cannot be empty');
    }

    if (Object.keys(outputSchema).length > 50) {
      throw new Error('Output schema exceeds maximum of 50 fields');
    }
  }

  /**
   * Get masked API key for display
   */
  getApiKeyPrefix() {
    if (!this.apiKey) return '';
    return this.apiKey.substring(0, 12) + '...';
  }
}

// Create singleton instance
const parseratorService = new ParseratorService();

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = parseratorService;
} else if (typeof window !== 'undefined') {
  window.parseratorService = parseratorService;
}

// For ES modules
export default parseratorService;