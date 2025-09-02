/**
 * API Key Generation Utilities for Parserator V3.0
 * Handles creation and management of user API keys
 */
/**
 * Generate a new API key for a user
 */
export declare function generateApiKey(userId: string, keyName?: string, isTestKey?: boolean): Promise<{
    apiKey: string;
    keyId: string;
}>;
/**
 * Create a new user account with default API key
 */
export declare function createUserAccount(email: string, subscriptionTier?: 'free' | 'pro' | 'enterprise', stripeCustomerId?: string): Promise<{
    userId: string;
    apiKey: string;
    keyId: string;
}>;
/**
 * Revoke an API key
 */
export declare function revokeApiKey(keyId: string, userId?: string): Promise<void>;
/**
 * List user's API keys
 */
export declare function listUserApiKeys(userId: string): Promise<Array<{
    keyId: string;
    name: string;
    createdAt: Date;
    lastUsed: Date | null;
    isActive: boolean;
    isTestKey: boolean;
}>>;
/**
 * Update API key name
 */
export declare function updateApiKeyName(keyId: string, newName: string, userId?: string): Promise<void>;
/**
 * Get usage statistics for a user
 */
export declare function getUserUsageStats(userId: string): Promise<{
    currentMonth: {
        usage: number;
        limit: number;
        percentage: number;
    };
    apiKeys: number;
    subscription: string;
    lastActive: Date | null;
}>;
//# sourceMappingURL=api-key-generator.d.ts.map