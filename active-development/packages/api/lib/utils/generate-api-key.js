"use strict";
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
exports.generateApiKey = generateApiKey;
exports.createUserWithApiKey = createUserWithApiKey;
const admin = __importStar(require("firebase-admin"));
const bcrypt = __importStar(require("bcrypt"));
const uuid_1 = require("uuid");
// Initialize Firebase Admin (if not already initialized)
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();
async function generateApiKey(prefix = 'pk_live') {
    const randomBytes = (0, uuid_1.v4)().replace(/-/g, '');
    return `${prefix}_${randomBytes}`;
}
async function createUserWithApiKey(options) {
    const { email, tier } = options;
    // Generate user ID and API key
    const userId = `user_${(0, uuid_1.v4)()}`;
    const apiKey = await generateApiKey();
    const keyHash = await bcrypt.hash(apiKey, 10);
    // Create user document
    await db.collection('users').doc(userId).set({
        email,
        subscriptionTier: tier,
        monthlyUsage: {
            count: 0,
            lastReset: admin.firestore.Timestamp.now()
        },
        createdAt: admin.firestore.Timestamp.now()
    });
    // Create API key document
    const keyId = `key_${(0, uuid_1.v4)()}`;
    await db.collection('api_keys').doc(keyId).set({
        userId,
        keyHash,
        name: `${tier} API Key`,
        createdAt: admin.firestore.Timestamp.now(),
        lastUsed: null
    });
    console.log(`
✅ User created successfully!
📧 Email: ${email}
🆔 User ID: ${userId}
🔑 API Key: ${apiKey}
📦 Tier: ${tier}

Save this API key securely - it won't be shown again!
  `);
    return { userId, apiKey, email, tier };
}
// CLI usage
if (require.main === module) {
    const args = process.argv.slice(2);
    if (args.length < 2) {
        console.error('Usage: ts-node generate-api-key.ts <email> <tier>');
        console.error('Example: ts-node generate-api-key.ts user@example.com pro');
        process.exit(1);
    }
    const [email, tier] = args;
    if (!['free', 'pro', 'enterprise'].includes(tier)) {
        console.error('Tier must be one of: free, pro, enterprise');
        process.exit(1);
    }
    createUserWithApiKey({ email, tier: tier })
        .then(() => process.exit(0))
        .catch(err => {
        console.error('Error:', err);
        process.exit(1);
    });
}
//# sourceMappingURL=generate-api-key.js.map