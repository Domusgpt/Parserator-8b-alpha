/**
 * Content script for Parserator Chrome Extension
 * Handles page content detection, text selection, and UI injection
 */

class ParseratorContentScript {
  constructor() {
    this.isInitialized = false;
    this.selectionPopup = null;
    this.highlightedElements = [];
    this.detectedStructures = [];
    this.settings = null;
    
    this.init();
  }

  async init() {
    if (this.isInitialized) return;
    
    try {
      // Get extension settings
      this.settings = await this.getSettings();
      
      // Set up event listeners
      this.setupEventListeners();
      
      // Auto-detect structured data if enabled
      if (this.settings.autoDetect) {
        await this.detectStructuredData();
      }
      
      this.isInitialized = true;
      console.log('Parserator content script initialized');
    } catch (error) {
      console.error('Failed to initialize Parserator content script:', error);
    }
  }

  setupEventListeners() {
    // Text selection events
    document.addEventListener('mouseup', this.handleTextSelection.bind(this));
    document.addEventListener('keyup', this.handleTextSelection.bind(this));
    
    // Click events to hide popup
    document.addEventListener('click', this.handleDocumentClick.bind(this));
    
    // Keyboard shortcuts
    document.addEventListener('keydown', this.handleKeydown.bind(this));
    
    // Message listener for background script communication
    chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));
    
    // Page visibility changes
    document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
  }

  async handleTextSelection(event) {
    // Small delay to ensure selection is complete
    setTimeout(async () => {
      const selection = window.getSelection();
      const selectedText = selection.toString().trim();
      
      if (selectedText.length > 10) {
        await this.showSelectionPopup(selection, selectedText);
      } else {
        this.hideSelectionPopup();
      }
    }, 100);
  }

  async showSelectionPopup(selection, selectedText) {
    // Remove existing popup
    this.hideSelectionPopup();
    
    // Get selection position
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    
    // Create popup element
    this.selectionPopup = this.createSelectionPopup(selectedText);
    
    // Position popup
    this.selectionPopup.style.left = `${rect.left + window.scrollX}px`;
    this.selectionPopup.style.top = `${rect.bottom + window.scrollY + 5}px`;
    
    // Add to page
    document.body.appendChild(this.selectionPopup);
    
    // Add event listeners
    this.setupPopupEventListeners(selectedText);
  }

  createSelectionPopup(selectedText) {
    const popup = document.createElement('div');
    popup.id = 'parserator-selection-popup';
    popup.innerHTML = `
      <div class="parserator-popup-content">
        <div class="parserator-popup-header">
          <img src="${chrome.runtime.getURL('assets/icons/icon-16.png')}" alt="Parserator" class="parserator-icon">
          <span>Parserator</span>
          <button class="parserator-close" title="Close">&times;</button>
        </div>
        <div class="parserator-popup-body">
          <button class="parserator-btn parserator-btn-primary" data-action="quick-parse">
            Quick Parse
          </button>
          <button class="parserator-btn parserator-btn-secondary" data-action="parse-with-schema">
            Parse with Schema
          </button>
          <button class="parserator-btn parserator-btn-tertiary" data-action="auto-detect">
            Auto-detect
          </button>
        </div>
      </div>
    `;
    
    // Add styles
    this.addPopupStyles();
    
    return popup;
  }

  addPopupStyles() {
    if (document.getElementById('parserator-popup-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'parserator-popup-styles';
    style.textContent = `
      #parserator-selection-popup {
        position: absolute;
        z-index: 10000;
        background: white;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        min-width: 200px;
        max-width: 300px;
        overflow: hidden;
      }
      
      .parserator-popup-content {
        padding: 0;
      }
      
      .parserator-popup-header {
        display: flex;
        align-items: center;
        padding: 8px 12px;
        background: #f8fafc;
        border-bottom: 1px solid #e2e8f0;
        font-weight: 600;
        color: #374151;
      }
      
      .parserator-icon {
        width: 16px;
        height: 16px;
        margin-right: 6px;
      }
      
      .parserator-close {
        margin-left: auto;
        background: none;
        border: none;
        font-size: 18px;
        cursor: pointer;
        color: #6b7280;
        padding: 0;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
      }
      
      .parserator-close:hover {
        background: #e5e7eb;
        color: #374151;
      }
      
      .parserator-popup-body {
        padding: 12px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      
      .parserator-btn {
        padding: 8px 12px;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 13px;
        font-weight: 500;
        transition: all 0.2s;
        text-align: left;
      }
      
      .parserator-btn-primary {
        background: #3b82f6;
        color: white;
      }
      
      .parserator-btn-primary:hover {
        background: #2563eb;
      }
      
      .parserator-btn-secondary {
        background: #f3f4f6;
        color: #374151;
        border: 1px solid #d1d5db;
      }
      
      .parserator-btn-secondary:hover {
        background: #e5e7eb;
      }
      
      .parserator-btn-tertiary {
        background: #ecfdf5;
        color: #059669;
        border: 1px solid #d1fae5;
      }
      
      .parserator-btn-tertiary:hover {
        background: #d1fae5;
      }
      
      .parserator-highlight {
        background-color: rgba(59, 130, 246, 0.2) !important;
        border: 2px solid rgba(59, 130, 246, 0.4) !important;
        border-radius: 3px !important;
        position: relative !important;
      }
      
      .parserator-structure-indicator {
        position: absolute;
        top: -20px;
        left: 0;
        background: #3b82f6;
        color: white;
        padding: 2px 6px;
        border-radius: 3px;
        font-size: 11px;
        font-weight: 500;
        z-index: 10001;
      }
    `;
    
    document.head.appendChild(style);
  }

  setupPopupEventListeners(selectedText) {
    const popup = this.selectionPopup;
    
    // Close button
    popup.querySelector('.parserator-close').addEventListener('click', () => {
      this.hideSelectionPopup();
    });
    
    // Action buttons
    popup.addEventListener('click', async (e) => {
      const action = e.target.getAttribute('data-action');
      if (!action) return;
      
      e.preventDefault();
      e.stopPropagation();
      
      switch (action) {
        case 'quick-parse':
          await this.quickParseSelection(selectedText);
          break;
        case 'parse-with-schema':
          await this.parseWithSchemaSelection(selectedText);
          break;
        case 'auto-detect':
          await this.autoDetectSelection(selectedText);
          break;
      }
      
      this.hideSelectionPopup();
    });
  }

  hideSelectionPopup() {
    if (this.selectionPopup) {
      this.selectionPopup.remove();
      this.selectionPopup = null;
    }
  }

  handleDocumentClick(event) {
    // Hide popup if clicking outside
    if (this.selectionPopup && !this.selectionPopup.contains(event.target)) {
      this.hideSelectionPopup();
    }
  }

  async handleKeydown(event) {
    // Handle keyboard shortcuts
    if (event.ctrlKey || event.metaKey) {
      switch (event.key) {
        case 'p':
          if (event.shiftKey) {
            event.preventDefault();
            await this.parseCurrentSelection();
          }
          break;
        case 'q':
          if (event.shiftKey) {
            event.preventDefault();
            await this.quickParseCurrentSelection();
          }
          break;
      }
    }
  }

  async handleMessage(message, sender, sendResponse) {
    switch (message.action) {
      case 'get-selected-text':
        const selectedText = window.getSelection().toString();
        sendResponse({ text: selectedText });
        break;
        
      case 'highlight-structures':
        await this.highlightDetectedStructures(message.data);
        sendResponse({ success: true });
        break;
        
      case 'clear-highlights':
        this.clearHighlights();
        sendResponse({ success: true });
        break;
        
      case 'detect-structures':
        const structures = await this.detectStructuredData();
        sendResponse({ structures });
        break;
    }
    
    return true;
  }

  handleVisibilityChange() {
    if (document.hidden) {
      this.hideSelectionPopup();
    }
  }

  async detectStructuredData() {
    const structures = [];
    
    try {
      // Detect JSON-LD structured data
      const jsonLdElements = document.querySelectorAll('script[type="application/ld+json"]');
      jsonLdElements.forEach((element, index) => {
        try {
          const data = JSON.parse(element.textContent);
          structures.push({
            type: 'json-ld',
            data: data,
            element: element,
            confidence: 0.9,
            id: `jsonld-${index}`
          });
        } catch (error) {
          console.debug('Invalid JSON-LD:', error);
        }
      });
      
      // Detect microdata
      const microdataElements = document.querySelectorAll('[itemscope]');
      microdataElements.forEach((element, index) => {
        const itemType = element.getAttribute('itemtype');
        if (itemType) {
          structures.push({
            type: 'microdata',
            itemType: itemType,
            element: element,
            confidence: 0.8,
            id: `microdata-${index}`
          });
        }
      });
      
      // Detect common patterns
      await this.detectCommonPatterns(structures);
      
      // Detect tables
      this.detectTables(structures);
      
      // Detect lists
      this.detectLists(structures);
      
      this.detectedStructures = structures;
      
      // Notify background script
      chrome.runtime.sendMessage({
        action: 'structures-detected',
        data: structures.map(s => ({
          type: s.type,
          confidence: s.confidence,
          preview: this.getStructurePreview(s)
        }))
      });
      
      return structures;
    } catch (error) {
      console.error('Error detecting structured data:', error);
      return [];
    }
  }

  async detectCommonPatterns(structures) {
    const text = document.body.innerText;
    
    // Contact information
    const emailMatches = text.match(/[\w\.-]+@[\w\.-]+\.\w+/g);
    const phoneMatches = text.match(/[\+]?[1-9][\d\s\-\(\)]{8,}/g);
    
    if (emailMatches || phoneMatches) {
      structures.push({
        type: 'contact-info',
        data: { emails: emailMatches, phones: phoneMatches },
        confidence: 0.7,
        id: 'contact-pattern'
      });
    }
    
    // Product information
    const priceMatches = text.match(/\$[\d,]+\.?\d*/g);
    if (priceMatches && priceMatches.length > 0) {
      structures.push({
        type: 'product-info',
        data: { prices: priceMatches },
        confidence: 0.6,
        id: 'product-pattern'
      });
    }
    
    // Dates and times
    const dateMatches = text.match(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b|\b\w+\s+\d{1,2},?\s+\d{2,4}\b/g);
    const timeMatches = text.match(/\b\d{1,2}:\d{2}\s*(AM|PM|am|pm)?\b/g);
    
    if (dateMatches || timeMatches) {
      structures.push({
        type: 'event-info',
        data: { dates: dateMatches, times: timeMatches },
        confidence: 0.6,
        id: 'event-pattern'
      });
    }
  }

  detectTables(structures) {
    const tables = document.querySelectorAll('table');
    tables.forEach((table, index) => {
      const rows = table.querySelectorAll('tr');
      if (rows.length > 1) {
        structures.push({
          type: 'table',
          element: table,
          data: { rows: rows.length },
          confidence: 0.8,
          id: `table-${index}`
        });
      }
    });
  }

  detectLists(structures) {
    const lists = document.querySelectorAll('ul, ol');
    lists.forEach((list, index) => {
      const items = list.querySelectorAll('li');
      if (items.length > 2) {
        structures.push({
          type: 'list',
          element: list,
          data: { items: items.length },
          confidence: 0.7,
          id: `list-${index}`
        });
      }
    });
  }

  getStructurePreview(structure) {
    if (structure.element) {
      return structure.element.innerText.substring(0, 100) + '...';
    }
    return JSON.stringify(structure.data).substring(0, 100) + '...';
  }

  async highlightDetectedStructures(structureIds = null) {
    this.clearHighlights();
    
    const structuresToHighlight = structureIds 
      ? this.detectedStructures.filter(s => structureIds.includes(s.id))
      : this.detectedStructures;
    
    structuresToHighlight.forEach(structure => {
      if (structure.element) {
        structure.element.classList.add('parserator-highlight');
        
        // Add indicator
        const indicator = document.createElement('div');
        indicator.className = 'parserator-structure-indicator';
        indicator.textContent = structure.type.toUpperCase();
        structure.element.appendChild(indicator);
        
        this.highlightedElements.push({
          element: structure.element,
          indicator: indicator
        });
      }
    });
  }

  clearHighlights() {
    this.highlightedElements.forEach(({ element, indicator }) => {
      element.classList.remove('parserator-highlight');
      if (indicator && indicator.parentNode) {
        indicator.parentNode.removeChild(indicator);
      }
    });
    this.highlightedElements = [];
  }

  async quickParseSelection(selectedText) {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'quick-parse',
        data: { text: selectedText, url: window.location.href }
      });
      
      if (response.success) {
        this.showNotification('Parse complete!', 'View results in side panel');
      } else {
        this.showNotification('Parse failed', response.error);
      }
    } catch (error) {
      this.showNotification('Error', error.message);
    }
  }

  async parseWithSchemaSelection(selectedText) {
    // Store selection for popup to access
    await chrome.storage.local.set({
      tempSelectedText: selectedText,
      tempTabUrl: window.location.href
    });
    
    // Request popup to open
    chrome.runtime.sendMessage({
      action: 'open-popup-for-schema'
    });
  }

  async autoDetectSelection(selectedText) {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'auto-detect-parse',
        data: { text: selectedText, url: window.location.href }
      });
      
      if (response.success) {
        this.showNotification('Auto-parse complete!', 'View results in side panel');
      } else {
        this.showNotification('Parse failed', response.error);
      }
    } catch (error) {
      this.showNotification('Error', error.message);
    }
  }

  async parseCurrentSelection() {
    const selectedText = window.getSelection().toString().trim();
    if (!selectedText) {
      this.showNotification('No text selected', 'Please select some text first');
      return;
    }
    
    await this.parseWithSchemaSelection(selectedText);
  }

  async quickParseCurrentSelection() {
    const selectedText = window.getSelection().toString().trim();
    if (!selectedText) {
      this.showNotification('No text selected', 'Please select some text first');
      return;
    }
    
    await this.quickParseSelection(selectedText);
  }

  showNotification(title, message) {
    // Create temporary notification
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #3b82f6;
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
      z-index: 10002;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      max-width: 300px;
    `;
    
    notification.innerHTML = `
      <div style="font-weight: 600; margin-bottom: 4px;">${title}</div>
      <div style="opacity: 0.9;">${message}</div>
    `;
    
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 3000);
  }

  async getSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(['parserator_settings'], (result) => {
        const defaultSettings = {
          autoDetect: true,
          showNotifications: true,
          autoOpenResults: true,
          keyboardShortcuts: true
        };
        
        const settings = { ...defaultSettings, ...(result.parserator_settings || {}) };
        resolve(settings);
      });
    });
  }
}

// Initialize content script
const parseratorContent = new ParseratorContentScript();