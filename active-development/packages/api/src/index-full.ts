/**
 * Main API endpoint for Parserator SaaS
 * Provides the RESTful interface for intelligent data parsing using the Architect-Extractor pattern
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import express from 'express';
import cors from 'cors';
import { z } from 'zod';
import { GeminiService } from './services/llm.service';
import { ParseService, IParseRequest } from './services/parse.service';
import { 
  authenticateApiKey, 
  incrementUsage, 
  AuthenticatedRequest,
  requireAdmin 
} from './middleware/auth.middleware';

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp();
}

// Initialize Express app
const app = express();

// Configure CORS
const corsOptions = {
  origin: true, // Allow all origins in development - restrict in production
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' })); // Support large input data

// Request validation schemas
const ParseRequestSchema = z.object({
  inputData: z.string()
    .min(1, 'Input data cannot be empty')
    .max(100000, 'Input data too large (max 100KB)'),
  
  outputSchema: z.object({})
    .refine(obj => Object.keys(obj).length > 0, 'Output schema cannot be empty')
    .refine(obj => Object.keys(obj).length <= 50, 'Output schema too complex (max 50 fields)'),
  
  instructions: z.string().optional()
});

type ParseRequestBody = z.infer<typeof ParseRequestSchema>;

// Health check schema
const HealthResponseSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  version: z.string(),
  timestamp: z.string(),
  services: z.record(z.boolean())
});

// Initialize services
let parseService: ParseService;
let isInitialized = false;

/**
 * Initialize services with proper error handling
 */
async function initializeServices(): Promise<void> {
  if (isInitialized) return;

  try {
    // Get Gemini API key from environment
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }

    // Initialize Gemini service
    const geminiService = new GeminiService(geminiApiKey, console);
    
    // Test connection
    const connectionOk = await geminiService.testConnection();
    if (!connectionOk) {
      console.warn('Gemini connection test failed, but continuing...');
    }

    // Initialize parse service
    parseService = new ParseService(
      geminiService,
      {
        maxInputLength: 100000,
        maxSchemaFields: 50,
        timeoutMs: 60000,
        enableFallbacks: true,
        minOverallConfidence: 0.5
      },
      console
    );

    isInitialized = true;
    console.log('Parserator services initialized successfully');

  } catch (error) {
    console.error('Failed to initialize services:', error);
    throw error;
  }
}

/**
 * Middleware to ensure services are initialized
 */
async function ensureInitialized(req: express.Request, res: express.Response, next: express.NextFunction) {
  try {
    await initializeServices();
    next();
  } catch (error) {
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
function requestLogger(req: express.Request, res: express.Response, next: express.NextFunction) {
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
  (req as any).requestId = requestId;
  (req as any).startTime = startTime;

  next();
}

/**
 * Middleware for response logging
 */
function responseLogger(req: express.Request, res: express.Response, next: express.NextFunction) {
  const originalSend = res.send;
  
  res.send = function(data) {
    const requestId = (req as any).requestId;
    const startTime = (req as any).startTime;
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
function errorHandler(err: any, req: express.Request, res: express.Response, next: express.NextFunction) {
  const requestId = (req as any).requestId || 'unknown';
  
  console.error('API error occurred', {
    requestId,
    error: err.message,
    stack: err.stack,
    method: req.method,
    path: req.path,
    timestamp: new Date().toISOString()
  });

  // Handle validation errors
  if (err instanceof z.ZodError) {
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
app.get('/health', ensureInitialized, async (req: express.Request, res: express.Response) => {
  try {
    const health = await parseService.getHealthStatus();
    const status = health.status === 'healthy' ? 200 : 503;

    const response = {
      status: health.status,
      version: '1.0.0',
      timestamp: health.timestamp,
      services: health.services,
      requestId: (req as any).requestId
    };

    res.status(status).json(response);
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      services: {},
      error: error instanceof Error ? error.message : 'Unknown error',
      requestId: (req as any).requestId
    });
  }
});

/**
 * Lean orchestration snapshot endpoint (admin only)
 */
app.get('/v1/lean/snapshot',
  ensureInitialized,
  authenticateApiKey,
  requireAdmin,
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      const snapshot = parseService.getLeanOrchestrationSnapshot();

      res.json({
        success: true,
        snapshot,
        requestId: (req as any).requestId
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Main parsing endpoint with authentication
 */
app.post('/v1/parse',
  ensureInitialized,
  authenticateApiKey, 
  incrementUsage,
  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      const requestId = (req as any).requestId;
      const authReq = req as AuthenticatedRequest;

      // Validate request body
      const validatedBody: ParseRequestBody = ParseRequestSchema.parse(req.body);

      // Create parse request with authenticated user context
      const parseRequest: IParseRequest = {
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

    } catch (error) {
      next(error);
    }
  }
);

/**
 * API information endpoint
 */
app.get('/v1/info', (req: express.Request, res: express.Response) => {
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
      'GET /v1/usage': 'Current usage statistics (requires API key)',
      'GET /v1/lean/snapshot': 'Lean orchestration readiness (admin API key)'
    },
    requestId: (req as any).requestId
  });
});

/**
 * User usage statistics endpoint
 */
app.get('/v1/usage', 
  ensureInitialized,
  authenticateApiKey,
  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      
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
        requestId: (req as any).requestId
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Admin endpoint: Get user statistics
 */
app.get('/admin/users/:userId/stats',
  ensureInitialized,
  authenticateApiKey,
  requireAdmin,
  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
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
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Admin endpoint: Update user subscription tier
 */
app.patch('/admin/users/:userId/tier',
  ensureInitialized,
  authenticateApiKey,
  requireAdmin,
  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
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
    } catch (error) {
      next(error);
    }
  }
);

/**
 * 404 handler
 */
app.use('*', (req: express.Request, res: express.Response) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Endpoint ${req.method} ${req.originalUrl} not found`,
      details: {
        requestId: (req as any).requestId,
        availableEndpoints: [
          'POST /v1/parse',
          'GET /health',
          'GET /v1/info',
          'GET /v1/lean/snapshot'
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
export const api = functions
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
export default app;