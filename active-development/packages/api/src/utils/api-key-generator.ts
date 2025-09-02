/**
 * API Key Generation Utilities for Parserator V3.0
 * Handles creation and management of user API keys
 */

import * as admin from 'firebase-admin';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

/**
 * Generate a new API key for a user
 */
export async function generateApiKey(
  userId: string,
  keyName?: string,
  isTestKey: boolean = false
): Promise<{ apiKey: string; keyId: string }> {
  const db = admin.firestore();
  
  // Generate random key material
  const keyMaterial = randomBytes(32).toString('hex');
  const prefix = isTestKey ? 'pk_test_' : 'pk_live_';
  const apiKey = `${prefix}${keyMaterial}`;
  
  // Hash the API key for storage
  const saltRounds = 12;
  const keyHash = await bcrypt.hash(apiKey, saltRounds);
  
  // Create API key document
  const apiKeyDoc = {
    userId,
    keyHash,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    lastUsed: null,
    isActive: true,
    name: keyName || `${isTestKey ? 'Test' : 'Live'} Key`,
    isTestKey
  };
  
  // Save to Firestore
  const docRef = await db.collection('api_keys').add(apiKeyDoc);
  
  console.log('API key generated', {
    userId,
    keyId: docRef.id,
    keyName: apiKeyDoc.name,
    isTestKey,
    timestamp: new Date().toISOString()
  });
  
  return {
    apiKey, // Return plaintext key (only time it's shown)
    keyId: docRef.id
  };
}

/**
 * Create a new user account with default API key
 */
export async function createUserAccount(
  email: string,
  subscriptionTier: 'free' | 'pro' | 'enterprise' = 'free',
  stripeCustomerId?: string
): Promise<{ userId: string; apiKey: string; keyId: string }> {
  const db = admin.firestore();
  
  // Create user document
  const userDoc = {
    email,
    stripeCustomerId: stripeCustomerId || '',
    subscriptionTier,
    monthlyUsage: {
      count: 0,
      lastReset: admin.firestore.FieldValue.serverTimestamp()
    },
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    isActive: true
  };
  
  // Save user
  const userRef = await db.collection('users').add(userDoc);
  const userId = userRef.id;
  
  // Generate default API key
  const { apiKey, keyId } = await generateApiKey(userId, 'Default Key', false);
  
  console.log('User account created', {
    userId,
    email,
    subscriptionTier,
    keyId,
    timestamp: new Date().toISOString()
  });
  
  return { userId, apiKey, keyId };
}

/**
 * Revoke an API key
 */
export async function revokeApiKey(keyId: string, userId?: string): Promise<void> {
  const db = admin.firestore();
  const keyRef = db.collection('api_keys').doc(keyId);
  
  // Verify key belongs to user if userId provided
  if (userId) {
    const keyDoc = await keyRef.get();
    if (!keyDoc.exists || keyDoc.data()?.userId !== userId) {
      throw new Error('API key not found or access denied');
    }
  }
  
  await keyRef.update({
    isActive: false,
    revokedAt: admin.firestore.FieldValue.serverTimestamp()
  });
  
  console.log('API key revoked', {
    keyId,
    userId,
    timestamp: new Date().toISOString()
  });
}

/**
 * List user's API keys
 */
export async function listUserApiKeys(userId: string): Promise<Array<{
  keyId: string;
  name: string;
  createdAt: Date;
  lastUsed: Date | null;
  isActive: boolean;
  isTestKey: boolean;
}>> {
  const db = admin.firestore();
  
  const keysSnapshot = await db.collection('api_keys')
    .where('userId', '==', userId)
    .orderBy('createdAt', 'desc')
    .get();
  
  return keysSnapshot.docs.map(doc => {
    const data = doc.data();
    return {
      keyId: doc.id,
      name: data.name,
      createdAt: data.createdAt.toDate(),
      lastUsed: data.lastUsed ? data.lastUsed.toDate() : null,
      isActive: data.isActive,
      isTestKey: data.isTestKey || false
    };
  });
}

/**
 * Update API key name
 */
export async function updateApiKeyName(
  keyId: string, 
  newName: string, 
  userId?: string
): Promise<void> {
  const db = admin.firestore();
  const keyRef = db.collection('api_keys').doc(keyId);
  
  // Verify key belongs to user if userId provided
  if (userId) {
    const keyDoc = await keyRef.get();
    if (!keyDoc.exists || keyDoc.data()?.userId !== userId) {
      throw new Error('API key not found or access denied');
    }
  }
  
  await keyRef.update({
    name: newName,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });
  
  console.log('API key name updated', {
    keyId,
    newName,
    userId,
    timestamp: new Date().toISOString()
  });
}

/**
 * Get usage statistics for a user
 */
export async function getUserUsageStats(userId: string): Promise<{
  currentMonth: {
    usage: number;
    limit: number;
    percentage: number;
  };
  apiKeys: number;
  subscription: string;
  lastActive: Date | null;
}> {
  const db = admin.firestore();
  
  // Get user data
  const userDoc = await db.collection('users').doc(userId).get();
  if (!userDoc.exists) {
    throw new Error('User not found');
  }
  
  const userData = userDoc.data()!;
  
  // Get API key count
  const keysSnapshot = await db.collection('api_keys')
    .where('userId', '==', userId)
    .where('isActive', '==', true)
    .get();
  
  // Get latest activity
  const latestKeyActivity = await db.collection('api_keys')
    .where('userId', '==', userId)
    .where('lastUsed', '!=', null)
    .orderBy('lastUsed', 'desc')
    .limit(1)
    .get();
  
  const lastActive = latestKeyActivity.empty ? 
    null : latestKeyActivity.docs[0].data().lastUsed.toDate();
  
  // Calculate limits based on tier
  const tierLimits = {
    free: 100,
    pro: 10000,
    enterprise: 100000
  };
  
  const limit = tierLimits[userData.subscriptionTier as keyof typeof tierLimits] || 100;
  const usage = userData.monthlyUsage.count;
  const percentage = Math.round((usage / limit) * 100);
  
  return {
    currentMonth: {
      usage,
      limit,
      percentage
    },
    apiKeys: keysSnapshot.size,
    subscription: userData.subscriptionTier,
    lastActive
  };
}