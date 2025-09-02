/**
 * User Management Routes for Parserator V3.0
 * Handles user registration, API key management, and account operations
 */

import { Request, Response } from 'express';
import * as admin from 'firebase-admin';
import {
  generateApiKey,
  createUserAccount,
  revokeApiKey,
  listUserApiKeys,
  updateApiKeyName,
  getUserUsageStats
} from '../utils/api-key-generator';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

/**
 * POST /user/register
 * Create a new user account with default API key
 */
export async function registerUser(req: Request, res: Response): Promise<void> {
  try {
    const { email, subscriptionTier = 'free' } = req.body;

    if (!email || !email.includes('@')) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_EMAIL',
          message: 'Valid email address is required'
        }
      });
      return;
    }

    if (!['free', 'pro', 'enterprise'].includes(subscriptionTier)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_TIER',
          message: 'Subscription tier must be free, pro, or enterprise'
        }
      });
      return;
    }

    // Check if user already exists
    const db = admin.firestore();
    const existingUser = await db.collection('users')
      .where('email', '==', email)
      .limit(1)
      .get();

    if (!existingUser.empty) {
      res.status(409).json({
        success: false,
        error: {
          code: 'USER_EXISTS',
          message: 'An account with this email already exists'
        }
      });
      return;
    }

    // Create user account
    const { userId, apiKey, keyId } = await createUserAccount(email, subscriptionTier);

    res.status(201).json({
      success: true,
      data: {
        userId,
        email,
        subscriptionTier,
        apiKey, // Only time the key is shown in plaintext
        keyId,
        message: 'Account created successfully. Save your API key securely - it won\'t be shown again!'
      }
    });

  } catch (error: any) {
    console.error('User registration failed:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'REGISTRATION_FAILED',
        message: 'Failed to create user account',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      }
    });
  }
}

/**
 * GET /user/profile
 * Get current user's profile and usage information
 */
export async function getUserProfile(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user.uid;

    const stats = await getUserUsageStats(userId);

    res.json({
      success: true,
      data: {
        userId,
        email: authReq.user.email,
        subscriptionTier: authReq.user.subscriptionTier,
        usage: stats.currentMonth,
        apiKeysCount: stats.apiKeys,
        lastActive: stats.lastActive
      }
    });

  } catch (error: any) {
    console.error('Failed to get user profile:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'PROFILE_FETCH_FAILED',
        message: 'Failed to retrieve user profile'
      }
    });
  }
}

/**
 * POST /user/api-keys
 * Create a new API key for the authenticated user
 */
export async function createApiKey(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user.uid;
    const { name, isTestKey = false } = req.body;

    if (!name || name.trim().length === 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_NAME',
          message: 'API key name is required'
        }
      });
      return;
    }

    // Check if user has reached API key limit (e.g., 10 keys max)
    const existingKeys = await listUserApiKeys(userId);
    const activeKeys = existingKeys.filter(key => key.isActive);
    
    if (activeKeys.length >= 10) {
      res.status(429).json({
        success: false,
        error: {
          code: 'KEY_LIMIT_EXCEEDED',
          message: 'Maximum number of API keys reached (10). Delete unused keys to create new ones.',
          details: {
            currentCount: activeKeys.length,
            limit: 10
          }
        }
      });
      return;
    }

    const { apiKey, keyId } = await generateApiKey(userId, name.trim(), isTestKey);

    res.status(201).json({
      success: true,
      data: {
        keyId,
        name: name.trim(),
        apiKey, // Only time the key is shown in plaintext
        isTestKey,
        createdAt: new Date().toISOString(),
        message: 'API key created successfully. Save it securely - it won\'t be shown again!'
      }
    });

  } catch (error: any) {
    console.error('API key creation failed:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'KEY_CREATION_FAILED',
        message: 'Failed to create API key'
      }
    });
  }
}

/**
 * GET /user/api-keys
 * List all API keys for the authenticated user
 */
export async function listApiKeys(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user.uid;

    const apiKeys = await listUserApiKeys(userId);

    res.json({
      success: true,
      data: {
        apiKeys: apiKeys.map(key => ({
          keyId: key.keyId,
          name: key.name,
          createdAt: key.createdAt.toISOString(),
          lastUsed: key.lastUsed ? key.lastUsed.toISOString() : null,
          isActive: key.isActive,
          isTestKey: key.isTestKey,
          keyPreview: `${key.isTestKey ? 'pk_test' : 'pk_live'}_****` // Never show full key
        })),
        totalKeys: apiKeys.length,
        activeKeys: apiKeys.filter(k => k.isActive).length
      }
    });

  } catch (error: any) {
    console.error('Failed to list API keys:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'KEY_LIST_FAILED',
        message: 'Failed to retrieve API keys'
      }
    });
  }
}

/**
 * PUT /user/api-keys/:keyId
 * Update an API key (name only)
 */
export async function updateApiKey(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user.uid;
    const { keyId } = req.params;
    const { name } = req.body;

    if (!name || name.trim().length === 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_NAME',
          message: 'API key name is required'
        }
      });
      return;
    }

    await updateApiKeyName(keyId, name.trim(), userId);

    res.json({
      success: true,
      data: {
        keyId,
        name: name.trim(),
        message: 'API key updated successfully'
      }
    });

  } catch (error: any) {
    console.error('API key update failed:', error);
    
    if (error.message.includes('not found') || error.message.includes('access denied')) {
      res.status(404).json({
        success: false,
        error: {
          code: 'KEY_NOT_FOUND',
          message: 'API key not found or access denied'
        }
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'KEY_UPDATE_FAILED',
        message: 'Failed to update API key'
      }
    });
  }
}

/**
 * DELETE /user/api-keys/:keyId
 * Revoke an API key
 */
export async function deleteApiKey(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user.uid;
    const { keyId } = req.params;

    // Check if this is the user's last active key
    const userKeys = await listUserApiKeys(userId);
    const activeKeys = userKeys.filter(key => key.isActive);
    
    if (activeKeys.length === 1 && activeKeys[0].keyId === keyId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'LAST_KEY_DELETION',
          message: 'Cannot delete your last active API key. Create a new key first.',
          details: {
            suggestion: 'Create a new API key before deleting this one to maintain access to your account.'
          }
        }
      });
      return;
    }

    await revokeApiKey(keyId, userId);

    res.json({
      success: true,
      data: {
        keyId,
        message: 'API key revoked successfully'
      }
    });

  } catch (error: any) {
    console.error('API key deletion failed:', error);
    
    if (error.message.includes('not found') || error.message.includes('access denied')) {
      res.status(404).json({
        success: false,
        error: {
          code: 'KEY_NOT_FOUND',
          message: 'API key not found or access denied'
        }
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'KEY_DELETION_FAILED',
        message: 'Failed to revoke API key'
      }
    });
  }
}

/**
 * GET /user/usage
 * Get detailed usage statistics for the authenticated user
 */
export async function getUserUsage(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user.uid;

    const stats = await getUserUsageStats(userId);
    
    // Calculate usage trend (simplified - in production you'd query historical data)
    const daysInMonth = new Date().getDate();
    const dailyAverage = Math.round(stats.currentMonth.usage / daysInMonth);
    const projectedMonthly = dailyAverage * 30;

    res.json({
      success: true,
      data: {
        currentMonth: stats.currentMonth,
        subscription: {
          tier: stats.subscription,
          apiKeys: stats.apiKeys,
          lastActive: stats.lastActive
        },
        trends: {
          dailyAverage,
          projectedMonthly,
          remainingDays: 30 - daysInMonth
        },
        recommendations: generateUsageRecommendations(stats)
      }
    });

  } catch (error: any) {
    console.error('Failed to get usage stats:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'USAGE_FETCH_FAILED',
        message: 'Failed to retrieve usage statistics'
      }
    });
  }
}

/**
 * Generate usage recommendations based on stats
 */
function generateUsageRecommendations(stats: any): string[] {
  const recommendations: string[] = [];
  
  if (stats.currentMonth.percentage > 80) {
    recommendations.push('You\'re approaching your monthly limit. Consider upgrading to avoid service interruption.');
  }
  
  if (stats.apiKeys === 1) {
    recommendations.push('Create a test API key for development to keep production and testing separate.');
  }
  
  if (!stats.lastActive) {
    recommendations.push('Start using your API keys to unlock the full power of Parserator!');
  } else {
    const daysSinceActive = Math.floor((Date.now() - new Date(stats.lastActive).getTime()) / (1000 * 60 * 60 * 24));
    if (daysSinceActive > 7) {
      recommendations.push('It\'s been a while since your last API call. Check out our examples for inspiration!');
    }
  }
  
  return recommendations;
}