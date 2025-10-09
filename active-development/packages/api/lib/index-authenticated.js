"use strict";
/**
 * Parserator API v3.0 - Complete authenticated API with user management
 * Includes parsing endpoints, authentication, API key management, and billing
 */
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.api = void 0;
const functions = __importStar(require("firebase-functions/v2/https"));
const params_1 = require("firebase-functions/params");
const admin = __importStar(require("firebase-admin"));
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const generative_ai_1 = require("@google/generative-ai");
// Middleware imports
const auth_middleware_1 = require("./middleware/auth.middleware");
// Route imports
const user_routes_1 = require("./routes/user.routes");
// Initialize Firebase Admin
if (!admin.apps.length) {
    admin.initializeApp();
}
// Define secrets
const geminiApiKey = (0, params_1.defineSecret)('GEMINI_API_KEY');
// Create Express app
const app = (0, express_1.default)();
// Middleware
app.use((0, cors_1.default)({
    origin: ['https://parserator.com', 'https://parserator-production.web.app', 'http://localhost:3000'],
    credentials: true
}));
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
// Request logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`, {
        userAgent: req.get('User-Agent'),
        origin: req.get('Origin'),
        contentLength: req.get('Content-Length')
    });
    next();
});
// Public routes (no authentication required)
/**
 * GET /health
 * Health check endpoint
 */
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '3.0.0',
        message: 'Parserator API is live!',
        environment: process.env.NODE_ENV || 'production'
    });
});
/**
 * GET /v1/info
 * API information and available endpoints
 */
app.get('/v1/info', (req, res) => {
    res.json({
        name: 'Parserator API',
        version: '3.0.0',
        status: 'running',
        architecture: 'Architect-Extractor Pattern',
        documentation: 'https://parserator.com/docs',
        endpoints: {
            // Public endpoints
            'GET /health': 'Health check',
            'GET /v1/info': 'API information',
            'POST /user/register': 'Create new user account',
            // Authenticated endpoints
            'POST /v1/parse': 'Parse data (requires API key)',
            'GET /user/profile': 'Get user profile (requires API key)',
            'GET /user/api-keys': 'List API keys (requires API key)',
            'POST /user/api-keys': 'Create API key (requires API key)',
            'PUT /user/api-keys/:id': 'Update API key (requires API key)',
            'DELETE /user/api-keys/:id': 'Delete API key (requires API key)',
            'GET /user/usage': 'Get usage statistics (requires API key)'
        },
        limits: {
            free: { requests: 100, rateLimit: 10 },
            pro: { requests: 10000, rateLimit: 100 },
            enterprise: { requests: 100000, rateLimit: 1000 }
        }
    });
});
/**
 * POST /user/register
 * Create a new user account (public endpoint)
 */
app.post('/user/register', user_routes_1.registerUser);
// Apply authentication middleware to all subsequent routes
app.use(auth_middleware_1.authenticateApiKey);
// Apply usage tracking middleware
app.use(auth_middleware_1.incrementUsage);
// Authenticated routes
/**
 * POST /v1/parse
 * Main parsing endpoint using Architect-Extractor pattern
 */
app.post('/v1/parse', async (req, res) => {
    const authReq = req;
    try {
        const { inputData, outputSchema, instructions } = req.body;
        if (!inputData || !outputSchema) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_INPUT',
                    message: 'inputData and outputSchema are required'
                }
            });
            return;
        }
        // Validate input size (10MB limit)
        if (inputData.length > 10 * 1024 * 1024) {
            res.status(413).json({
                success: false,
                error: {
                    code: 'INPUT_TOO_LARGE',
                    message: 'Input data exceeds 10MB limit',
                    details: {
                        size: inputData.length,
                        limit: 10 * 1024 * 1024
                    }
                }
            });
            return;
        }
        // Get Gemini API key
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
        const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const startTime = Date.now();
        // STAGE 1: ARCHITECT - Create parsing plan
        const sample = inputData.substring(0, 1500); // Increased sample size for better planning
        const architectPrompt = `You are the Architect LLM in a two-stage parsing system. Analyze this data sample and create a detailed SearchPlan for the Extractor LLM.

SAMPLE DATA:
${sample}

TARGET SCHEMA:
${JSON.stringify(outputSchema, null, 2)}

ADDITIONAL INSTRUCTIONS:
${instructions || 'None'}

Create a SearchPlan that tells the Extractor exactly how to find each field. Return ONLY this JSON format:

{
  "searchPlan": {
    "steps": [
      {
        "field": "exact_field_name_from_schema",
        "instruction": "specific instruction for finding this data",
        "pattern": "what pattern to look for",
        "validation": "data type validation",
        "required": true/false
      }
    ],
    "confidence": 0.95,
    "strategy": "parsing approach",
    "notes": "any important context for the Extractor"
  }
}

Create one step per field in the target schema. Return ONLY valid JSON with NO markdown formatting.`;
        const architectResult = await model.generateContent(architectPrompt);
        let searchPlan;
        try {
            const architectResponse = architectResult.response.text();
            console.log('Architect response:', architectResponse);
            // Clean response and extract JSON
            let cleanResponse = architectResponse
                .replace(/```[a-zA-Z]*\n?/g, '')
                .replace(/```/g, '')
                .trim();
            const jsonStart = cleanResponse.indexOf('{');
            const jsonEnd = cleanResponse.lastIndexOf('}');
            if (jsonStart !== -1 && jsonEnd !== -1) {
                cleanResponse = cleanResponse.substring(jsonStart, jsonEnd + 1);
            }
            const parsed = JSON.parse(cleanResponse);
            searchPlan = parsed.searchPlan;
            if (!searchPlan || !searchPlan.steps) {
                throw new Error('Invalid SearchPlan structure');
            }
        }
        catch (e) {
            console.error('Architect failed:', e.message);
            res.status(500).json({
                success: false,
                error: {
                    code: 'ARCHITECT_FAILED',
                    message: 'Failed to create parsing plan',
                    details: process.env.NODE_ENV === 'development' ? e.message : undefined
                }
            });
            return;
        }
        // STAGE 2: EXTRACTOR - Execute the plan
        const extractorPrompt = `You are the Extractor LLM. Execute this SearchPlan on the full input data with precision.

SEARCH PLAN:
${JSON.stringify(searchPlan, null, 2)}

FULL INPUT DATA:
${inputData}

INSTRUCTIONS:
- Follow each step in the SearchPlan exactly
- Extract data for each field as specified
- If a field cannot be found, use null
- Maintain data type consistency
- Be accurate and precise

Return ONLY the extracted data in this exact JSON format:
${JSON.stringify(outputSchema, null, 2)}

Respond with ONLY valid JSON, no markdown or explanations:`;
        const extractorResult = await model.generateContent(extractorPrompt);
        let parsedData;
        try {
            const extractorResponse = extractorResult.response.text();
            const cleanResponse = extractorResponse
                .replace(/```json/g, '')
                .replace(/```/g, '')
                .trim();
            parsedData = JSON.parse(cleanResponse);
        }
        catch (e) {
            console.error('Extractor failed:', e.message);
            res.status(500).json({
                success: false,
                error: {
                    code: 'EXTRACTOR_FAILED',
                    message: 'Failed to extract data',
                    details: process.env.NODE_ENV === 'development' ? e.message : undefined
                }
            });
            return;
        }
        const processingTime = Date.now() - startTime;
        const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        // Log successful parsing
        console.log('Parse request completed:', {
            requestId,
            userId: authReq.user.uid,
            processingTime,
            inputSize: inputData.length,
            confidence: searchPlan.confidence
        });
        res.json({
            success: true,
            parsedData,
            metadata: {
                requestId,
                architectPlan: searchPlan,
                confidence: searchPlan.confidence || 0.85,
                tokensUsed: Math.floor((architectPrompt.length + extractorPrompt.length) / 4),
                processingTimeMs: processingTime,
                timestamp: new Date().toISOString(),
                version: '3.0.0',
                user: {
                    tier: authReq.user.subscriptionTier,
                    usage: authReq.user.monthlyUsage,
                    limit: authReq.user.monthlyLimit
                }
            }
        });
    }
    catch (error) {
        console.error('Parse error:', {
            error: error.message,
            userId: authReq.user?.uid,
            timestamp: new Date().toISOString()
        });
        res.status(500).json({
            success: false,
            error: {
                code: 'PARSE_FAILED',
                message: error?.message || 'Parsing failed',
                details: process.env.NODE_ENV === 'development' ? error?.stack : undefined
            }
        });
    }
});
// User management routes
app.get('/user/profile', user_routes_1.getUserProfile);
app.get('/user/api-keys', user_routes_1.listApiKeys);
app.post('/user/api-keys', user_routes_1.createApiKey);
app.put('/user/api-keys/:keyId', user_routes_1.updateApiKey);
app.delete('/user/api-keys/:keyId', user_routes_1.deleteApiKey);
app.get('/user/usage', user_routes_1.getUserUsage);
// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({
        success: false,
        error: {
            code: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred'
        }
    });
});
// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: {
            code: 'NOT_FOUND',
            message: `Endpoint ${req.method} ${req.path} not found`,
            availableEndpoints: '/v1/info'
        }
    });
});
// Export Firebase function
exports.api = functions.onRequest({
    invoker: 'public',
    timeoutSeconds: 300,
    memory: '2GiB',
    secrets: [geminiApiKey],
    minInstances: 0,
    maxInstances: 100
}, app);
//# sourceMappingURL=index-authenticated.js.map