import * as admin from 'firebase-admin';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { generateApiKeyLookupToken } from './api-key-token';

// Initialize Firebase Admin (if not already initialized)
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

interface CreateUserOptions {
  email: string;
  tier: 'free' | 'pro' | 'enterprise';
}

export async function generateApiKey(prefix: 'pk_test' | 'pk_live' = 'pk_live'): Promise<string> {
  const randomBytes = uuidv4().replace(/-/g, '');
  return `${prefix}_${randomBytes}`;
}

export async function createUserWithApiKey(options: CreateUserOptions) {
  const { email, tier } = options;
  
  // Generate user ID and API key
  const userId = `user_${uuidv4()}`;
  const apiKey = await generateApiKey();
  const keyHash = await bcrypt.hash(apiKey, 10);
  const lookupToken = generateApiKeyLookupToken(apiKey);
  
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
  const keyId = `key_${uuidv4()}`;
  await db.collection('api_keys').doc(keyId).set({
    userId,
    keyHash,
    name: `${tier} API Key`,
    lookupToken,
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
  
  createUserWithApiKey({ email, tier: tier as any })
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Error:', err);
      process.exit(1);
    });
}