/**
 * Popup script for Parserator Chrome Extension
 * Handles the main popup interface
 */

class PopupManager {
  constructor() {
    this.currentSchema = null;
    this.editingSchemaId = null;
    this.recentResults = [];
    this.schemas = [];
    this.tempData = null;
    
    this.init();
  }

  async init() {
    await this.loadData();
    this.setupEventListeners();
    this.updateUI();
    await this.checkConnection();
    await this.loadTempData();
  }

  async loadData() {
    try {
      // Load schemas
      const response = await this.sendMessage({ action: 'get-schemas' });
      this.schemas = response.success ? response.data : [];
      
      // Load recent results
      const resultsResponse = await this.sendMessage({ action: 'get-parsed-data' });
      this.recentResults = resultsResponse.success ? resultsResponse.data.slice(0, 5) : [];
      
      console.log('Data loaded:', { schemas: this.schemas.length, results: this.recentResults.length });
    } catch (error) {
      console.error('Failed to load data:', error);
      this.showNotification('Failed to load data', 'error');
    }
  }

  async loadTempData() {
    // Check if there's temporary selected text from content script
    try {
      const result = await chrome.storage.local.get(['tempSelectedText', 'tempTabUrl']);
      if (result.tempSelectedText) {
        document.getElementById('inputText').value = result.tempSelectedText;
        this.tempData = result;
        
        // Clear temp data
        chrome.storage.local.remove(['tempSelectedText', 'tempTabUrl']);
        
        // Update UI
        this.updateParseButton();
      }
    } catch (error) {
      console.debug('No temp data available');
    }
  }

  setupEventListeners() {
    // Header actions
    document.getElementById('settingsBtn').addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });

    // Quick actions
    document.getElementById('quickParseBtn').addEventListener('click', () => {
      this.quickParse();
    });

    document.getElementById('autoDetectBtn').addEventListener('click', () => {
      this.autoDetectParse();
    });

    document.getElementById('sidePanelBtn').addEventListener('click', () => {
      this.openSidePanel();
    });

    // Text input
    document.getElementById('inputText').addEventListener('input', () => {
      this.updateParseButton();
    });

    document.getElementById('pasteBtn').addEventListener('click', () => {
      this.pasteText();
    });

    // Schema management
    document.getElementById('schemaSelect').addEventListener('change', (e) => {
      this.selectSchema(e.target.value);
    });

    document.getElementById('newSchemaBtn').addEventListener('click', () => {
      this.openSchemaModal();
    });

    document.getElementById('editSchemaBtn').addEventListener('click', () => {
      this.editCurrentSchema();
    });

    // Parse button
    document.getElementById('parseBtn').addEventListener('click', () => {
      this.parseText();
    });

    // Recent results
    document.getElementById('clearResultsBtn').addEventListener('click', () => {
      this.clearResults();
    });

    // Footer actions
    document.getElementById('refreshBtn').addEventListener('click', () => {
      this.refresh();
    });

    // Schema modal
    document.getElementById('closeModalBtn').addEventListener('click', () => {
      this.closeSchemaModal();
    });

    document.getElementById('cancelSchemaBtn').addEventListener('click', () => {
      this.closeSchemaModal();
    });

    document.getElementById('saveSchemaBtn').addEventListener('click', () => {
      this.saveSchema();
    });

    // Schema form validation
    document.getElementById('schemaJson').addEventListener('input', () => {
      this.validateSchemaJson();
    });

    // Modal backdrop click
    document.getElementById('schemaModal').addEventListener('click', (e) => {
      if (e.target.id === 'schemaModal') {
        this.closeSchemaModal();
      }
    });
  }

  updateUI() {
    this.populateSchemaSelect();
    this.populateRecentResults();
    this.updateParseButton();
  }

  populateSchemaSelect() {
    const select = document.getElementById('schemaSelect');
    select.innerHTML = '<option value="">Select a schema...</option>';

    this.schemas.forEach(schema => {
      const option = document.createElement('option');
      option.value = schema.id;
      option.textContent = schema.name;
      if (schema.isDefault) {
        option.textContent += ' (Default)';
      }
      select.appendChild(option);
    });

    // Select first schema if none selected
    if (this.schemas.length > 0 && !this.currentSchema) {
      select.value = this.schemas[0].id;
      this.selectSchema(this.schemas[0].id);
    }
  }

  populateRecentResults() {
    const container = document.getElementById('recentResults');
    
    if (this.recentResults.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📄</div>
          <div class="empty-text">No recent results</div>
        </div>
      `;
      return;
    }

    container.innerHTML = '';
    this.recentResults.forEach(result => {
      const item = document.createElement('div');
      item.className = 'result-item';
      item.innerHTML = `
        <div class="result-meta">
          <span>${this.formatDate(result.timestamp)}</span>
          <span>${result.schemaUsed || 'Custom'}</span>
        </div>
        <div class="result-preview">${this.getResultPreview(result)}</div>
      `;
      
      item.addEventListener('click', () => {
        this.viewResult(result);
      });
      
      container.appendChild(item);
    });
  }

  selectSchema(schemaId) {
    this.currentSchema = this.schemas.find(s => s.id === schemaId);
    
    const editBtn = document.getElementById('editSchemaBtn');
    const preview = document.getElementById('schemaPreview');
    
    if (this.currentSchema) {
      editBtn.disabled = false;
      preview.classList.remove('hidden');
      preview.querySelector('pre').textContent = JSON.stringify(this.currentSchema.schema, null, 2);
    } else {
      editBtn.disabled = true;
      preview.classList.add('hidden');
    }
    
    this.updateParseButton();
  }

  updateParseButton() {
    const parseBtn = document.getElementById('parseBtn');
    const inputText = document.getElementById('inputText').value.trim();
    const hasSchema = this.currentSchema || this.getDefaultSchema();
    
    parseBtn.disabled = !inputText || !hasSchema;
  }

  getDefaultSchema() {
    return {
      name: 'string',
      description: 'string',
      value: 'string'
    };
  }

  async quickParse() {
    const inputText = document.getElementById('inputText').value.trim();
    if (!inputText) {
      await this.getSelectedText();
      return;
    }

    await this.performParse(inputText, this.getDefaultSchema(), 'Quick Parse');
  }

  async autoDetectParse() {
    const inputText = document.getElementById('inputText').value.trim();
    if (!inputText) {
      await this.getSelectedText();
      return;
    }

    // Simple auto-detection logic
    let detectedSchema = this.getDefaultSchema();
    
    if (this.detectContactInfo(inputText)) {
      const contactSchema = this.schemas.find(s => s.id === 'default_contact');
      if (contactSchema) detectedSchema = contactSchema.schema;
    } else if (this.detectProductInfo(inputText)) {
      const productSchema = this.schemas.find(s => s.id === 'default_product');
      if (productSchema) detectedSchema = productSchema.schema;
    } else if (this.detectEventInfo(inputText)) {
      const eventSchema = this.schemas.find(s => s.id === 'default_event');
      if (eventSchema) detectedSchema = eventSchema.schema;
    }

    await this.performParse(inputText, detectedSchema, 'Auto-detect');
  }

  async parseText() {
    const inputText = document.getElementById('inputText').value.trim();
    const schema = this.currentSchema ? this.currentSchema.schema : this.getDefaultSchema();
    const schemaName = this.currentSchema ? this.currentSchema.name : 'Default';

    await this.performParse(inputText, schema, schemaName);
  }

  async performParse(inputData, outputSchema, schemaName) {
    const parseBtn = document.getElementById('parseBtn');
    
    try {
      // Show loading state
      parseBtn.classList.add('loading');
      parseBtn.disabled = true;

      // Get current tab URL
      let tabUrl = 'unknown';
      if (this.tempData?.tempTabUrl) {
        tabUrl = this.tempData.tempTabUrl;
      } else {
        try {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          tabUrl = tab?.url || 'unknown';
        } catch (error) {
          console.debug('Could not get tab URL:', error);
        }
      }

      // Perform parse
      const response = await this.sendMessage({
        action: 'parse-text',
        data: {
          inputData,
          outputSchema,
          schemaName,
          tabUrl
        }
      });

      if (response.success) {
        this.showNotification('Parse successful!', 'success');
        await this.openSidePanel();
        await this.loadData();
        this.updateUI();
        
        // Clear input if it was from temp data
        if (this.tempData) {
          document.getElementById('inputText').value = '';
          this.tempData = null;
        }
      } else {
        this.showNotification(response.error || 'Parse failed', 'error');
      }
    } catch (error) {
      console.error('Parse error:', error);
      this.showNotification(error.message || 'Parse failed', 'error');
    } finally {
      parseBtn.classList.remove('loading');
      parseBtn.disabled = false;
      this.updateParseButton();
    }
  }

  async getSelectedText() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'get-selected-text' });
      
      if (response.text && response.text.trim()) {
        document.getElementById('inputText').value = response.text;
        this.updateParseButton();
      } else {
        this.showNotification('No text selected on page', 'warning');
      }
    } catch (error) {
      this.showNotification('Could not get selected text', 'error');
    }
  }

  async pasteText() {
    try {
      const text = await navigator.clipboard.readText();
      document.getElementById('inputText').value = text;
      this.updateParseButton();
    } catch (error) {
      this.showNotification('Could not paste text', 'error');
    }
  }

  async openSidePanel() {
    try {
      const response = await this.sendMessage({ action: 'open-sidepanel' });
      if (!response.success) {
        this.showNotification('Could not open side panel', 'error');
      }
    } catch (error) {
      this.showNotification('Could not open side panel', 'error');
    }
  }

  openSchemaModal(schema = null) {
    const modal = document.getElementById('schemaModal');
    const title = document.getElementById('modalTitle');
    const form = document.getElementById('schemaForm');
    
    this.editingSchemaId = schema?.id || null;
    
    if (schema) {
      title.textContent = 'Edit Schema';
      document.getElementById('schemaName').value = schema.name;
      document.getElementById('schemaDescription').value = schema.description || '';
      document.getElementById('schemaJson').value = JSON.stringify(schema.schema, null, 2);
      document.getElementById('schemaInstructions').value = schema.instructions || '';
    } else {
      title.textContent = 'New Schema';
      form.reset();
      document.getElementById('schemaJson').value = '{\n  "": ""\n}';
    }
    
    modal.classList.remove('hidden');
    document.getElementById('schemaName').focus();
  }

  closeSchemaModal() {
    document.getElementById('schemaModal').classList.add('hidden');
    this.editingSchemaId = null;
  }

  editCurrentSchema() {
    if (this.currentSchema) {
      this.openSchemaModal(this.currentSchema);
    }
  }

  validateSchemaJson() {
    const textarea = document.getElementById('schemaJson');
    const saveBtn = document.getElementById('saveSchemaBtn');
    
    try {
      JSON.parse(textarea.value);
      textarea.style.borderColor = '#d1d5db';
      saveBtn.disabled = false;
    } catch (error) {
      textarea.style.borderColor = '#ef4444';
      saveBtn.disabled = true;
    }
  }

  async saveSchema() {
    const name = document.getElementById('schemaName').value.trim();
    const description = document.getElementById('schemaDescription').value.trim();
    const jsonText = document.getElementById('schemaJson').value.trim();
    const instructions = document.getElementById('schemaInstructions').value.trim();
    
    if (!name) {
      this.showNotification('Schema name is required', 'error');
      return;
    }
    
    let schema;
    try {
      schema = JSON.parse(jsonText);
    } catch (error) {
      this.showNotification('Invalid JSON schema', 'error');
      return;
    }
    
    if (Object.keys(schema).length === 0) {
      this.showNotification('Schema cannot be empty', 'error');
      return;
    }
    
    try {
      const schemaData = {
        id: this.editingSchemaId,
        name,
        description,
        schema,
        instructions: instructions || undefined
      };
      
      const response = await this.sendMessage({
        action: 'save-schema',
        data: schemaData
      });
      
      if (response.success) {
        this.showNotification('Schema saved successfully', 'success');
        this.closeSchemaModal();
        await this.loadData();
        this.updateUI();
        
        // Select the newly saved schema
        if (response.data?.id) {
          document.getElementById('schemaSelect').value = response.data.id;
          this.selectSchema(response.data.id);
        }
      } else {
        this.showNotification(response.error || 'Failed to save schema', 'error');
      }
    } catch (error) {
      this.showNotification('Failed to save schema: ' + error.message, 'error');
    }
  }

  async clearResults() {
    if (confirm('Clear all recent results?')) {
      try {
        await chrome.storage.local.set({ parserator_parsed_data: [] });
        this.recentResults = [];
        this.populateRecentResults();
        this.showNotification('Results cleared', 'success');
      } catch (error) {
        this.showNotification('Failed to clear results', 'error');
      }
    }
  }

  async viewResult(result) {
    await this.openSidePanel();
    window.close();
  }

  async refresh() {
    await this.loadData();
    this.updateUI();
    await this.checkConnection();
    this.showNotification('Refreshed', 'success');
  }

  async checkConnection() {
    const statusBar = document.getElementById('connectionStatus');
    const usageInfo = document.getElementById('usageInfo');
    
    try {
      const response = await this.sendMessage({ action: 'test-connection' });
      
      if (response.success && response.data) {
        statusBar.className = 'status-bar connected';
        statusBar.querySelector('.status-text').textContent = 'Connected';
        statusBar.classList.remove('hidden');
        
        // Get usage info
        try {
          const usageResponse = await this.sendMessage({ action: 'get-usage' });
          if (usageResponse.success) {
            const usage = usageResponse.data.usage;
            usageInfo.textContent = `${usage.monthlyUsage}/${usage.monthlyLimit} requests`;
          }
        } catch (error) {
          console.debug('Could not get usage info:', error);
        }
        
        // Hide status bar after a moment if connected
        setTimeout(() => {
          if (statusBar.classList.contains('connected')) {
            statusBar.classList.add('hidden');
          }
        }, 2000);
      } else {
        statusBar.className = 'status-bar error';
        statusBar.querySelector('.status-text').textContent = 'Not configured';
        statusBar.classList.remove('hidden');
        usageInfo.textContent = 'Configure API key';
      }
    } catch (error) {
      statusBar.className = 'status-bar error';
      statusBar.querySelector('.status-text').textContent = 'Connection error';
      statusBar.classList.remove('hidden');
      usageInfo.textContent = 'Check settings';
    }
  }

  // Helper methods
  detectContactInfo(text) {
    const emailPattern = /[\w\.-]+@[\w\.-]+\.\w+/;
    const phonePattern = /[\+]?[1-9][\d\s\-\(\)]{8,}/;
    return emailPattern.test(text) || phonePattern.test(text);
  }

  detectProductInfo(text) {
    const pricePattern = /\$[\d,]+\.?\d*/;
    const productKeywords = /\b(product|item|price|buy|purchase|sale)\b/i;
    return pricePattern.test(text) || productKeywords.test(text);
  }

  detectEventInfo(text) {
    const datePattern = /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b|\b\w+\s+\d{1,2},?\s+\d{2,4}\b/;
    const timePattern = /\b\d{1,2}:\d{2}\s*(AM|PM|am|pm)?\b/;
    const eventKeywords = /\b(event|meeting|conference|workshop|seminar)\b/i;
    return datePattern.test(text) || timePattern.test(text) || eventKeywords.test(text);
  }

  formatDate(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffHours < 1) {
      return 'Just now';
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else {
      return date.toLocaleDateString();
    }
  }

  getResultPreview(result) {
    if (result.parsedData && typeof result.parsedData === 'object') {
      const keys = Object.keys(result.parsedData);
      if (keys.length > 0) {
        const firstValue = result.parsedData[keys[0]];
        return `${keys[0]}: ${String(firstValue).substring(0, 50)}...`;
      }
    }
    return 'Parse result';
  }

  showNotification(message, type = 'info') {
    // Create temporary notification
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: ${type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#3b82f6'};
      color: white;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 12px;
      z-index: 2000;
      max-width: 250px;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 3000);
  }

  async sendMessage(message) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, (response) => {
        resolve(response || { success: false, error: 'No response' });
      });
    });
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new PopupManager();
});