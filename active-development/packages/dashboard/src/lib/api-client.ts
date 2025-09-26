const DEFAULT_API_BASE_URL = 'https://app-5108296280.us-central1.run.app';

const baseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/$/, '');

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface ApiEnvelope<T> {
  success?: boolean;
  data?: T;
  error?: {
    code?: string;
    message?: string;
  };
  [key: string]: unknown;
}

async function request<T>(
  apiKey: string,
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      ...(init.headers || {})
    }
  });

  let payload: ApiEnvelope<T> | T | undefined;
  try {
    payload = await response.json();
  } catch (error) {
    // Ignore JSON parse errors for empty responses
  }

  if (!response.ok) {
    const message =
      (payload as ApiEnvelope<T>)?.error?.message ||
      (payload as any)?.message ||
      `Request failed with status ${response.status}`;
    const code = (payload as ApiEnvelope<T>)?.error?.code;
    throw new ApiError(message, response.status, code);
  }

  if (payload && typeof payload === 'object' && 'success' in payload) {
    const envelope = payload as ApiEnvelope<T>;
    if (envelope.success === false) {
      throw new ApiError(
        envelope.error?.message || 'Request failed',
        response.status,
        envelope.error?.code
      );
    }
    if ('data' in envelope) {
      return envelope.data as T;
    }
  }

  return payload as T;
}

export interface UserProfileResponse {
  userId: string;
  email: string;
  subscriptionTier: 'free' | 'pro' | 'enterprise';
  usage: {
    usage: number;
    limit: number;
    percentage: number;
  };
  apiKeysCount: number;
  lastActive: string | null;
}

export interface UsageDetailsResponse {
  currentMonth: {
    usage: number;
    limit: number;
    percentage: number;
  };
  subscription: {
    tier: string;
    apiKeys: number;
    lastActive: string | null;
  };
  trends: {
    dailyAverage: number;
    projectedMonthly: number;
    remainingDays: number;
  };
  recommendations: string[];
}

export interface ApiKeySummary {
  keyId: string;
  name?: string;
  createdAt: string;
  lastUsed: string | null;
  isActive: boolean;
  isTestKey: boolean;
  keyPreview: string;
}

export interface ApiKeyListResponse {
  apiKeys: ApiKeySummary[];
  totalKeys: number;
  activeKeys: number;
}

export interface CreateApiKeyResponse {
  keyId: string;
  name: string;
  apiKey: string;
  isTestKey: boolean;
  createdAt: string;
  message: string;
}

export interface DeleteApiKeyResponse {
  keyId: string;
  message: string;
}

export async function fetchUserProfile(apiKey: string): Promise<UserProfileResponse> {
  return request<UserProfileResponse>(apiKey, '/user/profile');
}

export async function fetchUsageDetails(apiKey: string): Promise<UsageDetailsResponse> {
  return request<UsageDetailsResponse>(apiKey, '/user/usage');
}

export async function fetchApiKeys(apiKey: string): Promise<ApiKeyListResponse> {
  return request<ApiKeyListResponse>(apiKey, '/user/api-keys');
}

export async function createApiKey(
  apiKey: string,
  body: { name: string; isTestKey?: boolean }
): Promise<CreateApiKeyResponse> {
  return request<CreateApiKeyResponse>(apiKey, '/user/api-keys', {
    method: 'POST',
    body: JSON.stringify(body)
  });
}

export async function deleteApiKey(
  apiKey: string,
  keyId: string
): Promise<DeleteApiKeyResponse> {
  return request<DeleteApiKeyResponse>(apiKey, `/user/api-keys/${keyId}`, {
    method: 'DELETE'
  });
}

export async function updateApiKeyName(
  apiKey: string,
  keyId: string,
  name: string
): Promise<{ keyId: string; name: string; message: string }> {
  return request(apiKey, `/user/api-keys/${keyId}`, {
    method: 'PUT',
    body: JSON.stringify({ name })
  });
}

export function getApiBaseUrl(): string {
  return baseUrl;
}
