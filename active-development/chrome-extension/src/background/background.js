/**
 * Background script for Parserator Chrome Extension
 * Handles context menus, keyboard shortcuts, and service worker functionality
 */

// Import services (using importScripts for service worker)
try {
  importScripts('../lib/parserator-service.js', '../lib/storage.js');
} catch (error) {
  console.error('Failed to import scripts:', error);
}

class BackgroundService {
  constructor() {
    this.init();
  }

  async init() {
    // Set up event listeners
    this.setupEventListeners();
    
    // Initialize services
    await parseratorService.initialize();
    await storageManager.initializeDefaultSchemas();
    
    // Create context menus
    this.createContextMenus();
    
    console.log('Parserator background service initialized');
  }

  setupEventListeners() {
    // Extension installation/startup
    chrome.runtime.onInstalled.addListener(this.handleInstalled.bind(this));
    chrome.runtime.onStartup.addListener(this.handleStartup.bind(this));

    // Context menu clicks
    chrome.contextMenus.onClicked.addListener(this.handleContextMenuClick.bind(this));

    // Keyboard commands
    chrome.commands.onCommand.addListener(this.handleCommand.bind(this));

    // Messages from content scripts and popup
    chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));

    // Tab updates for auto-detection
    chrome.tabs.onUpdated.addListener(this.handleTabUpdated.bind(this));

    // Side panel handling
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
  }

  async handleInstalled(details) {
    if (details.reason === 'install') {
      // First time install
      await this.showWelcomeNotification();
      chrome.runtime.openOptionsPage();
    } else if (details.reason === 'update') {
      // Extension updated
      await this.showUpdateNotification();
    }
  }

  async handleStartup() {
    // Extension started
    await parseratorService.initialize();
    await storageManager.initializeDefaultSchemas();
  }

  createContextMenus() {
    // Remove existing menus
    chrome.contextMenus.removeAll(() => {
      // Main parse menu
      chrome.contextMenus.create({
        id: 'parse-with-parserator',
        title: 'Parse with Parserator',
        contexts: ['selection'],
        visible: true
      });

      // Quick parse submenu
      chrome.contextMenus.create({
        id: 'quick-parse',
        title: 'Quick Parse (Default Schema)',
        contexts: ['selection'],
        parentId: 'parse-with-parserator'
      });

      // Schema-specific parsing submenu
      chrome.contextMenus.create({
        id: 'parse-with-schema',
        title: 'Parse with Schema...',
        contexts: ['selection'],
        parentId: 'parse-with-parserator'
      });

      // Separator
      chrome.contextMenus.create({
        id: 'separator1',
        type: 'separator',
        contexts: ['selection'],
        parentId: 'parse-with-parserator'
      });

      // Auto-detect and parse
      chrome.contextMenus.create({
        id: 'auto-detect-parse',
        title: 'Auto-detect and Parse',
        contexts: ['selection'],
        parentId: 'parse-with-parserator'
      });

      // Open side panel
      chrome.contextMenus.create({
        id: 'open-sidepanel',
        title: 'Open Parserator Panel',
        contexts: ['page', 'selection']
      });

      // Add dynamic schema menus
      this.addSchemaMenus();
    });
  }

  async addSchemaMenus() {
    const schemas = await storageManager.getSchemas();
    const maxMenuItems = 5; // Limit menu items to avoid clutter

    schemas.slice(0, maxMenuItems).forEach((schema, index) => {
      chrome.contextMenus.create({
        id: `schema-${schema.id}`,
        title: schema.name,
        contexts: ['selection'],
        parentId: 'parse-with-schema'
      });
    });

    if (schemas.length > maxMenuItems) {
      chrome.contextMenus.create({
        id: 'more-schemas',
        title: `... and ${schemas.length - maxMenuItems} more`,
        contexts: ['selection'],
        parentId: 'parse-with-schema'
      });
    }
  }

  async handleContextMenuClick(info, tab) {
    const selectedText = info.selectionText;

    switch (info.menuItemId) {
      case 'quick-parse':
        await this.quickParse(selectedText, tab);
        break;

      case 'auto-detect-parse':
        await this.autoDetectAndParse(selectedText, tab);
        break;

      case 'open-sidepanel':
        await this.openSidePanel(tab.id);
        break;

      case 'more-schemas':
        await this.openPopupForSchemaSelection(tab);
        break;

      default:
        if (info.menuItemId.startsWith('schema-')) {
          const schemaId = info.menuItemId.replace('schema-', '');
          await this.parseWithSchema(selectedText, schemaId, tab);
        }
        break;
    }
  }

  async handleCommand(command) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    switch (command) {
      case 'parse-selection':
        await this.parseCurrentSelection(tab);
        break;

      case 'quick-parse':
        await this.quickParseCurrentSelection(tab);
        break;

      case 'toggle-sidepanel':
        await this.toggleSidePanel(tab.id);
        break;
    }
  }

  async handleMessage(message, sender, sendResponse) {
    try {
      switch (message.action) {
        case 'parse-text':
          const result = await this.parseText(message.data);
          sendResponse({ success: true, data: result });
          break;

        case 'get-schemas':
          const schemas = await storageManager.getSchemas();
          sendResponse({ success: true, data: schemas });
          break;

        case 'save-schema':
          const savedSchema = await storageManager.saveSchema(message.data);
          await this.updateContextMenus();
          sendResponse({ success: true, data: savedSchema });
          break;

        case 'delete-schema':
          await storageManager.deleteSchema(message.data.id);
          await this.updateContextMenus();
          sendResponse({ success: true });
          break;

        case 'get-parsed-data':
          const parsedData = await storageManager.getParsedData();
          sendResponse({ success: true, data: parsedData });
          break;

        case 'open-sidepanel':
          await this.openSidePanel(sender.tab?.id);
          sendResponse({ success: true });
          break;

        case 'test-connection':
          const isConnected = await parseratorService.testConnection();
          sendResponse({ success: true, data: isConnected });
          break;

        case 'get-usage':
          const usage = await parseratorService.getUsage();
          sendResponse({ success: true, data: usage });
          break;

        case 'auto-detect-content':
          const detectedData = await this.autoDetectPageContent(sender.tab);
          sendResponse({ success: true, data: detectedData });
          break;

        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      console.error('Background message handler error:', error);
      sendResponse({ success: false, error: error.message });
    }

    return true; // Keep message channel open for async response
  }

  async handleTabUpdated(tabId, changeInfo, tab) {
    if (changeInfo.status === 'complete' && tab.url) {
      const settings = await storageManager.getSettings();
      
      if (settings.autoDetect) {
        // Inject content script if needed and trigger auto-detection
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['src/content/content.js']
          });
        } catch (error) {
          // Content script might already be injected
          console.debug('Content script injection skipped:', error);
        }
      }
    }
  }

  async parseCurrentSelection(tab) {
    try {
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: () => window.getSelection().toString()
      });

      const selectedText = result.result;
      if (!selectedText) {
        await this.showNotification('No text selected', 'Please select some text to parse.');
        return;
      }

      // Open popup for schema selection
      await this.openPopupForParsing(tab, selectedText);
    } catch (error) {
      await this.showNotification('Error', 'Failed to get selected text: ' + error.message);
    }
  }

  async quickParseCurrentSelection(tab) {
    try {
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: () => window.getSelection().toString()
      });

      const selectedText = result.result;
      if (!selectedText) {
        await this.showNotification('No text selected', 'Please select some text to parse.');
        return;
      }

      await this.quickParse(selectedText, tab);
    } catch (error) {
      await this.showNotification('Error', 'Failed to parse selection: ' + error.message);
    }
  }

  async quickParse(text, tab) {
    try {
      const settings = await storageManager.getSettings();
      let schema = settings.defaultSchema;

      if (!schema) {
        // Use a default schema
        schema = {
          name: 'string',
          description: 'string',
          value: 'string'
        };
      }

      const result = await parseratorService.parse(text, schema);
      
      // Save result
      const dataEntry = await storageManager.saveParsedData({
        url: tab.url,
        inputData: text,
        outputSchema: schema,
        parsedData: result.parsedData,
        metadata: result.metadata,
        schemaUsed: 'quick-parse'
      });

      // Show result
      await this.showParseResult(result, tab);
      
    } catch (error) {
      await this.showNotification('Parse Error', error.message);
    }
  }

  async parseWithSchema(text, schemaId, tab) {
    try {
      const schema = await storageManager.getSchema(schemaId);
      if (!schema) {
        throw new Error('Schema not found');
      }

      const result = await parseratorService.parse(text, schema.schema);
      
      // Save result
      await storageManager.saveParsedData({
        url: tab.url,
        inputData: text,
        outputSchema: schema.schema,
        parsedData: result.parsedData,
        metadata: result.metadata,
        schemaUsed: schema.name
      });

      // Show result
      await this.showParseResult(result, tab);
      
    } catch (error) {
      await this.showNotification('Parse Error', error.message);
    }
  }

  async autoDetectAndParse(text, tab) {
    try {
      // Simple auto-detection logic based on content patterns
      let detectedSchema;

      if (this.detectContactInfo(text)) {
        const schemas = await storageManager.getSchemas();
        detectedSchema = schemas.find(s => s.id === 'default_contact')?.schema;
      } else if (this.detectProductInfo(text)) {
        const schemas = await storageManager.getSchemas();
        detectedSchema = schemas.find(s => s.id === 'default_product')?.schema;
      } else if (this.detectEventInfo(text)) {
        const schemas = await storageManager.getSchemas();
        detectedSchema = schemas.find(s => s.id === 'default_event')?.schema;
      } else {
        // Generic schema
        detectedSchema = {
          title: 'string',
          description: 'string',
          category: 'string',
          data: 'string'
        };
      }

      const result = await parseratorService.parse(text, detectedSchema);
      
      // Save result
      await storageManager.saveParsedData({
        url: tab.url,
        inputData: text,
        outputSchema: detectedSchema,
        parsedData: result.parsedData,
        metadata: result.metadata,
        schemaUsed: 'auto-detect'
      });

      // Show result
      await this.showParseResult(result, tab);
      
    } catch (error) {
      await this.showNotification('Parse Error', error.message);
    }
  }

  async parseText(data) {
    const result = await parseratorService.parse(
      data.inputData,
      data.outputSchema,
      data.instructions
    );

    // Save result if tab info provided
    if (data.tabUrl) {
      await storageManager.saveParsedData({
        url: data.tabUrl,
        inputData: data.inputData,
        outputSchema: data.outputSchema,
        parsedData: result.parsedData,
        metadata: result.metadata,
        schemaUsed: data.schemaName || 'custom'
      });
    }

    return result;
  }

  async showParseResult(result, tab) {
    const settings = await storageManager.getSettings();
    
    if (settings.autoOpenResults) {
      await this.openSidePanel(tab.id);
    }
    
    if (settings.showNotifications) {
      await this.showNotification(
        'Parse Complete',
        `Successfully parsed with ${result.metadata.confidence}% confidence`
      );
    }
  }

  async openSidePanel(tabId) {
    try {
      await chrome.sidePanel.open({ tabId });
    } catch (error) {
      console.error('Failed to open side panel:', error);
    }
  }

  async toggleSidePanel(tabId) {
    // Chrome doesn't have a direct toggle, so we'll just open it
    await this.openSidePanel(tabId);
  }

  async openPopupForParsing(tab, selectedText) {
    // Store selected text for popup to access
    await chrome.storage.local.set({
      tempSelectedText: selectedText,
      tempTabUrl: tab.url
    });
    
    // Open popup by simulating action click
    chrome.action.openPopup();
  }

  async openPopupForSchemaSelection(tab) {
    chrome.action.openPopup();
  }

  async updateContextMenus() {
    this.createContextMenus();
  }

  async autoDetectPageContent(tab) {
    // This would analyze the page content for structured data
    // Implementation would depend on specific detection algorithms
    return {
      detectedStructures: [],
      confidence: 0,
      suggestions: []
    };
  }

  // Content detection helpers
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

  // Notification helpers
  async showNotification(title, message) {
    const settings = await storageManager.getSettings();
    if (settings.showNotifications) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: '/assets/icons/icon-48.png',
        title: title,
        message: message
      });
    }
  }

  async showWelcomeNotification() {
    await this.showNotification(
      'Welcome to Parserator!',
      'Click the extension icon to get started or configure your API key in settings.'
    );
  }

  async showUpdateNotification() {
    await this.showNotification(
      'Parserator Updated',
      'New features and improvements are now available!'
    );
  }
}

// Initialize background service
const backgroundService = new BackgroundService();