# Parserator Chrome Extension - Installation Guide

## Quick Installation (Developer Mode)

### Prerequisites
- Google Chrome browser (version 88 or later)
- Parserator API key from [parserator.com](https://parserator.com)

### Installation Steps

1. **Prepare Extension Files**
   ```bash
   cd /mnt/c/Users/millz/Parserator/chrome-extension
   chmod +x build.sh
   ./build.sh
   ```

2. **Load Extension in Chrome**
   - Open Google Chrome
   - Navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top-right corner)
   - Click "Load unpacked"
   - Select the `/mnt/c/Users/millz/Parserator/chrome-extension` directory
   - The Parserator extension should now appear in your extensions list

3. **Initial Configuration**
   - Click the Parserator icon in the toolbar (blue "P" icon)
   - Click the settings gear icon or go to Chrome menu > More tools > Extensions > Parserator > Options
   - Enter your Parserator API key (format: `pk_live_...` or `pk_test_...`)
   - Click "Test" to verify connection
   - Adjust other settings as needed
   - Click "Save Settings"

### Testing the Extension

#### Basic Functionality Test
1. **Context Menu Test**
   - Go to any webpage with text content
   - Select some text (e.g., a paragraph or contact information)
   - Right-click the selected text
   - Verify "Parse with Parserator" appears in context menu
   - Click it and test the submenu options

2. **Popup Interface Test**
   - Click the Parserator icon in the toolbar
   - Verify the popup opens with interface elements
   - Try entering text in the input field
   - Test schema selection dropdown
   - Try the "Quick Parse" button

3. **Side Panel Test**
   - Use any parse function to generate a result
   - Click "Open Panel" or use Ctrl+Shift+S
   - Verify the side panel opens showing results
   - Test different data view modes (JSON, Table, Raw)

4. **Keyboard Shortcuts Test**
   - Select text on any webpage
   - Press Ctrl+Shift+P (or Cmd+Shift+P on Mac)
   - Verify parsing action is triggered
   - Test other shortcuts:
     - Ctrl+Shift+Q: Quick parse
     - Ctrl+Shift+S: Toggle side panel
     - Alt+P: Open popup

#### Advanced Features Test
1. **Schema Management**
   - Open popup and click "New" next to schema selection
   - Create a custom schema with JSON format
   - Save and verify it appears in dropdown
   - Test editing and deleting schemas

2. **Data Export/Import**
   - Parse some text to generate results
   - Go to Options page
   - Test "Export Results" and "Export Schemas" buttons
   - Try importing schemas from a JSON file

3. **Auto-Detection**
   - Find text with contact information (email, phone)
   - Select and use "Auto-detect and Parse" from context menu
   - Verify appropriate schema is automatically selected

### Troubleshooting

#### Extension Not Loading
- **Check Console**: Open Chrome DevTools (F12) and check for errors
- **File Permissions**: Ensure all files are readable
- **Manifest Errors**: Verify manifest.json is valid JSON

#### API Connection Issues
- **API Key Format**: Must start with `pk_live_` or `pk_test_`
- **Network Access**: Check if your network allows API calls to parserator.com
- **Quota Limits**: Verify your API key has remaining quota

#### Context Menu Not Appearing
- **Text Selection**: Ensure text is actually selected before right-clicking
- **Page Refresh**: Try refreshing the page
- **Extension Reload**: Go to chrome://extensions/ and click reload on Parserator

#### Side Panel Not Opening
- **Chrome Version**: Side panel requires Chrome 114+
- **Browser Restart**: Try closing and reopening Chrome
- **Permission Check**: Verify extension has "sidePanel" permission

### Development Mode Features

When running in developer mode, you have access to:

1. **Console Logging**: Detailed logs in browser console
2. **Hot Reload**: Changes to files reflect after extension reload
3. **Error Details**: Full error messages and stack traces
4. **Storage Inspection**: View stored data in Chrome DevTools

### File Structure Verification

Ensure your directory structure looks like this:
```
chrome-extension/
├── manifest.json
├── src/
│   ├── background/
│   │   └── background.js
│   ├── content/
│   │   └── content.js
│   ├── popup/
│   │   ├── popup.html
│   │   ├── popup.css
│   │   └── popup.js
│   ├── options/
│   │   ├── options.html
│   │   ├── options.css
│   │   └── options.js
│   ├── sidepanel/
│   │   ├── sidepanel.html
│   │   ├── sidepanel.css
│   │   └── sidepanel.js
│   └── lib/
│       ├── parserator-service.js
│       └── storage.js
├── assets/
│   └── icons/
│       ├── icon-16.svg
│       ├── icon-24.svg
│       ├── icon-32.svg
│       ├── icon-48.svg
│       └── icon-128.svg
└── README.md
```

### Performance Considerations

- **Memory Usage**: Extension uses minimal memory, mostly for stored schemas and recent results
- **Storage Limits**: Chrome extensions have storage quotas; large result sets may need cleanup
- **API Calls**: Each parse operation uses one API request from your quota
- **Background Processing**: Service worker sleeps when inactive to save resources

### Security Notes

- **API Key Storage**: Keys are stored securely using Chrome's encrypted storage
- **Data Privacy**: Only selected text is sent to Parserator API
- **Local Processing**: All UI and management happens locally in your browser
- **No Tracking**: Extension does not collect or transmit usage analytics

### Support

If you encounter issues:

1. **Check Logs**: Open Chrome DevTools Console for error messages
2. **Verify Setup**: Double-check API key and configuration
3. **Test Connection**: Use the "Test" button in settings
4. **Email Support**: phillips.paul.email@gmail.com
5. **Documentation**: Visit parserator.com/docs

### Next Steps

Once installed and working:

1. **Create Custom Schemas**: Define schemas for your specific data types
2. **Set Default Schema**: Configure quick parse behavior
3. **Customize Shortcuts**: Adjust keyboard shortcuts in Chrome settings
4. **Export Backup**: Export your schemas for backup/sharing
5. **Optimize Settings**: Adjust auto-detection and notification preferences

The extension is now ready for production use with your Parserator API account!