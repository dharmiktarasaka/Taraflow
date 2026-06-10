import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BarChart3, TrendingUp, Sparkles, UserCheck, Eye, 
  Sparkle, RefreshCw, AlertCircle, Database, HelpCircle,
  Share2, MessageSquare, Heart, Bookmark, MousePointer, Play
} from 'lucide-react';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, 
  CartesianGrid, Tooltip 
} from 'recharts';
import analyticsService from '../services/analyticsService';

const PLATFORMS = [
  { id: 'all', name: 'All Platforms' },
  { id: 'linkedin', name: 'LinkedIn' },
  { id: 'instagram', name: 'Instagram' },
  { id: 'facebook', name: 'Facebook' },
  { id: 'threads', name: 'Threads' }
];

const METRICS = [
  { id: 'impressions', name: 'Impressions', icon: Eye, color: 'text-indigo-400', strokeColor: '#6366f1', gradientColor: '#6366f1' },
  { id: 'reach', name: 'Reach', icon: Share2, color: 'text-sky-400', strokeColor: '#0ea5e9', gradientColor: '#0ea5e9' },
  { id: 'followers', name: 'Followers', icon: UserCheck, color: 'text-violet-400', strokeColor: '#8b5cf6', gradientColor: '#8b5cf6' },
  { id: 'engagementRate', name: 'Engagement Rate', icon: TrendingUp, color: 'text-emerald-400', strokeColor: '#10b981', gradientColor: '#10b981' },
  { id: 'clicks', name: 'Link Clicks', icon: MousePointer, color: 'text-amber-400', strokeColor: '#f59e0b', gradientColor: '#f59e0b' },
  { id: 'saves', name: 'Saves', icon: Bookmark, color: 'text-rose-400', strokeColor: '#f43f5e', gradientColor: '#f43f5e' },
  { id: 'videoViews', name: 'Video Views', icon: Play, color: 'text-fuchsia-400', strokeColor: '#d946ef', gradientColor: '#d946ef' }
];

const Analytics = () => {
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState('');
  
  // Dashboard data state
  const [hasData, setHasData] = useState(false);
  const [summary, setSummary] = useState({});
  const [timeline, setTimeline] = useState([]);
  const [topPosts, setTopPosts] = useState([]);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [lastSyncTime, setLastSyncTime] = useState(new Date().toLocaleTimeString());

  // Filters state
  const [activePlatform, setActivePlatform] = useState('all');
  const [activeMetric, setActiveMetric] = useState(METRICS[0]); // Default Impressions
  const [activeDays, setActiveDays] = useState(30);

  useEffect(() => {
    fetchAnalyticsData();
  }, [activePlatform, activeDays]);

  const fetchAnalyticsData = async () => {
    setLoading(true);
    setError('');
    try {
      // 1. Fetch overview summary & timeline
      const overviewRes = await analyticsService.getOverview({
        platform: activePlatform,
        days: activeDays
      });
      
      if (overviewRes && overviewRes.success) {
        setHasData(overviewRes.hasData);
        setSummary(overviewRes.summary || {});
        setTimeline(overviewRes.timeline || []);
      }

      // 2. Fetch top posts
      const postsRes = await analyticsService.getTopPosts({
        limit: 5,
        sortBy: 'engagementRate',
        platform: activePlatform
      });
      if (postsRes && postsRes.success) {
        setTopPosts(postsRes.posts || []);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to fetch analytics metrics. Please ensure server is running.');
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  };

  const formatMetric = (value) => (
    value === null || value === undefined ? 'N/A' : value.toLocaleString()
  );

  const formatPercent = (value) => (
    value === null || value === undefined ? 'N/A' : `${value}%`
  );

  // Sync metrics helper
  const handleSyncMetrics = async () => {
    setSeeding(true);
    showToast('Synchronizing account metrics and snapshots...', 'info');
    try {
      const response = await analyticsService.seedMetrics();
      if (response && response.success) {
        showToast('Social media analytics synchronized successfully!');
        setLastSyncTime(new Date().toLocaleTimeString());
        await fetchAnalyticsData();
      }
    } catch (err) {
      console.error(err);
      showToast('Synchronization request failed.', 'error');
    } finally {
      setSeeding(false);
    }
  };

  // Custom visual glassmorphic tooltip for Recharts graph plotting
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const value = payload[0].value;
      const metricLabel = activeMetric.name;
      const formattedValue = value === null || value === undefined
        ? 'N/A'
        : activeMetric.id === 'engagementRate' 
          ? `${value}%` 
          : value.toLocaleString();

      return (
        <div className="bg-zinc-950/90 border border-zinc-800 backdrop-blur-md p-3.5 rounded-xl shadow-xl text-left">
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Date: {label}</p>
          <p className="text-sm font-extrabold text-white">
            {metricLabel}: <span style={{ color: activeMetric.strokeColor }}>{formattedValue}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 py-4 relative"
    >
      {/* Floating Status Toast */}
      <AnimatePresence>
        {toast.show && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className={`fixed top-4 right-4 z-50 flex items-center space-x-2.5 px-4.5 py-3 rounded-xl border shadow-xl backdrop-blur-xl ${
              toast.type === 'error' 
                ? 'bg-red-500/10 border-red-500/20 text-red-400' 
                : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
            }`}
          >
            <span className="text-sm font-semibold">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Analytics Page Title & Platform Filters toolbar */}
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-6 border-b border-zinc-800/40 pb-6">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-700 dark:from-white dark:via-zinc-100 dark:to-zinc-400 bg-clip-text text-transparent flex items-center space-x-3.5">
            <BarChart3 className="h-8 w-8 text-indigo-400 animate-pulse" />
            <span>Performance Analytics</span>
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1.5">
            Detailed metrics showing audience reach, content interactions, and brand statistics.
          </p>
        </div>

        {/* Filters control bar */}
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {/* Last Sync Indicator & Manual Sync Button */}
          <div className="flex items-center space-x-2 bg-zinc-950/80 border border-zinc-800/80 rounded-2xl p-2 px-3.5">
            <span className="text-[10px] text-zinc-550 dark:text-zinc-500 font-bold uppercase tracking-wider">
              Last Sync: {lastSyncTime}
            </span>
            <button
              onClick={handleSyncMetrics}
              disabled={seeding}
              className="p-1 rounded-lg text-zinc-400 hover:text-indigo-400 hover:bg-zinc-800 transition-colors disabled:opacity-40 cursor-pointer"
              title="Sync metrics in real time"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${seeding ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Days Filter */}
          <select
            value={activeDays}
            onChange={(e) => setActiveDays(parseInt(e.target.value, 10))}
            className="rounded-xl border border-zinc-800 bg-zinc-950 py-2.5 px-3.5 text-xs font-semibold text-zinc-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value={7}>Last 7 Days</option>
            <option value={30}>Last 30 Days</option>
            <option value={90}>Last 90 Days</option>
          </select>

          {/* Platform Tab Buttons */}
          <div className="flex items-center space-x-1 bg-zinc-950/80 border border-zinc-800/80 rounded-2xl p-1.5">
            {PLATFORMS.map((p) => (
              <button
                key={p.id}
                onClick={() => setActivePlatform(p.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activePlatform === p.id 
                    ? 'bg-indigo-600/10 border border-indigo-500/30 text-indigo-400' 
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-xl text-sm flex items-center space-x-2 text-left">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading overview layout state */}
      {loading && timeline.length === 0 ? (
        <div className="min-h-[400px] flex items-center justify-center">
          <div className="flex flex-col items-center space-y-4 text-center">
            <RefreshCw className="h-8 w-8 text-indigo-500 animate-spin" />
            <p className="text-zinc-500 dark:text-zinc-400 text-sm font-medium">Fetching brand metrics statistics...</p>
          </div>
        </div>
      ) : !hasData ? (
        /* Empty Seed Demo state */
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-zinc-900/40 border border-zinc-800/80 rounded-3xl p-10 text-center max-w-xl mx-auto space-y-6 shadow-xl relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-grid-pattern opacity-[0.02]" />
          <div className="h-16 w-16 bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 rounded-2xl flex items-center justify-center mx-auto shadow-inner animate-pulse">
            <Database className="h-8 w-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-zinc-100">No Performance Data Found</h2>
            <p className="text-sm text-zinc-400 leading-relaxed max-w-sm mx-auto">
              We couldn't locate any historical analytics snapshots for this profile. Click below to populate high-fidelity mock charts data!
            </p>
          </div>
          <button
            onClick={handleSyncMetrics}
            disabled={seeding}
            className="flex items-center space-x-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold text-white rounded-xl shadow-lg shadow-indigo-500/25 transition-all mx-auto cursor-pointer"
          >
            {seeding ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Syncing Analytics...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4.5 w-4.5" />
                <span>Sync Social Analytics</span>
              </>
            )}
          </button>
        </motion.div>
      ) : (
        /* KPI Metrics Cards and Interactive Recharts plot */
        <div className="space-y-8">
          
          {/* Stats KPI Cards Grid */}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 text-left">
            {[
              { 
                name: 'Total Impressions', 
                value: summary.impressions === null || summary.impressions === undefined ? 'N/A' : summary.impressions.toLocaleString(), 
                change: summary.changeImpressions || '+0%', 
                icon: Eye, 
                color: 'text-indigo-400',
                isGrowth: parseFloat(summary.changeImpressions || '0') >= 0 
              },
              { 
                name: 'Total Reach', 
                value: summary.reach === null || summary.reach === undefined ? 'N/A' : summary.reach.toLocaleString(), 
                change: summary.changeReach || '+0%', 
                icon: Share2, 
                color: 'text-sky-400',
                isGrowth: parseFloat(summary.changeReach || '0') >= 0 
              },
              { 
                name: 'Followers Growth', 
                value: summary.followers === null || summary.followers === undefined ? 'N/A' : summary.followers.toLocaleString(), 
                change: summary.changeFollowers || '+0%', 
                icon: UserCheck, 
                color: 'text-violet-400',
                isGrowth: parseFloat(summary.changeFollowers || '0') >= 0 
              },
              { 
                name: 'Average Engagement', 
                value: summary.engagementRate === null || summary.engagementRate === undefined ? 'N/A' : `${summary.engagementRate}%`, 
                change: summary.changeEngagement || '+0%', 
                icon: TrendingUp, 
                color: 'text-emerald-400',
                isGrowth: parseFloat(summary.changeEngagement || '0') >= 0 
              },
              { 
                name: 'Link Clicks', 
                value: summary.clicks === null || summary.clicks === undefined ? 'N/A' : summary.clicks.toLocaleString(), 
                change: '+0.0%', 
                icon: MousePointer, 
                color: 'text-amber-400',
                isGrowth: true 
              },
              { 
                name: 'Saves', 
                value: summary.saves === null || summary.saves === undefined ? 'N/A' : summary.saves.toLocaleString(), 
                change: '+0.0%', 
                icon: Bookmark, 
                color: 'text-rose-400',
                isGrowth: true 
              },
              { 
                name: 'Video Views', 
                value: summary.videoViews === null || summary.videoViews === undefined ? 'N/A' : summary.videoViews.toLocaleString(), 
                change: '+0.0%', 
                icon: Play, 
                color: 'text-fuchsia-400',
                isGrowth: true 
              }
            ].map((s, idx) => (
              <div key={idx} className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-5 relative overflow-hidden backdrop-blur-sm shadow-md">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-550 dark:text-zinc-500 font-bold uppercase tracking-wider">{s.name}</span>
                  <s.icon className={`h-4.5 w-4.5 ${s.color}`} />
                </div>
                <div className="mt-4 flex items-baseline justify-between">
                  <span className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">{s.value}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                    s.isGrowth 
                      ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' 
                      : 'text-rose-400 bg-rose-500/10 border-rose-500/20'
                  }`}>
                    {s.change}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Interactive Recharts Graph Plot */}
          <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-3xl p-6 space-y-6 backdrop-blur-sm shadow-md">
            
            {/* Graph header toolbar */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-left">
              <div>
                <h3 className="font-bold text-zinc-900 dark:text-white text-base">Audience Metrics Trend</h3>
                <p className="text-xs text-zinc-500 mt-0.5">Performance tracking timeline for the past {activeDays} days</p>
              </div>

              {/* Chart Metric Select buttons */}
              <div className="flex flex-wrap items-center gap-2 bg-zinc-950 p-1 border border-zinc-850 rounded-2xl">
                {METRICS.map((metric) => {
                  const Icon = metric.icon;
                  const isActive = activeMetric.id === metric.id;
                  return (
                    <button
                      key={metric.id}
                      onClick={() => setActiveMetric(metric)}
                      className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                        isActive 
                          ? 'bg-zinc-850 text-white' 
                          : 'text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span>{metric.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Recharts AreaChart Block */}
            <div className="h-72 w-full bg-zinc-950/40 rounded-2xl border border-zinc-850 p-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={timeline}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="metricGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={activeMetric.gradientColor} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={activeMetric.gradientColor} stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  
                  <CartesianGrid 
                    strokeDasharray="3 3" 
                    vertical={false} 
                    stroke="rgba(255,255,255,0.03)"
                  />
                  
                  <XAxis 
                    dataKey="date" 
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: '#71717a', fontSize: 10, fontWeight: 'bold' }}
                    dy={10}
                  />
                  
                  <YAxis 
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: '#71717a', fontSize: 10, fontWeight: 'bold' }}
                    dx={-5}
                  />
                  
                  <Tooltip content={<CustomTooltip />} />
                  
                  <Area
                    type="monotone"
                    dataKey={activeMetric.id}
                    name={activeMetric.name}
                    stroke={activeMetric.strokeColor}
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#metricGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top Performing Content table list */}
          {topPosts.length > 0 && (
            <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-3xl p-6 space-y-4 backdrop-blur-sm shadow-md text-left">
              <h3 className="font-bold text-zinc-900 dark:text-white text-base flex items-center space-x-2">
                <Sparkle className="h-4.5 w-4.5 text-indigo-400" />
                <span>Top Performing Content</span>
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-800 text-xs text-zinc-550 dark:text-zinc-500 uppercase tracking-wider font-bold">
                      <th className="pb-3 pl-2">Published Post</th>
                      <th className="pb-3">Platform</th>
                      <th className="pb-3 text-center"><Heart className="h-3.5 w-3.5 inline mr-1" /> Likes</th>
                      <th className="pb-3 text-center"><MessageSquare className="h-3.5 w-3.5 inline mr-1" /> Comments</th>
                      <th className="pb-3 text-center"><Share2 className="h-3.5 w-3.5 inline mr-1" /> Shares</th>
                      <th className="pb-3 text-center">Engagement</th>
                      <th className="pb-3 text-right pr-2">Reach</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-850 text-sm text-zinc-300">
                    {topPosts.map((p) => (
                      <tr key={p.id} className="hover:bg-zinc-900/10 transition-all font-medium">
                        <td className="py-4 font-semibold text-zinc-900 dark:text-white max-w-sm truncate pl-2" title={p.content}>
                          {p.content}
                        </td>
                        <td className="py-4 capitalize font-bold text-zinc-500 dark:text-zinc-400">{p.platform}</td>
                        <td className="py-4 text-center text-zinc-400 font-bold">{formatMetric(p.likes)}</td>
                        <td className="py-4 text-center text-zinc-400 font-bold">{formatMetric(p.comments)}</td>
                        <td className="py-4 text-center text-zinc-400 font-bold">{formatMetric(p.shares)}</td>
                        <td className="py-4 text-center text-indigo-455 dark:text-indigo-400 font-bold">
                          {formatPercent(p.engagementRate)}
                        </td>
                        <td className="py-4 text-right font-bold text-zinc-900 dark:text-white pr-2">
                          {formatMetric(p.reach)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Seed helper option at the bottom */}
          <div className="flex justify-end pr-2">
            <button
              onClick={handleSyncMetrics}
              disabled={seeding}
              className="flex items-center space-x-1.5 px-3.5 py-2 border border-zinc-800 hover:border-zinc-700 bg-zinc-950 text-zinc-455 hover:text-zinc-300 rounded-xl text-xs font-semibold transition-all cursor-pointer disabled:opacity-40"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${seeding ? 'animate-spin' : ''}`} />
              <span>Sync All Social Data</span>
            </button>
          </div>

        </div>
      )}
    </motion.div>
  );
};

export default Analytics;
