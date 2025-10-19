import { createHash } from 'crypto';

/**
 * Length of the lookup token stored alongside the hashed API key.
 * 16 hex characters gives us 64 bits of entropy which keeps the
 * candidate set very small while remaining index-friendly.
 */
export const API_KEY_LOOKUP_TOKEN_LENGTH = 16;

/**
 * Derive the deterministic lookup token for an API key.
 *
 * We take a truncated SHA-256 digest of the plaintext key. This keeps
 * the token deterministic (so we can recompute it during validation)
 * without storing the original key material.
 */
export function generateApiKeyLookupToken(apiKey: string): string {
  if (!apiKey) {
    throw new Error('API key is required to generate a lookup token');
  }

  return createHash('sha256')
    .update(apiKey)
    .digest('hex')
    .slice(0, API_KEY_LOOKUP_TOKEN_LENGTH);
}
