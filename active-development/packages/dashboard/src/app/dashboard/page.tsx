'use client';

import Image from 'next/image';
import Link from 'next/link';
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
  TrendingUp,
  Sparkles,
  ShieldCheck,
  PlayCircle
} from 'lucide-react';
import toast from 'react-hot-toast';

const heroHighlights = [
  {
    title: 'Two-stage architect → extractor core',
    description: 'Plans first, executes second so you ship 95%+ accuracy without runaway spend.',
    icon: Sparkles
  },
  {
    title: 'Enterprise-ready guardrails',
    description: 'Deterministic fallbacks, audit trails, and live support at Chairman@parserator.com.',
    icon: ShieldCheck
  },
  {
    title: 'Instant operational wins',
    description: 'JSON, CSV, and CRM exports wired into workflows with 70% token savings out of the box.',
    icon: Zap
  }
] as const;

const heroMetrics = [
  { label: 'Accuracy', value: '95%+', hint: 'Production-validated parses' },
  { label: 'Token savings', value: '70%', hint: 'vs. single-shot LLM calls' },
  { label: 'Median latency', value: '2.2s', hint: 'Across live customer traffic' }
] as const;

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
  const demoVideoUrl =
    process.env.NEXT_PUBLIC_DEMO_VIDEO_URL ??
    'https://storage.googleapis.com/parserator-static-assets/demo/parserator-quick-tour.mp4';

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
      <div className="relative overflow-hidden bg-brand-gradient pb-24 text-white">
        <div className="absolute inset-0 opacity-40" style={{ backgroundImage: 'radial-gradient(circle at top left, rgba(255,255,255,0.45), transparent 55%)' }} />
        <div className="relative border-b border-white/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-center justify-between gap-6 py-6">
              <div className="flex items-center gap-3">
                <Image src="/brand/parserator-logo.svg" alt="Parserator" width={40} height={40} className="h-10 w-10" priority />
                <div>
                  <p className="text-sm font-semibold uppercase tracking-widest text-white/70">Architect → Extractor</p>
                  <h1 className="text-2xl font-bold leading-tight">Parserator Launch Control</h1>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="hidden md:flex flex-col text-right text-sm text-white/80">
                  <span className="font-medium text-white">{mockUser.email}</span>
                  <span className="text-white/60">Production access</span>
                </div>
                <div className="h-10 w-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center font-semibold">
                  {mockUser.email.charAt(0).toUpperCase()}
                </div>
              </div>
            </div>
          </div>
        </div>

        <section className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center">
            <div className="space-y-8">
              <div className="brand-badge">
                <PlayCircle className="h-4 w-4" />
                Ready for the marketing spotlight
              </div>
              <div>
                <h2 className="text-4xl font-bold sm:text-5xl leading-tight">
                  Bring the Parserator revolution to every customer touchpoint.
                </h2>
                <p className="mt-6 max-w-xl text-lg text-white/80">
                  Launch with unified branding, a two-minute product tour, and messaging that keeps the EMA mystique intact while telling the Architect → Extractor story.
                </p>
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                {heroHighlights.map(({ title, description, icon: Icon }) => (
                  <div key={title} className="rounded-2xl border border-white/20 bg-white/5 p-4 backdrop-blur-lg">
                    <div className="flex items-start gap-3">
                      <span className="mt-1 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/15">
                        <Icon className="h-4 w-4" />
                      </span>
                      <div>
                        <h3 className="text-base font-semibold text-white">{title}</h3>
                        <p className="mt-2 text-sm text-white/70">{description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <Link href="#api-keys" className="btn-primary">Generate API key</Link>
                <a
                  href={demoVideoUrl}
                  className="btn-secondary text-white hover:text-white"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Watch the 2-min demo
                </a>
              </div>
            </div>

            <div className="relative">
              <div className="rounded-3xl border border-white/15 bg-white/10 p-4 backdrop-blur-xl shadow-2xl">
                <div className="aspect-video w-full overflow-hidden rounded-2xl border border-white/20 bg-black/50 shadow-xl">
                  <video
                    key={demoVideoUrl}
                    controls
                    className="h-full w-full object-cover"
                    preload="metadata"
                  >
                    <source src={demoVideoUrl} type="video/mp4" />
                    Your browser does not support the Parserator launch video.
                  </video>
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                  {heroMetrics.map(metric => (
                    <div key={metric.label} className="brand-metric-card">
                      <div className="text-xs uppercase text-white/70">{metric.label}</div>
                      <div className="mt-1 text-2xl font-semibold">{metric.value}</div>
                      <div className="mt-1 text-xs text-white/70">{metric.hint}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Main Content */}
      <main className="relative z-10 -mt-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-white/80 bg-white p-4 shadow-[0_20px_45px_-25px_rgba(79,70,229,0.4)]">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Messaging check</p>
            <p className="mt-2 text-lg font-semibold text-brand-primary">EMA narrative aligned</p>
            <p className="mt-3 text-sm text-gray-500">
              Marketing copy references Architect → Extractor benefits without leaking PPP/MVEP details.
            </p>
          </div>
          <div className="rounded-2xl border border-white/80 bg-white p-4 shadow-[0_20px_45px_-25px_rgba(79,70,229,0.4)]">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Chrome extension</p>
            <p className="mt-2 text-lg font-semibold text-brand-primary">Assets refreshed</p>
            <p className="mt-3 text-sm text-gray-500">
              Icons, promo tiles, and support links now match the new purple + gold identity for the Web Store listing.
            </p>
          </div>
          <div className="rounded-2xl border border-white/80 bg-white p-4 shadow-[0_20px_45px_-25px_rgba(79,70,229,0.4)]">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Demo touchpoints</p>
            <p className="mt-2 text-lg font-semibold text-brand-primary">Video embedded</p>
            <p className="mt-3 text-sm text-gray-500">
              Dashboard, marketing docs, and extension highlight the same two-minute walkthrough.
            </p>
          </div>
          <div className="rounded-2xl border border-white/80 bg-white p-4 shadow-[0_20px_45px_-25px_rgba(79,70,229,0.4)]">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Support readiness</p>
            <p className="mt-2 text-lg font-semibold text-brand-primary">Chairman@parserator.com</p>
            <p className="mt-3 text-sm text-gray-500">
              Centralized mailer routes live responses and marketing CTA footers share the new address.
            </p>
          </div>
        </div>

        <section className="mt-12 grid grid-cols-1 gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-8" id="api-keys">
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
          </div>

          <aside className="space-y-6">
            <div className="card bg-white/95">
              <div className="card-header">
                <h3 className="text-lg font-medium text-gray-900">Launch timeline</h3>
                <p className="text-sm text-gray-500">Phase 4 marketing sequence</p>
              </div>
              <div className="card-body space-y-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="mt-1 h-5 w-5 text-green-500" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Day 0 – Brand sync</p>
                    <p className="text-sm text-gray-500">Dashboard, Chrome extension, and collateral now ship the purple + gold Parserator identity.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Clock className="mt-1 h-5 w-5 text-primary-600" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Day 1 – Demo amplification</p>
                    <p className="text-sm text-gray-500">Share the two-minute walkthrough, push the Chrome Web Store submission, and point support CTAs to Chairman@parserator.com.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <TrendingUp className="mt-1 h-5 w-5 text-brand-primary" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Day 2–7 – Momentum</p>
                    <p className="text-sm text-gray-500">Roll out blog posts, community drops, and partner outreach while tracking engagement inside the marketing checklist.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="card bg-white/95">
              <div className="card-header">
                <h3 className="text-lg font-medium text-gray-900">Messaging guardrails</h3>
                <p className="text-sm text-gray-500">Keep EMA + PPP promises intact</p>
              </div>
              <div className="card-body space-y-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="mt-1 h-5 w-5 text-brand-primary" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Lead with outcomes</p>
                    <p className="text-sm text-gray-500">Highlight 95% accuracy, 70% savings, and real usage metrics—skip internal implementation specifics.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Sparkles className="mt-1 h-5 w-5 text-brand-primary" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Maintain mystique</p>
                    <p className="text-sm text-gray-500">Reference PPP/MVEP vision, audio demos, and the EMA charter without revealing restricted code paths.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-1 h-5 w-5 text-primary-600" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Route support centrally</p>
                    <p className="text-sm text-gray-500">Chairman@parserator.com is the canonical contact for launch communications and customer escalations.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="card bg-white/95">
              <div className="card-header">
                <h3 className="text-lg font-medium text-gray-900">Brand kit quick links</h3>
              </div>
              <div className="card-body space-y-3 text-sm text-gray-600">
                <a
                  href="https://parserator.com/brand"
                  className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3 hover:border-primary-500 hover:text-primary-600 transition-colors"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span>Logo & icon exports</span>
                  <ExternalLink className="h-4 w-4" />
                </a>
                <a
                  href={demoVideoUrl}
                  className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3 hover:border-primary-500 hover:text-primary-600 transition-colors"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span>Two-minute demo reel</span>
                  <ExternalLink className="h-4 w-4" />
                </a>
                <a
                  href="mailto:Chairman@parserator.com"
                  className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3 hover:border-primary-500 hover:text-primary-600 transition-colors"
                >
                  <span>Support & launch approvals</span>
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            </div>
          </aside>
        </section>
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