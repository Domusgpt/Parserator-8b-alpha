'use client';

import { useState, useEffect } from 'react';
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
  TrendingUp
} from 'lucide-react';
import toast from 'react-hot-toast';

// Mock data - in production, this would come from your API
const mockUser = {
  email: 'developer@example.com',
  subscriptionTier: 'pro' as const,
  monthlyUsage: {
    count: 3420,
    limit: 10000,
    resetDate: '2024-02-01'
  }
};

const mockApiKeys = [
  {
    id: 'key_1',
    name: 'Production API',
    key: 'pk_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6',
    created: '2024-01-15',
    lastUsed: '2024-01-28',
    isActive: true,
    isTest: false
  },
  {
    id: 'key_2', 
    name: 'Development API',
    key: 'pk_test_x1y2z3a4b5c6d7e8f9g0h1i2j3k4l5m6',
    created: '2024-01-10',
    lastUsed: '2024-01-27',
    isActive: true,
    isTest: true
  }
];

const mockUsageData = [
  { date: '2024-01-22', requests: 145 },
  { date: '2024-01-23', requests: 203 },
  { date: '2024-01-24', requests: 178 },
  { date: '2024-01-25', requests: 267 },
  { date: '2024-01-26', requests: 198 },
  { date: '2024-01-27', requests: 324 },
  { date: '2024-01-28', requests: 289 }
];

interface ApiKey {
  id: string;
  name: string;
  key: string;
  created: string;
  lastUsed: string;
  isActive: boolean;
  isTest: boolean;
}

export default function DashboardPage() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>(mockApiKeys);
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const usagePercentage = Math.round((mockUser.monthlyUsage.count / mockUser.monthlyUsage.limit) * 100);
  const remainingRequests = mockUser.monthlyUsage.limit - mockUser.monthlyUsage.count;

  const toggleKeyVisibility = (keyId: string) => {
    const newRevealed = new Set(revealedKeys);
    if (newRevealed.has(keyId)) {
      newRevealed.delete(keyId);
    } else {
      newRevealed.add(keyId);
    }
    setRevealedKeys(newRevealed);
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('API key copied to clipboard');
    } catch (error) {
      toast.error('Failed to copy to clipboard');
    }
  };

  const deleteApiKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to delete this API key? This action cannot be undone.')) {
      return;
    }

    setIsLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      setApiKeys(keys => keys.filter(key => key.id !== keyId));
      toast.success('API key deleted successfully');
    } catch (error) {
      toast.error('Failed to delete API key');
    } finally {
      setIsLoading(false);
    }
  };

  const createApiKey = async (name: string, isTest: boolean) => {
    setIsLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const newKey: ApiKey = {
        id: `key_${Date.now()}`,
        name,
        key: `pk_${isTest ? 'test' : 'live'}_${Math.random().toString(36).substring(2, 34)}`,
        created: new Date().toISOString().split('T')[0],
        lastUsed: 'Never',
        isActive: true,
        isTest
      };
      
      setApiKeys(keys => [newKey, ...keys]);
      setShowCreateModal(false);
      toast.success('API key created successfully');
    } catch (error) {
      toast.error('Failed to create API key');
    } finally {
      setIsLoading(false);
    }
  };

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
              <div className="ml-8">
                <nav className="flex space-x-8">
                  <a href="#" className="text-primary-600 border-b-2 border-primary-600 py-2 px-1 text-sm font-medium">
                    Dashboard
                  </a>
                  <a href="#" className="text-gray-500 hover:text-gray-700 py-2 px-1 text-sm font-medium">
                    Documentation
                  </a>
                  <a href="#" className="text-gray-500 hover:text-gray-700 py-2 px-1 text-sm font-medium">
                    Pricing
                  </a>
                </nav>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <div className="text-sm text-gray-500">Signed in as</div>
                <div className="text-sm font-medium text-gray-900">{mockUser.email}</div>
              </div>
              <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-medium">
                  {mockUser.email.charAt(0).toUpperCase()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Usage Card */}
          <div className="card">
            <div className="card-body">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <BarChart3 className="h-8 w-8 text-primary-600" />
                </div>
                <div className="ml-4 flex-1">
                  <div className="text-sm font-medium text-gray-500">Monthly Usage</div>
                  <div className="text-2xl font-semibold text-gray-900">
                    {mockUser.monthlyUsage.count.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-500">
                    of {mockUser.monthlyUsage.limit.toLocaleString()} requests
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

          {/* Subscription Card */}
          <div className="card">
            <div className="card-body">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Zap className="h-8 w-8 text-yellow-500" />
                </div>
                <div className="ml-4 flex-1">
                  <div className="text-sm font-medium text-gray-500">Subscription</div>
                  <div className="text-2xl font-semibold text-gray-900 capitalize">
                    {mockUser.subscriptionTier}
                  </div>
                  <div className="text-sm text-gray-500">
                    Resets {mockUser.monthlyUsage.resetDate}
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <button className="btn-secondary btn-sm w-full">
                  Upgrade Plan
                </button>
              </div>
            </div>
          </div>

          {/* API Keys Card */}
          <div className="card">
            <div className="card-body">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Key className="h-8 w-8 text-gray-600" />
                </div>
                <div className="ml-4 flex-1">
                  <div className="text-sm font-medium text-gray-500">API Keys</div>
                  <div className="text-2xl font-semibold text-gray-900">
                    {apiKeys.length}
                  </div>
                  <div className="text-sm text-gray-500">
                    {apiKeys.filter(k => k.isActive).length} active
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <button 
                  onClick={() => setShowCreateModal(true)}
                  className="btn-primary btn-sm w-full"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Create Key
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Usage Chart */}
        <div className="card mb-8">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">Usage Trends</h3>
            <p className="text-sm text-gray-500">Daily API requests over the past week</p>
          </div>
          <div className="card-body">
            <div className="h-64 flex items-end space-x-2">
              {mockUsageData.map((day, index) => (
                <div key={day.date} className="flex-1 flex flex-col items-center">
                  <div 
                    className="w-full bg-primary-500 rounded-t hover:bg-primary-600 transition-colors cursor-pointer"
                    style={{ 
                      height: `${(day.requests / Math.max(...mockUsageData.map(d => d.requests))) * 200}px`,
                      minHeight: '20px'
                    }}
                    title={`${day.requests} requests on ${day.date}`}
                  />
                  <div className="text-xs text-gray-500 mt-2">
                    {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* API Keys Section */}
        <div className="card">
          <div className="card-header">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-medium text-gray-900">API Keys</h3>
                <p className="text-sm text-gray-500">Manage your API keys for accessing Parserator</p>
              </div>
              <button 
                onClick={() => setShowCreateModal(true)}
                className="btn-primary"
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
                  {apiKeys.map((apiKey) => (
                    <tr key={apiKey.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div>
                          <div className="text-sm font-medium text-gray-900 mb-1">
                            {apiKey.name}
                          </div>
                          <div className="flex items-center space-x-2">
                            <code className={revealedKeys.has(apiKey.id) ? 'api-key-revealed' : 'api-key-masked'}>
                              {revealedKeys.has(apiKey.id) ? apiKey.key : `${apiKey.key.substring(0, 12)}...${apiKey.key.substring(apiKey.key.length - 4)}`}
                            </code>
                            <button
                              onClick={() => toggleKeyVisibility(apiKey.id)}
                              className="text-gray-400 hover:text-gray-600"
                            >
                              {revealedKeys.has(apiKey.id) ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                            <button
                              onClick={() => copyToClipboard(apiKey.key)}
                              className="text-gray-400 hover:text-gray-600"
                            >
                              <Copy className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`badge ${apiKey.isTest ? 'badge-yellow' : 'badge-blue'}`}>
                          {apiKey.isTest ? 'Test' : 'Live'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {apiKey.lastUsed === 'Never' ? (
                          <span className="text-gray-400">Never</span>
                        ) : (
                          <div className="flex items-center">
                            <Clock className="h-4 w-4 mr-1" />
                            {apiKey.lastUsed}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`badge ${apiKey.isActive ? 'badge-green' : 'badge-red'}`}>
                          {apiKey.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => deleteApiKey(apiKey.id)}
                          disabled={isLoading}
                          className="text-red-600 hover:text-red-900 disabled:opacity-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
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
                  <pre className="mt-1 text-xs bg-gray-900 text-gray-100 p-2 rounded">{`const parser = new Parserator('${apiKeys[0]?.key.substring(0, 20)}...');`}</pre>
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
            
            <div className="mt-6 flex space-x-3">
              <a href="#" className="btn-primary">
                <ExternalLink className="h-4 w-4 mr-2" />
                View Documentation
              </a>
              <a href="#" className="btn-secondary">
                API Reference
              </a>
            </div>
          </div>
        </div>
      </main>

      {/* Create API Key Modal */}
      {showCreateModal && (
        <CreateApiKeyModal
          onClose={() => setShowCreateModal(false)}
          onCreate={createApiKey}
          isLoading={isLoading}
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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
                onChange={(e) => setName(e.target.value)}
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
                  onChange={(e) => setIsTest(e.target.checked)}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  disabled={isLoading}
                />
                <span className="ml-2 text-sm text-gray-700">
                  Test key (for development)
                </span>
              </label>
              <p className="mt-1 text-xs text-gray-500">
                Test keys have the same functionality but are clearly marked for development use.
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
              {isLoading ? 'Creating...' : 'Create Key'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}