# Parserator Chrome Extension

A powerful Chrome browser extension that brings AI-powered text parsing directly to your browsing experience. Transform unstructured text into structured JSON data with intelligent schema detection and customizable parsing rules.

## Features

### 🎯 Core Functionality
- **Context Menu Integration**: Right-click selected text and choose "Parse with Parserator"
- **Smart Auto-Detection**: Automatically identifies and suggests appropriate parsing schemas
- **Quick Parse**: Instant parsing with default schemas for common data types
- **Custom Schemas**: Create, edit, and manage your own parsing schemas
- **Side Panel Results**: View detailed parsing results in a dedicated side panel

### ⚡ User Experience
- **Popup Interface**: Quick access toolbar popup for immediate parsing
- **Keyboard Shortcuts**: Power user shortcuts for rapid text processing
- **Content Script Integration**: Seamless page interaction with visual feedback
- **Real-time Previews**: See parsing results before committing

### 📊 Data Management
- **Local Storage**: Save parsed results and schemas locally
- **Export/Import**: Backup and share your schemas and results
- **Usage Analytics**: Track API usage and parsing statistics
- **Bulk Operations**: Clear, export, or manage multiple results at once

### 🔧 Configuration
- **API Key Management**: Secure storage of Parserator API credentials
- **Custom Endpoints**: Support for self-hosted Parserator instances
- **Notification Controls**: Customizable success/error notifications
- **Auto-detection Settings**: Configure automatic content analysis

## Installation

### From Chrome Web Store
*Coming soon - extension will be published to the Chrome Web Store*

### Manual Installation (Developer Mode)
1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the `chrome-extension` directory
5. The Parserator extension will appear in your extensions list

## Setup

1. **Get API Key**: Visit [parserator.com/api-keys](https://parserator.com/api-keys) to obtain your API key
2. **Configure Extension**: Click the Parserator icon and go to Settings, or right-click the extension icon and choose "Options"
3. **Enter API Key**: Paste your API key (format: `pk_live_...` or `pk_test_...`)
4. **Test Connection**: Click "Test" to verify your API key works
5. **Customize Settings**: Adjust auto-detection, notifications, and other preferences

## Usage

### Quick Start
1. **Select Text**: Highlight any text on a webpage
2. **Right-click**: Choose "Parse with Parserator" from the context menu
3. **Choose Method**:
   - **Quick Parse**: Uses default schema for instant results
   - **Parse with Schema**: Select from your saved schemas
   - **Auto-detect**: Let AI determine the best parsing approach
4. **View Results**: Results appear in the side panel automatically

### Advanced Usage

#### Custom Schemas
1. Click the Parserator icon to open the popup
2. Click "New" next to Schema selection
3. Define your JSON schema:
```json
{
  "name": "string",
  "email": "string",
  "phone": "string",
  "company": "string"
}
```
4. Save and use for consistent parsing

#### Keyboard Shortcuts
- `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (Mac): Parse selected text
- `Ctrl+Shift+Q` (Windows/Linux) or `Cmd+Shift+Q` (Mac): Quick parse with default schema
- `Ctrl+Shift+S` (Windows/Linux) or `Cmd+Shift+S` (Mac): Toggle side panel
- `Alt+P`: Open Parserator popup

#### Data Export
1. Open the side panel by clicking the extension icon
2. Use "Export" button to download results as JSON
3. Import/export schemas through the Options page

## API Integration

The extension integrates with the Parserator API:

- **Base URL**: `https://api.parserator.com` (configurable)
- **Authentication**: Bearer token using your API key
- **Endpoints Used**:
  - `POST /v1/parse` - Main parsing endpoint
  - `GET /v1/usage` - Usage statistics
  - `GET /health` - Connection testing

## Storage & Privacy

### Local Storage
- **Schemas**: Stored locally in Chrome's storage
- **Results**: Recent parsing results cached locally (configurable limit)
- **Settings**: Extension preferences synced across Chrome instances
- **API Key**: Securely stored using Chrome's encrypted storage

### Privacy
- **No Data Collection**: Extension does not collect or transmit personal data
- **API Communication**: Only selected text is sent to Parserator API for processing
- **Local Processing**: All UI logic and data management happens locally
- **User Control**: Complete control over what data is parsed and stored

## Troubleshooting

### Common Issues

**Extension not working**
- Ensure you have a valid API key configured
- Check your internet connection
- Verify the API key format (`pk_live_...` or `pk_test_...`)

**Context menu not appearing**
- Make sure text is selected before right-clicking
- Try refreshing the page
- Check if the extension is enabled in `chrome://extensions/`

**Parsing errors**
- Verify your API key has sufficient quota
- Check if the selected text is too large (100KB limit)
- Ensure your schema is valid JSON

**Side panel not opening**
- The side panel feature requires Chrome 114+
- Try closing and reopening Chrome
- Check extension permissions

### Support
- **Documentation**: [parserator.com/docs](https://parserator.com/docs)
- **Support Email**: phillips.paul.email@gmail.com
- **GitHub Issues**: [github.com/domusgpt/parserator](https://github.com/domusgpt/parserator)

## Development

### Project Structure
```
chrome-extension/
├── manifest.json              # Extension manifest
├── src/
│   ├── background/           # Service worker
│   ├── content/             # Content scripts
│   ├── popup/               # Toolbar popup
│   ├── options/             # Settings page
│   ├── sidepanel/           # Results panel
│   └── lib/                 # Shared utilities
├── assets/
│   └── icons/               # Extension icons
└── README.md
```

### Building
```bash
npm run build    # Build for distribution
npm run package  # Create ZIP file
npm run clean    # Clean build artifacts
```

### Loading for Development
1. Open `chrome://extensions/`
2. Enable Developer mode
3. Click "Load unpacked"
4. Select the `chrome-extension` directory
5. Make changes and click "Reload" button

## License

Private/Proprietary - All rights reserved by Paul Phillips

## Changelog

### Version 1.0.0
- Initial release
- Context menu integration
- Popup interface
- Side panel results
- Schema management
- Keyboard shortcuts
- Auto-detection
- Export/import functionality
- Comprehensive settings page