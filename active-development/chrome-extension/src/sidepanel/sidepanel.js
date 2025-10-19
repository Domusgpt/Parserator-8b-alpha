/**
 * Side panel script for Parserator Chrome Extension
 * Handles the display of parsing results and data management
 */

const PANEL_EXPORT_VERSION = (() => {
  try {
    if (typeof chrome !== 'undefined' && chrome.runtime?.getManifest) {
      const manifest = chrome.runtime.getManifest();
      if (manifest?.version) {
        return manifest.version;
      }
    }
  } catch (error) {
    console.warn('Unable to determine panel export version:', error);
  }

  return 'dev';
})();

class SidePanelManager {
  constructor() {
    this.currentView = 'list'; // 'list' or 'detail'
    this.currentResult = null;
    this.results = [];
    this.currentDataView = 'json'; // 'json', 'table', 'raw'
    
    this.init();
  }

  async init() {
    await this.loadResults();
    this.setupEventListeners();
    this.updateUI();
  }

  async loadResults() {
    try {
      this.showLoading('Loading results...');
      
      const response = await this.sendMessage({ action: 'get-parsed-data' });
      this.results = response.success ? response.data : [];
      
      console.log('Loaded results:', this.results.length);
    } catch (error) {
      console.error('Failed to load results:', error);
      this.showToast('Failed to load results', 'error');
    } finally {
      this.hideLoading();
    }
  }

  setupEventListeners() {
    // Header actions
    document.getElementById('refreshBtn').addEventListener('click', () => {
      this.refresh();
    });

    document.getElementById('settingsBtn').addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });

    // Quick actions
    document.getElementById('newParseBtn').addEventListener('click', () => {
      this.openNewParse();
    });

    document.getElementById('getStartedBtn').addEventListener('click', () => {
      this.openNewParse();
    });

    // Results list actions
    document.getElementById('clearAllBtn').addEventListener('click', () => {
      this.clearAllResults();
    });

    document.getElementById('exportAllBtn').addEventListener('click', () => {
      this.exportAllResults();
    });

    // Detail view actions
    document.getElementById('backBtn').addEventListener('click', () => {
      this.showListView();
    });

    document.getElementById('copyResultBtn').addEventListener('click', () => {
      this.copyCurrentResult();
    });

    document.getElementById('downloadResultBtn').addEventListener('click', () => {
      this.downloadCurrentResult();
    });

    document.getElementById('deleteResultBtn').addEventListener('click', () => {
      this.deleteCurrentResult();
    });

    // Data view toggles
    document.getElementById('jsonViewBtn').addEventListener('click', () => {
      this.switchDataView('json');
    });

    document.getElementById('tableViewBtn').addEventListener('click', () => {
      this.switchDataView('table');
    });

    document.getElementById('rawViewBtn').addEventListener('click', () => {
      this.switchDataView('raw');
    });

    // Footer actions
    document.getElementById('helpBtn').addEventListener('click', () => {
      this.showHelp();
    });

    // Toast close
    document.querySelector('.toast-close').addEventListener('click', () => {
      this.hideToast();
    });

    // Listen for messages from background script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'refresh-results') {
        this.refresh();
      }
      return true;
    });
  }

  updateUI() {
    this.updateResultsCount();
    
    if (this.results.length === 0) {
      this.showEmptyState();
    } else {
      this.showListView();
    }
  }

  updateResultsCount() {
    const count = this.results.length;
    const text = count === 1 ? '1 result' : `${count} results`;
    document.getElementById('resultsCount').textContent = text;
  }

  showEmptyState() {
    document.getElementById('emptyState').classList.remove('hidden');
    document.getElementById('resultsList').classList.add('hidden');
    document.getElementById('resultDetail').classList.add('hidden');
    this.currentView = 'empty';
  }

  showListView() {
    document.getElementById('emptyState').classList.add('hidden');
    document.getElementById('resultsList').classList.remove('hidden');
    document.getElementById('resultDetail').classList.add('hidden');
    this.currentView = 'list';
    this.renderResultsList();
  }

  showDetailView(result) {
    document.getElementById('emptyState').classList.add('hidden');
    document.getElementById('resultsList').classList.add('hidden');
    document.getElementById('resultDetail').classList.remove('hidden');
    this.currentView = 'detail';
    this.currentResult = result;
    this.renderResultDetail();
  }

  renderResultsList() {
    const container = document.getElementById('resultsContainer');
    container.innerHTML = '';

    if (this.results.length === 0) {
      this.showEmptyState();
      return;
    }

    this.results.forEach(result => {
      const item = this.createResultItem(result);
      container.appendChild(item);
    });
  }

  createResultItem(result) {
    const item = document.createElement('div');
    item.className = 'result-item';
    
    const confidence = this.getConfidenceLevel(result.metadata?.confidence);
    const preview = this.getResultPreview(result.parsedData);
    const timeAgo = this.formatTimeAgo(result.timestamp);
    
    item.innerHTML = `
      <div class="result-header">
        <div class="result-title">${result.schemaUsed || 'Custom Parse'}</div>
        <div class="result-time">${timeAgo}</div>
      </div>
      <div class="result-preview">${preview}</div>
      <div class="result-meta">
        <span class="result-url">${this.formatUrl(result.url)}</span>
        <span class="result-confidence ${confidence.level}">${confidence.text}</span>
      </div>
    `;

    item.addEventListener('click', () => {
      this.showDetailView(result);
    });

    return item;
  }

  renderResultDetail() {
    if (!this.currentResult) return;

    // Render metadata
    this.renderMetadata();
    
    // Render data views
    this.renderDataViews();
    
    // Render original input
    document.getElementById('originalInput').textContent = this.currentResult.inputData;
    
    // Render schema
    document.getElementById('schemaUsed').textContent = 
      JSON.stringify(this.currentResult.outputSchema, null, 2);
  }

  renderMetadata() {
    const container = document.getElementById('resultMetadata');
    const metadata = this.currentResult.metadata;
    
    const items = [
      { label: 'Confidence', value: `${metadata?.confidence || 0}%` },
      { label: 'Processing Time', value: `${metadata?.processingTimeMs || 0}ms` },
      { label: 'Tokens Used', value: metadata?.tokensUsed || 0 },
      { label: 'Complexity', value: metadata?.architectPlan?.estimatedComplexity || 'Unknown' },
      { label: 'Schema', value: this.currentResult.schemaUsed || 'Custom' },
      { label: 'Timestamp', value: this.formatFullDate(this.currentResult.timestamp) }
    ];

    container.innerHTML = items.map(item => `
      <div class="metadata-item">
        <div class="metadata-label">${item.label}</div>
        <div class="metadata-value">${item.value}</div>
      </div>
    `).join('');
  }

  renderDataViews() {
    const data = this.currentResult.parsedData;
    
    // JSON view
    document.getElementById('jsonView').textContent = JSON.stringify(data, null, 2);
    
    // Table view
    this.renderTableView(data);
    
    // Raw view
    document.getElementById('rawView').textContent = this.currentResult.inputData;
    
    // Set active view
    this.switchDataView(this.currentDataView);
  }

  renderTableView(data) {
    const container = document.getElementById('tableView');
    
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      container.innerHTML = '<p style="padding: 12px; color: #6b7280;">Table view not available for this data type</p>';
      return;
    }

    const table = document.createElement('table');
    table.className = 'data-table';
    
    // Create header
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    headerRow.innerHTML = '<th>Field</th><th>Value</th><th>Type</th>';
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    // Create body
    const tbody = document.createElement('tbody');
    Object.entries(data).forEach(([key, value]) => {
      const row = document.createElement('tr');
      const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
      const type = Array.isArray(value) ? 'array' : typeof value;
      
      row.innerHTML = `
        <td><strong>${key}</strong></td>
        <td>${valueStr}</td>
        <td><code>${type}</code></td>
      `;
      tbody.appendChild(row);
    });
    table.appendChild(tbody);
    
    container.innerHTML = '';
    container.appendChild(table);
  }

  switchDataView(view) {
    this.currentDataView = view;
    
    // Update toggle buttons
    document.querySelectorAll('.view-toggle-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    document.getElementById(`${view}ViewBtn`).classList.add('active');
    
    // Show/hide views
    document.querySelectorAll('.data-view').forEach(viewEl => {
      viewEl.classList.add('hidden');
    });
    document.getElementById(`${view}View`).classList.remove('hidden');
  }

  async refresh() {
    await this.loadResults();
    this.updateUI();
    this.showToast('Results refreshed', 'success');
  }

  openNewParse() {
    // Open the popup for new parse
    chrome.action.openPopup();
  }

  async clearAllResults() {
    if (!confirm('Clear all parsing results? This cannot be undone.')) {
      return;
    }

    try {
      await chrome.storage.local.set({ parserator_parsed_data: [] });
      this.results = [];
      this.updateUI();
      this.showToast('All results cleared', 'success');
    } catch (error) {
      this.showToast('Failed to clear results', 'error');
    }
  }

  exportAllResults() {
    if (this.results.length === 0) {
      this.showToast('No results to export', 'warning');
      return;
    }

    const exportData = {
      exportedAt: new Date().toISOString(),
      version: PANEL_EXPORT_VERSION,
      count: this.results.length,
      results: this.results
    };

    this.downloadJson(exportData, 'parserator-results.json');
    this.showToast('Results exported successfully', 'success');
  }

  async copyCurrentResult() {
    if (!this.currentResult) return;

    try {
      const jsonText = JSON.stringify(this.currentResult.parsedData, null, 2);
      await navigator.clipboard.writeText(jsonText);
      this.showToast('Copied to clipboard', 'success');
    } catch (error) {
      this.showToast('Failed to copy', 'error');
    }
  }

  downloadCurrentResult() {
    if (!this.currentResult) return;

    const filename = `parserator-result-${Date.now()}.json`;
    this.downloadJson(this.currentResult.parsedData, filename);
    this.showToast('Download started', 'success');
  }

  async deleteCurrentResult() {
    if (!this.currentResult) return;

    if (!confirm('Delete this result? This cannot be undone.')) {
      return;
    }

    try {
      // Remove from storage
      const filteredResults = this.results.filter(r => r.id !== this.currentResult.id);
      await chrome.storage.local.set({ parserator_parsed_data: filteredResults });
      
      // Update local state
      this.results = filteredResults;
      this.currentResult = null;
      
      // Update UI
      this.updateUI();
      this.showToast('Result deleted', 'success');
      
    } catch (error) {
      this.showToast('Failed to delete result', 'error');
    }
  }

  showHelp() {
    const helpContent = `
Parserator Side Panel Help:

• Click on any result to view details
• Use the data view toggles to see JSON, table, or raw views
• Copy results to clipboard or download as JSON
• Export all results for backup
• Clear all results to free up storage

Keyboard shortcuts:
• Ctrl+Shift+P: Parse selected text
• Ctrl+Shift+Q: Quick parse
• Ctrl+Shift+S: Toggle side panel
• Alt+P: Open popup

Need more help? Visit parserator.com
    `.trim();

    alert(helpContent);
  }

  // Utility methods
  getConfidenceLevel(confidence) {
    if (!confidence || confidence < 0) {
      return { level: 'low', text: 'Unknown' };
    } else if (confidence >= 80) {
      return { level: 'high', text: `${confidence}%` };
    } else if (confidence >= 60) {
      return { level: 'medium', text: `${confidence}%` };
    } else {
      return { level: 'low', text: `${confidence}%` };
    }
  }

  getResultPreview(data) {
    if (!data || typeof data !== 'object') {
      return 'No data';
    }

    const entries = Object.entries(data);
    if (entries.length === 0) {
      return 'Empty result';
    }

    const [key, value] = entries[0];
    const valueStr = typeof value === 'string' ? value : JSON.stringify(value);
    return `${key}: ${valueStr.substring(0, 50)}${valueStr.length > 50 ? '...' : ''}`;
  }

  formatTimeAgo(timestamp) {
    const now = new Date();
    const date = new Date(timestamp);
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) {
      return 'Just now';
    } else if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else {
      return `${diffDays}d ago`;
    }
  }

  formatFullDate(timestamp) {
    return new Date(timestamp).toLocaleString();
  }

  formatUrl(url) {
    if (!url || url === 'unknown') {
      return 'Unknown page';
    }

    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch (error) {
      return url.substring(0, 30) + '...';
    }
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

  showLoading(message = 'Loading...') {
    const overlay = document.getElementById('loadingOverlay');
    const text = document.querySelector('.loading-text');
    text.textContent = message;
    overlay.classList.remove('hidden');
  }

  hideLoading() {
    document.getElementById('loadingOverlay').classList.add('hidden');
  }

  showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    const messageEl = document.querySelector('.toast-message');
    
    messageEl.textContent = message;
    toast.className = `toast ${type}`;
    toast.classList.remove('hidden');

    // Auto-hide after 3 seconds
    setTimeout(() => {
      this.hideToast();
    }, 3000);
  }

  hideToast() {
    document.getElementById('toast').classList.add('hidden');
  }

  async sendMessage(message) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, (response) => {
        resolve(response || { success: false, error: 'No response' });
      });
    });
  }
}

// Initialize side panel when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new SidePanelManager();
});