import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BarChart3, TrendingUp, Sparkles, UserCheck, Eye, 
  Sparkle, RefreshCw, AlertCircle, Database, HelpCircle,
  Share2, MessageSquare, Heart, Bookmark, MousePointer, Play,
  Link as LinkIcon, AlertTriangle
} from 'lucide-react';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, 
  CartesianGrid, Tooltip 
} from 'recharts';
import analyticsService from '../services/analyticsService';
import AISuggestions from '../components/AISuggestions';
import PostAnalysisModal from '../components/PostAnalysisModal';
import { useData } from '../context/DataContext';

const PLATFORMS = [
  { id: 'all', name: 'All Platforms', color: '#a1a1aa' },
  { id: 'instagram', name: 'Instagram', color: '#e1306c' },
  { id: 'facebook', name: 'Facebook', color: '#1877f2' },
  { id: 'threads', name: 'Threads', color: '#000000' }
];

const PLATFORM_META = {
  linkedin:  { label: 'LinkedIn',  color: '#0077b5', bg: 'bg-blue-500/10',   text: 'text-blue-400',   dot: '#0077b5' },
  instagram: { label: 'Instagram', color: '#e1306c', bg: 'bg-pink-500/10',   text: 'text-pink-400',   dot: '#e1306c' },
  facebook:  { label: 'Facebook',  color: '#1877f2', bg: 'bg-blue-600/10',   text: 'text-blue-300',   dot: '#1877f2' },
  threads:   { label: 'Threads',   color: '#a1a1aa', bg: 'bg-zinc-700/30',   text: 'text-zinc-300',   dot: '#a1a1aa' },
};

const METRICS = [
  { id: 'impressions', name: 'Impressions', icon: Eye, color: 'text-indigo-400', strokeColor: '#6366f1', gradientColor: '#6366f1' },
  { id: 'reach', name: 'Reach', icon: Share2, color: 'text-sky-400', strokeColor: '#0ea5e9', gradientColor: '#0ea5e9' },
  { id: 'followers', name: 'Followers', icon: UserCheck, color: 'text-violet-400', strokeColor: '#8b5cf6', gradientColor: '#8b5cf6' },
  { id: 'engagementRate', name: 'Engagement Rate', icon: TrendingUp, color: 'text-emerald-400', strokeColor: '#10b981', gradientColor: '#10b981' },
  { id: 'clicks', name: 'Link Clicks', icon: MousePointer, color: 'text-amber-400', strokeColor: '#f59e0b', gradientColor: '#f59e0b' },
  { id: 'saves', name: 'Saves', icon: Bookmark, color: 'text-rose-400', strokeColor: '#f43f5e', gradientColor: '#f43f5e' },
  { id: 'videoViews', name: 'Video Views', icon: Play, color: 'text-fuchsia-400', strokeColor: '#d946ef', gradientColor: '#d946ef' }
];

// ─── Premium Skeletons ───────────────────────────────────────────────────────
const KPICardsSkeleton = () => (
  <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 text-left">
    {Array.from({ length: 7 }).map((_, idx) => (
      <div 
        key={idx} 
        className="bg-zinc-100/50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-5 relative overflow-hidden backdrop-blur-sm shadow-md animate-pulse"
      >
        <div className="flex items-center justify-between">
          <div className="h-3.5 bg-zinc-200 dark:bg-zinc-800 rounded-md w-24" />
          <div className="h-4.5 w-4.5 bg-zinc-200 dark:bg-zinc-850 rounded-full" />
        </div>
        <div className="mt-4 flex items-baseline justify-between">
          <div className="h-7 bg-zinc-200 dark:bg-zinc-800 rounded-md w-20" />
          <div className="h-4 bg-zinc-205 dark:bg-zinc-850 rounded-md w-10 border border-zinc-200 dark:border-zinc-800" />
        </div>
      </div>
    ))}
  </div>
);

const MetricsChartSkeleton = () => (
  <div className="bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/80 rounded-3xl p-6 space-y-6 backdrop-blur-sm shadow-md animate-pulse text-left">
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div className="space-y-2">
        <div className="h-5 bg-zinc-200 dark:bg-zinc-800 rounded-md w-48" />
        <div className="h-3 bg-zinc-200 dark:bg-zinc-850 rounded-md w-64" />
      </div>
      <div className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-950 p-1 border border-zinc-200 dark:border-zinc-850 rounded-2xl w-full sm:w-auto overflow-hidden">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={idx} className="h-7 bg-zinc-200 dark:bg-zinc-900 rounded-xl w-24" />
        ))}
      </div>
    </div>

    <div className="h-72 w-full bg-zinc-50/40 dark:bg-zinc-950/40 rounded-2xl border border-zinc-200 dark:border-zinc-850 p-6 flex flex-col justify-between relative overflow-hidden">
      <div className="absolute inset-0 p-6 flex flex-col justify-between pointer-events-none opacity-40">
        {Array.from({ length: 5 }).map((_, idx) => (
          <div key={idx} className="border-b border-zinc-200 dark:border-zinc-800/60 w-full h-0" />
        ))}
      </div>
      
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-25">
        <svg className="w-full h-full" viewBox="0 0 800 200" fill="none" preserveAspectRatio="none">
          <path
            d="M0 150 C 100 130, 200 80, 300 110 C 400 140, 500 50, 600 70 C 700 90, 750 120, 800 100"
            stroke="#6366f1"
            strokeWidth="4"
            strokeLinecap="round"
            className="stroke-zinc-400 dark:stroke-zinc-700/80"
          />
          <path
            d="M0 150 C 100 130, 200 80, 300 110 C 400 140, 500 50, 600 70 C 700 90, 750 120, 800 100 L 800 200 L 0 200 Z"
            fill="url(#skeletonGradient)"
            className="fill-zinc-200/10 dark:fill-zinc-850/10"
          />
          <defs>
            <linearGradient id="skeletonGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" className="text-zinc-200 dark:text-zinc-800" stopOpacity="0.3" />
              <stop offset="100%" stopColor="currentColor" className="text-zinc-200 dark:text-zinc-800" stopOpacity="0.0" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      <div className="flex justify-between items-end mt-auto pt-4 border-t border-zinc-200 dark:border-zinc-800/20">
        {Array.from({ length: 6 }).map((_, idx) => (
          <div key={idx} className="h-3 bg-zinc-200 dark:bg-zinc-900 rounded-md w-10" />
        ))}
      </div>
    </div>
  </div>
);

const TopPostsSkeleton = ({ activePlatform }) => (
  <div className="bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/80 rounded-3xl p-6 space-y-4 backdrop-blur-sm shadow-md animate-pulse text-left">
    <div className="flex items-center justify-between flex-wrap gap-3">
      <div className="h-5 bg-zinc-200 dark:bg-zinc-800 rounded-md w-48" />
      <div className="h-6 bg-zinc-205 dark:bg-zinc-850 rounded-full w-28" />
    </div>

    <div className="w-full overflow-x-auto">
      <table className="w-full min-w-[640px] text-left border-collapse">
        <thead>
          <tr className="border-b border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500 uppercase tracking-wider font-bold">
            <th className="pb-3 pl-2 w-1/3">Published Post</th>
            {activePlatform === 'all' && <th className="pb-3">Platform</th>}
            <th className="pb-3 text-center">Likes</th>
            <th className="pb-3 text-center">Comments</th>
            <th className="pb-3 text-center">Shares</th>
            <th className="pb-3 text-center">Engagement</th>
            <th className="pb-3 text-right pr-2">Reach</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-850">
          {Array.from({ length: 5 }).map((_, idx) => (
            <tr key={idx}>
              <td className="py-4 pl-2">
                <div className="space-y-1.5">
                  <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded-md w-full" />
                  <div className="h-2.5 bg-zinc-150 dark:bg-zinc-850 rounded-md w-2/3" />
                </div>
              </td>
              {activePlatform === 'all' && (
                <td className="py-4">
                  <div className="h-5 bg-zinc-200 dark:bg-zinc-850 rounded-full w-16" />
                </td>
              )}
              <td className="py-4 text-center">
                <div className="h-4 bg-zinc-200 dark:bg-zinc-850 rounded-md w-8 mx-auto" />
              </td>
              <td className="py-4 text-center">
                <div className="h-4 bg-zinc-200 dark:bg-zinc-850 rounded-md w-8 mx-auto" />
              </td>
              <td className="py-4 text-center">
                <div className="h-4 bg-zinc-200 dark:bg-zinc-850 rounded-md w-8 mx-auto" />
              </td>
              <td className="py-4 text-center">
                <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded-md w-10 mx-auto" />
              </td>
              <td className="py-4 text-right pr-2">
                <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded-md w-12 ml-auto" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const AISuggestionsSkeleton = () => (
  <div className="space-y-5 text-left animate-pulse">
    <div className="bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/80 rounded-3xl p-6 backdrop-blur-sm shadow-lg">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-2xl bg-zinc-200 dark:bg-zinc-800" />
          <div className="space-y-1.5">
            <div className="h-4.5 bg-zinc-200 dark:bg-zinc-800 rounded-md w-32" />
            <div className="h-3 bg-zinc-150 dark:bg-zinc-850 rounded-md w-60" />
          </div>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="h-8 bg-zinc-200 dark:bg-zinc-850 rounded-xl w-24" />
          <div className="h-8 bg-zinc-200 dark:bg-zinc-850 rounded-xl w-16" />
        </div>
      </div>
    </div>

    <div className="space-y-3">
      <div className="bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-5 space-y-2.5">
        <div className="h-3.5 bg-zinc-200 dark:bg-zinc-800 rounded-md w-36" />
        <div className="h-3 bg-zinc-150 dark:bg-zinc-850 rounded-md w-full" />
        <div className="h-3 bg-zinc-150 dark:bg-zinc-850 rounded-md w-4/5" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={idx} className="bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-5 space-y-3">
            <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded-md w-1/3" />
            <div className="space-y-2">
              <div className="h-3 bg-zinc-150 dark:bg-zinc-850 rounded-md w-full" />
              <div className="h-3 bg-zinc-150 dark:bg-zinc-850 rounded-md w-5/6" />
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const Analytics = () => {
  const navigate = useNavigate();
  const { fetchAnalytics, connectedAccounts, fetchAccounts } = useData();
  const activeRequestRef = useRef(0);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState('');
  
  // Dashboard data state
  const [hasData, setHasData] = useState(false);
  const [summary, setSummary] = useState({});
  const [timeline, setTimeline] = useState([]);
  const [topPosts, setTopPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [lastSyncTimestamp, setLastSyncTimestamp] = useState(new Date());
  const [relativeSyncTime, setRelativeSyncTime] = useState('Just now');

  useEffect(() => {
    const updateRelativeTime = () => {
      const diffMs = new Date() - lastSyncTimestamp;
      const diffMins = Math.floor(diffMs / 60000);
      const diffSecs = Math.floor(diffMs / 1000);
      if (diffMins > 0) {
        setRelativeSyncTime(`${diffMins} minute${diffMins > 1 ? 's' : ''} ago`);
      } else if (diffSecs > 10) {
        setRelativeSyncTime(`${diffSecs} seconds ago`);
      } else {
        setRelativeSyncTime('Just now');
      }
    };
    updateRelativeTime();
    const interval = setInterval(updateRelativeTime, 10000); // update every 10 seconds
    return () => clearInterval(interval);
  }, [lastSyncTimestamp]);
  
  // Post-Level AI Analysis Modal State
  const [selectedPost, setSelectedPost] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Filters state
  const [activePlatform, setActivePlatform] = useState('all');
  const [activeMetric, setActiveMetric] = useState(METRICS[0]); // Default Impressions
  const [activeDays, setActiveDays] = useState(30);

  useEffect(() => {
    fetchAccounts();
    fetchAnalyticsData();
  }, [activePlatform, activeDays]);

  const fetchAnalyticsData = async (force = false) => {
    const currentRequestId = activeRequestRef.current + 1;
    activeRequestRef.current = currentRequestId;

    setLoading(true);
    setPostsLoading(true);
    setError('');

    // Clear data states immediately to avoid stale data display
    setSummary({});
    setTimeline([]);
    setTopPosts([]);
    setHasData(false);

    try {
      const data = await fetchAnalytics(activePlatform, activeDays, force);
      
      // Only set state if this request is still the active/latest one
      if (activeRequestRef.current === currentRequestId) {
        if (data.overview) {
          setHasData(data.overview.hasData);
          setSummary(data.overview.summary || {});
          setTimeline(data.overview.timeline || []);
        }
        setTopPosts(data.topPosts || []);
      }
    } catch (err) {
      console.error(err);
      if (activeRequestRef.current === currentRequestId) {
        setError('Failed to fetch analytics metrics. Please ensure server is running.');
      }
    } finally {
      if (activeRequestRef.current === currentRequestId) {
        setLoading(false);
        setPostsLoading(false);
      }
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

  // Open post-level analysis modal
  const handlePostClick = (post) => {
    // Check if the social account is connected (allow mock posts in development)
    const isMock = post.platformPostId?.startsWith('mock_post_');
    const isConnected = connectedAccounts.some(acc => acc.platform === post.platform);

    if (!isConnected && !isMock) {
      const confirmConnect = window.confirm(`Please connect your ${post.platform} account first to analyze this post. Would you like to go to the Social Accounts page now?`);
      if (confirmConnect) {
        navigate('/social-accounts');
      }
      return;
    }

    setSelectedPost(post);
    setIsModalOpen(true);
  };

  // Sync metrics helper
  const handleSyncMetrics = async () => {
    if (connectedAccounts.length === 0) {
      const confirmConnect = window.confirm('Please connect at least one social media account first to synchronize metrics. Would you like to go to the Social Accounts page now?');
      if (confirmConnect) {
        navigate('/social-accounts');
      }
      return;
    }

    setSeeding(true);
    showToast('Synchronizing account metrics and snapshots...', 'info');
    try {
      const response = await analyticsService.seedMetrics();
      if (response && response.success) {
        showToast('Social media analytics synchronized successfully!');
        setLastSyncTimestamp(new Date());
        setRelativeSyncTime('Just now');
        await fetchAnalyticsData(true);
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
        <div 
          className="bg-white/95 dark:bg-zinc-950/95 border border-zinc-250/80 dark:border-zinc-800/80 backdrop-blur-xl p-4 rounded-xl shadow-2xl text-left"
          style={{ borderLeft: `3px solid ${activeMetric.strokeColor}` }}
        >
          <p className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: activeMetric.strokeColor }} />
            {label}
          </p>
          <p className="text-sm font-black text-zinc-900 dark:text-white leading-none">
            {metricLabel}: <span style={{ color: activeMetric.strokeColor }} className="text-base font-extrabold ml-1">{formattedValue}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  // Derive the active platform meta for display
  const activePlatformMeta = PLATFORM_META[activePlatform] || null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 py-4 relative"
      style={{ overflowX: 'hidden', maxWidth: '100%' }}
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
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-6 border-b border-zinc-200 dark:border-zinc-800/40 pb-6">
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
        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
          {/* Last Sync Indicator & Manual Sync Button */}
          <div className="flex items-center space-x-3 bg-zinc-50 dark:bg-zinc-950/80 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-2 px-3.5">
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
              Last Synced: {relativeSyncTime}
            </span>
            <button
              onClick={handleSyncMetrics}
              disabled={seeding}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-zinc-50 dark:bg-zinc-900 dark:hover:bg-zinc-850 text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white transition-all disabled:opacity-40 cursor-pointer text-[10px] font-bold border border-zinc-200 dark:border-zinc-800"
              title="Refresh Analytics"
            >
              <RefreshCw className={`h-3 w-3 ${seeding ? 'animate-spin' : ''}`} />
              <span>Refresh Analytics</span>
            </button>
          </div>

          {/* Days Filter */}
          <select
            value={activeDays}
            onChange={(e) => setActiveDays(parseInt(e.target.value, 10))}
            className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 py-2.5 px-3.5 text-xs font-semibold text-zinc-800 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value={7}>Last 7 Days</option>
            <option value={30}>Last 30 Days</option>
            <option value={90}>Last 90 Days</option>
          </select>

          {/* Platform Tab Buttons */}
          <div className="flex items-center gap-1 bg-zinc-50 dark:bg-zinc-950/80 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-1 sm:p-1.5 overflow-x-auto max-w-full scrollbar-none shrink-0">
            {PLATFORMS.map((p) => (
              <button
                key={p.id}
                onClick={() => setActivePlatform(p.id)}
                className={`shrink-0 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activePlatform === p.id 
                    ? 'bg-white dark:bg-indigo-600/10 border border-zinc-200 dark:border-indigo-500/30 text-indigo-600 dark:text-indigo-400' 
                    : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'
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

      {/* Disconnected Account Warning Banner */}
      {!loading && connectedAccounts.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-amber-500/[0.03] dark:bg-amber-500/5 border border-amber-500/20 rounded-2xl p-5 backdrop-blur-sm shadow-lg relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-amber-500/[0.03] via-transparent to-orange-500/[0.03] dark:from-amber-500/5 dark:to-orange-500/5 pointer-events-none" />
          <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start space-x-3.5">
              <div className="h-10 w-10 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="text-left">
                <h4 className="text-sm font-bold text-amber-800 dark:text-amber-300">No Social Accounts Connected</h4>
                <p className="text-xs text-amber-700 dark:text-amber-400/70 mt-0.5 leading-relaxed max-w-lg">
                  Please connect your social media accounts to track and analyze real-time performance metrics, followers, and engagement data.
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate('/social-accounts')}
              className="flex items-center space-x-2 px-5 py-2.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 hover:border-amber-500/50 text-amber-700 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-200 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0"
            >
              <LinkIcon className="h-3.5 w-3.5" />
              <span>Connect Accounts</span>
            </button>
          </div>
        </motion.div>
      )}

      {/* Dynamic Dashboard Content with Fade Transition & Skeletons */}
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="skeleton"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-8"
          >
            <KPICardsSkeleton />
            <MetricsChartSkeleton />
            <TopPostsSkeleton activePlatform={activePlatform} />
            <AISuggestionsSkeleton />
          </motion.div>
        ) : !hasData ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25 }}
            className="bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/80 rounded-3xl p-10 text-center max-w-xl mx-auto space-y-6 shadow-xl relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-grid-pattern opacity-[0.02]" />
            <div className="h-16 w-16 bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 rounded-2xl flex items-center justify-center mx-auto shadow-inner animate-pulse">
              <Database className="h-8 w-8" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">No Analytics Data Available</h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-sm mx-auto">
                No real-time analytics data has been retrieved from your connected social media accounts yet. Click below to synchronize and fetch the latest metrics!
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
                  <span>Synchronize Social Accounts</span>
                </>
              )}
            </button>
          </motion.div>
        ) : (
          /* KPI Metrics Cards and Interactive Recharts plot */
          <motion.div
            key="dashboard"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25 }}
            className="space-y-8"
          >
            
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
                <div key={idx} className="bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-5 relative overflow-hidden backdrop-blur-sm shadow-md">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-500 font-bold uppercase tracking-wider">{s.name}</span>
                    <s.icon className={`h-4.5 w-4.5 ${s.color}`} />
                  </div>
                  <div className="mt-4 flex items-baseline justify-between">
                    <span className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">{s.value}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                      s.isGrowth 
                        ? 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20' 
                        : 'text-rose-600 bg-rose-50 dark:text-rose-400 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20'
                    }`}>
                      {s.change}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Interactive Recharts Graph Plot */}
            <div className="bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/80 rounded-3xl p-6 space-y-6 backdrop-blur-sm shadow-md">
              
              {/* Graph header toolbar */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-left">
                <div>
                  <h3 className="font-bold text-zinc-900 dark:text-white text-base">Audience Metrics Trend</h3>
                  <p className="text-xs text-zinc-500 mt-0.5">Performance tracking timeline for the past {activeDays} days</p>
                </div>

                {/* Chart Metric Select buttons */}
                <div className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-950 p-1 border border-zinc-200 dark:border-zinc-850 rounded-2xl overflow-x-auto max-w-full scrollbar-none shrink-0">
                  {METRICS.map((metric) => {
                    const Icon = metric.icon;
                    const isActive = activeMetric.id === metric.id;
                    return (
                      <button
                        key={metric.id}
                        onClick={() => setActiveMetric(metric)}
                        className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 ${
                          isActive 
                            ? 'bg-white dark:bg-zinc-850 text-zinc-900 dark:text-white shadow-sm border border-zinc-200 dark:border-transparent' 
                            : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-300'
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
              <div className="h-72 w-full bg-zinc-50 dark:bg-zinc-950/40 rounded-2xl border border-zinc-200 dark:border-zinc-850 p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={timeline}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="metricGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={activeMetric.gradientColor} stopOpacity={0.4} />
                        <stop offset="100%" stopColor={activeMetric.gradientColor} stopOpacity={0.01} />
                      </linearGradient>
                    </defs>
                    
                    <CartesianGrid 
                      strokeDasharray="4 4" 
                      vertical={false} 
                      stroke="rgba(113, 113, 122, 0.15)"
                    />
                    
                    <XAxis 
                      dataKey="date" 
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: '#71717a', fontSize: 10, fontWeight: '700' }}
                      dy={10}
                      minTickGap={65}
                    />
                    
                    <YAxis 
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: '#71717a', fontSize: 10, fontWeight: '700' }}
                      dx={-5}
                    />
                    
                    <Tooltip content={<CustomTooltip />} />
                    
                    <Area
                      type="monotone"
                      dataKey={activeMetric.id}
                      name={activeMetric.name}
                      stroke={activeMetric.strokeColor}
                      strokeWidth={3.5}
                      fillOpacity={1}
                      fill="url(#metricGradient)"
                      dot={{ r: 2, fill: activeMetric.strokeColor, strokeWidth: 0 }}
                      activeDot={{ r: 5, fill: activeMetric.strokeColor, stroke: '#ffffff', strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Top Performing Content table list */}
            <div className="bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/80 rounded-3xl p-6 space-y-4 backdrop-blur-sm shadow-md text-left">
              {/* Section header with platform badge */}
              <div className="flex items-center justify-between flex-wrap gap-3">
                <h3 className="font-bold text-zinc-900 dark:text-white text-base flex items-center space-x-2">
                  <Sparkle className="h-4.5 w-4.5 text-indigo-400" />
                  <span>Top Performing Content</span>
                </h3>
                {activePlatformMeta && (
                  <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border border-zinc-200 dark:border-white/10 ${activePlatformMeta.bg} ${activePlatformMeta.text}`}>
                    <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: activePlatformMeta.dot }} />
                    {activePlatformMeta.label} only
                  </span>
                )}
              </div>

              {postsLoading ? (
                /* Loading shimmer rows */
                <div className="space-y-3 pt-2">
                  {[1,2,3].map(i => (
                    <div key={i} className="h-10 bg-zinc-100 dark:bg-zinc-800/40 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : topPosts.length > 0 ? (
                <div className="w-full overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500 uppercase tracking-wider font-bold">
                        <th className="pb-3 pl-2">Published Post</th>
                        {activePlatform === 'all' && <th className="pb-3">Platform</th>}
                        <th className="pb-3 text-center"><Heart className="h-3.5 w-3.5 inline mr-1" />Likes</th>
                        <th className="pb-3 text-center"><MessageSquare className="h-3.5 w-3.5 inline mr-1" />Comments</th>
                        <th className="pb-3 text-center"><Share2 className="h-3.5 w-3.5 inline mr-1" />Shares</th>
                        <th className="pb-3 text-center">Engagement</th>
                        <th className="pb-3 text-right pr-2">Reach</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-850 text-sm text-zinc-600 dark:text-zinc-300">
                      {topPosts.filter(p => activePlatform === 'all' || p.platform === activePlatform).map((p) => {
                        const meta = PLATFORM_META[p.platform];
                        return (
                          <tr 
                            key={p.id} 
                            className="hover:bg-zinc-50 dark:hover:bg-zinc-800/20 transition-all font-medium cursor-pointer"
                            onClick={() => handlePostClick(p)}
                          >
                            <td className="py-4 font-semibold text-zinc-900 dark:text-white max-w-xs truncate pl-2" title={p.content}>
                              {p.content}
                            </td>
                            {activePlatform === 'all' && (
                              <td className="py-4">
                                <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${meta?.bg || 'bg-zinc-100 dark:bg-zinc-800'} ${meta?.text || 'text-zinc-700 dark:text-zinc-300'}`}>
                                  <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: meta?.dot || '#a1a1aa' }} />
                                  {p.platform}
                                </span>
                              </td>
                            )}
                            <td className="py-4 text-center text-zinc-700 dark:text-zinc-400 font-bold">{formatMetric(p.likes)}</td>
                            <td className="py-4 text-center text-zinc-700 dark:text-zinc-400 font-bold">{formatMetric(p.comments)}</td>
                            <td className="py-4 text-center text-zinc-700 dark:text-zinc-400 font-bold">{formatMetric(p.shares)}</td>
                            <td className="py-4 text-center text-indigo-600 dark:text-indigo-400 font-bold">
                              {formatPercent(p.engagementRate)}
                            </td>
                            <td className="py-4 text-right font-bold text-zinc-900 dark:text-white pr-2">
                              {formatMetric(p.reach)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                /* Empty state when a platform has no posts */
                <div className="flex flex-col items-center justify-center py-12 space-y-3 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800/60 flex items-center justify-center">
                    <Sparkle className="h-6 w-6 text-zinc-500 dark:text-zinc-600" />
                  </div>
                  <p className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">
                    No posts found{activePlatformMeta ? ` for ${activePlatformMeta.label}` : ''}.
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-600 max-w-xs">
                    Click &ldquo;Sync All Social Data&rdquo; to pull the latest content from your connected accounts.
                  </p>
                </div>
              )}
            </div>

            {/* Seed helper option at the bottom */}
            <div className="flex justify-end pr-2">
              <button
                onClick={handleSyncMetrics}
                disabled={seeding}
                className="flex items-center space-x-1.5 px-3.5 py-2 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 bg-white dark:bg-zinc-950 text-zinc-700 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-300 rounded-xl text-xs font-semibold transition-all cursor-pointer disabled:opacity-40"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${seeding ? 'animate-spin' : ''}`} />
                <span>Refresh Analytics</span>
              </button>
            </div>

            {/* ── AI Suggestions ── */}
            <AISuggestions activePlatform={activePlatform} hasAnalyticsData={hasData} />

            {/* ── Individual Post AI Analysis Modal ── */}
            <PostAnalysisModal 
              isOpen={isModalOpen} 
              onClose={() => {
                setIsModalOpen(false);
                setSelectedPost(null);
              }} 
              postId={selectedPost?.id} 
              platform={selectedPost?.platform}
              feedMediaUrl={selectedPost?.mediaUrl}
              feedMediaType={selectedPost?.mediaType}
            />

          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default Analytics;
