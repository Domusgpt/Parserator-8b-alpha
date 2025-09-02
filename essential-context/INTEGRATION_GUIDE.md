# 🔧 PARSERATOR INTEGRATION GUIDE

> **For Developers**: How to integrate and extend Parserator  
> **For Users**: How to use the completed integrations  
> **For Contributors**: How to build new integrations

---

## 📦 AVAILABLE INTEGRATIONS

### 1. **Node.js SDK** ✅ PRODUCTION READY

**Installation**:
```bash
npm install @parserator/node-sdk
```

**Quick Start**:
```javascript
const { ParseratorClient } = require('@parserator/node-sdk');

const client = new ParseratorClient({
  apiKey: 'pk_live_your_api_key_here'
});

const result = await client.parse({
  inputData: 'John Smith, john@example.com, (555) 123-4567',
  outputSchema: {
    name: 'string',
    email: 'email',
    phone: 'phone'
  }
});

console.log(result.parsedData);
```

**Advanced Features**:
```javascript
// Batch processing
const batchResult = await client.batchParse({
  items: documents,
  options: { concurrency: 5 }
});

// Using presets
const { EMAIL_PARSER } = require('@parserator/node-sdk');
const emailResult = await client.parse({
  inputData: emailContent,
  ...EMAIL_PARSER
});

// Error handling
try {
  const result = await client.parse(request);
} catch (error) {
  if (error instanceof RateLimitError) {
    console.log(`Retry after ${error.retryAfter} seconds`);
  }
}
```

**Documentation**: `/packages/sdk-node/README.md`

---

### 2. **Chrome Extension** ✅ PRODUCTION READY

**Installation**:
1. Load unpacked extension from `/chrome-extension/`
2. Or install from Chrome Web Store (after submission)

**Usage**:
- **Context Menu**: Right-click text → "Parse with Parserator"
- **Popup**: Click extension icon → paste data → parse
- **Side Panel**: View results in dedicated panel
- **Keyboard**: `Ctrl+Shift+P` to parse selected text

**Features**:
- Auto-detection of common data formats
- Custom schema builder
- Export results to JSON, CSV, Excel
- History of parsed data
- Settings for API key management

**Documentation**: `/chrome-extension/README.md`

---

### 3. **VS Code Extension** ✅ PRODUCTION READY

**Installation**:
1. Package with: `vsce package`
2. Install: `code --install-extension parserator-*.vsix`
3. Or install from VS Code Marketplace (after submission)

**Usage**:
- **Command Palette**: `Parse Selection with Parserator`
- **Keyboard**: `Ctrl+Shift+P` → type "parse"
- **Context Menu**: Right-click selection → "Parse with Parserator"

**Features**:
- Parse selected text in any file
- Schema management with IntelliSense
- Syntax highlighting for `.pschema` files
- Code snippets for common schemas
- Results displayed in webview panel

**Documentation**: `/vscode-extension/README.md`

---

### 4. **JetBrains Plugin** ✅ PRODUCTION READY

**Installation**:
```bash
cd jetbrains-plugin
./build.sh
# Install the generated .jar in your IDE
```

**Compatible IDEs**:
- IntelliJ IDEA
- WebStorm
- PyCharm
- PhpStorm
- GoLand
- RubyMine
- CLion

**Features**:
- Parse selected text with custom schemas
- Tool window for session management
- Export to 9+ formats (JSON, CSV, XML, etc.)
- Code generation from schemas
- Schema validation and templates
- Integration with version control

**Documentation**: `/jetbrains-plugin/README.md`

---

### 5. **Python SDK** 🚧 IN DEVELOPMENT

**Planned Installation**:
```bash
pip install parserator-sdk
```

**Planned Features**:
```python
import parserator
import pandas as pd

# Basic parsing
client = parserator.Client(api_key="pk_live_...")
result = await client.parse(
    input_data="contact info...",
    output_schema={"name": "string", "email": "email"}
)

# pandas integration
df = pd.DataFrame({'text': ['contact1', 'contact2']})
result_df = await parserator.parse_dataframe(
    df, 'text', {"name": "string", "email": "email"}
)

# Jupyter notebook widgets
%load_ext parserator
%%parse
schema = {"name": "string"}
data = "John Smith"
```

**Status**: Project structure complete, implementation in progress

---

## 🚀 UPCOMING INTEGRATIONS

### **MCP (Model Context Protocol)** 🚧 IN PROGRESS

**Purpose**: Connect Parserator to AI agents like Claude Desktop

**Planned Usage**:
```typescript
// In Claude Desktop or MCP-compatible agent
const parseResult = await mcp.tools.parserator({
  data: "unstructured text",
  schema: {"field": "type"}
});
```

**Progress**: 
- [ ] MCP server implementation
- [ ] Tool definitions
- [ ] Claude Desktop integration
- [ ] Documentation

---

### **GitHub Action** 🗺️ PLANNED

**Purpose**: Parse data in CI/CD pipelines

**Planned Usage**:
```yaml
name: Parse Data
uses: parserator/parse-action@v1
with:
  input-file: 'data/contacts.txt'
  schema: '{ "name": "string", "email": "email" }'
  output-file: 'parsed/contacts.json'
  api-key: ${{ secrets.PARSERATOR_API_KEY }}
```

---

### **Zapier Integration** 🗺️ PLANNED

**Purpose**: No-code automation workflows

**Planned Triggers**:
- New file in Google Drive
- New email in Gmail
- Webhook received

**Planned Actions**:
- Parse text with schema
- Send to Airtable
- Create Google Sheets row
- Send to Slack

---

### **LangChain Tool** 🗺️ PLANNED

**Purpose**: AI application integration

**Planned Usage**:
```python
from langchain.tools import ParseratorTool

parser = ParseratorTool(api_key="pk_live_...")
result = parser.run({
    "input": unstructured_data,
    "schema": {"name": "string", "email": "email"}
})
```

---

## 🛠️ BUILDING NEW INTEGRATIONS

### **Integration Architecture**

All integrations follow the same pattern:

1. **Authentication**: Store API key securely
2. **Request Building**: Convert user input to `ParseRequest`
3. **API Call**: Send to `https://api.parserator.com/v1/parse`
4. **Response Handling**: Parse `ParseResponse` and handle errors
5. **Result Display**: Show parsed data in appropriate format

### **API Contract**

**Request**:
```typescript
interface ParseRequest {
  inputData: string;           // The unstructured data
  outputSchema: object;        // Desired JSON structure
  instructions?: string;       // Optional parsing hints
  options?: {
    timeout?: number;
    validateOutput?: boolean;
    confidenceThreshold?: number;
  };
}
```

**Response**:
```typescript
interface ParseResponse {
  success: boolean;
  parsedData: object;          // Structured result
  metadata: {
    architectPlan: object;     // The SearchPlan used
    confidence: number;        // 0-1 confidence score
    tokensUsed: number;        // Tokens consumed
    processingTimeMs: number;  // Time taken
    requestId: string;         // For debugging
    timestamp: string;         // ISO date
  };
  error?: {
    code: string;
    message: string;
    details?: object;
  };
}
```

### **Best Practices**

1. **Error Handling**: Always handle network errors, rate limits, and validation errors
2. **User Experience**: Provide progress indicators for long operations
3. **Caching**: Cache schemas and results when appropriate
4. **Security**: Never log API keys or sensitive data
5. **Performance**: Use batch processing for multiple items
6. **Validation**: Validate inputs before sending to API

### **Example Integration Template**

```typescript
class ParseratorIntegration {
  constructor(private apiKey: string) {}

  async parse(request: ParseRequest): Promise<ParseResponse> {
    // 1. Validate inputs
    if (!request.inputData?.trim()) {
      throw new Error('Input data is required');
    }

    // 2. Build API request
    const response = await fetch('https://api.parserator.com/v1/parse', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request)
    });

    // 3. Handle response
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const result = await response.json();

    // 4. Return structured result
    return result;
  }
}
```

---

## 📝 SCHEMA REFERENCE

### **Supported Types**

- `string` - Text data
- `number` - Numeric values
- `boolean` - True/false values
- `email` - Email addresses (validated)
- `phone` - Phone numbers (various formats)
- `date` - Human-readable dates
- `iso_date` - ISO 8601 formatted dates
- `url` - URLs (validated)
- `string_array` - Array of strings
- `number_array` - Array of numbers
- `object` - Complex nested objects

### **Complex Schema Example**

```json
{
  "contact": {
    "name": "string",
    "email": "email",
    "phone": "phone",
    "address": {
      "type": "object",
      "description": "Full address information"
    },
    "tags": "string_array",
    "active": "boolean",
    "score": "number",
    "last_seen": "iso_date"
  }
}
```

---

## 🔗 USEFUL LINKS

- **API Documentation**: `/docs/API_DOCUMENTATION.md`
- **Architecture Guide**: `/docs/ARCHITECTURE.md`
- **Example Schemas**: `/templates/`
- **GitHub Repository**: https://github.com/domusgpt/parserator
- **NPM Package**: https://npmjs.com/package/@parserator/node-sdk
- **Issue Tracker**: https://github.com/domusgpt/parserator/issues

---

## 🎆 CONTRIBUTING

Want to build a new integration? Here's how:

1. **Fork the repository**
2. **Create integration directory**: `mkdir integrations/your-platform`
3. **Follow the template** above
4. **Add documentation**
5. **Submit pull request**

**We'd love integrations for**:
- Slack/Discord bots
- Mobile applications
- Desktop applications
- CLI tools
- Database connectors
- Cloud service integrations

---

**Happy parsing!** 🚀
