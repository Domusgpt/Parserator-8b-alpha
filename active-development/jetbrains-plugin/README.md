# Parserator JetBrains Plugin

A powerful JetBrains IDE plugin that integrates with the Parserator AI service for intelligent data parsing and structuring directly within your development environment.

## Features

### Core Functionality
- **AI-Powered Parsing**: Parse JSON, CSV, XML, and unstructured text data with intelligent schemas
- **Schema Management**: Create, validate, and manage custom parsing schemas
- **Multiple Data Formats**: Support for JSON, CSV, XML, TSV, YAML, HTML, and log formats
- **Real-time Validation**: Instant schema validation and data format detection

### IDE Integration
- **Context Menu Actions**: Right-click to parse selected text
- **Tool Window**: Dedicated panel for viewing parse results and managing sessions
- **Editor Folding**: Automatic folding of large parsed datasets
- **Line Markers**: Visual indicators for schema files and parsed data
- **Code Completion**: Schema field autocomplete in JSON files

### Developer Productivity
- **Bulk Operations**: Parse multiple files simultaneously
- **Export Options**: Export results to JSON, CSV, XML, Excel, and more
- **Code Generation**: Generate model classes from schemas in multiple languages
- **Version Control**: Integration with VCS for schema file management
- **Session History**: Track and replay parsing sessions

## Installation

### From JetBrains Marketplace
1. Open your JetBrains IDE (IntelliJ IDEA, WebStorm, PyCharm, etc.)
2. Go to `File` → `Settings` → `Plugins`
3. Search for "Parserator"
4. Click `Install` and restart your IDE

### Manual Installation
1. Download the latest release from [GitHub Releases](https://github.com/parserator/jetbrains-plugin/releases)
2. Go to `File` → `Settings` → `Plugins`
3. Click the gear icon and select `Install Plugin from Disk...`
4. Select the downloaded `.zip` file
5. Restart your IDE

## Configuration

### API Key Setup
1. Go to `File` → `Settings` → `Tools` → `Parserator`
2. Enter your Parserator API key
3. (Optional) Configure custom API URL if using a private instance
4. Click `Test Connection` to verify your settings

### Getting an API Key
1. Visit [parserator.com](https://parserator.com)
2. Sign up for an account
3. Navigate to your dashboard
4. Generate an API key in the API section

## Usage

### Basic Parsing
1. Select text in any editor
2. Right-click and choose `Parse with Parserator`
3. View results in the Parserator tool window

### Schema-Based Parsing
1. Create a schema file (`.pschema`) using `File` → `New` → `Parserator Schema`
2. Select text to parse
3. Right-click and choose `Parse with Schema...`
4. Select your schema and parse

### Creating Schemas
The plugin provides several schema templates:
- **Basic Schema**: General-purpose parsing schema
- **CSV Schema**: Optimized for CSV data with field validation
- **JSON Schema**: For complex nested JSON structures
- **XML Schema**: For XML document parsing

### Bulk Parsing
1. Go to `Tools` → `Parserator` → `Bulk Parse Files...`
2. Select files to parse
3. Choose a schema (optional)
4. Review results in the tool window

### Code Generation
1. Open a schema file
2. Go to `Code` → `Generate` → `Generate Code from Schema`
3. Choose target language (Java, Kotlin, Python, TypeScript, etc.)
4. Customize generation options
5. Generate model classes

## Supported File Types

### Input Formats
- **JSON**: Objects, arrays, and nested structures
- **CSV**: Comma-separated values with header detection
- **XML**: Well-formed XML documents
- **TSV**: Tab-separated values
- **YAML**: YAML documents and configurations
- **HTML**: HTML tables and structured content
- **Log Files**: Application logs with pattern recognition
- **Plain Text**: Unstructured text with AI parsing

### Output Formats
- **JSON**: Structured JSON objects
- **CSV**: Comma-separated values
- **XML**: Well-formed XML
- **Excel**: XLSX spreadsheets
- **TSV**: Tab-separated values
- **YAML**: YAML format
- **SQL**: INSERT statements
- **Parquet**: Columnar data format
- **Avro**: Binary serialization format

## Keyboard Shortcuts

| Action | Windows/Linux | macOS |
|--------|---------------|-------|
| Parse Selected Text | `Ctrl+Shift+P` | `Cmd+Shift+P` |
| Open Tool Window | `Alt+9` | `Cmd+9` |
| Create Schema | `Ctrl+Alt+S` | `Cmd+Option+S` |

## Tool Window

The Parserator tool window provides:
- **Session List**: History of all parsing operations
- **Tree View**: Hierarchical view of parsed data
- **Raw Data**: Formatted JSON/XML output
- **Metadata**: Parsing statistics and information
- **Export Options**: Quick export to various formats

## Settings

### General Settings
- **API Key**: Your Parserator API key
- **API URL**: Custom API endpoint (default: https://parserator.com/api)
- **Auto-validate schemas**: Automatically validate schemas on save
- **Enable notifications**: Show parsing status notifications

### UI Settings
- **Enable auto-folding**: Automatically fold large datasets
- **Folding threshold**: Number of lines before folding (default: 50)
- **Enable line markers**: Show visual indicators in editor
- **Tool window location**: Right, left, bottom, or floating

### Performance Settings
- **Request timeout**: Maximum time for API requests (default: 60s)
- **Cache results**: Cache parsing results locally
- **Cache expiration**: How long to keep cached results (default: 1 hour)
- **Max bulk items**: Maximum files for bulk operations (default: 100)

## Advanced Features

### Custom Headers
Add custom HTTP headers for API requests in the advanced settings.

### Proxy Support
Configure proxy settings for corporate environments.

### Retry Logic
Automatic retry with exponential backoff for failed requests.

### Schema Validation
Real-time validation of schema files with error highlighting and suggestions.

### Template System
Custom templates for code generation with support for multiple languages.

## Troubleshooting

### Common Issues

**"API key not configured"**
- Go to Settings → Tools → Parserator and enter your API key
- Click "Test Connection" to verify

**"Connection failed"**
- Check your internet connection
- Verify API key is correct
- Check if corporate firewall is blocking requests

**"Parse failed"**
- Check if selected text is valid for the chosen format
- Try using a different schema or auto-detection
- Check API rate limits

**"Plugin not responding"**
- Try restarting the IDE
- Check IDE logs in Help → Show Log in Files
- Disable other plugins that might conflict

### Debug Mode
Enable debug mode in settings to get detailed logging:
1. Go to Settings → Tools → Parserator
2. Check "Debug mode"
3. View logs in Help → Show Log in Files

### Support
- GitHub Issues: [Report bugs and feature requests](https://github.com/parserator/jetbrains-plugin/issues)
- Documentation: [Full documentation](https://docs.parserator.com)
- Email: support@parserator.com

## Development

### Building from Source
```bash
git clone https://github.com/parserator/jetbrains-plugin.git
cd jetbrains-plugin
./gradlew buildPlugin
```

### Running in Development
```bash
./gradlew runIde
```

### Contributing
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

This plugin is licensed under the MIT License. See [LICENSE](LICENSE) for details.

## Changelog

### Version 1.0.0
- Initial release
- Core parsing functionality
- Schema management
- Tool window integration
- Export capabilities
- Code generation features
- Bulk parsing operations
- Multiple IDE support

---

Built with ❤️ by the Parserator team