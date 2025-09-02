"use strict";
/**
 * Simple Parserator API for initial deployment
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
exports.app = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
// Initialize Firebase Admin
if (!admin.apps.length) {
    admin.initializeApp();
}
const app = (0, express_1.default)();
// CORS
app.use((0, cors_1.default)({ origin: true }));
app.use(express_1.default.json());
// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});
// Info endpoint
app.get('/v1/info', (req, res) => {
    res.json({
        name: 'Parserator API',
        version: '1.0.0',
        status: 'running',
        endpoints: {
            'GET /health': 'Health check',
            'GET /v1/info': 'API information',
            'POST /v1/parse': 'Parse data (coming soon)'
        }
    });
});
// Simple parse endpoint for testing
app.post('/v1/parse', (req, res) => {
    const { inputData, outputSchema } = req.body;
    if (!inputData || !outputSchema) {
        return res.status(400).json({
            success: false,
            error: 'inputData and outputSchema are required'
        });
    }
    // Simple echo response for now
    res.json({
        success: true,
        parsedData: {
            message: 'Parserator API is working!',
            input: inputData.substring(0, 100),
            schema: Object.keys(outputSchema)
        },
        metadata: {
            version: '1.0.0',
            timestamp: new Date().toISOString(),
            tokensUsed: 42,
            confidence: 0.95
        }
    });
});
// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Not found',
        path: req.originalUrl
    });
});
// Export Cloud Function
exports.app = functions
    .runWith({
    memory: '512MB',
    timeoutSeconds: 60
})
    .https
    .onRequest(app);
//# sourceMappingURL=index-simple.js.map