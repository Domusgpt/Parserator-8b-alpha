/**
 * User Management Routes for Parserator V3.0
 * Handles user registration, API key management, and account operations
 */
import { Request, Response } from 'express';
/**
 * POST /user/register
 * Create a new user account with default API key
 */
export declare function registerUser(req: Request, res: Response): Promise<void>;
/**
 * GET /user/profile
 * Get current user's profile and usage information
 */
export declare function getUserProfile(req: Request, res: Response): Promise<void>;
/**
 * POST /user/api-keys
 * Create a new API key for the authenticated user
 */
export declare function createApiKey(req: Request, res: Response): Promise<void>;
/**
 * GET /user/api-keys
 * List all API keys for the authenticated user
 */
export declare function listApiKeys(req: Request, res: Response): Promise<void>;
/**
 * PUT /user/api-keys/:keyId
 * Update an API key (name only)
 */
export declare function updateApiKey(req: Request, res: Response): Promise<void>;
/**
 * DELETE /user/api-keys/:keyId
 * Revoke an API key
 */
export declare function deleteApiKey(req: Request, res: Response): Promise<void>;
/**
 * GET /user/usage
 * Get detailed usage statistics for the authenticated user
 */
export declare function getUserUsage(req: Request, res: Response): Promise<void>;
//# sourceMappingURL=user.routes.d.ts.map