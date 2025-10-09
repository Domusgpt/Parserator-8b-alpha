"use strict";
/**
 * User Management Routes for Parserator V3.0
 * Handles user registration, API key management, and account operations
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerUser = registerUser;
exports.getUserProfile = getUserProfile;
exports.createApiKey = createApiKey;
exports.listApiKeys = listApiKeys;
exports.updateApiKey = updateApiKey;
exports.deleteApiKey = deleteApiKey;
exports.getUserUsage = getUserUsage;
const admin = __importStar(require("firebase-admin"));
const api_key_generator_1 = require("../utils/api-key-generator");
/**
 * POST /user/register
 * Create a new user account with default API key
 */
async function registerUser(req, res) {
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
        const { userId, apiKey, keyId } = await (0, api_key_generator_1.createUserAccount)(email, subscriptionTier);
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
    }
    catch (error) {
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
async function getUserProfile(req, res) {
    try {
        const authReq = req;
        const userId = authReq.user.uid;
        const stats = await (0, api_key_generator_1.getUserUsageStats)(userId);
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
    }
    catch (error) {
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
async function createApiKey(req, res) {
    try {
        const authReq = req;
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
        const existingKeys = await (0, api_key_generator_1.listUserApiKeys)(userId);
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
        const { apiKey, keyId } = await (0, api_key_generator_1.generateApiKey)(userId, name.trim(), isTestKey);
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
    }
    catch (error) {
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
async function listApiKeys(req, res) {
    try {
        const authReq = req;
        const userId = authReq.user.uid;
        const apiKeys = await (0, api_key_generator_1.listUserApiKeys)(userId);
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
    }
    catch (error) {
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
async function updateApiKey(req, res) {
    try {
        const authReq = req;
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
        await (0, api_key_generator_1.updateApiKeyName)(keyId, name.trim(), userId);
        res.json({
            success: true,
            data: {
                keyId,
                name: name.trim(),
                message: 'API key updated successfully'
            }
        });
    }
    catch (error) {
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
async function deleteApiKey(req, res) {
    try {
        const authReq = req;
        const userId = authReq.user.uid;
        const { keyId } = req.params;
        // Check if this is the user's last active key
        const userKeys = await (0, api_key_generator_1.listUserApiKeys)(userId);
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
        await (0, api_key_generator_1.revokeApiKey)(keyId, userId);
        res.json({
            success: true,
            data: {
                keyId,
                message: 'API key revoked successfully'
            }
        });
    }
    catch (error) {
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
async function getUserUsage(req, res) {
    try {
        const authReq = req;
        const userId = authReq.user.uid;
        const stats = await (0, api_key_generator_1.getUserUsageStats)(userId);
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
    }
    catch (error) {
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
function generateUsageRecommendations(stats) {
    const recommendations = [];
    if (stats.currentMonth.percentage > 80) {
        recommendations.push('You\'re approaching your monthly limit. Consider upgrading to avoid service interruption.');
    }
    if (stats.apiKeys === 1) {
        recommendations.push('Create a test API key for development to keep production and testing separate.');
    }
    if (!stats.lastActive) {
        recommendations.push('Start using your API keys to unlock the full power of Parserator!');
    }
    else {
        const daysSinceActive = Math.floor((Date.now() - new Date(stats.lastActive).getTime()) / (1000 * 60 * 60 * 24));
        if (daysSinceActive > 7) {
            recommendations.push('It\'s been a while since your last API call. Check out our examples for inspiration!');
        }
    }
    return recommendations;
}
//# sourceMappingURL=user.routes.js.map