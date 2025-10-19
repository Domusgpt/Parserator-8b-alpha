/**
 * One-off migration to backfill lookup tokens for existing API keys.
 *
 * Usage:
 *   npx ts-node src/scripts/backfill-api-key-lookup.ts ./plaintext-api-keys.json
 *
 * The input file should be a JSON array where each entry is either a
 * string (the plaintext API key) or an object with the shape
 * `{ "apiKey": "pk_live_...", "keyId": "<optional firestore doc id>" }`.
 *
 * When a keyId is provided we skip the expensive bcrypt comparisons
 * and update the corresponding document directly. Otherwise the script
 * will compare the plaintext key against any documents that are still
 * missing a lookup token.
 */

import * as admin from 'firebase-admin';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';
import { generateApiKeyLookupToken } from '../utils/api-key-token';

interface PlaintextKeyRecord {
  apiKey: string;
  keyId?: string;
  matched?: boolean;
}

async function main(): Promise<void> {
  if (!admin.apps.length) {
    admin.initializeApp();
  }

  const [inputPath] = process.argv.slice(2);
  if (!inputPath) {
    console.error('Usage: ts-node src/scripts/backfill-api-key-lookup.ts <plaintext-keys.json>');
    process.exit(1);
  }

  const resolvedPath = path.resolve(process.cwd(), inputPath);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`Plaintext key export not found at ${resolvedPath}`);
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(resolvedPath, 'utf8')) as Array<string | { apiKey: string; keyId?: string }>;
  const plaintextRecords: PlaintextKeyRecord[] = raw.map(entry => {
    if (typeof entry === 'string') {
      return { apiKey: entry };
    }

    if (!entry.apiKey) {
      throw new Error('Invalid plaintext key entry – missing apiKey property');
    }

    return { apiKey: entry.apiKey, keyId: entry.keyId };
  });

  if (!plaintextRecords.length) {
    console.error('Plaintext key export is empty. Nothing to backfill.');
    process.exit(1);
  }

  const db = admin.firestore();
  const apiKeysSnapshot = await db.collection('api_keys').get();

  let updatedCount = 0;
  const unmatchedDocs: string[] = [];
  const missingPlaintext: string[] = [];

  for (const doc of apiKeysSnapshot.docs) {
    const data = doc.data() as { keyHash?: string; lookupToken?: string };

    if (!data.keyHash) {
      console.warn(`Skipping api_keys/${doc.id} – missing keyHash field`);
      continue;
    }

    if (data.lookupToken) {
      continue;
    }

    let matchingRecord = plaintextRecords.find(record => !record.matched && record.keyId === doc.id);

    if (!matchingRecord) {
      for (const record of plaintextRecords) {
        if (record.matched) {
          continue;
        }

        const isMatch = await bcrypt.compare(record.apiKey, data.keyHash);
        if (isMatch) {
          matchingRecord = record;
          break;
        }
      }
    }

    if (!matchingRecord) {
      unmatchedDocs.push(doc.id);
      continue;
    }

    const lookupToken = generateApiKeyLookupToken(matchingRecord.apiKey);
    await doc.ref.update({ lookupToken });

    matchingRecord.matched = true;
    updatedCount += 1;
  }

  for (const record of plaintextRecords) {
    if (!record.matched) {
      missingPlaintext.push(record.keyId ?? record.apiKey);
    }
  }

  console.log('Lookup token backfill complete', {
    totalDocuments: apiKeysSnapshot.size,
    updatedCount,
    unmatchedDocuments: unmatchedDocs,
    unusedPlaintextEntries: missingPlaintext.length
  });

  if (unmatchedDocs.length) {
    console.warn('The following API key documents could not be matched. You may need to supply their plaintext keys manually:', unmatchedDocs);
  }

  if (missingPlaintext.length) {
    console.warn('Some plaintext entries were not used during the migration:', missingPlaintext);
  }
}

main().catch(error => {
  console.error('Lookup token backfill failed', error);
  process.exit(1);
});
