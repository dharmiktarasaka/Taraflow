import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain, RefreshCw, TrendingUp, FileText, Hash, Users,
  Calendar, Target, ChevronDown, ChevronUp, Sparkles,
  Shield, Trash2, AlertCircle, CheckCircle2, Lightbulb,
  BarChart2, MessageSquare, BookOpen, Zap, ToggleLeft, ToggleRight, Info
} from 'lucide-react';
import analyticsService from '../services/analyticsService';

// ─── Priority Badge ──────────────────────────────────────────────────────────
const PriorityBadge = ({ priority }) => {
  const map = {
    high:   { bg: 'bg-rose-500/15',   text: 'text-rose-600 dark:text-rose-400',   border: 'border-rose-500/30',   label: 'HIGH' },
    medium: { bg: 'bg-amber-500/15',  text: 'text-amber-600 dark:text-amber-400',  border: 'border-amber-500/30',  label: 'MED' },
    low:    { bg: 'bg-emerald-500/15',text: 'text-emerald-600 dark:text-emerald-400',border: 'border-emerald-500/30',label: 'LOW' }
  };
  const s = map[priority] || map.low;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-black tracking-widest rounded-md border ${s.bg} ${s.text} ${s.border}`}>
      {s.label}
    </span>
  );
};

// ─── Platform Badge ──────────────────────────────────────────────────────────
const PlatformBadge = ({ platform }) => {
  const map = {
    linkedin:  { bg: 'bg-blue-500/10',  text: 'text-blue-650 dark:text-blue-400' },
    instagram: { bg: 'bg-pink-500/10',  text: 'text-pink-600 dark:text-pink-400' },
    facebook:  { bg: 'bg-blue-600/10',  text: 'text-blue-700 dark:text-blue-300' },
    threads:   { bg: 'bg-zinc-100 dark:bg-zinc-700/40',  text: 'text-zinc-800 dark:text-zinc-300' }
  };
  const s = map[platform] || { bg: 'bg-zinc-700/40', text: 'text-zinc-300' };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 text-[11px] font-bold rounded-full capitalize ${s.bg} ${s.text}`}>
      {platform}
    </span>
  );
};

// ─── Skeleton Loader ─────────────────────────────────────────────────────────
const SkeletonCard = ({ className = '' }) => (
  <div className={`bg-zinc-100 dark:bg-zinc-800/30 rounded-2xl p-5 animate-pulse space-y-3 ${className}`}>
    <div className="h-4 bg-zinc-200 dark:bg-zinc-700/50 rounded-lg w-2/5" />
    <div className="h-3 bg-zinc-150 dark:bg-zinc-700/30 rounded-lg w-full" />
    <div className="h-3 bg-zinc-150 dark:bg-zinc-700/30 rounded-lg w-4/5" />
  </div>
);

// ─── Section Card ────────────────────────────────────────────────────────────
const SectionCard = ({ icon: Icon, title, iconColor = 'text-indigo-505 dark:text-indigo-400', children, defaultOpen = true }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl overflow-hidden backdrop-blur-sm shadow-md">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <Icon className={`h-4.5 w-4.5 ${iconColor}`} />
          <span className="text-sm font-bold text-zinc-800 dark:text-zinc-100">{title}</span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-zinc-500" /> : <ChevronDown className="h-4 w-4 text-zinc-500" />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 pt-1 border-t border-zinc-200 dark:border-zinc-800/50 text-left">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Quality Indicator ───────────────────────────────────────────────────────
const QualityBar = ({ quality }) => {
  const levels = { insufficient: 1, fair: 2, good: 3, excellent: 4 };
  const level = levels[quality] || 1;
  const colors = ['bg-rose-500', 'bg-amber-500', 'bg-emerald-400', 'bg-indigo-400'];
  const labels = { insufficient: 'Limited data', fair: 'Fair data', good: 'Good data', excellent: 'Excellent data' };
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5">
        {[1,2,3,4].map(i => (
          <div key={i} className={`h-2 w-5 rounded-sm transition-colors ${i <= level ? colors[level - 1] : 'bg-zinc-700/50'}`} />
        ))}
      </div>
      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">{labels[quality] || 'Limited data'}</span>
    </div>
  );
};

// ─── Privacy Panel ───────────────────────────────────────────────────────────
const PrivacyPanel = ({ learningEnabled, onToggle, onDelete, toggling, deleting }) => {
  const [showPanel, setShowPanel] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setShowPanel(p => !p)}
        className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
        title="AI Learning & Privacy Settings"
      >
        <Shield className="h-3.5 w-3.5" />
        <span className="font-semibold">Privacy</span>
      </button>

      <AnimatePresence>
        {showPanel && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -8 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-7 z-50 w-80 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-4 space-y-4 text-left"
          >
            {/* Header */}
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
              <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">AI Learning & Privacy</span>
            </div>

            {/* Info block */}
            <div className="bg-zinc-100 dark:bg-zinc-900/60 rounded-xl p-3 text-xs text-zinc-600 dark:text-zinc-400 space-y-1.5">
              <p className="flex items-start gap-1.5"><CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" /> Only aggregated performance stats are stored — never raw post content or personal data.</p>
              <p className="flex items-start gap-1.5"><CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" /> Your data is isolated from all other users.</p>
              <p className="flex items-start gap-1.5"><CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" /> You can disable learning or delete all data at any time.</p>
            </div>

            {/* Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">AI Continuous Learning</p>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-500 mt-0.5">
                  {learningEnabled ? 'Learning is active — improving future suggestions.' : 'Learning is paused.'}
                </p>
              </div>
              <button
                onClick={onToggle}
                disabled={toggling}
                className={`transition-opacity ${toggling ? 'opacity-40' : ''}`}
              >
                {learningEnabled
                  ? <ToggleRight className="h-7 w-7 text-indigo-500 dark:text-indigo-400" />
                  : <ToggleLeft className="h-7 w-7 text-zinc-400 dark:text-zinc-500" />
                }
              </button>
            </div>

            {/* Delete */}
            <button
              onClick={onDelete}
              disabled={deleting}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10 transition-colors disabled:opacity-40"
            >
              {deleting ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
              Delete All My Learning Data
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────────
const AISuggestions = ({ activePlatform = 'all', hasAnalyticsData = false }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [learningEnabled, setLearningEnabled] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3500);
  };

  const fetchSuggestions = useCallback(async (force = false) => {
    if (!hasAnalyticsData && !force) return;
    setLoading(true);
    setError('');
    try {
      const res = await analyticsService.getSuggestions(activePlatform, force);
      setData(res);
    } catch (err) {
      console.error('[AISuggestions]', err);
      setError('Failed to load AI suggestions. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [activePlatform, hasAnalyticsData]);

  // Load learning profile consent state
  useEffect(() => {
    analyticsService.getLearningProfile()
      .then(res => {
        if (res?.hasProfile) setLearningEnabled(res.learningEnabled);
      })
      .catch(() => {});
  }, []);

  // Fetch suggestions when platform changes or analytics data is available
  useEffect(() => {
    if (hasAnalyticsData) fetchSuggestions(false);
  }, [activePlatform, hasAnalyticsData, fetchSuggestions]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchSuggestions(true);
    setRefreshing(false);
    showToast('AI suggestions refreshed!');
  };

  const handleToggleLearning = async () => {
    setToggling(true);
    try {
      const res = await analyticsService.updateLearningConsent(!learningEnabled);
      setLearningEnabled(res.learningEnabled);
      showToast(res.message || (res.learningEnabled ? 'AI learning enabled.' : 'AI learning paused.'));
    } catch {
      showToast('Failed to update learning preference.', 'error');
    } finally {
      setToggling(false);
    }
  };

  const handleDeleteData = async () => {
    if (!window.confirm('This will permanently delete all your AI learning data. This cannot be undone. Continue?')) return;
    setDeleting(true);
    try {
      await analyticsService.deleteLearningData();
      setLearningEnabled(false);
      showToast('Your AI learning data has been permanently deleted.', 'success');
    } catch {
      showToast('Failed to delete learning data.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const s = data?.suggestions;
  const summary = data?.summary;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 text-left">
      {/* Toast */}
      <AnimatePresence>
        {toast.show && (
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12 }}
            className={`fixed top-4 right-4 z-[9999] flex items-center gap-2.5 px-4 py-3 rounded-xl border shadow-xl backdrop-blur-xl text-sm font-semibold ${
              toast.type === 'error'
                ? 'bg-white dark:bg-zinc-900 border-rose-500/30 text-rose-650 dark:text-rose-400'
                : 'bg-white dark:bg-zinc-900 border-emerald-500/30 text-emerald-650 dark:text-emerald-400'
            }`}
          >
            {toast.type === 'error' ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Section Header ── */}
      <div className="relative">
        {/* Ambient glow */}
        <div className="absolute inset-0 -z-10 rounded-3xl bg-gradient-to-br from-violet-600/6 via-indigo-600/4 to-transparent blur-2xl" />

        <div className="bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/80 rounded-3xl p-6 backdrop-blur-sm shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            {/* Title */}
            <div className="flex items-center gap-3.5">
              <div className="relative h-11 w-11 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 shrink-0">
                <Brain className="h-5.5 w-5.5 text-white" />
                <div className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 border-2 border-zinc-200 dark:border-zinc-900 animate-pulse" />
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  AI Suggestions
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-violet-500/10 dark:bg-violet-500/15 text-violet-600 dark:text-violet-400 border border-violet-500/20">
                    <Sparkles className="h-2.5 w-2.5" />
                    BETA
                  </span>
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">Personalized recommendations from your real performance data</p>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-3 shrink-0">
              {/* Quality indicator */}
              {summary?.analysisQuality && (
                <QualityBar quality={summary.analysisQuality} />
              )}

              {/* Refresh */}
              <button
                onClick={handleRefresh}
                disabled={loading || refreshing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-zinc-600 hover:text-indigo-650 dark:text-zinc-400 dark:hover:text-indigo-400 border border-zinc-200 dark:border-zinc-800 hover:border-indigo-500/30 bg-white dark:bg-zinc-950 hover:bg-indigo-50/50 dark:hover:bg-indigo-500/5 transition-all disabled:opacity-40 cursor-pointer"
                title="Regenerate suggestions"
              >
                <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>

              {/* Privacy panel */}
              <PrivacyPanel
                learningEnabled={learningEnabled}
                onToggle={handleToggleLearning}
                onDelete={handleDeleteData}
                toggling={toggling}
                deleting={deleting}
              />
            </div>
          </div>

          {/* Stats row when data is loaded */}
          {summary && (
            <div className="mt-4 flex flex-wrap gap-3">
              <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                <BarChart2 className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400" />
                <span className="font-semibold text-zinc-700 dark:text-zinc-400">{summary.totalPosts}</span> posts analyzed
              </div>
              {summary.avgEngagementRate > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-650 dark:text-emerald-400" />
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">{summary.avgEngagementRate}%</span> avg engagement
                </div>
              )}
              {summary.bestPlatform && (
                <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                  <Zap className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />
                  Best on <PlatformBadge platform={summary.bestPlatform} />
                </div>
              )}
              {!learningEnabled && (
                <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-650">
                  <Shield className="h-3 w-3" /> Learning paused
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── No analytics data yet ── */}
      {!hasAnalyticsData && !loading && !data && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-8 text-center space-y-3"
        >
          <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800/60 flex items-center justify-center mx-auto">
            <Brain className="h-6 w-6 text-zinc-500 dark:text-zinc-600" />
          </div>
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-200">No analytics data to analyze yet.</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-455 max-w-xs mx-auto">Sync your social media data first, then AI Suggestions will analyze your real performance and generate personalized recommendations.</p>
        </motion.div>
      )}

      {/* ── Loading skeleton ── */}
      {loading && (
        <div className="space-y-3">
          <SkeletonCard />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
          <SkeletonCard />
        </div>
      )}

      {/* ── Error state ── */}
      {error && !loading && (
        <div className="bg-rose-500/8 border border-rose-500/20 rounded-2xl p-4 flex items-center gap-3 text-sm text-rose-455">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── LLM unavailable ── */}
      {data?.llmUnavailable && !loading && (
        <div className="bg-amber-500/8 border border-amber-500/20 rounded-2xl p-4 flex items-start gap-3">
          <Info className="h-4 w-4 text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-500 dark:text-amber-400">AI Engine Unavailable</p>
            <p className="text-xs text-zinc-500 mt-1">{data.message}</p>
          </div>
        </div>
      )}

      {/* ── Main content ── */}
      {!loading && s && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-3"
        >
          {/* Performance Summary — full width */}
          {s.performanceSummary && (
            <div className="bg-white dark:bg-gradient-to-br dark:from-indigo-600/8 dark:via-violet-600/5 dark:to-transparent border border-zinc-200 dark:border-indigo-500/20 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-2.5">
                <BarChart2 className="h-4 w-4 text-indigo-505 dark:text-indigo-400" />
                <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Performance Summary</span>
              </div>
              <p className="text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed">{s.performanceSummary}</p>
            </div>
          )}

          {/* 2-column grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">

            {/* Growth Opportunities */}
            {s.growthOpportunities?.length > 0 && (
              <SectionCard icon={TrendingUp} title="Growth Opportunities" iconColor="text-emerald-500 dark:text-emerald-400">
                <div className="space-y-3 mt-2">
                  {s.growthOpportunities.map((opp, i) => (
                    <div key={i} className="flex gap-3">
                      <div className="h-5 w-5 rounded-lg bg-emerald-500/15 flex items-center justify-center shrink-0 mt-0.5">
                        <TrendingUp className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">{opp.title}</p>
                        <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">{opp.description}</p>
                        {opp.metric && (
                          <span className="inline-block mt-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                            📊 {opp.metric}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}

            {/* Content Recommendations */}
            {s.contentRecommendations?.length > 0 && (
              <SectionCard icon={FileText} title="Content Recommendations" iconColor="text-sky-655 dark:text-sky-400">
                <div className="space-y-3 mt-2">
                  {s.contentRecommendations.map((rec, i) => (
                    <div key={i} className="flex gap-3">
                      <div className="h-5 w-5 rounded-lg bg-sky-500/15 flex items-center justify-center shrink-0 mt-0.5">
                        <Lightbulb className="h-3 w-3 text-sky-500 dark:text-sky-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider">{rec.type}</span>
                        </div>
                        <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">{rec.suggestion}</p>
                        {rec.reason && <p className="text-xs text-zinc-605 dark:text-zinc-400 mt-0.5">{rec.reason}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}

            {/* Caption Recommendations */}
            {s.captionRecommendations && (
              <SectionCard icon={MessageSquare} title="Caption Recommendations" iconColor="text-violet-500 dark:text-violet-400">
                <div className="space-y-3 mt-2">
                  <div className="flex flex-wrap gap-2">
                    {s.captionRecommendations.length && (
                      <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-violet-500/10 dark:bg-violet-500/15 text-violet-600 dark:text-violet-400">
                        Length: {s.captionRecommendations.length}
                      </span>
                    )}
                    {s.captionRecommendations.style && (
                      <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-zinc-700/50 text-zinc-700 dark:text-zinc-300">
                        Style: {s.captionRecommendations.style}
                      </span>
                    )}
                  </div>
                  {s.captionRecommendations.toneAdvice && (
                    <p className="text-xs text-zinc-600 dark:text-zinc-400">{s.captionRecommendations.toneAdvice}</p>
                  )}
                  {s.captionRecommendations.hooks?.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-bold text-zinc-550 dark:text-zinc-500 uppercase tracking-wider">Hook Examples</p>
                      {s.captionRecommendations.hooks.map((hook, i) => (
                        <div key={i} className="bg-zinc-100 dark:bg-zinc-800/40 rounded-lg px-3 py-2 text-xs text-zinc-700 dark:text-zinc-300 italic border border-zinc-200 dark:border-zinc-700/40">
                          "{hook}"
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </SectionCard>
            )}

            {/* Hashtag Recommendations */}
            {s.hashtagRecommendations && (
              <SectionCard icon={Hash} title="Hashtag Strategy" iconColor="text-fuchsia-500 dark:text-fuchsia-400">
                <div className="space-y-3 mt-2">
                  {s.hashtagRecommendations.strategy && (
                    <p className="text-xs text-zinc-600 dark:text-zinc-400">{s.hashtagRecommendations.strategy}</p>
                  )}
                  {s.hashtagRecommendations.suggestedHashtags?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {s.hashtagRecommendations.suggestedHashtags.map((tag, i) => (
                        <span key={i} className="text-xs font-bold px-2.5 py-1 rounded-full bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400 border border-fuchsia-500/20 dark:border-fuchsia-500/30">
                          {tag.startsWith('#') ? tag : `#${tag}`}
                        </span>
                      ))}
                    </div>
                  )}
                  {s.hashtagRecommendations.frequency && (
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-500 flex items-center gap-1">
                      <Info className="h-3 w-3" /> {s.hashtagRecommendations.frequency}
                    </p>
                  )}
                </div>
              </SectionCard>
            )}

            {/* Audience Insights */}
            {s.audienceInsights?.length > 0 && (
              <SectionCard icon={Users} title="Audience Insights" iconColor="text-amber-500 dark:text-amber-400">
                <div className="space-y-3 mt-2">
                  {s.audienceInsights.map((insight, i) => (
                    <div key={i} className="border-l-2 border-amber-500/30 pl-3 space-y-0.5">
                      <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">{insight.insight}</p>
                      {insight.actionable && (
                        <p className="text-xs text-amber-600 dark:text-amber-400">→ {insight.actionable}</p>
                      )}
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}

            {/* Posting Strategy */}
            {s.postingStrategy && (
              <SectionCard icon={Calendar} title="Posting Strategy" iconColor="text-rose-500 dark:text-rose-400">
                <div className="space-y-2.5 mt-2">
                  {s.postingStrategy.bestDays?.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Best Days</p>
                      <div className="flex flex-wrap gap-1.5">
                        {s.postingStrategy.bestDays.map((day, i) => (
                          <span key={i} className="text-xs font-bold px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                            {day}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {s.postingStrategy.bestHours && (
                    <div>
                      <p className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Best Time</p>
                      <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">{s.postingStrategy.bestHours}</p>
                    </div>
                  )}
                  {s.postingStrategy.frequency && (
                    <div>
                      <p className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Frequency</p>
                      <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">{s.postingStrategy.frequency}</p>
                    </div>
                  )}
                  {s.postingStrategy.rationale && (
                    <p className="text-xs text-zinc-600 dark:text-zinc-455 leading-relaxed border-t border-zinc-200 dark:border-zinc-800/50 pt-2">{s.postingStrategy.rationale}</p>
                  )}
                </div>
              </SectionCard>
            )}
          </div>

          {/* Priority Action Items — full width */}
          {s.priorityActions?.length > 0 && (
            <SectionCard icon={Target} title="Priority Action Items" iconColor="text-indigo-505 dark:text-indigo-400" defaultOpen={true}>
              <div className="space-y-3 mt-2">
                {s.priorityActions.map((action, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.06 }}
                    className="flex items-start gap-3 bg-zinc-50 dark:bg-zinc-850/30 rounded-xl p-3.5 border border-zinc-200 dark:border-zinc-800/50 hover:border-zinc-300/80 dark:hover:border-zinc-700/60 transition-colors"
                  >
                    <div className="flex items-center gap-2 shrink-0 pt-0.5">
                      <span className="text-xs font-black text-zinc-400 dark:text-zinc-500 w-4 text-center">{i + 1}</span>
                      <PriorityBadge priority={action.priority} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">{action.action}</p>
                      {action.impact && (
                        <p className="text-xs text-zinc-600 dark:text-zinc-550 mt-0.5 flex items-center gap-1">
                          <TrendingUp className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                          {action.impact}
                        </p>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </SectionCard>
          )}

          {/* Learning enabled notice */}
          {learningEnabled && (
            <div className="flex items-center justify-center gap-2 text-[10px] text-zinc-550 dark:text-zinc-600 py-1">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              AI is learning from your data to improve future suggestions and AI Write output.
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
};

export default AISuggestions;
