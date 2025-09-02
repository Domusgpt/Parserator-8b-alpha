# Parserator Logging & Debug Guide for AI Agents

## Logging Architecture

### Current Logging Status
The system needs enhanced operational logging for AI agent transparency. Based on the original project structure, we need to implement:

1. **Parse Operation Logs**: Track every API request and response
2. **Two-Stage Process Logs**: Monitor Architect → Extractor workflow
3. **Performance Metrics**: Response times, token usage, accuracy scores
4. **Error Tracking**: Failures, retries, fallback scenarios

### Proposed Logging Structure
```
logs/
├── parse.log          # All parse requests and responses
├── architect.log      # Stage 1 planning operations
├── extractor.log      # Stage 2 execution operations
├── performance.log    # Metrics and benchmarks
├── errors.log         # Failures and recovery attempts
└── debug/
    ├── architect-prompts.log    # LLM prompts for debugging
    └── extractor-responses.log  # Raw LLM outputs
```

## Debug Mode Implementation

### Enabling Debug Mode
```bash
# Environment variable approach
export PARSERATOR_DEBUG=true
npm run dev

# Or via debug script (to be implemented)
npm run debug
```

### Debug Script Requirements
Based on original `debug-architect.js`, we need:
```javascript
// Debug mode should log:
// 1. Input data sample sent to Architect
// 2. Generated SearchPlan JSON
// 3. Full data + plan sent to Extractor
// 4. Final parsed output
// 5. Token counts and timing for each stage
```

## Log Entry Formats

### Parse Request Log
```json
{
  "timestamp": "2025-06-12T10:30:00Z",
  "requestId": "req_abc123",
  "userId": "user_xyz789",
  "operation": "parse",
  "inputSize": 2500,
  "outputSchema": {...},
  "status": "success|error",
  "duration": 2200,
  "tokensUsed": 1250,
  "confidence": 0.95
}
```

### Architect Stage Log
```json
{
  "timestamp": "2025-06-12T10:30:01Z",
  "requestId": "req_abc123",
  "stage": "architect",
  "inputSample": "First 1000 chars...",
  "outputSchema": {...},
  "searchPlan": {...},
  "tokensUsed": 450,
  "duration": 800,
  "confidence": 0.98
}
```

### Extractor Stage Log
```json
{
  "timestamp": "2025-06-12T10:30:02Z",
  "requestId": "req_abc123",
  "stage": "extractor",
  "searchPlan": {...},
  "parsedOutput": {...},
  "tokensUsed": 800,
  "duration": 1400,
  "validationPassed": true
}
```

## Interpreting Logs for Debugging

### Performance Issues
- **High Duration**: Check if Architect stage is taking too long on complex schemas
- **Low Confidence**: May indicate ambiguous data or insufficient planning
- **High Token Usage**: Architect might be sending too much context

### Example Log Analysis
```
[ARCHITECT] schema identified missing field 'deadline' 
→ Indicates Architect had to infer a field, prompt might need adjustment

[EXTRACTOR] validation failed for field 'email'
→ Data quality issue or SearchPlan instruction unclear

[PERFORMANCE] response time 4.2s (target: 2.2s)
→ Check for network latency or LLM API delays
```

### Error Patterns to Monitor
1. **Schema Mismatch**: Architect plan doesn't match desired output
2. **Data Quality**: Extractor can't find expected patterns
3. **Rate Limiting**: API calls being throttled
4. **Network Issues**: Timeouts or connection errors

## Monitoring Commands

### Real-time Log Monitoring
```bash
# Watch all logs
tail -f logs/*.log

# Monitor specific operations
grep "confidence.*0\.[0-6]" logs/parse.log  # Low confidence results
grep "duration.*[4-9][0-9][0-9][0-9]" logs/parse.log  # Slow responses
grep "error" logs/errors.log  # All errors
```

### Performance Analysis
```bash
# Average response time
grep "duration" logs/parse.log | awk '{sum+=$3; count++} END {print sum/count}'

# Token efficiency
grep "tokensUsed" logs/parse.log | awk '{sum+=$3; count++} END {print sum/count}'

# Success rate
grep -c "success" logs/parse.log
```

## Debug Tools to Implement

### 1. Architect Debug Script
Recreate functionality from original `debug-architect.js`:
```javascript
// Should output:
// - Input schema analysis
// - Generated SearchPlan
// - Reasoning steps (if debug mode)
// - Token usage breakdown
```

### 2. Performance Profiler
```javascript
// Track and report:
// - API latency by region
// - LLM response times by model
// - Memory usage during processing
// - Database query performance
```

### 3. Validation Checker
```javascript
// Verify:
// - Output matches schema requirements
// - Data type consistency
// - Required fields presence
// - Confidence threshold compliance
```

## Agent Debugging Workflow

### For Claude Agents
When debugging issues, follow this sequence:

1. **Check Recent Logs**: Look at last 10-20 parse operations
2. **Identify Patterns**: Group similar errors or performance issues
3. **Analyze Context**: Review input data and schema complexity
4. **Test Hypotheses**: Run controlled tests with debug mode
5. **Document Findings**: Update logs with resolution notes

### Log-Based Troubleshooting
```bash
# Find recent errors
tail -20 logs/errors.log

# Check confidence trends
grep "confidence" logs/parse.log | tail -50

# Monitor token usage efficiency
grep "tokensUsed.*architect" logs/architect.log | awk '{print $NF}'
```

## Implementation Priority

### Phase 1 (Immediate)
1. Basic request/response logging in API layer
2. Error tracking and alerting
3. Performance metrics collection

### Phase 2 (Week 2)
1. Two-stage process detailed logging
2. Debug mode implementation
3. Log analysis scripts

### Phase 3 (Month 2)
1. Real-time monitoring dashboard
2. Automated anomaly detection
3. Historical trend analysis

This logging system ensures Claude agents can:
- Track system behavior transparently
- Debug issues autonomously
- Optimize performance based on data
- Maintain system health proactively