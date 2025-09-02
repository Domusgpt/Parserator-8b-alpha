/**
 * Parserator API v3.0 - Complete authenticated API with user management
 * Includes parsing endpoints, authentication, API key management, and billing
 */

import * as functions from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import * as admin from 'firebase-admin';
import express from 'express';
import cors from 'cors';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Middleware imports
import { authenticateApiKey, incrementUsage, AuthenticatedRequest } from './middleware/auth.middleware';

// Route imports
import {
  registerUser,
  getUserProfile,
  createApiKey,
  listApiKeys,
  updateApiKey,
  deleteApiKey,
  getUserUsage
} from './routes/user.routes';

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp();
}

// Define secrets
const geminiApiKey = defineSecret('GEMINI_API_KEY');

// Create Express app
const app = express();

// Middleware
app.use(cors({
  origin: ['https://parserator.com', 'https://parserator-production.web.app', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

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
app.post('/user/register', registerUser);

// Apply authentication middleware to all subsequent routes
app.use(authenticateApiKey);

// Apply usage tracking middleware
app.use(incrementUsage);

// Authenticated routes

/**
 * POST /v1/parse
 * Main parsing endpoint using Architect-Extractor pattern
 */
app.post('/v1/parse', async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  
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

    const genAI = new GoogleGenerativeAI(apiKey);
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
    } catch (e: any) {
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
    } catch (e: any) {
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

  } catch (error: any) {
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
app.get('/user/profile', getUserProfile);
app.get('/user/api-keys', listApiKeys);
app.post('/user/api-keys', createApiKey);
app.put('/user/api-keys/:keyId', updateApiKey);
app.delete('/user/api-keys/:keyId', deleteApiKey);
app.get('/user/usage', getUserUsage);

// Error handling middleware
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
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
export const api = functions.onRequest({
  invoker: 'public',
  timeoutSeconds: 300,
  memory: '2GiB',
  secrets: [geminiApiKey],
  minInstances: 0,
  maxInstances: 100
}, app);