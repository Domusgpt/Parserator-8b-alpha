interface CreateUserOptions {
    email: string;
    tier: 'free' | 'pro' | 'enterprise';
}
export declare function generateApiKey(prefix?: 'pk_test' | 'pk_live'): Promise<string>;
export declare function createUserWithApiKey(options: CreateUserOptions): Promise<{
    userId: string;
    apiKey: string;
    email: string;
    tier: "free" | "pro" | "enterprise";
}>;
export {};
//# sourceMappingURL=generate-api-key.d.ts.map