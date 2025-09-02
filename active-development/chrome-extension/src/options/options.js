/**
 * Options page script for Parserator Chrome Extension
 * Handles settings configuration and management
 */

class OptionsManager {
  constructor() {
    this.isLoading = false;
    this.schemas = [];
    this.storageStats = {};
    
    this.init();
  }

  async init() {
    await this.loadSettings();
    this.setupEventListeners();
    await this.loadData();
    await this.checkConnection();
  }

  async loadSettings() {
    try {
      // Load API configuration
      const apiConfig = await this.getStorageData('sync', ['apiKey', 'baseUrl', 'timeout']);
      document.getElementById('apiKey').value = apiConfig.apiKey || '';
      document.getElementById('baseUrl').value = apiConfig.baseUrl || 'https://api.parserator.com';
      document.getElementById('timeout').value = (apiConfig.timeout || 30000) / 1000;

      // Load extension settings
      const settings = await this.getStorageData('sync', ['parserator_settings']);
      const extSettings = settings.parserator_settings || {};
      
      document.getElementById('autoDetect').checked = extSettings.autoDetect !== false;
      document.getElementById('showNotifications').checked = extSettings.showNotifications !== false;
      document.getElementById('autoOpenResults').checked = extSettings.autoOpenResults !== false;
      document.getElementById('keyboardShortcuts').checked = extSettings.keyboardShortcuts !== false;
      
      // Load default schema
      if (extSettings.defaultSchema) {
        document.getElementById('defaultSchemaJson').value = JSON.stringify(extSettings.defaultSchema, null, 2);
      }
      
    } catch (error) {
      console.error('Failed to load settings:', error);
      this.showStatus('Failed to load settings', 'error');
    }
  }

  async loadData() {
    try {
      // Load schemas for dropdown
      const response = await this.sendMessage({ action: 'get-schemas' });
      this.schemas = response.success ? response.data : [];
      this.populateSchemaSelect();
      
      // Load storage stats
      this.storageStats = await this.getStorageStats();
      this.updateStats();
      
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  }

  populateSchemaSelect() {
    const select = document.getElementById('defaultSchemaSelect');
    select.innerHTML = '<option value="">Auto-detect schema</option>';
    
    this.schemas.forEach(schema => {
      const option = document.createElement('option');
      option.value = schema.id;
      option.textContent = schema.name;
      if (schema.isDefault) {
        option.textContent += ' (Default)';
      }
      select.appendChild(option);
    });
  }

  updateStats() {
    document.getElementById('schemasCount').textContent = this.storageStats.schemasCount || 0;
    document.getElementById('resultsCount').textContent = this.storageStats.parsedDataCount || 0;
    
    const usedMB = ((this.storageStats.totalBytes || 0) / (1024 * 1024)).toFixed(2);
    const maxMB = ((this.storageStats.maxStorageBytes || 0) / (1024 * 1024)).toFixed(0);
    document.getElementById('storageUsed').textContent = `${usedMB}/${maxMB} MB`;
  }

  setupEventListeners() {
    // API key toggle
    document.getElementById('toggleApiKey').addEventListener('click', () => {
      this.toggleApiKeyVisibility();
    });

    // Test connection
    document.getElementById('testConnection').addEventListener('click', () => {
      this.testConnection();
    });

    // Save settings
    document.getElementById('saveSettings').addEventListener('click', () => {
      this.saveSettings();
    });

    // Reset settings
    document.getElementById('resetSettings').addEventListener('click', () => {
      this.resetSettings();
    });

    // Data management
    document.getElementById('exportSchemas').addEventListener('click', () => {
      this.exportSchemas();
    });

    document.getElementById('importSchemas').addEventListener('click', () => {
      this.importSchemas();
    });

    document.getElementById('exportResults').addEventListener('click', () => {
      this.exportResults();
    });

    document.getElementById('clearData').addEventListener('click', () => {
      this.clearAllData();
    });

    // File input for import
    document.getElementById('fileInput').addEventListener('change', (e) => {
      this.handleFileImport(e);
    });

    // Schema JSON validation
    document.getElementById('defaultSchemaJson').addEventListener('input', () => {
      this.validateSchemaJson();
    });

    // Auto-save on input changes
    this.setupAutoSave();
  }

  setupAutoSave() {
    const inputs = [
      'apiKey', 'baseUrl', 'timeout',
      'autoDetect', 'showNotifications', 'autoOpenResults', 'keyboardShortcuts',
      'defaultSchemaSelect', 'defaultSchemaJson'
    ];

    inputs.forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        const eventType = element.type === 'checkbox' ? 'change' : 'input';
        element.addEventListener(eventType, () => {
          this.debounce(() => this.autoSave(), 1000);
        });
      }
    });
  }

  toggleApiKeyVisibility() {
    const input = document.getElementById('apiKey');
    const button = document.getElementById('toggleApiKey');
    
    if (input.type === 'password') {
      input.type = 'text';
      button.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
          <line x1="1" y1="1" x2="23" y2="23"></line>
        </svg>
      `;
    } else {
      input.type = 'password';
      button.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
          <circle cx="12" cy="12" r="3"></circle>
        </svg>
      `;
    }
  }

  async testConnection() {
    const button = document.getElementById('testConnection');
    const status = document.getElementById('connectionStatus');
    
    try {
      button.classList.add('loading');
      button.disabled = true;

      // Save current API settings first
      await this.saveApiConfig();

      // Test connection
      const response = await this.sendMessage({ action: 'test-connection' });
      
      if (response.success && response.data) {
        status.className = 'status-indicator connected';
        status.querySelector('.status-text').textContent = 'Connected';
        this.showStatus('Connection successful!', 'success');
        
        // Get usage info
        await this.loadUsageInfo();
      } else {
        status.className = 'status-indicator error';
        status.querySelector('.status-text').textContent = 'Connection failed';
        this.showStatus('Connection failed. Check your API key.', 'error');
      }
    } catch (error) {
      status.className = 'status-indicator error';
      status.querySelector('.status-text').textContent = 'Error';
      this.showStatus('Connection error: ' + error.message, 'error');
    } finally {
      button.classList.remove('loading');
      button.disabled = false;
    }
  }

  async checkConnection() {
    const status = document.getElementById('connectionStatus');
    const apiKey = document.getElementById('apiKey').value.trim();
    
    if (!apiKey) {
      status.className = 'status-indicator';
      status.querySelector('.status-text').textContent = 'Not configured';
      return;
    }

    try {
      const response = await this.sendMessage({ action: 'test-connection' });
      
      if (response.success && response.data) {
        status.className = 'status-indicator connected';
        status.querySelector('.status-text').textContent = 'Connected';
        await this.loadUsageInfo();
      } else {
        status.className = 'status-indicator error';
        status.querySelector('.status-text').textContent = 'Connection failed';
      }
    } catch (error) {
      status.className = 'status-indicator error';
      status.querySelector('.status-text').textContent = 'Error';
    }
  }

  async loadUsageInfo() {
    try {
      const response = await this.sendMessage({ action: 'get-usage' });
      
      if (response.success) {
        const usage = response.data.usage;
        const apiKey = response.data.apiKey;
        
        document.getElementById('usageDetails').innerHTML = `
          <p><strong>Subscription:</strong> ${usage.subscriptionTier}</p>
          <p><strong>Usage:</strong> ${usage.monthlyUsage}/${usage.monthlyLimit} requests this month</p>
          <p><strong>Remaining:</strong> ${usage.remainingRequests} requests</p>
          <p><strong>Usage:</strong> ${usage.usagePercentage}%</p>
          ${apiKey.name ? `<p><strong>API Key:</strong> ${apiKey.name}</p>` : ''}
        `;
      }
    } catch (error) {
      console.debug('Could not load usage info:', error);
    }
  }

  async saveApiConfig() {
    const apiKey = document.getElementById('apiKey').value.trim();
    const baseUrl = document.getElementById('baseUrl').value.trim();
    const timeout = parseInt(document.getElementById('timeout').value) * 1000;

    await this.setStorageData('sync', {
      apiKey,
      baseUrl,
      timeout
    });
  }

  async saveSettings() {
    if (this.isLoading) return;
    
    try {
      this.isLoading = true;
      const saveButton = document.getElementById('saveSettings');
      saveButton.classList.add('loading');

      // Save API configuration
      await this.saveApiConfig();

      // Save extension settings
      const settings = {
        autoDetect: document.getElementById('autoDetect').checked,
        showNotifications: document.getElementById('showNotifications').checked,
        autoOpenResults: document.getElementById('autoOpenResults').checked,
        keyboardShortcuts: document.getElementById('keyboardShortcuts').checked,
        defaultSchema: this.getDefaultSchemaValue()
      };

      await this.setStorageData('sync', {
        parserator_settings: settings
      });

      this.showStatus('Settings saved successfully!', 'success');
      await this.checkConnection();
      
    } catch (error) {
      console.error('Failed to save settings:', error);
      this.showStatus('Failed to save settings: ' + error.message, 'error');
    } finally {
      this.isLoading = false;
      document.getElementById('saveSettings').classList.remove('loading');
    }
  }

  async autoSave() {
    if (this.isLoading) return;
    
    try {
      await this.saveSettings();
    } catch (error) {
      console.debug('Auto-save failed:', error);
    }
  }

  getDefaultSchemaValue() {
    const selectedSchemaId = document.getElementById('defaultSchemaSelect').value;
    const customSchemaJson = document.getElementById('defaultSchemaJson').value.trim();
    
    if (selectedSchemaId) {
      const schema = this.schemas.find(s => s.id === selectedSchemaId);
      return schema ? schema.schema : null;
    } else if (customSchemaJson) {
      try {
        return JSON.parse(customSchemaJson);
      } catch (error) {
        return null;
      }
    }
    
    return null;
  }

  validateSchemaJson() {
    const textarea = document.getElementById('defaultSchemaJson');
    const json = textarea.value.trim();
    
    if (!json) {
      textarea.style.borderColor = '#d1d5db';
      return;
    }
    
    try {
      JSON.parse(json);
      textarea.style.borderColor = '#10b981';
    } catch (error) {
      textarea.style.borderColor = '#ef4444';
    }
  }

  async resetSettings() {
    if (!confirm('Reset all settings to defaults? This cannot be undone.')) {
      return;
    }

    try {
      // Clear stored settings
      await chrome.storage.sync.clear();
      await chrome.storage.local.clear();
      
      // Reset form to defaults
      document.getElementById('apiKey').value = '';
      document.getElementById('baseUrl').value = 'https://api.parserator.com';
      document.getElementById('timeout').value = '30';
      document.getElementById('autoDetect').checked = true;
      document.getElementById('showNotifications').checked = true;
      document.getElementById('autoOpenResults').checked = true;
      document.getElementById('keyboardShortcuts').checked = true;
      document.getElementById('defaultSchemaSelect').value = '';
      document.getElementById('defaultSchemaJson').value = '';
      
      this.showStatus('Settings reset to defaults', 'success');
      await this.checkConnection();
      
    } catch (error) {
      this.showStatus('Failed to reset settings: ' + error.message, 'error');
    }
  }

  async exportSchemas() {
    try {
      const response = await this.sendMessage({ action: 'get-schemas' });
      
      if (response.success) {
        const exportData = {
          exportedAt: new Date().toISOString(),
          version: '1.0.0',
          schemas: response.data
        };
        
        this.downloadJson(exportData, 'parserator-schemas.json');
        this.showStatus('Schemas exported successfully', 'success');
      } else {
        this.showStatus('Failed to export schemas', 'error');
      }
    } catch (error) {
      this.showStatus('Export failed: ' + error.message, 'error');
    }
  }

  importSchemas() {
    document.getElementById('fileInput').click();
  }

  async handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const text = await this.readFile(file);
      const data = JSON.parse(text);
      
      let schemas;
      if (Array.isArray(data)) {
        schemas = data;
      } else if (data.schemas && Array.isArray(data.schemas)) {
        schemas = data.schemas;
      } else {
        throw new Error('Invalid file format');
      }
      
      // Import schemas
      let importedCount = 0;
      for (const schema of schemas) {
        try {
          await this.sendMessage({
            action: 'save-schema',
            data: {
              ...schema,
              id: null // Generate new ID
            }
          });
          importedCount++;
        } catch (error) {
          console.error('Failed to import schema:', schema.name, error);
        }
      }
      
      this.showStatus(`Imported ${importedCount} schemas successfully`, 'success');
      await this.loadData();
      
    } catch (error) {
      this.showStatus('Import failed: ' + error.message, 'error');
    } finally {
      event.target.value = ''; // Reset file input
    }
  }

  async exportResults() {
    try {
      const response = await this.sendMessage({ action: 'get-parsed-data' });
      
      if (response.success) {
        const exportData = {
          exportedAt: new Date().toISOString(),
          version: '1.0.0',
          results: response.data
        };
        
        this.downloadJson(exportData, 'parserator-results.json');
        this.showStatus('Results exported successfully', 'success');
      } else {
        this.showStatus('Failed to export results', 'error');
      }
    } catch (error) {
      this.showStatus('Export failed: ' + error.message, 'error');
    }
  }

  async clearAllData() {
    const confirmation = prompt(
      'This will permanently delete all schemas and parsed results. Type "DELETE" to confirm:'
    );
    
    if (confirmation !== 'DELETE') {
      return;
    }

    try {
      await chrome.storage.local.clear();
      this.showStatus('All data cleared successfully', 'success');
      await this.loadData();
    } catch (error) {
      this.showStatus('Failed to clear data: ' + error.message, 'error');
    }
  }

  // Utility methods
  async getStorageStats() {
    return new Promise((resolve) => {
      chrome.storage.local.getBytesInUse(null, (bytesInUse) => {
        chrome.storage.local.get(null, (items) => {
          const schemas = items.parserator_schemas || [];
          const parsedData = items.parserator_parsed_data || [];
          
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

  async getStorageData(area, keys) {
    return new Promise((resolve) => {
      chrome.storage[area].get(keys, resolve);
    });
  }

  async setStorageData(area, data) {
    return new Promise((resolve) => {
      chrome.storage[area].set(data, resolve);
    });
  }

  async sendMessage(message) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, (response) => {
        resolve(response || { success: false, error: 'No response' });
      });
    });
  }

  downloadJson(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  showStatus(message, type = 'info') {
    const status = document.getElementById('saveStatus');
    status.textContent = message;
    status.className = `footer-status ${type}`;
    
    setTimeout(() => {
      status.textContent = '';
      status.className = 'footer-status';
    }, 5000);
  }

  debounce(func, wait) {
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(func, wait);
  }
}

// Initialize options page when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new OptionsManager();
});