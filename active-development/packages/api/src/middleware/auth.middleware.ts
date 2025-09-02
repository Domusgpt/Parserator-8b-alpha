/**
 * Authentication Middleware for Parserator V3.0
 * Handles API key validation, user lookup, and subscription tier enforcement
 */

import { Request, Response, NextFunction } from 'express';
import * as admin from 'firebase-admin';
import * as bcrypt from 'bcrypt';

/**
 * User document structure in Firestore
 */
export interface IUser {
  email: string;
  stripeCustomerId: string;
  subscriptionTier: 'free' | 'pro' | 'enterprise';
  monthlyUsage: {
    count: number;
    lastReset: Date;
  };
  createdAt: Date;
  isActive: boolean;
}

/**
 * API Key document structure in Firestore
 */
export interface IApiKey {
  userId: string;
  keyHash: string;
  createdAt: Date;
  lastUsed: Date;
  isActive: boolean;
  name?: string; // Optional key name for user management
}

/**
 * Subscription tier limits
 */
const TIER_LIMITS = {
  free: { requests: 100, rateLimit: 10 }, // 100/month, 10/minute
  pro: { requests: 10000, rateLimit: 100 }, // 10k/month, 100/minute  
  enterprise: { requests: 100000, rateLimit: 1000 } // 100k/month, 1000/minute
};

/**
 * Enhanced request object with user context
 */
export interface AuthenticatedRequest extends Request {
  user: {
    uid: string;
    email: string;
    subscriptionTier: 'free' | 'pro' | 'enterprise';
    monthlyUsage: number;
    monthlyLimit: number;
  };
  apiKey: {
    keyId: string;
    name?: string;
  };
}

/**
 * Authentication error types
 */
export class AuthError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 401,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * Main authentication middleware
 */
export async function authenticateApiKey(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Extract API key from Authorization header
    const authHeader = req.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthError(
        'Missing or invalid Authorization header. Expected: Bearer pk_live_xxx',
        'MISSING_API_KEY',
        401
      );
    }

    const apiKey = authHeader.replace('Bearer ', '');
    
    // Validate API key format
    if (!isValidApiKeyFormat(apiKey)) {
      throw new AuthError(
        'Invalid API key format. Expected: pk_live_xxx or pk_test_xxx',
        'INVALID_API_KEY_FORMAT',
        401
      );
    }

    // Find and validate API key in database
    const { user, apiKeyDoc } = await validateApiKey(apiKey);

    // Check if user account is active
    if (!user.isActive) {
      throw new AuthError(
        'User account is suspended. Contact support.',
        'ACCOUNT_SUSPENDED',
        403
      );
    }

    // Reset monthly usage if needed
    const updatedUser = await resetMonthlyUsageIfNeeded(user, user.uid);

    // Check usage limits
    await checkUsageLimits(updatedUser, req);

    // Check rate limits
    await checkRateLimits(updatedUser, req);

    // Update API key last used timestamp
    await updateApiKeyLastUsed(apiKeyDoc.id);

    // Add user context to request
    (req as AuthenticatedRequest).user = {
      uid: apiKeyDoc.userId,
      email: updatedUser.email,
      subscriptionTier: updatedUser.subscriptionTier,
      monthlyUsage: updatedUser.monthlyUsage.count,
      monthlyLimit: TIER_LIMITS[updatedUser.subscriptionTier].requests
    };

    (req as AuthenticatedRequest).apiKey = {
      keyId: apiKeyDoc.id,
      name: apiKeyDoc.name
    };

    next();

  } catch (error) {
    console.error('Authentication failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      path: req.path,
      method: req.method,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    });

    if (error instanceof AuthError) {
      res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details
        }
      });
      return;
    }

    // Handle unexpected errors
    res.status(500).json({
      success: false,
      error: {
        code: 'AUTHENTICATION_ERROR',
        message: 'Authentication service temporarily unavailable'
      }
    });
  }
}

/**
 * Validate API key format
 */
function isValidApiKeyFormat(apiKey: string): boolean {
  // Expected format: pk_live_xxx or pk_test_xxx (minimum 32 chars)
  return /^pk_(live|test)_[a-zA-Z0-9]{20,}$/.test(apiKey);
}

/**
 * Find and validate API key in Firestore
 */
async function validateApiKey(apiKey: string): Promise<{
  user: IUser & { uid: string };
  apiKeyDoc: IApiKey & { id: string; userId: string };
}> {
  const db = admin.firestore();

  // Get all API keys (we'll need to check hashes)
  const apiKeysSnapshot = await db.collection('api_keys')
    .where('isActive', '==', true)
    .get();

  let matchedApiKeyDoc: any = null;

  // Check each API key hash
  for (const doc of apiKeysSnapshot.docs) {
    const apiKeyData = doc.data() as IApiKey;
    
    // Compare hash (bcrypt compare)
    if (await bcrypt.compare(apiKey, apiKeyData.keyHash)) {
      matchedApiKeyDoc = { id: doc.id, ...apiKeyData };
      break;
    }
  }

  if (!matchedApiKeyDoc) {
    throw new AuthError(
      'Invalid API key. Check your key or generate a new one.',
      'INVALID_API_KEY',
      401
    );
  }

  // Get user document
  const userDoc = await db.collection('users').doc(matchedApiKeyDoc.userId).get();
  if (!userDoc.exists) {
    throw new AuthError(
      'User account not found. Contact support.',
      'USER_NOT_FOUND',
      401
    );
  }

  const userData = userDoc.data() as IUser;

  return {
    user: { uid: userDoc.id, ...userData },
    apiKeyDoc: matchedApiKeyDoc
  };
}

/**
 * Reset monthly usage if it's a new month
 */
async function resetMonthlyUsageIfNeeded(
  user: IUser & { uid: string },
  userId?: string
): Promise<IUser & { uid: string }> {
  const now = new Date();
  const lastReset = user.monthlyUsage.lastReset instanceof Date ? 
    user.monthlyUsage.lastReset : 
    (user.monthlyUsage.lastReset as any).toDate ? 
      (user.monthlyUsage.lastReset as any).toDate() : 
      new Date(user.monthlyUsage.lastReset);
  
  // Check if we're in a new month
  const isNewMonth = (
    now.getFullYear() !== lastReset.getFullYear() ||
    now.getMonth() !== lastReset.getMonth()
  );

  if (isNewMonth) {
    const db = admin.firestore();
    const updatedUsage = {
      count: 0,
      lastReset: now
    };

    await db.collection('users').doc(user.uid).update({
      monthlyUsage: updatedUsage
    });

    console.log('Monthly usage reset for user:', {
      userId: user.uid,
      previousCount: user.monthlyUsage.count,
      resetDate: now.toISOString()
    });

    return {
      ...user,
      monthlyUsage: updatedUsage
    };
  }

  return user;
}

/**
 * Check if user has exceeded monthly usage limits
 */
async function checkUsageLimits(user: IUser & { uid: string }, req: Request): Promise<void> {
  const limit = TIER_LIMITS[user.subscriptionTier].requests;
  
  if (user.monthlyUsage.count >= limit) {
    throw new AuthError(
      `Monthly usage limit exceeded. Used ${user.monthlyUsage.count}/${limit} requests. Upgrade your plan to continue.`,
      'USAGE_LIMIT_EXCEEDED',
      429,
      {
        currentUsage: user.monthlyUsage.count,
        monthlyLimit: limit,
        subscriptionTier: user.subscriptionTier,
        upgradeUrl: 'https://parserator.com/pricing'
      }
    );
  }
}

/**
 * Check rate limits (requests per minute)
 */
async function checkRateLimits(user: IUser & { uid: string }, req: Request): Promise<void> {
  const rateLimit = TIER_LIMITS[user.subscriptionTier].rateLimit;
  const db = admin.firestore();
  
  // Use a simple sliding window rate limiter
  const now = Date.now();
  const windowStart = now - (60 * 1000); // 1 minute window
  
  const rateLimitDoc = db.collection('rate_limits').doc(user.uid);
  
  await db.runTransaction(async (transaction) => {
    const doc = await transaction.get(rateLimitDoc);
    
    let requests: number[] = [];
    if (doc.exists) {
      const data = doc.data();
      requests = (data?.requests || []).filter((timestamp: number) => timestamp > windowStart);
    }
    
    if (requests.length >= rateLimit) {
      throw new AuthError(
        `Rate limit exceeded. Maximum ${rateLimit} requests per minute for ${user.subscriptionTier} tier.`,
        'RATE_LIMIT_EXCEEDED',
        429,
        {
          rateLimit,
          subscriptionTier: user.subscriptionTier,
          retryAfter: 60
        }
      );
    }
    
    // Add current request timestamp
    requests.push(now);
    
    transaction.set(rateLimitDoc, {
      requests,
      lastUpdated: now
    });
  });
}

/**
 * Update API key last used timestamp
 */
async function updateApiKeyLastUsed(apiKeyId: string): Promise<void> {
  const db = admin.firestore();
  await db.collection('api_keys').doc(apiKeyId).update({
    lastUsed: admin.firestore.FieldValue.serverTimestamp()
  });
}

/**
 * Middleware to increment usage count after successful request
 */
export async function incrementUsage(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const originalSend = res.send;
  
  res.send = function(data) {
    // Only increment for successful requests
    if (res.statusCode === 200) {
      const authReq = req as AuthenticatedRequest;
      if (authReq.user?.uid) {
        incrementUserUsage(authReq.user.uid, authReq.apiKey?.keyId).catch(error => {
          console.error('Failed to increment usage:', error);
        });
      }
    }
    
    return originalSend.call(this, data);
  };
  
  next();
}

/**
 * Increment user's monthly usage count
 */
async function incrementUserUsage(userId: string, apiKeyId?: string): Promise<void> {
  const db = admin.firestore();
  
  await db.runTransaction(async (transaction) => {
    const userRef = db.collection('users').doc(userId);
    const userDoc = await transaction.get(userRef);
    
    if (userDoc.exists) {
      const userData = userDoc.data() as IUser;
      transaction.update(userRef, {
        'monthlyUsage.count': userData.monthlyUsage.count + 1
      });
    }
  });

  console.log('Usage incremented:', {
    userId,
    apiKeyId,
    timestamp: new Date().toISOString()
  });
}

/**
 * Middleware for admin-only endpoints
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const authReq = req as AuthenticatedRequest;
  
  // For now, simple admin check - in production, you'd have admin flags in user docs
  if (authReq.user?.email && authReq.user.email.endsWith('@parserator.com')) {
    next();
  } else {
    res.status(403).json({
      success: false,
      error: {
        code: 'ADMIN_REQUIRED',
        message: 'This endpoint requires administrator privileges'
      }
    });
  }
}