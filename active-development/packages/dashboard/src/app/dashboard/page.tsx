'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Key,
  BarChart3,
  Zap,
  Plus,
  Eye,
  EyeOff,
  Copy,
  Trash2,
  ExternalLink,
  AlertCircle,
  CheckCircle,
  Clock,
  RefreshCw,
  ShieldCheck
} from 'lucide-react';
import toast from 'react-hot-toast';

import {
  ApiError,
  ApiKeySummary,
  UsageDetailsResponse,
  UserProfileResponse,
  createApiKey as createApiKeyRequest,
  deleteApiKey as deleteApiKeyRequest,
  fetchApiKeys,
  fetchUsageDetails,
  fetchUserProfile,
  getApiBaseUrl
} from '../../lib/api-client';

const AUTH_STORAGE_KEY = 'parserator_dashboard_auth_key';
const KEY_CACHE_STORAGE_KEY = 'parserator_dashboard_key_cache_v1';

interface UsageHistoryPoint {
  date: string;
  requests: number;
}

function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 12) {
    return `${apiKey.slice(0, 4)}••••${apiKey.slice(-2)}`;
  }
  return `${apiKey.slice(0, 10)}…${apiKey.slice(-4)}`;
}

function formatRelativeDate(dateString: string | null): string {
  if (!dateString) {
    return 'Never';
  }
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return 'Never';
  }

  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return 'Today';
  }
  if (diffDays === 1) {
    return 'Yesterday';
  }
  if (diffDays < 7) {
    return `${diffDays} days ago`;
  }
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function buildUsageHistory(usage: UsageDetailsResponse | null): UsageHistoryPoint[] {
  if (!usage) {
    return [];
  }

  const points: UsageHistoryPoint[] = [];
  const today = new Date();
  const baseline =
    usage.trends.dailyAverage ||
    (usage.currentMonth.usage && usage.trends.remainingDays < 30
      ? Math.round(usage.currentMonth.usage / Math.max(1, 30 - usage.trends.remainingDays))
      : usage.currentMonth.usage / Math.max(1, today.getDate()));
  const safeBaseline = Math.max(Math.round(baseline), 0);

  for (let offset = 6; offset >= 0; offset -= 1) {
    const pointDate = new Date(today);
    pointDate.setDate(today.getDate() - offset);
    const varianceFactor = 0.9 + (offset % 3) * 0.07;
    const requests = Math.max(0, Math.round(safeBaseline * varianceFactor));
    points.push({ date: pointDate.toISOString(), requests });
  }

  return points;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError || error instanceof Error) {
    return error.message;
  }
  return 'Unexpected error occurred';
}

export default function DashboardPage() {
  const [profile, setProfile] = useState<UserProfileResponse | null>(null);
  const [usageDetails, setUsageDetails] = useState<UsageDetailsResponse | null>(null);
  const [apiKeys, setApiKeys] = useState<ApiKeySummary[]>([]);
  const [apiKeyStats, setApiKeyStats] = useState({ total: 0, active: 0 });
  const [authKey, setAuthKey] = useState<string | null>(null);
  const [fullKeyCache, setFullKeyCache] = useState<Record<string, string>>({});
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const apiBaseUrl = getApiBaseUrl();

  const persistKeyCache = useCallback((cache: Record<string, string>) => {
    setFullKeyCache(cache);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(KEY_CACHE_STORAGE_KEY, JSON.stringify(cache));
    }
  }, []);

  const storePlaintextKey = useCallback((keyId: string, keyValue: string) => {
    setFullKeyCache(prev => {
      const next = { ...prev, [keyId]: keyValue };
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(KEY_CACHE_STORAGE_KEY, JSON.stringify(next));
      }
      return next;
    });
    setRevealedKeys(prev => {
      const next = new Set(prev);
      next.add(keyId);
      return next;
    });
  }, []);

  const removePlaintextKey = useCallback((keyId: string) => {
    setFullKeyCache(prev => {
      if (!(keyId in prev)) {
        return prev;
      }
      const { [keyId]: _removed, ...rest } = prev;
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(KEY_CACHE_STORAGE_KEY, JSON.stringify(rest));
      }
      return rest;
    });
    setRevealedKeys(prev => {
      const next = new Set(prev);
      next.delete(keyId);
      return next;
    });
  }, []);

  const resetSession = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
    }
    setAuthKey(null);
    setProfile(null);
    setUsageDetails(null);
    setApiKeys([]);
    setApiKeyStats({ total: 0, active: 0 });
    setLastRefreshed(null);
  }, []);

  const bootstrapKey = useCallback(
    async (key: string) => {
      setIsBootstrapping(true);
      setConnectError(null);
      try {
        const [profileData, usageData, apiKeyData] = await Promise.all([
          fetchUserProfile(key),
          fetchUsageDetails(key),
          fetchApiKeys(key)
        ]);

        setProfile(profileData);
        setUsageDetails(usageData);
        setApiKeys(apiKeyData.apiKeys);
        setApiKeyStats({ total: apiKeyData.totalKeys, active: apiKeyData.activeKeys });
        setAuthKey(key);
        setLastRefreshed(new Date());

        if (typeof window !== 'undefined') {
          window.localStorage.setItem(AUTH_STORAGE_KEY, key);
        }

        setShowConnectModal(false);
      } catch (error) {
        resetSession();
        throw error;
      } finally {
        setIsBootstrapping(false);
      }
    },
    [resetSession]
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const storedCacheRaw = window.localStorage.getItem(KEY_CACHE_STORAGE_KEY);
      if (storedCacheRaw) {
        const storedCache = JSON.parse(storedCacheRaw) as Record<string, string>;
        persistKeyCache(storedCache);
        setRevealedKeys(new Set(Object.keys(storedCache)));
      }
    } catch (error) {
      console.warn('Failed to load key cache from storage', error);
      persistKeyCache({});
    }

    const storedKey = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (storedKey) {
      bootstrapKey(storedKey).catch(error => {
        if (error instanceof ApiError && error.status === 401) {
          toast.error('Stored API key is no longer valid. Please connect a new key.');
          setConnectError('API key expired or revoked. Enter a new key to continue.');
        } else {
          toast.error(`Failed to load dashboard: ${getErrorMessage(error)}`);
          setConnectError('Unable to load dashboard data. Reconnect with a valid API key.');
        }
        setShowConnectModal(true);
      });
    } else {
      setShowConnectModal(true);
    }
  }, [bootstrapKey, persistKeyCache]);

  const refreshAll = useCallback(
    async (showToast: boolean) => {
      if (!authKey) {
        return;
      }

      setIsMutating(true);
      try {
        const [profileData, usageData, apiKeyData] = await Promise.all([
          fetchUserProfile(authKey),
          fetchUsageDetails(authKey),
          fetchApiKeys(authKey)
        ]);

        setProfile(profileData);
        setUsageDetails(usageData);
        setApiKeys(apiKeyData.apiKeys);
        setApiKeyStats({ total: apiKeyData.totalKeys, active: apiKeyData.activeKeys });
        setLastRefreshed(new Date());

        if (showToast) {
          toast.success('Dashboard refreshed');
        }
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          toast.error('Your API key no longer has access. Please reconnect.');
          resetSession();
          setShowConnectModal(true);
        } else {
          toast.error(`Failed to refresh dashboard: ${getErrorMessage(error)}`);
        }
      } finally {
        setIsMutating(false);
      }
    },
    [authKey, resetSession]
  );

  const handleConnect = useCallback(
    async (key: string) => {
      if (!key) {
        setConnectError('Enter your Parserator API key to continue.');
        return;
      }

      setIsConnecting(true);
      setConnectError(null);
      try {
        await bootstrapKey(key.trim());
        toast.success('API key connected');
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          setConnectError('API key not recognized. Double-check and try again.');
          toast.error('Authentication failed. Please verify your API key.');
        } else {
          const message = getErrorMessage(error);
          setConnectError(message);
          toast.error(`Failed to connect: ${message}`);
        }
      } finally {
        setIsConnecting(false);
      }
    },
    [bootstrapKey]
  );

  const handleCreateApiKey = useCallback(
    async (name: string, isTest: boolean) => {
      if (!authKey) {
        toast.error('Connect an API key before creating additional keys.');
        return;
      }

      setIsMutating(true);
      try {
        const created = await createApiKeyRequest(authKey, { name, isTestKey: isTest });
        storePlaintextKey(created.keyId, created.apiKey);
        toast.success(`API key "${created.name}" created. Copy it now—it will not be shown again.`);
        setShowCreateModal(false);
        await refreshAll(false);
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          toast.error('Your current API key lost access. Please reconnect.');
          resetSession();
          setShowConnectModal(true);
        } else {
          toast.error(`Failed to create API key: ${getErrorMessage(error)}`);
        }
      } finally {
        setIsMutating(false);
      }
    },
    [authKey, refreshAll, resetSession, storePlaintextKey]
  );

  const handleDeleteApiKey = useCallback(
    async (keyId: string) => {
      if (!authKey) {
        toast.error('Connect an API key before managing keys.');
        return;
      }

      const confirmed = window.confirm(
        'Are you sure you want to revoke this API key? This action cannot be undone.'
      );
      if (!confirmed) {
        return;
      }

      setIsMutating(true);
      try {
        await deleteApiKeyRequest(authKey, keyId);
        removePlaintextKey(keyId);
        toast.success('API key revoked successfully');
        await refreshAll(false);
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          toast.error('Your current API key lost access. Please reconnect.');
          resetSession();
          setShowConnectModal(true);
        } else {
          toast.error(`Failed to delete API key: ${getErrorMessage(error)}`);
        }
      } finally {
        setIsMutating(false);
      }
    },
    [authKey, refreshAll, removePlaintextKey, resetSession]
  );

  const toggleKeyVisibility = useCallback(
    (keyId: string) => {
      if (!fullKeyCache[keyId]) {
        toast.error('Full key not available. Keys are only displayed once when created.');
        return;
      }

      setRevealedKeys(prev => {
        const next = new Set(prev);
        if (next.has(keyId)) {
          next.delete(keyId);
        } else {
          next.add(keyId);
        }
        return next;
      });
    },
    [fullKeyCache]
  );

  const copyKeyToClipboard = useCallback(
    async (keyId: string) => {
      const keyValue = fullKeyCache[keyId];
      if (!keyValue) {
        toast.error('Full key not available. Copy it immediately after creation.');
        return;
      }

      try {
        await navigator.clipboard.writeText(keyValue);
        toast.success('API key copied to clipboard');
      } catch (error) {
        toast.error('Failed to copy API key to clipboard');
      }
    },
    [fullKeyCache]
  );

  const usageHistory = useMemo(() => buildUsageHistory(usageDetails), [usageDetails]);
  const maxHistoryValue = useMemo(
    () => (usageHistory.length ? Math.max(...usageHistory.map(point => point.requests)) : 0),
    [usageHistory]
  );

  const usageCount = usageDetails?.currentMonth.usage ?? 0;
  const usageLimit = usageDetails?.currentMonth.limit ?? 0;
  const usagePercentage = usageDetails ? Math.min(usageDetails.currentMonth.percentage, 100) : 0;
  const remainingRequests = Math.max(usageLimit - usageCount, 0);
  const subscriptionTier = profile?.subscriptionTier ?? usageDetails?.subscription.tier ?? 'free';
  const lastActive = profile?.lastActive ?? usageDetails?.subscription.lastActive ?? null;
  const recommendations = usageDetails?.recommendations ?? [];
  const quickStartKey = authKey ? maskApiKey(authKey) : 'pk_live_your_api_key';
  const lastRefreshedLabel = lastRefreshed
    ? `Last updated ${lastRefreshed.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit'
      })}`
    : 'Not yet refreshed';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <h1 className="text-2xl font-bold text-gradient">Parserator</h1>
              </div>
              <div className="ml-8 hidden md:block">
                <nav className="flex space-x-8">
                  <span className="text-primary-600 border-b-2 border-primary-600 py-2 px-1 text-sm font-medium">
                    Dashboard
                  </span>
                  <a
                    href="https://docs.parserator.com"
                    className="text-gray-500 hover:text-gray-700 py-2 px-1 text-sm font-medium"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Documentation
                  </a>
                  <a
                    href="https://parserator.com/pricing"
                    className="text-gray-500 hover:text-gray-700 py-2 px-1 text-sm font-medium"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Pricing
                  </a>
                </nav>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="text-right">
                <div className="text-xs text-gray-400">API base</div>
                <div className="text-sm text-gray-600 truncate max-w-[180px]">
                  {apiBaseUrl}
                </div>
              </div>
              <div className="hidden sm:block text-right">
                <div className="text-sm text-gray-500">{profile ? 'Signed in as' : 'Not connected'}</div>
                <div className="text-sm font-medium text-gray-900 truncate max-w-[200px]">
                  {profile?.email ?? 'Provide your API key'}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => refreshAll(true)}
                  disabled={!authKey || isBootstrapping || isMutating}
                  className="btn-secondary btn-sm flex items-center"
                >
                  <RefreshCw className={`h-4 w-4 mr-1 ${isMutating ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
                <button
                  onClick={() => {
                    setConnectError(null);
                    setShowConnectModal(true);
                  }}
                  className="btn-primary btn-sm"
                  disabled={isConnecting || isBootstrapping}
                >
                  {authKey ? 'Switch API Key' : 'Connect API Key'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 text-sm text-gray-500 flex items-center space-x-2">
          <ShieldCheck className="h-4 w-4 text-primary-600" />
          <span>{lastRefreshedLabel}</span>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="card">
            <div className="card-body">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <BarChart3 className="h-8 w-8 text-primary-600" />
                </div>
                <div className="ml-4 flex-1">
                  <div className="text-sm font-medium text-gray-500">Monthly Usage</div>
                  <div className="text-2xl font-semibold text-gray-900">
                    {usageCount.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-500">
                    of {usageLimit.toLocaleString()} requests
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">{usagePercentage}% used</span>
                  <span className="text-gray-500">{remainingRequests.toLocaleString()} remaining</span>
                </div>
                <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      usagePercentage > 90 ? 'bg-red-500' :
                      usagePercentage > 75 ? 'bg-yellow-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${usagePercentage}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-body">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Zap className="h-8 w-8 text-yellow-500" />
                </div>
                <div className="ml-4 flex-1">
                  <div className="text-sm font-medium text-gray-500">Subscription</div>
                  <div className="text-2xl font-semibold text-gray-900 capitalize">
                    {subscriptionTier}
                  </div>
                  <div className="text-sm text-gray-500">
                    Last active: {formatRelativeDate(lastActive)}
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <a
                  href="https://parserator.com/pricing"
                  target="_blank"
                  rel="noreferrer"
                  className="btn-secondary btn-sm w-full text-center"
                >
                  Upgrade Plan
                </a>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-body">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Key className="h-8 w-8 text-gray-600" />
                </div>
                <div className="ml-4 flex-1">
                  <div className="text-sm font-medium text-gray-500">API Keys</div>
                  <div className="text-2xl font-semibold text-gray-900">
                    {apiKeyStats.total}
                  </div>
                  <div className="text-sm text-gray-500">
                    {apiKeyStats.active} active
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="btn-primary btn-sm w-full"
                  disabled={!authKey || isMutating || isBootstrapping}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Create Key
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Usage Trends */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="card lg:col-span-2">
            <div className="card-header">
              <h3 className="text-lg font-medium text-gray-900">Usage Trends</h3>
              <p className="text-sm text-gray-500">Daily API requests (estimated)</p>
            </div>
            <div className="card-body">
              {usageHistory.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
                  Connect your API key to view live usage data.
                </div>
              ) : (
                <div className="h-64 flex items-end space-x-2">
                  {usageHistory.map(point => (
                    <div key={point.date} className="flex-1 flex flex-col items-center">
                      <div
                        className="w-full bg-primary-500 rounded-t hover:bg-primary-600 transition-colors"
                        style={{
                          height: maxHistoryValue ? `${(point.requests / maxHistoryValue) * 200}px` : '20px',
                          minHeight: '20px'
                        }}
                        title={`${point.requests.toLocaleString()} requests on ${new Date(point.date).toLocaleDateString()}`}
                      />
                      <div className="text-xs text-gray-500 mt-2">
                        {new Date(point.date).toLocaleDateString(undefined, { weekday: 'short' })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-medium text-gray-900">Recommendations</h3>
              <p className="text-sm text-gray-500">Actionable guidance based on your usage</p>
            </div>
            <div className="card-body space-y-3">
              {recommendations.length === 0 ? (
                <div className="flex items-start space-x-3 text-sm text-gray-500">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span>Your account is all set. Keep building!</span>
                </div>
              ) : (
                recommendations.map((recommendation, index) => (
                  <div key={index} className="flex items-start space-x-3 text-sm text-gray-600">
                    <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5" />
                    <span>{recommendation}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* API Keys Table */}
        <div className="card">
          <div className="card-header">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-medium text-gray-900">API Keys</h3>
                <p className="text-sm text-gray-500">Keys are only shown in full once during creation—store them securely.</p>
              </div>
              <button
                onClick={() => setShowCreateModal(true)}
                className="btn-primary"
                disabled={!authKey || isMutating || isBootstrapping}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create New Key
              </button>
            </div>
          </div>
          <div className="card-body p-0">
            <div className="overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name & Key
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Used
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {apiKeys.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-16 text-center text-sm text-gray-500">
                        {authKey ? 'No API keys found. Create one to get started.' : 'Connect your API key to manage keys.'}
                      </td>
                    </tr>
                  ) : (
                    apiKeys.map(apiKey => {
                      const fullKey = fullKeyCache[apiKey.keyId];
                      const isRevealed = revealedKeys.has(apiKey.keyId);
                      const maskedValue = fullKey
                        ? isRevealed
                          ? fullKey
                          : maskApiKey(fullKey)
                        : apiKey.keyPreview;

                      return (
                        <tr key={apiKey.keyId} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <div>
                              <div className="text-sm font-medium text-gray-900 mb-1">
                                {apiKey.name || 'Untitled key'}
                              </div>
                              <div className="flex items-center space-x-2">
                                <code className={isRevealed ? 'api-key-revealed' : 'api-key-masked'}>
                                  {maskedValue}
                                </code>
                                <button
                                  onClick={() => toggleKeyVisibility(apiKey.keyId)}
                                  className={`text-gray-400 hover:text-gray-600 ${!fullKey ? 'opacity-40 cursor-not-allowed' : ''}`}
                                  disabled={!fullKey}
                                >
                                  {isRevealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                                <button
                                  onClick={() => copyKeyToClipboard(apiKey.keyId)}
                                  className={`text-gray-400 hover:text-gray-600 ${!fullKey ? 'opacity-40 cursor-not-allowed' : ''}`}
                                  disabled={!fullKey}
                                >
                                  <Copy className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`badge ${apiKey.isTestKey ? 'badge-yellow' : 'badge-blue'}`}>
                              {apiKey.isTestKey ? 'Test' : 'Live'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {apiKey.lastUsed ? (
                              <div className="flex items-center">
                                <Clock className="h-4 w-4 mr-1" />
                                {formatRelativeDate(apiKey.lastUsed)}
                              </div>
                            ) : (
                              <span className="text-gray-400">Never</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`badge ${apiKey.isActive ? 'badge-green' : 'badge-red'}`}>
                              {apiKey.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => handleDeleteApiKey(apiKey.keyId)}
                              disabled={isMutating}
                              className="text-red-600 hover:text-red-900 disabled:opacity-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Quick Start Guide */}
        <div className="mt-8 card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">Quick Start</h3>
            <p className="text-sm text-gray-500">Get started with Parserator in minutes</p>
          </div>
          <div className="card-body">
            <div className="space-y-4">
              <div className="flex items-start">
                <div className="flex-shrink-0 w-6 h-6 bg-primary-600 text-white rounded-full flex items-center justify-center text-xs font-medium">
                  1
                </div>
                <div className="ml-3">
                  <h4 className="text-sm font-medium text-gray-900">Install the SDK</h4>
                  <pre className="mt-1 text-xs bg-gray-900 text-gray-100 p-2 rounded">npm install @parserator/sdk</pre>
                </div>
              </div>

              <div className="flex items-start">
                <div className="flex-shrink-0 w-6 h-6 bg-primary-600 text-white rounded-full flex items-center justify-center text-xs font-medium">
                  2
                </div>
                <div className="ml-3">
                  <h4 className="text-sm font-medium text-gray-900">Use your API key</h4>
                  <pre className="mt-1 text-xs bg-gray-900 text-gray-100 p-2 rounded">{`const parser = new Parserator('${quickStartKey}');`}</pre>
                  <p className="text-xs text-gray-500 mt-1">
                    Replace with your live key from this dashboard. Test keys are safe for development.
                  </p>
                </div>
              </div>

              <div className="flex items-start">
                <div className="flex-shrink-0 w-6 h-6 bg-primary-600 text-white rounded-full flex items-center justify-center text-xs font-medium">
                  3
                </div>
                <div className="ml-3">
                  <h4 className="text-sm font-medium text-gray-900">Start parsing</h4>
                  <pre className="mt-1 text-xs bg-gray-900 text-gray-100 p-2 rounded">{`const result = await parser.parse({
  inputData: "messy data...",
  outputSchema: { name: "string", email: "string" }
});`}</pre>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <a href="https://docs.parserator.com" className="btn-primary" target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                View Documentation
              </a>
              <a href="https://docs.parserator.com/reference" className="btn-secondary" target="_blank" rel="noreferrer">
                API Reference
              </a>
            </div>
          </div>
        </div>
      </main>

      {showCreateModal && (
        <CreateApiKeyModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateApiKey}
          isLoading={isMutating}
        />
      )}

      {showConnectModal && (
        <ConnectApiKeyModal
          onClose={() => {
            if (!isConnecting && !isBootstrapping) {
              setShowConnectModal(false);
            }
          }}
          onConnect={handleConnect}
          isLoading={isConnecting || isBootstrapping}
          error={connectError}
          apiBaseUrl={apiBaseUrl}
        />
      )}
    </div>
  );
}

function CreateApiKeyModal({
  onClose,
  onCreate,
  isLoading
}: {
  onClose: () => void;
  onCreate: (name: string, isTest: boolean) => void;
  isLoading: boolean;
}) {
  const [name, setName] = useState('');
  const [isTest, setIsTest] = useState(false);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (name.trim()) {
      onCreate(name.trim(), isTest);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Create API Key</h3>
          </div>

          <div className="px-6 py-4 space-y-4">
            <div>
              <label htmlFor="keyName" className="block text-sm font-medium text-gray-700 mb-2">
                Key Name
              </label>
              <input
                type="text"
                id="keyName"
                value={name}
                onChange={event => setName(event.target.value)}
                placeholder="e.g., Production API, Development Key"
                className="input"
                required
                disabled={isLoading}
              />
            </div>

            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={isTest}
                  onChange={event => setIsTest(event.target.checked)}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  disabled={isLoading}
                />
                <span className="ml-2 text-sm text-gray-700">
                  Test key (for development)
                </span>
              </label>
              <p className="mt-1 text-xs text-gray-500">
                Keys are only shown once. Store them securely in your secret manager immediately.
              </p>
            </div>
          </div>

          <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !name.trim()}
              className="btn-primary"
            >
              {isLoading ? 'Creating…' : 'Create Key'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ConnectApiKeyModal({
  onClose,
  onConnect,
  isLoading,
  error,
  apiBaseUrl
}: {
  onClose: () => void;
  onConnect: (apiKey: string) => void;
  isLoading: boolean;
  error: string | null;
  apiBaseUrl: string;
}) {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onConnect(apiKey);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Connect your Parserator API key</h3>
            <p className="mt-1 text-sm text-gray-500">
              We store your key securely in this browser only to fetch usage, profile, and key data from
              {` ${apiBaseUrl}`}.
            </p>
          </div>

          <div className="px-6 py-4 space-y-4">
            <div>
              <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700 mb-2">
                API Key
              </label>
              <div className="flex">
                <input
                  type={showKey ? 'text' : 'password'}
                  id="apiKey"
                  value={apiKey}
                  onChange={event => setApiKey(event.target.value)}
                  placeholder="pk_live_XXXXXXXXXXXXXXXXXXXXXXXX"
                  className="input flex-1"
                  required
                  disabled={isLoading}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowKey(value => !value)}
                  className="ml-2 text-sm text-primary-600 hover:text-primary-700"
                >
                  {showKey ? 'Hide' : 'Show'}
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Use a live or test key that begins with <code>pk_live_</code> or <code>pk_test_</code>.
              </p>
            </div>

            {error && (
              <div className="flex items-start space-x-3 text-sm text-red-600 bg-red-50 border border-red-100 p-3 rounded">
                <AlertCircle className="h-5 w-5" />
                <span>{error}</span>
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !apiKey.trim()}
              className="btn-primary"
            >
              {isLoading ? 'Connecting…' : 'Connect Key'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
