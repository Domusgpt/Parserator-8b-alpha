# Parserator Architecture Guide for AI Agents

## Component Overview

### Two-Stage Parsing Engine (Core Innovation)
- **Stage 1 - Architect**: Schema analysis with Gemini 1.5 Flash
  - Input: Output schema + small data sample (~1000 chars)
  - Output: Detailed SearchPlan JSON
  - Purpose: Complex reasoning on minimal data to reduce token costs
- **Stage 2 - Extractor**: Data processing execution
  - Input: Full data + SearchPlan from Architect
  - Output: Final structured JSON
  - Purpose: Direct execution with minimal "thinking" overhead
- **Performance**: 70% token savings, ~2.2s response time, 95% accuracy

### System Components

#### Backend Infrastructure
- **API Server**: Firebase Functions v2 (Node.js 18 + TypeScript)
- **Database**: Firestore for users, API keys, usage tracking
- **AI Engine**: Google Gemini 1.5 Flash integration
- **Authentication**: bcrypt hashing, rate limiting, subscription tiers
- **Security**: Comprehensive middleware, CORS validation

#### Frontend & Dashboard
- **Technology**: Next.js 14 with React 18
- **Styling**: Tailwind CSS professional design system
- **Deployment**: Firebase hosting with static export
- **Features**: User management, API key generation, usage analytics

#### Integration Ecosystem
- **MCP Adapter**: Model Context Protocol for Claude Desktop
- **Node.js SDK**: Published to NPM as parserator-sdk@1.0.0
- **Python SDK**: TypeScript support, framework integrations
- **ADK Module**: Agent Development Kit for AI agents
- **Browser Extensions**: Chrome (ready), VSCode, JetBrains (to be migrated)

### Tech Stack Details

#### Production Environment
```
API: https://app-5108296280.us-central1.run.app/v1/parse
Dashboard: https://parserator-production.web.app
NPM: parserator-sdk@1.0.0, parserator-mcp-server@1.0.1
```

#### Development Structure
```
active-development/
├── packages/
│   ├── core/           # Two-stage parsing engine
│   ├── api/            # Firebase Functions backend
│   ├── mcp-adapter/    # Claude Desktop integration
│   ├── sdk-node/       # Node.js developer SDK
│   ├── sdk-python/     # Python SDK with framework plugins
│   ├── adk/            # Agent Development Kit
│   ├── email-parser/   # Specialized email processing
│   └── dashboard/      # Next.js frontend
```

### EMA Technology Hierarchy (Strategic Context)

```
EMA Movement (Philosophy)
├── Parserator (Market Entry - Data Liberation) ← CURRENT FOCUS
├── MVEP/PPP (Visualization Revolution - PRIVATE) ← STRATEGIC HOLD
├── HAOS (Future Cognitive OS - RESEARCH) ← CONCEPTUAL
└── Bridge Builder (Migration Technology - EMA Proof)
```

## Subsystem Boundaries & Restrictions

### ✅ Safe to Modify
- **Dashboard UI**: Add features, improve UX
- **Documentation**: Expand guides and examples
- **Integration examples**: Create more framework demos
- **Performance optimizations**: Response time improvements
- **Testing infrastructure**: Expand validation suite

### ⚠️ Modify with Caution
- **Core parsing logic**: Architect-Extractor pattern is proven
- **Authentication system**: Production-ready and secure
- **API endpoints**: Maintain backward compatibility
- **Database schema**: Existing structure is optimized

### 🚫 DO NOT MODIFY (Strategic Hold)
- **MVEP/PPP integration**: Advanced visualization features
- **Pricing changes**: Subscription tier modifications
- **Major architectural changes**: Consult strategic documents
- **Public API breaking changes**: Version management required

## Performance Baselines

### Current Metrics (Verified)
- **API Response**: ~2.2 seconds average
- **Accuracy**: 95% confidence score
- **Token Efficiency**: 70% reduction vs single-LLM
- **Uptime**: 99.9% (Firebase infrastructure)

### Post-Launch Targets
- **API Response**: <1.5 seconds average
- **Accuracy**: 97% confidence score
- **Monthly Requests**: 100K+ processed
- **Developer Adoption**: 1000+ active users

## Integration Points

### Framework Support Status
- ✅ **MCP (Claude Desktop)**: Published package, full integration
- ✅ **REST API**: Direct HTTP calls, comprehensive documentation
- ✅ **Node.js SDK**: Published to NPM, TypeScript support
- 🔍 **Python SDK**: Ready for publication with framework plugins
- 🔍 **Google ADK**: Native agent integration
- 🔍 **LangChain**: Output parser implementation (to be verified)
- 🔍 **CrewAI**: Tool integration (to be verified)
- 🔍 **AutoGPT**: Plugin architecture (to be verified)

### Missing Components to Migrate
1. **JetBrains Plugin**: PyCharm/IntelliJ integration from original repo
2. **Framework Plugins**: LangChain, CrewAI, AutoGPT classes in Python SDK
3. **Test Suite**: Comprehensive validation scripts from original
4. **Debug Tools**: debug-architect.js and monitoring utilities

## Development Guidelines

### Token Optimization First
- Always consider token costs in design decisions
- Minimize context sent to LLMs while maximizing accuracy
- Use caching for repeated patterns
- Batch similar operations when possible

### EMA Compliance
- All features must respect Digital Sovereignty and Portability
- Include data in export formats (EMA rules)
- Maintain "liberation over profit" messaging
- Support standards agnosticism and vendor independence

### Strategic Alignment
- Consult CRITICAL_PROJECT_STATE.md for restrictions
- No publishing without explicit approval
- Maintain mystique around PPP/MVEP capabilities
- Focus on strategic patience over immediate helpfulness