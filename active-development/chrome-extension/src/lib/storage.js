/**
 * Storage utility for Chrome Extension
 * Handles schemas, parsed data, and settings
 */

class StorageManager {
  constructor() {
    this.SCHEMAS_KEY = 'parserator_schemas';
    this.PARSED_DATA_KEY = 'parserator_parsed_data';
    this.SETTINGS_KEY = 'parserator_settings';
    this.MAX_STORED_RESULTS = 100;
  }

  /**
   * Get all stored schemas
   */
  async getSchemas() {
    return new Promise((resolve) => {
      chrome.storage.local.get([this.SCHEMAS_KEY], (result) => {
        const schemas = result[this.SCHEMAS_KEY] || [];
        resolve(schemas);
      });
    });
  }

  /**
   * Save a new schema
   */
  async saveSchema(schema) {
    const schemas = await this.getSchemas();
    
    // Generate ID if not provided
    if (!schema.id) {
      schema.id = this.generateId();
    }
    
    // Add timestamp
    schema.createdAt = new Date().toISOString();
    schema.updatedAt = new Date().toISOString();

    // Check if schema already exists (update)
    const existingIndex = schemas.findIndex(s => s.id === schema.id);
    if (existingIndex >= 0) {
      schema.createdAt = schemas[existingIndex].createdAt;
      schemas[existingIndex] = schema;
    } else {
      schemas.push(schema);
    }

    return new Promise((resolve) => {
      chrome.storage.local.set({ [this.SCHEMAS_KEY]: schemas }, () => {
        resolve(schema);
      });
    });
  }

  /**
   * Delete a schema
   */
  async deleteSchema(schemaId) {
    const schemas = await this.getSchemas();
    const filteredSchemas = schemas.filter(s => s.id !== schemaId);
    
    return new Promise((resolve) => {
      chrome.storage.local.set({ [this.SCHEMAS_KEY]: filteredSchemas }, () => {
        resolve();
      });
    });
  }

  /**
   * Get schema by ID
   */
  async getSchema(schemaId) {
    const schemas = await this.getSchemas();
    return schemas.find(s => s.id === schemaId);
  }

  /**
   * Save parsed data result
   */
  async saveParsedData(result) {
    const parsedData = await this.getParsedData();
    
    const dataEntry = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      url: result.url || 'Unknown',
      inputData: result.inputData,
      outputSchema: result.outputSchema,
      parsedData: result.parsedData,
      metadata: result.metadata,
      schemaUsed: result.schemaUsed || null
    };

    parsedData.unshift(dataEntry);
    
    // Keep only the last MAX_STORED_RESULTS
    if (parsedData.length > this.MAX_STORED_RESULTS) {
      parsedData.splice(this.MAX_STORED_RESULTS);
    }

    return new Promise((resolve) => {
      chrome.storage.local.set({ [this.PARSED_DATA_KEY]: parsedData }, () => {
        resolve(dataEntry);
      });
    });
  }

  /**
   * Get all parsed data
   */
  async getParsedData() {
    return new Promise((resolve) => {
      chrome.storage.local.get([this.PARSED_DATA_KEY], (result) => {
        const parsedData = result[this.PARSED_DATA_KEY] || [];
        resolve(parsedData);
      });
    });
  }

  /**
   * Delete parsed data entry
   */
  async deleteParsedData(dataId) {
    const parsedData = await this.getParsedData();
    const filteredData = parsedData.filter(d => d.id !== dataId);
    
    return new Promise((resolve) => {
      chrome.storage.local.set({ [this.PARSED_DATA_KEY]: filteredData }, () => {
        resolve();
      });
    });
  }

  /**
   * Clear all parsed data
   */
  async clearParsedData() {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [this.PARSED_DATA_KEY]: [] }, () => {
        resolve();
      });
    });
  }

  /**
   * Export parsed data as JSON
   */
  async exportParsedData() {
    const parsedData = await this.getParsedData();
    const exportData = {
      exportedAt: new Date().toISOString(),
      version: '1.0.0',
      data: parsedData
    };
    
    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Get extension settings
   */
  async getSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.get([this.SETTINGS_KEY], (result) => {
        const defaultSettings = {
          autoDetect: true,
          showNotifications: true,
          autoOpenResults: true,
          defaultSchema: null,
          keyboardShortcuts: true
        };
        
        const settings = { ...defaultSettings, ...(result[this.SETTINGS_KEY] || {}) };
        resolve(settings);
      });
    });
  }

  /**
   * Save extension settings
   */
  async saveSettings(settings) {
    return new Promise((resolve) => {
      chrome.storage.sync.set({ [this.SETTINGS_KEY]: settings }, () => {
        resolve(settings);
      });
    });
  }

  /**
   * Get storage usage statistics
   */
  async getStorageStats() {
    return new Promise((resolve) => {
      chrome.storage.local.getBytesInUse(null, (bytesInUse) => {
        chrome.storage.local.get(null, (items) => {
          const schemas = items[this.SCHEMAS_KEY] || [];
          const parsedData = items[this.PARSED_DATA_KEY] || [];
          
          resolve({
            totalBytes: bytesInUse,
            schemasCount: schemas.length,
            parsedDataCount: parsedData.length,
            maxStorageBytes: chrome.storage.local.QUOTA_BYTES
          });
        });
      });
    });
  }

  /**
   * Import schemas from JSON
   */
  async importSchemas(jsonString) {
    try {
      const importData = JSON.parse(jsonString);
      const schemas = Array.isArray(importData) ? importData : importData.schemas;
      
      if (!Array.isArray(schemas)) {
        throw new Error('Invalid import format');
      }

      const currentSchemas = await this.getSchemas();
      const mergedSchemas = [...currentSchemas];

      for (const schema of schemas) {
        // Generate new ID to avoid conflicts
        schema.id = this.generateId();
        schema.importedAt = new Date().toISOString();
        mergedSchemas.push(schema);
      }

      return new Promise((resolve) => {
        chrome.storage.local.set({ [this.SCHEMAS_KEY]: mergedSchemas }, () => {
          resolve(schemas.length);
        });
      });
    } catch (error) {
      throw new Error('Failed to import schemas: ' + error.message);
    }
  }

  /**
   * Export schemas as JSON
   */
  async exportSchemas() {
    const schemas = await this.getSchemas();
    const exportData = {
      exportedAt: new Date().toISOString(),
      version: '1.0.0',
      schemas: schemas
    };
    
    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Generate unique ID
   */
  generateId() {
    return 'parserator_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Get default schemas
   */
  getDefaultSchemas() {
    return [
      {
        id: 'default_contact',
        name: 'Contact Information',
        description: 'Extract contact details from text',
        schema: {
          name: 'string',
          email: 'string',
          phone: 'string',
          company: 'string',
          address: 'string'
        },
        isDefault: true
      },
      {
        id: 'default_product',
        name: 'Product Information',
        description: 'Extract product details',
        schema: {
          name: 'string',
          price: 'number',
          description: 'string',
          category: 'string',
          brand: 'string',
          availability: 'boolean'
        },
        isDefault: true
      },
      {
        id: 'default_event',
        name: 'Event Information',
        description: 'Extract event details',
        schema: {
          title: 'string',
          date: 'string',
          time: 'string',
          location: 'string',
          description: 'string',
          organizer: 'string'
        },
        isDefault: true
      }
    ];
  }

  /**
   * Initialize default schemas if none exist
   */
  async initializeDefaultSchemas() {
    const schemas = await this.getSchemas();
    if (schemas.length === 0) {
      const defaultSchemas = this.getDefaultSchemas();
      for (const schema of defaultSchemas) {
        await this.saveSchema(schema);
      }
    }
  }
}

// Create singleton instance
const storageManager = new StorageManager();

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = storageManager;
} else if (typeof window !== 'undefined') {
  window.storageManager = storageManager;
}

// For ES modules
export default storageManager;