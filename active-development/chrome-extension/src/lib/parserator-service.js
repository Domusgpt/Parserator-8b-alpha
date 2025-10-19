/**
 * Parserator Service for Chrome Extension
 * Handles all API communication with Parserator backend
 */

const DEFAULT_BASE_URL = 'https://api.parserator.com';

const CLIENT_IDENTIFIER = (() => {
  try {
    if (typeof chrome !== 'undefined' && chrome.runtime?.getManifest) {
      const manifest = chrome.runtime.getManifest();
      if (manifest?.version) {
        return `parserator-chrome-extension/${manifest.version}`;
      }
    }
  } catch (error) {
    console.warn('Unable to determine extension version:', error);
  }

  return 'parserator-chrome-extension/dev';
})();

class ParseratorService {
  constructor() {
    this.baseUrl = DEFAULT_BASE_URL;
    this.apiKey = null;
    this.timeout = 30000;
  }

  /**
   * Initialize service with stored configuration
   */
  async initialize() {
    const config = await this.getStoredConfig();
    this.apiKey = (config.apiKey || '').trim();
    this.baseUrl = this.normalizeBaseUrl(config.baseUrl);
    this.timeout = Number.isFinite(config.timeout) ? config.timeout : 30000;
  }

  /**
   * Get stored configuration from Chrome storage
   */
  async getStoredConfig() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(['apiKey', 'baseUrl', 'timeout'], (result) => {
        const storedTimeout = Number(result.timeout);
        resolve({
          apiKey: result.apiKey || '',
          baseUrl: this.normalizeBaseUrl(result.baseUrl),
          timeout: Number.isFinite(storedTimeout) ? storedTimeout : 30000
        });
      });
    });
  }

  /**
   * Save configuration to Chrome storage
   */
  async saveConfig(config) {
    return new Promise((resolve) => {
      const timeoutMs = Number(config.timeout);
      const preparedConfig = {
        ...config,
        apiKey: (config.apiKey || '').trim(),
        baseUrl: this.normalizeBaseUrl(config.baseUrl),
        timeout: Number.isFinite(timeoutMs) ? timeoutMs : this.timeout
      };

      chrome.storage.sync.set(preparedConfig, () => {
        this.apiKey = preparedConfig.apiKey;
        this.baseUrl = preparedConfig.baseUrl;
        this.timeout = preparedConfig.timeout;
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
  getHeaders(hasBody = false, extraHeaders = {}) {
    const headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'X-Parserator-Client': CLIENT_IDENTIFIER,
      ...extraHeaders
    };

    const hasContentTypeOverride = Object.keys(extraHeaders)
      .map(key => key.toLowerCase())
      .includes('content-type');

    if (hasBody && !hasContentTypeOverride) {
      headers['Content-Type'] = 'application/json';
    }

    return headers;
  }

  /**
   * Make HTTP request with error handling
   */
  async makeRequest(endpoint, options = {}) {
    if (!this.isConfigured()) {
      throw new Error('Parserator not configured. Please set your API key in options.');
    }

    const {
      headers: extraHeaders = {},
      body: providedBody,
      method = 'GET',
      ...restOptions
    } = options;

    const url = this.buildUrl(endpoint);
    const hasBody = providedBody !== undefined && providedBody !== null;
    const isFormData = typeof FormData !== 'undefined' && providedBody instanceof FormData;

    const requestOptions = {
      method,
      headers: this.getHeaders(hasBody && !isFormData, extraHeaders),
      ...restOptions
    };

    if (hasBody) {
      requestOptions.body = isFormData || typeof providedBody === 'string'
        ? providedBody
        : JSON.stringify(providedBody);
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
   * Normalize configured base URL
   */
  normalizeBaseUrl(url) {
    const value = (url || '').trim();
    if (!value) {
      return DEFAULT_BASE_URL;
    }

    try {
      const parsed = new URL(value);
      const normalizedPath = parsed.pathname.endsWith('/') && parsed.pathname !== '/' ? parsed.pathname.slice(0, -1) : parsed.pathname;
      return `${parsed.origin}${normalizedPath === '/' ? '' : normalizedPath}`;
    } catch (error) {
      console.warn('Invalid base URL provided, falling back to default:', error);
      return DEFAULT_BASE_URL;
    }
  }

  /**
   * Build URL with normalized base
   */
  buildUrl(endpoint = '') {
    const sanitizedBase = this.baseUrl.endsWith('/') ? this.baseUrl.slice(0, -1) : this.baseUrl;
    const sanitizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return `${sanitizedBase}${sanitizedEndpoint}`;
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