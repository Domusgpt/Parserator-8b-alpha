"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const functions = __importStar(require("firebase-functions/v2/https"));
const params_1 = require("firebase-functions/params");
const generative_ai_1 = require("@google/generative-ai");
const geminiApiKey = (0, params_1.defineSecret)('GEMINI_API_KEY');
exports.app = functions.onRequest({
    invoker: 'public',
    timeoutSeconds: 300,
    memory: '1GiB',
    secrets: [geminiApiKey]
}, async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }
    const path = req.url;
    if (path === '/health' || path === '/') {
        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            version: '1.0.0',
            message: 'Parserator API is live!'
        });
        return;
    }
    if (path === '/v1/info') {
        res.json({
            name: 'Parserator API',
            version: '1.0.0',
            status: 'running',
            endpoints: {
                'GET /health': 'Health check',
                'GET /v1/info': 'API information',
                'POST /v1/parse': 'Parse data'
            }
        });
        return;
    }
    if (path === '/v1/parse' && req.method === 'POST') {
        const body = req.body || {};
        if (!body.inputData || !body.outputSchema) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_INPUT',
                    message: 'inputData and outputSchema are required'
                }
            });
            return;
        }
        // Get Gemini API key from Firebase config
        const apiKey = geminiApiKey.value();
        if (!apiKey) {
            res.status(500).json({
                success: false,
                error: {
                    code: 'CONFIGURATION_ERROR',
                    message: 'Gemini API key not configured'
                }
            });
            return;
        }
        // Initialize Gemini
        const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const startTime = Date.now();
        try {
            // STAGE 1: ARCHITECT - Create parsing plan from sample
            const sample = body.inputData.substring(0, 1000); // First 1KB for planning
            const architectPrompt = `You are the Architect. Create a SearchPlan JSON for parsing data.

SAMPLE DATA:
${sample}

TARGET SCHEMA:
${JSON.stringify(body.outputSchema, null, 2)}

Return ONLY this exact JSON format with NO markdown, NO explanations, NO code blocks:

{
  "searchPlan": {
    "steps": [
      {
        "field": "fieldname",
        "instruction": "specific extraction instruction",
        "pattern": "search pattern",
        "validation": "data type"
      }
    ],
    "confidence": 0.95,
    "strategy": "field-by-field extraction"
  }
}

Create one step per field in the target schema. Return ONLY valid JSON.`;
            const architectResult = await model.generateContent(architectPrompt);
            const architectResponse = architectResult.response.text();
            let searchPlan;
            try {
                // Clean the response - remove any markdown formatting
                console.log('Raw Architect response:', architectResponse);
                let cleanResponse = architectResponse;
                // Remove all markdown code blocks
                cleanResponse = cleanResponse.replace(/```[a-zA-Z]*\n?/g, '');
                cleanResponse = cleanResponse.replace(/```/g, '');
                // Remove any explanatory text before/after JSON
                const jsonStart = cleanResponse.indexOf('{');
                const jsonEnd = cleanResponse.lastIndexOf('}');
                if (jsonStart !== -1 && jsonEnd !== -1) {
                    cleanResponse = cleanResponse.substring(jsonStart, jsonEnd + 1);
                }
                cleanResponse = cleanResponse.trim();
                console.log('Cleaned response:', cleanResponse);
                const parsed = JSON.parse(cleanResponse);
                console.log('Parsed JSON:', JSON.stringify(parsed, null, 2));
                searchPlan = parsed.searchPlan;
                if (!searchPlan || !searchPlan.steps) {
                    throw new Error('Invalid SearchPlan structure - missing searchPlan or steps');
                }
            }
            catch (e) {
                console.error('Architect JSON parse failed:', e.message);
                console.error('Original response:', architectResponse);
                throw new Error(`Architect failed to create valid SearchPlan: ${e.message}`);
            }
            // STAGE 2: EXTRACTOR - Execute the plan on full data
            const extractorPrompt = `You are the Extractor in a two-stage parsing system. Execute this SearchPlan on the full input data.

SEARCH PLAN:
${JSON.stringify(searchPlan, null, 2)}

FULL INPUT DATA:
${body.inputData}

INSTRUCTIONS:
- Follow the SearchPlan exactly
- Extract data for each field as specified
- Return ONLY valid JSON matching the output schema
- If a field cannot be found, use null
- Be precise and accurate

Expected output format:
${JSON.stringify(body.outputSchema, null, 2)}

Respond ONLY with valid JSON data:`;
            const extractorResult = await model.generateContent(extractorPrompt);
            const extractorResponse = extractorResult.response.text();
            let parsedData;
            try {
                // Clean the response - remove any markdown formatting
                const cleanResponse = extractorResponse
                    .replace(/```json/g, '')
                    .replace(/```/g, '')
                    .trim();
                parsedData = JSON.parse(cleanResponse);
            }
            catch (e) {
                console.error('Extractor response:', extractorResponse);
                throw new Error(`Extractor failed to return valid JSON: ${e.message}`);
            }
            const processingTime = Date.now() - startTime;
            res.json({
                success: true,
                parsedData: parsedData,
                metadata: {
                    architectPlan: searchPlan,
                    confidence: searchPlan.confidence || 0.85,
                    tokensUsed: Math.floor((architectPrompt.length + extractorPrompt.length) / 4), // Rough estimate
                    processingTimeMs: processingTime,
                    requestId: `req_${Date.now()}`,
                    timestamp: new Date().toISOString(),
                    version: '1.0.0'
                }
            });
        }
        catch (error) {
            console.error('Parse error:', error);
            res.status(500).json({
                success: false,
                error: {
                    code: 'PARSE_FAILED',
                    message: error?.message || 'Parsing failed',
                    details: process.env.NODE_ENV === 'development' ? error?.stack : undefined
                }
            });
        }
        return;
    }
    res.status(404).json({
        error: 'Not found',
        path: path,
        method: req.method
    });
});
//# sourceMappingURL=index.js.map