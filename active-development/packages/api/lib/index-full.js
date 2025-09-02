"use strict";
/**
 * Main API endpoint for Parserator SaaS
 * Provides the RESTful interface for intelligent data parsing using the Architect-Extractor pattern
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
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const zod_1 = require("zod");
const llm_service_1 = require("./services/llm.service");
const parse_service_1 = require("./services/parse.service");
const auth_middleware_1 = require("./middleware/auth.middleware");
// Initialize Firebase Admin
if (!admin.apps.length) {
    admin.initializeApp();
}
// Initialize Express app
const app = (0, express_1.default)();
// Configure CORS
const corsOptions = {
    origin: true, // Allow all origins in development - restrict in production
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false
};
app.use((0, cors_1.default)(corsOptions));
app.use(express_1.default.json({ limit: '10mb' })); // Support large input data
// Request validation schemas
const ParseRequestSchema = zod_1.z.object({
    inputData: zod_1.z.string()
        .min(1, 'Input data cannot be empty')
        .max(100000, 'Input data too large (max 100KB)'),
    outputSchema: zod_1.z.object({})
        .refine(obj => Object.keys(obj).length > 0, 'Output schema cannot be empty')
        .refine(obj => Object.keys(obj).length <= 50, 'Output schema too complex (max 50 fields)'),
    instructions: zod_1.z.string().optional()
});
// Health check schema
const HealthResponseSchema = zod_1.z.object({
    status: zod_1.z.enum(['healthy', 'degraded', 'unhealthy']),
    version: zod_1.z.string(),
    timestamp: zod_1.z.string(),
    services: zod_1.z.record(zod_1.z.boolean())
});
// Initialize services
let parseService;
let isInitialized = false;
/**
 * Initialize services with proper error handling
 */
async function initializeServices() {
    if (isInitialized)
        return;
    try {
        // Get Gemini API key from environment
        const geminiApiKey = process.env.GEMINI_API_KEY;
        if (!geminiApiKey) {
            throw new Error('GEMINI_API_KEY environment variable is required');
        }
        // Initialize Gemini service
        const geminiService = new llm_service_1.GeminiService(geminiApiKey, console);
        // Test connection
        const connectionOk = await geminiService.testConnection();
        if (!connectionOk) {
            console.warn('Gemini connection test failed, but continuing...');
        }
        // Initialize parse service
        parseService = new parse_service_1.ParseService(geminiService, {
            maxInputLength: 100000,
            maxSchemaFields: 50,
            timeoutMs: 60000,
            enableFallbacks: true,
            architectSampleSize: 1000,
            minOverallConfidence: 0.5
        }, console);
        isInitialized = true;
        console.log('Parserator services initialized successfully');
    }
    catch (error) {
        console.error('Failed to initialize services:', error);
        throw error;
    }
}
/**
 * Middleware to ensure services are initialized
 */
async function ensureInitialized(req, res, next) {
    try {
        await initializeServices();
        next();
    }
    catch (error) {
        console.error('Service initialization failed:', error);
        res.status(503).json({
            success: false,
            error: {
                code: 'SERVICE_UNAVAILABLE',
                message: 'Service is temporarily unavailable during startup',
                details: { initializationError: error instanceof Error ? error.message : 'Unknown error' }
            }
        });
    }
}
/**
 * Middleware for request logging
 */
function requestLogger(req, res, next) {
    const startTime = Date.now();
    const requestId = `req_${startTime}_${Math.random().toString(36).substring(2, 8)}`;
    // Add request ID to headers for client tracking
    res.setHeader('X-Request-ID', requestId);
    console.log('API request started', {
        requestId,
        method: req.method,
        path: req.path,
        userAgent: req.get('User-Agent'),
        contentLength: req.get('Content-Length'),
        timestamp: new Date().toISOString()
    });
    // Store for response logging
    req.requestId = requestId;
    req.startTime = startTime;
    next();
}
/**
 * Middleware for response logging
 */
function responseLogger(req, res, next) {
    const originalSend = res.send;
    res.send = function (data) {
        const requestId = req.requestId;
        const startTime = req.startTime;
        const duration = Date.now() - startTime;
        console.log('API request completed', {
            requestId,
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            duration,
            responseSize: data ? data.length : 0,
            timestamp: new Date().toISOString()
        });
        return originalSend.call(this, data);
    };
    next();
}
/**
 * Error handling middleware
 */
function errorHandler(err, req, res, next) {
    const requestId = req.requestId || 'unknown';
    console.error('API error occurred', {
        requestId,
        error: err.message,
        stack: err.stack,
        method: req.method,
        path: req.path,
        timestamp: new Date().toISOString()
    });
    // Handle validation errors
    if (err instanceof zod_1.z.ZodError) {
        return res.status(400).json({
            success: false,
            error: {
                code: 'VALIDATION_ERROR',
                message: 'Invalid request format',
                details: {
                    requestId,
                    issues: err.errors.map(issue => ({
                        field: issue.path.join('.'),
                        message: issue.message,
                        code: issue.code
                    }))
                }
            }
        });
    }
    // Handle other known errors
    if (err.code && err.message) {
        const statusCode = err.statusCode || 500;
        return res.status(statusCode).json({
            success: false,
            error: {
                code: err.code,
                message: err.message,
                details: { requestId, ...err.details }
            }
        });
    }
    // Handle unexpected errors
    res.status(500).json({
        success: false,
        error: {
            code: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred',
            details: { requestId }
        }
    });
}
// Apply middleware
app.use(requestLogger);
app.use(responseLogger);
/**
 * Health check endpoint
 */
app.get('/health', ensureInitialized, async (req, res) => {
    try {
        const health = await parseService.getHealthStatus();
        const status = health.status === 'healthy' ? 200 : 503;
        const response = {
            status: health.status,
            version: '1.0.0',
            timestamp: health.timestamp,
            services: health.services,
            requestId: req.requestId
        };
        res.status(status).json(response);
    }
    catch (error) {
        res.status(503).json({
            status: 'unhealthy',
            version: '1.0.0',
            timestamp: new Date().toISOString(),
            services: {},
            error: error instanceof Error ? error.message : 'Unknown error',
            requestId: req.requestId
        });
    }
});
/**
 * Main parsing endpoint with authentication
 */
app.post('/v1/parse', ensureInitialized, auth_middleware_1.authenticateApiKey, auth_middleware_1.incrementUsage, async (req, res, next) => {
    try {
        const requestId = req.requestId;
        const authReq = req;
        // Validate request body
        const validatedBody = ParseRequestSchema.parse(req.body);
        // Create parse request with authenticated user context
        const parseRequest = {
            inputData: validatedBody.inputData,
            outputSchema: validatedBody.outputSchema,
            instructions: validatedBody.instructions,
            requestId,
            userId: authReq.user.uid
        };
        // Execute parsing
        const result = await parseService.parse(parseRequest);
        // Add billing metadata to response
        const enhancedResult = {
            ...result,
            billing: {
                subscriptionTier: authReq.user.subscriptionTier,
                monthlyUsage: authReq.user.monthlyUsage + 1, // After this request
                monthlyLimit: authReq.user.monthlyLimit,
                apiKeyName: authReq.apiKey.name
            }
        };
        // Return result
        res.json(enhancedResult);
    }
    catch (error) {
        next(error);
    }
});
/**
 * API information endpoint
 */
app.get('/v1/info', (req, res) => {
    res.json({
        name: 'Parserator API',
        version: '3.0.0',
        description: 'Intelligent data parsing using advanced AI',
        architecture: 'Two-stage Architect-Extractor pattern',
        model: 'Gemini 1.5 Flash',
        documentation: 'https://docs.parserator.com',
        pricing: 'https://parserator.com/pricing',
        dashboard: 'https://app.parserator.com',
        endpoints: {
            'POST /v1/parse': 'Main parsing endpoint (requires API key)',
            'GET /health': 'Service health check',
            'GET /v1/info': 'API information',
            'GET /v1/usage': 'Current usage statistics (requires API key)'
        },
        requestId: req.requestId
    });
});
/**
 * User usage statistics endpoint
 */
app.get('/v1/usage', ensureInitialized, auth_middleware_1.authenticateApiKey, async (req, res, next) => {
    try {
        const authReq = req;
        res.json({
            success: true,
            usage: {
                subscriptionTier: authReq.user.subscriptionTier,
                monthlyUsage: authReq.user.monthlyUsage,
                monthlyLimit: authReq.user.monthlyLimit,
                remainingRequests: authReq.user.monthlyLimit - authReq.user.monthlyUsage,
                usagePercentage: Math.round((authReq.user.monthlyUsage / authReq.user.monthlyLimit) * 100)
            },
            apiKey: {
                name: authReq.apiKey.name,
                id: authReq.apiKey.keyId
            },
            requestId: req.requestId
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * Admin endpoint: Get user statistics
 */
app.get('/admin/users/:userId/stats', ensureInitialized, auth_middleware_1.authenticateApiKey, auth_middleware_1.requireAdmin, async (req, res, next) => {
    try {
        const { userId } = req.params;
        const db = admin.firestore();
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            return res.status(404).json({
                success: false,
                error: { code: 'USER_NOT_FOUND', message: 'User not found' }
            });
        }
        const userData = userDoc.data();
        res.json({
            success: true,
            user: {
                uid: userId,
                email: userData?.email,
                subscriptionTier: userData?.subscriptionTier,
                monthlyUsage: userData?.monthlyUsage,
                createdAt: userData?.createdAt,
                isActive: userData?.isActive
            }
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * Admin endpoint: Update user subscription tier
 */
app.patch('/admin/users/:userId/tier', ensureInitialized, auth_middleware_1.authenticateApiKey, auth_middleware_1.requireAdmin, async (req, res, next) => {
    try {
        const { userId } = req.params;
        const { tier } = req.body;
        if (!['free', 'pro', 'enterprise'].includes(tier)) {
            return res.status(400).json({
                success: false,
                error: { code: 'INVALID_TIER', message: 'Invalid subscription tier' }
            });
        }
        const db = admin.firestore();
        await db.collection('users').doc(userId).update({
            subscriptionTier: tier,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        res.json({
            success: true,
            message: `User ${userId} updated to ${tier} tier`
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * 404 handler
 */
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: {
            code: 'NOT_FOUND',
            message: `Endpoint ${req.method} ${req.originalUrl} not found`,
            details: {
                requestId: req.requestId,
                availableEndpoints: [
                    'POST /v1/parse',
                    'GET /health',
                    'GET /v1/info'
                ]
            }
        }
    });
});
// Apply error handling middleware last
app.use(errorHandler);
/**
 * Export Cloud Function
 */
exports.api = functions
    .runWith({
    memory: '1GB',
    timeoutSeconds: 120,
    secrets: ['GEMINI_API_KEY']
})
    .https
    .onRequest(app);
/**
 * Export for local development
 */
exports.default = app;
//# sourceMappingURL=index-full.js.map