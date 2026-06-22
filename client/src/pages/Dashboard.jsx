import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  Calendar,
  Users,
  MessageSquare,
  ArrowUpRight,
  Plus,
  ArrowRight,
  Instagram,
  Linkedin,
  Twitter,
  Facebook,
  Globe,
  Pin,
  AtSign,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Play
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import contentService from '../services/contentService';
import socialService from '../services/socialService';
import { useData } from '../context/DataContext';

const PLATFORM_ICONS = {
  facebook: { icon: Facebook, color: 'text-blue-500 bg-blue-500/10 border-blue-500/20' },
  instagram: { icon: Instagram, color: 'text-pink-500 bg-pink-500/10 border-pink-500/20' },
  threads: { icon: AtSign, color: 'text-zinc-300 bg-zinc-700/10 border-zinc-600/20' },
  linkedin: { icon: Linkedin, color: 'text-sky-500 bg-sky-500/10 border-sky-500/20' }
};

const Dashboard = () => {
  const { 
    posts, 
    connectedAccounts, 
    fetchPosts, 
    fetchAccounts, 
    loading: globalLoading, 
    errors: globalErrors 
  } = useData();
  const [error, setError] = useState('');
  const [publishingId, setPublishingId] = useState(null);
  
  const navigate = useNavigate();

  useEffect(() => {
    fetchPosts();
    fetchAccounts();
  }, []);

  const handlePublishNow = async (postId) => {
    setPublishingId(postId);
    try {
      await contentService.publishPostNow(postId);
      await Promise.all([
        fetchPosts(true),
        fetchAccounts(true)
      ]);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to publish post immediately.');
    } finally {
      setPublishingId(null);
    }
  };

  const loading = globalLoading.posts || globalLoading.accounts;

  const handleRetry = (post) => {
    if (post.isCarousel) {
      navigate('/carousel-builder', { state: { retryPost: post } });
    } else {
      navigate('/contain-studio', { state: { retryPost: post } });
    }
  };

  // Dynamic calculations
  const scheduledCount = posts.filter(p => p.status === 'SCHEDULED').length;
  const publishedCount = posts.filter(p => p.status === 'PUBLISHED').length;
  const failedCount = posts.filter(p => p.status === 'FAILED').length;
  
  const stats = [
    { name: 'Scheduled Posts', value: scheduledCount, change: 'Queued to release', icon: Calendar, color: 'from-blue-600 to-indigo-500' },
    { name: 'Published Posts', value: publishedCount, change: 'Live on channels', icon: CheckCircle2, color: 'from-emerald-600 to-teal-500' },
    { name: 'Failed Posts', value: failedCount, change: failedCount > 0 ? `${failedCount} need attention` : 'All healthy', icon: AlertCircle, color: failedCount > 0 ? 'from-rose-600 to-red-500' : 'from-zinc-700 to-zinc-650' },
    { name: 'Social Channels', value: connectedAccounts.length, change: `${4 - connectedAccounts.length} platforms left`, icon: Users, color: 'from-violet-600 to-purple-500' },
  ];

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4 text-center">
          <RefreshCw className="h-8 w-8 text-indigo-500 animate-spin" />
          <p className="text-zinc-500 dark:text-zinc-400 text-sm font-medium">Loading workspace metrics...</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-8 py-4"
    >
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-700 dark:from-white dark:via-zinc-100 dark:to-zinc-400 bg-clip-text text-transparent">
            Welcome back, Dharmik! 👋
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            Here is a snapshot of what is happening across your social media channels today.
          </p>
        </div>
        <Link
          to="/contain-studio"
          className="flex items-center space-x-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold text-white rounded-xl shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all"
        >
          <Plus className="h-4 w-4" />
          <span>New Content</span>
        </Link>
      </div>

      {error && (
        <div className="flex items-center space-x-2.5 bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-xl text-sm">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, i) => (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.05 }}
            key={stat.name}
            className="relative bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-6 overflow-hidden group hover:border-zinc-700/60 transition-all"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-zinc-400">{stat.name}</span>
              <div className={`h-10 w-10 rounded-xl bg-gradient-to-tr ${stat.color} flex items-center justify-center shadow-lg shadow-indigo-500/5`}>
                <stat.icon className="h-5 w-5 text-white" />
              </div>
            </div>
            <div className="mt-4">
              <span className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">{stat.value}</span>
              <span className="text-xs text-zinc-400 ml-2.5 font-medium block sm:inline mt-1 sm:mt-0">{stat.change}</span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Layout Split */}
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Left Column: Recent Drafts / Scheduled Queue */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Social Posting Queue</h2>
            <Link to="/scheduler" className="flex items-center space-x-1 text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
              <span>Open Calendar</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl overflow-hidden divide-y divide-zinc-800/50">
            {posts.length === 0 ? (
              <div className="p-8 text-center text-zinc-500">
                <Calendar className="h-10 w-10 mx-auto text-zinc-700 mb-2" />
                <p className="text-sm">No scheduled posts or drafts in your pipeline.</p>
                <Link to="/contain-studio" className="text-xs text-indigo-400 hover:underline mt-2 inline-block">Create your first post now</Link>
              </div>
            ) : (
              posts.slice(0, 5).map((post) => {
                const meta = PLATFORM_ICONS[post.platform] || { icon: Globe, color: 'text-zinc-400 bg-zinc-800 border-zinc-700' };
                const PlatformIcon = meta.icon;

                return (
                  <div key={post._id} className="p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-zinc-900/10 transition-all group">
                    <div className="flex items-start space-x-4 min-w-0 flex-1">
                      {/* Platform icon badge */}
                      <div className={`h-10 w-10 rounded-xl border flex items-center justify-center shrink-0 ${meta.color}`}>
                        <PlatformIcon className="h-5 w-5" />
                      </div>
                      
                      <div className="min-w-0 flex-1">
                        <h4 className="font-semibold text-zinc-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors text-sm sm:text-base truncate">
                          {post.content}
                        </h4>
                        
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase ${
                            post.status === 'PUBLISHED' ? 'bg-emerald-550/10 text-emerald-400 border-emerald-500/20' :
                            post.status === 'SCHEDULED' ? 'bg-blue-550/10 text-blue-400 border-blue-500/20' :
                            post.status === 'PUBLISHING' ? 'bg-indigo-550/10 text-indigo-400 border-indigo-500/20 animate-pulse' :
                            post.status === 'FAILED' ? 'bg-rose-550/10 text-red-400 border-rose-500/20' :
                            'bg-zinc-800 text-zinc-400 border-zinc-700'
                          }`}>
                            {post.status}
                          </span>

                          <span className="text-xs text-zinc-500">
                            {post.status === 'PUBLISHED' 
                              ? `Published at ${new Date(post.publishedAt).toLocaleDateString()}` 
                              : post.scheduledAt 
                              ? `Scheduled: ${new Date(post.scheduledAt).toLocaleString()}` 
                              : 'Draft'
                            }
                          </span>
                        </div>

                        {post.status === 'FAILED' && post.publishError && (
                          <p className="text-xs text-red-450 mt-1 flex items-center space-x-1">
                            <AlertCircle className="h-3 w-3 shrink-0" />
                            <span className="truncate">{post.publishError}</span>
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 self-end sm:self-auto shrink-0">
                      {/* Action buttons */}
                      {post.status === 'SCHEDULED' && (
                        <button
                          type="button"
                          disabled={publishingId === post._id}
                          onClick={() => handlePublishNow(post._id)}
                          className="flex items-center space-x-1 px-3 py-1.5 bg-indigo-600/80 hover:bg-indigo-600 text-white rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                          title="Publish Immediately"
                        >
                          {publishingId === post._id ? (
                            <RefreshCw className="h-3 w-3 animate-spin mr-1" />
                          ) : (
                            <Play className="h-3 w-3 mr-1" />
                          )}
                          <span>Post Now</span>
                        </button>
                      )}

                      {(post.status === 'FAILED' || post.status === 'DRAFT') && (
                        <button
                          type="button"
                          onClick={() => handleRetry(post)}
                          className="px-3 py-1.5 border border-zinc-800 hover:border-zinc-700 bg-zinc-950/45 text-zinc-350 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                        >
                          Retry / Edit
                        </button>
                      )}

                      {post.status === 'PUBLISHED' && (
                        <button
                          type="button"
                          onClick={() => handleRetry(post)}
                          className="px-3 py-1.5 border border-zinc-800 hover:border-zinc-700 bg-zinc-950/45 text-zinc-350 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                        >
                          Duplicate
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Social Channels */}
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Active Channels</h2>
            <Link to="/social-accounts" className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
              Manage
            </Link>
          </div>

          <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-6 space-y-4">
            {/* Account List */}
            {connectedAccounts.length === 0 ? (
              <div className="text-center py-6 text-zinc-555">
                <p className="text-sm">No connected social accounts.</p>
                <Link to="/social-accounts" className="text-xs text-indigo-455 hover:underline mt-2.5 inline-block font-semibold">Connect Platform Now</Link>
              </div>
            ) : (
              connectedAccounts.map((account) => {
                const meta = PLATFORM_ICONS[account.platform] || { icon: Globe, color: 'text-zinc-400 bg-zinc-800 border-zinc-700' };
                const PlatformIcon = meta.icon;

                return (
                  <div key={account._id} className="flex items-center justify-between p-3 rounded-xl hover:bg-zinc-900/20 transition-all border border-transparent hover:border-zinc-800/50">
                    <div className="flex items-center space-x-3">
                      <div className={`h-9 w-9 rounded-lg border flex items-center justify-center ${meta.color}`}>
                        <PlatformIcon className="h-4.5 w-4.5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-zinc-900 dark:text-white capitalize">{account.platform}</p>
                        <p className="text-xs text-zinc-400 truncate max-w-[140px]">{account.platformUsername}</p>
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                        Connected
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default Dashboard;
