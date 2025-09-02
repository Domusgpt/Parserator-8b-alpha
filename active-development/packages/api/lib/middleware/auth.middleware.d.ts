/**
 * Authentication Middleware for Parserator V3.0
 * Handles API key validation, user lookup, and subscription tier enforcement
 */
import { Request, Response, NextFunction } from 'express';
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
    name?: string;
}
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
export declare class AuthError extends Error {
    code: string;
    statusCode: number;
    details?: Record<string, unknown> | undefined;
    constructor(message: string, code: string, statusCode?: number, details?: Record<string, unknown> | undefined);
}
/**
 * Main authentication middleware
 */
export declare function authenticateApiKey(req: Request, res: Response, next: NextFunction): Promise<void>;
/**
 * Middleware to increment usage count after successful request
 */
export declare function incrementUsage(req: Request, res: Response, next: NextFunction): Promise<void>;
/**
 * Middleware for admin-only endpoints
 */
export declare function requireAdmin(req: Request, res: Response, next: NextFunction): void;
//# sourceMappingURL=auth.middleware.d.ts.map