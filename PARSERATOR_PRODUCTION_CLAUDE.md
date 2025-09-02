# CLAUDE.md - Parserator Project

This file provides comprehensive guidance to Claude Code when working on the Parserator project.

## Project Overview
**Project Name**: Parserator  
**Tagline**: "Intelligent data parsing for modern operators"  
**Type**: Two-stage LLM parsing engine using Architect-Extractor pattern  
**Status**: Initial Development Phase

## CRITICAL DEVELOPMENT PREFERENCES

### PRODUCTION-READY CODE ONLY
**ABSOLUTELY NEVER** create simplified, demo, or workaround versions. This is a production parsing engine for developers and AI agents. All implementations must be:

- **COMPLETE**: Full functionality, no stubs or placeholders
- **ROBUST**: Comprehensive error handling and edge cases
- **EFFICIENT**: Optimized token usage through two-stage processing
- **ACCURATE**: High-precision parsing through planning + execution
- **DOCUMENTED**: Clear examples and comprehensive guides
- **TESTED**: Real-world test cases with actual messy data

## Core Mission

**Parserator is the intelligent parsing engine for building modern operators.**

Its purpose is to transform any unstructured data input into clean, structured JSON using a sophisticated, two-stage AI process that ensures accuracy and cost-efficiency.

## Technical Architecture: The Architect-Extractor Pattern

Parserator uses a revolutionary two-LLM, Planner-Executor model to achieve state-of-the-art results while minimizing token costs.

### LLM 1 ("The Architect"): Gemini 1.5 Flash
- **Job**: Create a detailed parsing plan
- **Input**: User's desired `outputSchema` + small representative sample of `inputData` (first ~1000 characters)
- **Output**: Structured JSON `SearchPlan` that tells the second LLM exactly what to look for and how to format it
- **Token Efficiency**: Operates on tiny data sample, keeping reasoning costs extremely low

### LLM 2 ("The Extractor"): Gemini 1.5 Flash  
- **Job**: Execute the parsing plan
- **Input**: Full `inputData` + `SearchPlan` from the Architect
- **Output**: Final structured JSON data, validated against the plan
- **Token Efficiency**: Direct execution with minimal "thinking" overhead

### Why This Architecture is Superior

1. **Reduced Context for "Thinking"**: The Architect does complex reasoning on a tiny fraction of the data
2. **Focused Execution**: The Extractor operates with very direct instructions, reducing token count
3. **Higher Accuracy**: Two-stage validation and planning reduces errors
4. **Cost Efficiency**: Avoids sending full large data blobs to LLMs for complex reasoning tasks

## API Design

### Core Endpoint
```
POST https://api.parserator.com/v1/parse
```

### Request Format
```json
{
  "inputData": "string",      // Raw unstructured data
  "outputSchema": "object",   // Desired JSON structure
  "instructions": "string"    // Optional additional context
}
```

### Response Format
```json
{
  "success": true,
  "parsedData": { /* structured output */ },
  "metadata": {
    "architectPlan": { /* the SearchPlan used */ },
    "confidence": 0.95,
    "tokensUsed": 1250,
    "processingTimeMs": 800
  }
}
```

## Development Architecture

### Project Structure
```
parserator/
├── packages/
│   ├── core/              # Core parsing engine
│   ├── sdk-node/          # Node.js SDK
│   ├── sdk-python/        # Python SDK  
│   ├── mcp-adapter/       # MCP protocol integration
│   └── adk/               # Agent Development Kit
├── examples/              # Real-world usage examples
└── docs/                  # Comprehensive documentation
```

### Core Interfaces

#### SearchPlan Structure
```typescript
interface ISearchStep {
  targetKey: string;           // Output JSON key
  description: string;         // What this data represents
  searchInstruction: string;   // Direct instruction for Extractor
  validationType: 'string' | 'email' | 'number' | 'iso_date' | 'string_array';
  isRequired: boolean;
}

interface ISearchPlan {
  steps: ISearchStep[];
}
```

## Development Phases

### Phase 1: Core Engine (2-3 weeks)
1. **SearchPlan Interface**: Define TypeScript interfaces for the parsing plan
2. **Architect Service**: Build prompt service for plan creation (LLM 1)
3. **Extractor Service**: Build prompt service for plan execution (LLM 2)
4. **Main Orchestrator**: Implement two-stage parsing workflow
5. **Gemini Integration**: Connect to Gemini 1.5 Flash API
6. **Validation**: Output validation and error handling

### Phase 2: SDK & Tools (1-2 weeks)
1. **Node.js SDK**: Developer-friendly package
2. **Python SDK**: For data science workflows
3. **MCP Adapter**: Model Context Protocol integration
4. **Agent Development Kit**: Pre-built components for AI agents

### Phase 3: Launch & Optimization (1 week)
1. **Documentation**: Comprehensive guides and examples
2. **Performance Optimization**: Token usage and speed improvements
3. **Template System**: Pre-built parsing patterns
4. **Monitoring**: Usage tracking and analytics

## Use Cases

### For Developers
- **API Integration**: Parse inconsistent API responses into clean JSON
- **Data Migration**: Extract from legacy systems with varying formats
- **ETL Pipelines**: Intelligent data transformation for any input format
- **Content Processing**: Handle user-generated content variations

### For AI Agents
- **Email Processing**: Extract tasks, contacts, dates from any email format
- **Document Analysis**: Parse contracts, invoices, reports regardless of structure
- **Web Scraping**: Handle sites with changing layouts intelligently
- **Research Workflows**: Extract key info from academic papers, articles

### For Operators
- **Unstructured Data**: Turn messy inputs into clean, structured outputs
- **Legacy Integration**: Parse old system exports without rigid schemas
- **User Input**: Handle variations in how users format information
- **Multi-source Data**: Normalize data from different providers

## Quality Standards

### Error Handling
- Network failures with exponential backoff retry logic
- LLM API errors with fallback strategies
- Invalid input graceful handling with helpful error messages
- Confidence threshold enforcement with user feedback

### Performance Targets
- **Latency**: <3 seconds for most parsing operations
- **Token Efficiency**: 70% reduction vs single-LLM approach
- **Accuracy**: >95% for well-structured inputs, >85% for messy data
- **Reliability**: 99.9% uptime for production API

### Testing Strategy
- Real-world messy data test cases (emails, PDFs, CSVs, JSON)
- Performance benchmarks against token usage
- Accuracy metrics tracking with human validation
- Integration tests with actual Gemini API

## Security & Privacy

### Data Handling
- Optional local processing mode for sensitive data
- Configurable data retention policies
- PII detection and automatic masking
- Comprehensive audit logging for compliance

### API Security
- API key authentication with rate limiting
- Request validation and sanitization
- Usage monitoring and anomaly detection
- Secure defaults for all configurations

## Development Commands
```bash
# Development
npm run dev

# Build all packages
npm run build

# Test with real data
npm run test:integration

# Run architect-extractor workflow tests
npm run test:workflow

# Performance benchmarks
npm run benchmark
```

## Key Development Principles

### Token Optimization First
- Always consider token costs in design decisions
- Minimize context sent to LLMs while maximizing accuracy
- Use caching for repeated patterns
- Batch similar operations when possible

### Flexibility Without Complexity
- No rigid schemas required from users
- Intelligent adaptation to any input format
- Simple API that hides sophisticated internal processing
- Graceful degradation when confidence is low

### Developer Experience
- Zero-config for simple use cases
- Extensive customization for power users
- Clear error messages with actionable guidance
- Comprehensive examples and templates

Remember: Parserator bridges the gap between chaotic real-world data and the clean, structured inputs that applications need. The two-stage architecture makes this bridge both intelligent and efficient.