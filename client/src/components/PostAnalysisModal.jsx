import React, { useState, useEffect } from 'react';
import { 
  X, Copy, Check, Sparkles, Heart, MessageSquare, 
  Share2, Bookmark, Eye, MousePointer, Play, User, 
  BarChart3, Target, Award, AwardIcon, Lightbulb, RefreshCw, AlertCircle
} from 'lucide-react';
import analyticsService from '../services/analyticsService';

const PostAnalysisModal = ({ isOpen, onClose, postId, platform }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [copiedField, setCopiedField] = useState('');
  const [activeTab, setActiveTab] = useState('content');
  const [reposting, setReposting] = useState(false);
  const [repostStatus, setRepostStatus] = useState('idle');
  const [repostError, setRepostError] = useState('');

  const fetchAnalysis = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await analyticsService.getPostAnalysis(postId, platform);
      if (res && res.success) {
        setData(res);
      } else {
        throw new Error('Failed to retrieve post analysis.');
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || err.message || 'An error occurred while fetching analysis.');
    } finally {
      setLoading(false);
    }
  };

  const handleRepost = async () => {
    if (!data) return;
    setReposting(true);
    setRepostStatus('idle');
    setRepostError('');
    try {
      // Merge Caption + CTA + Hashtags as content
      const improvedCaption = data.aiRewrite.improvedCaption || '';
      const improvedCTA = data.aiRewrite.improvedCTA || '';
      const hashtags = data.aiRewrite.improvedHashtags?.join(' ') || '';
      const fullContent = `${improvedCaption}\n\n${improvedCTA}\n\n${hashtags}`;

      // Retrieve calculated optimal posting time
      const nextPostingTime = data.aiSuggestions.nextBestPostingTime || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      await analyticsService.repostWithImprovements(postId, fullContent, nextPostingTime);
      setRepostStatus('success');
    } catch (err) {
      console.error(err);
      setRepostStatus('error');
      setRepostError(err.response?.data?.message || err.message || 'Failed to repost.');
    } finally {
      setReposting(false);
    }
  };

  useEffect(() => {
    if (isOpen && postId) {
      setRepostStatus('idle');
      setRepostError('');
      fetchAnalysis();
    }
  }, [isOpen, postId, platform]);

  if (!isOpen) return null;

  const handleCopy = (text, fieldName) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(''), 2000);
  };

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-emerald-400 stroke-emerald-400';
    if (score >= 60) return 'text-amber-400 stroke-amber-400';
    return 'text-rose-400 stroke-rose-400';
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-zinc-950/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 md:p-8">
      {/* Modal Container */}
      <div className="bg-zinc-950 dark:bg-zinc-900/90 border border-zinc-800 rounded-3xl w-full max-w-6xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-800/40">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 rounded-xl">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white flex items-center">
                Post-Level AI Analysis
              </h2>
              <p className="text-xs text-zinc-550 dark:text-zinc-500 font-semibold uppercase tracking-wider mt-0.5">
                Platform: {platform} • ID: {postId}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-all cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            /* Premium Shimmer Loading State */
            <div className="space-y-8 animate-pulse">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div className="h-64 bg-zinc-800/30 rounded-2xl" />
                  <div className="grid grid-cols-3 gap-4">
                    <div className="h-20 bg-zinc-800/30 rounded-xl" />
                    <div className="h-20 bg-zinc-800/30 rounded-xl" />
                    <div className="h-20 bg-zinc-800/30 rounded-xl" />
                  </div>
                </div>
                <div className="space-y-6">
                  <div className="h-32 bg-zinc-800/30 rounded-2xl" />
                  <div className="h-48 bg-zinc-800/30 rounded-2xl" />
                </div>
              </div>
            </div>
          ) : error ? (
            /* Error Fallback Display */
            <div className="flex flex-col items-center justify-center py-16 space-y-4 text-center">
              <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500">
                <AlertCircle className="h-8 w-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-zinc-200">Analysis Fetch Failed</h3>
                <p className="text-sm text-zinc-400 max-w-sm">{error}</p>
              </div>
              <button 
                onClick={fetchAnalysis}
                className="flex items-center space-x-2 px-4.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white rounded-xl transition-all cursor-pointer shadow-lg shadow-indigo-500/25"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Try Again</span>
              </button>
            </div>
          ) : data ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 text-left">
              
              {/* Left Column: Post Details & Performance */}
              <div className="space-y-6">
                
                {/* Visual Preview & Details */}
                <div className="bg-zinc-950 dark:bg-zinc-900/30 border border-zinc-850 dark:border-zinc-800/60 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-350 border border-white/5 uppercase">
                      {data.post.platform}
                    </span>
                    <span className="text-xs text-zinc-500 font-bold">
                      {new Date(data.post.publishedAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>

                  {/* Media Content Preview */}
                  {data.post.mediaUrl ? (
                    <div className="relative rounded-xl overflow-hidden border border-zinc-850 max-h-72 flex items-center justify-center bg-zinc-950">
                      {data.post.mediaType === 'video' ? (
                        <video 
                          src={data.post.mediaUrl} 
                          controls 
                          className="max-h-72 w-full object-contain"
                        />
                      ) : (
                        <img 
                          src={data.post.mediaUrl} 
                          alt="Post Media Visual" 
                          className="max-h-72 w-full object-contain"
                        />
                      )}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-zinc-850 border-dashed p-8 text-center text-zinc-500 text-xs bg-zinc-950/20">
                      No visual media attachment for this post.
                    </div>
                  )}

                  {/* Caption & Metadata */}
                  <div className="space-y-2.5">
                    <p className="text-sm text-zinc-900 dark:text-zinc-200 leading-relaxed font-medium whitespace-pre-wrap">
                      {data.post.caption}
                    </p>
                    {data.post.permalink && (
                      <a 
                        href={data.post.permalink} 
                        target="_blank" 
                        rel="noreferrer"
                        className="inline-flex items-center space-x-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-semibold hover:underline cursor-pointer"
                      >
                        <span>View original post on {data.post.platform}</span>
                        <X className="h-3 w-3 rotate-45" />
                      </a>
                    )}
                  </div>
                </div>

                {/* Real Analytics Metrics Card Grid */}
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider flex items-center space-x-2">
                    <BarChart3 className="h-4 w-4 text-zinc-500" />
                    <span>Real Performance Metrics</span>
                  </h3>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {[
                      { name: 'Impressions', value: data.post.impressions?.toLocaleString() || 'N/A', icon: Eye, color: 'text-indigo-400' },
                      { name: 'Reach', value: data.post.reach?.toLocaleString() || 'N/A', icon: Share2, color: 'text-sky-400' },
                      { name: 'Engagement Rate', value: `${data.post.engagementRate || 0}%`, icon: Target, color: 'text-emerald-400' },
                      { name: 'Likes', value: data.post.likes?.toLocaleString() || 'N/A', icon: Heart, color: 'text-rose-400' },
                      { name: 'Comments', value: data.post.comments?.toLocaleString() || 'N/A', icon: MessageSquare, color: 'text-violet-400' },
                      { name: 'Shares', value: data.post.shares?.toLocaleString() || 'N/A', icon: Share2, color: 'text-fuchsia-400' },
                      { name: 'Saves', value: data.post.saves?.toLocaleString() || 'N/A', icon: Bookmark, color: 'text-amber-400' },
                      { name: 'Link Clicks', value: data.post.clicks?.toLocaleString() || 'N/A', icon: MousePointer, color: 'text-orange-400' },
                      { name: 'Profile Visits', value: data.post.profileVisits?.toLocaleString() || 'N/A', icon: User, color: 'text-teal-400' }
                    ].map((m, idx) => (
                      <div key={idx} className="bg-zinc-950 dark:bg-zinc-900/40 border border-zinc-850 dark:border-zinc-800/80 rounded-2xl p-4 shadow-sm relative overflow-hidden">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-zinc-550 dark:text-zinc-500 font-bold uppercase tracking-wider">{m.name}</span>
                          <m.icon className={`h-3.5 w-3.5 ${m.color}`} />
                        </div>
                        <div className="mt-2.5">
                          <span className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight">{m.value}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* Right Column: AI Analysis, Score Breakdown, Suggestions & Rewrites */}
              <div className="space-y-6">

                {/* Score Breakdown Section */}
                <div className="bg-zinc-950 dark:bg-zinc-900/40 border border-zinc-850 dark:border-zinc-800/80 rounded-2xl p-5 shadow-sm space-y-4">
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider flex items-center space-x-2">
                    <Award className="h-4 w-4 text-indigo-400 animate-pulse" />
                    <span>AI Score Breakdown</span>
                  </h3>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {[
                      { name: 'Content Score', score: data.aiScores.contentScore },
                      { name: 'Engagement Score', score: data.aiScores.engagementScore },
                      { name: 'Caption Score', score: data.aiScores.captionScore },
                      { name: 'Hashtag Score', score: data.aiScores.hashtagScore },
                      { name: 'Visual Score', score: data.aiScores.visualScore },
                      { name: 'Growth Potential', score: data.aiScores.growthPotentialScore }
                    ].map((s, idx) => (
                      <div key={idx} className="flex flex-col items-center p-3.5 bg-zinc-950/40 rounded-xl border border-zinc-850/40 text-center">
                        <div className="relative flex items-center justify-center w-14 h-14">
                          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                            <path
                              className="text-zinc-800/60 stroke-current"
                              strokeWidth="3"
                              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                              fill="none"
                            />
                            <path
                              className={`stroke-current ${getScoreColor(s.score)}`}
                              strokeWidth="3.2"
                              strokeDasharray={`${s.score}, 100`}
                              strokeLinecap="round"
                              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                              fill="none"
                            />
                          </svg>
                          <span className="absolute text-xs font-extrabold text-zinc-900 dark:text-white">
                            {s.score}
                          </span>
                        </div>
                        <span className="text-[10px] text-zinc-550 dark:text-zinc-450 font-bold uppercase tracking-wider mt-2.5">
                          {s.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tabbed AI Deep-Dive Analysis */}
                <div className="bg-zinc-950 dark:bg-zinc-900/40 border border-zinc-850 dark:border-zinc-800/80 rounded-2xl p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-zinc-850/60 pb-3">
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider flex items-center space-x-2">
                      <Sparkles className="h-4.5 w-4.5 text-indigo-400" />
                      <span>Deep AI Analysis Insights</span>
                    </h3>
                  </div>

                  {/* Tabs select bar */}
                  <div className="flex items-center gap-1 bg-zinc-950 p-1 border border-zinc-850 rounded-xl overflow-x-auto scrollbar-none">
                    {[
                      { id: 'content', label: 'Content' },
                      { id: 'visual', label: 'Visual' },
                      { id: 'engagement', label: 'Engagement' },
                      { id: 'audience', label: 'Audience' }
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          activeTab === tab.id 
                            ? 'bg-zinc-850 text-white' 
                            : 'text-zinc-500 hover:text-zinc-350'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Active Tab Panel */}
                  <div className="pt-2 text-sm text-zinc-800 dark:text-zinc-300 leading-relaxed font-medium space-y-4.5 min-h-[120px]">
                    {activeTab === 'content' && (
                      <div className="space-y-3">
                        <p><strong>Caption Quality:</strong> {data.aiAnalysis.contentAnalysis.captionQuality}</p>
                        <p><strong>Caption Length:</strong> {data.aiAnalysis.contentAnalysis.captionLength}</p>
                        <p><strong>CTA Effectiveness:</strong> {data.aiAnalysis.contentAnalysis.ctaEffectiveness}</p>
                        <p><strong>Structure:</strong> {data.aiAnalysis.contentAnalysis.contentStructure}</p>
                        <p><strong>Topic Relevance:</strong> {data.aiAnalysis.contentAnalysis.topicRelevance}</p>
                        <p><strong>Hashtags:</strong> {data.aiAnalysis.contentAnalysis.hashtagQuality} (Relevance: {data.aiAnalysis.contentAnalysis.hashtagRelevance})</p>
                      </div>
                    )}
                    {activeTab === 'visual' && (
                      <div className="space-y-3">
                        <p><strong>Composition & Branding:</strong> {data.aiAnalysis.visualAnalysis.visualComposition}</p>
                        <p><strong>Branding Consistency:</strong> {data.aiAnalysis.visualAnalysis.brandingConsistency}</p>
                        <p><strong>Content Type:</strong> {data.aiAnalysis.visualAnalysis.contentType}</p>
                        <p><strong>Visual Elements Quality:</strong> {data.aiAnalysis.visualAnalysis.imageQuality}</p>
                        <p><strong>Design & Layout:</strong> {data.aiAnalysis.visualAnalysis.designEffectiveness}</p>
                      </div>
                    )}
                    {activeTab === 'engagement' && (
                      <div className="space-y-3">
                        <p className="text-emerald-400"><strong>Engagement Boosters:</strong> {data.aiAnalysis.engagementAnalysis.droveEngagement}</p>
                        <p className="text-rose-400"><strong>Friction Points:</strong> {data.aiAnalysis.engagementAnalysis.reducedEngagement}</p>
                        <p><strong>Success Factors:</strong> {data.aiAnalysis.engagementAnalysis.performedWell}</p>
                        <p><strong>Low Points Rationale:</strong> {data.aiAnalysis.engagementAnalysis.performedPoorly}</p>
                      </div>
                    )}
                    {activeTab === 'audience' && (
                      <div className="space-y-3">
                        <p><strong>Response Patterns:</strong> {data.aiAnalysis.audienceAnalysis.responsePatterns}</p>
                        <p><strong>Interaction Behavior:</strong> {data.aiAnalysis.audienceAnalysis.interactionBehavior}</p>
                        <p><strong>Resonance Rationale:</strong> {data.aiAnalysis.audienceAnalysis.contentResonance}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* AI Rewrite Suggestions */}
                <div className="bg-zinc-950 dark:bg-zinc-900/40 border border-zinc-850 dark:border-zinc-800/80 rounded-2xl p-5 shadow-sm space-y-4">
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider flex items-center space-x-2">
                    <Sparkles className="h-4.5 w-4.5 text-indigo-400" />
                    <span>AI Rewrite Suggestions</span>
                  </h3>

                  {/* Improved Caption Box */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs font-bold text-zinc-550 dark:text-zinc-455">
                      <span>IMPROVED CAPTION</span>
                      <button
                        onClick={() => handleCopy(data.aiRewrite.improvedCaption, 'caption')}
                        className="flex items-center space-x-1 hover:text-indigo-400 transition-colors cursor-pointer"
                      >
                        {copiedField === 'caption' ? (
                          <>
                            <Check className="h-3 w-3 text-emerald-400" />
                            <span className="text-emerald-400">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />
                            <span>Copy Caption</span>
                          </>
                        )}
                      </button>
                    </div>
                    <div className="p-3 bg-zinc-950 border border-zinc-850 rounded-xl text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed">
                      {data.aiRewrite.improvedCaption}
                    </div>
                  </div>

                  {/* Improved Hashtags Box */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs font-bold text-zinc-550 dark:text-zinc-455">
                      <span>IMPROVED HASHTAGS</span>
                      <button
                        onClick={() => handleCopy(data.aiRewrite.improvedHashtags.join(' '), 'hashtags')}
                        className="flex items-center space-x-1 hover:text-indigo-400 transition-colors cursor-pointer"
                      >
                        {copiedField === 'hashtags' ? (
                          <>
                            <Check className="h-3 w-3 text-emerald-400" />
                            <span className="text-emerald-400">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />
                            <span>Copy Hashtags</span>
                          </>
                        )}
                      </button>
                    </div>
                    <div className="p-3 bg-zinc-950 border border-zinc-850 rounded-xl text-xs text-indigo-400 font-semibold tracking-wide">
                      {data.aiRewrite.improvedHashtags.join(' ')}
                    </div>
                  </div>

                  {/* Improved CTA Box */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs font-bold text-zinc-550 dark:text-zinc-455">
                      <span>IMPROVED CALL TO ACTION (CTA)</span>
                      <button
                        onClick={() => handleCopy(data.aiRewrite.improvedCTA, 'cta')}
                        className="flex items-center space-x-1 hover:text-indigo-400 transition-colors cursor-pointer"
                      >
                        {copiedField === 'cta' ? (
                          <>
                            <Check className="h-3 w-3 text-emerald-400" />
                            <span className="text-emerald-400">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />
                            <span>Copy CTA</span>
                          </>
                        )}
                      </button>
                    </div>
                    <div className="p-3 bg-zinc-950 border border-zinc-850 rounded-xl text-xs text-zinc-300 font-bold">
                      {data.aiRewrite.improvedCTA}
                    </div>
                  </div>

                  {/* Improved Content Strategy */}
                  <div className="space-y-2 pt-1 border-t border-zinc-850/40">
                    <span className="text-xs font-bold text-zinc-550 dark:text-zinc-455 uppercase block">IMPROVED CONTENT STRATEGY</span>
                    <p className="text-xs text-zinc-450 leading-relaxed font-semibold">
                      {data.aiRewrite.improvedContentStrategy}
                    </p>
                  </div>
                </div>

                {/* AI Improvement Suggestions List */}
                <div className="bg-zinc-950 dark:bg-zinc-900/40 border border-zinc-850 dark:border-zinc-800/80 rounded-2xl p-5 shadow-sm space-y-4">
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider flex items-center space-x-2">
                    <Lightbulb className="h-4.5 w-4.5 text-amber-400" />
                    <span>AI Improvement Suggestions</span>
                  </h3>

                  <div className="space-y-4 text-xs font-medium text-zinc-300">
                    <div className="p-3 bg-zinc-950/40 rounded-xl border border-zinc-850/40 space-y-1">
                      <span className="font-bold text-amber-400">HOOK EXAMPLES:</span>
                      <ul className="list-disc pl-4 space-y-1 mt-1 text-zinc-400 font-semibold">
                        {data.aiSuggestions.betterHooks.map((h, i) => (
                          <li key={i}>{h}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="p-3 bg-zinc-950/40 rounded-xl border border-zinc-850/40 space-y-1">
                      <span className="font-bold text-indigo-400">BETTER CAPTION OPTIONS:</span>
                      <ul className="list-disc pl-4 space-y-1 mt-1 text-zinc-400 font-semibold">
                        {data.aiSuggestions.betterCaptions.map((c, i) => (
                          <li key={i}>{c}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="p-3 bg-zinc-950/40 rounded-xl border border-zinc-850/40 space-y-1">
                      <span className="font-bold text-violet-400">BETTER CTA EXAMPLES:</span>
                      <ul className="list-disc pl-4 space-y-1 mt-1 text-zinc-400 font-semibold">
                        {data.aiSuggestions.betterCTAs.map((cta, i) => (
                          <li key={i}>{cta}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 bg-zinc-950/40 rounded-xl border border-zinc-850/40">
                        <span className="font-bold text-sky-400 block mb-1">HASHTAG STRATEGY:</span>
                        <span className="text-zinc-400 text-[11px] leading-relaxed font-semibold">{data.aiSuggestions.hashtagStrategy}</span>
                      </div>
                      <div className="p-3 bg-zinc-950/40 rounded-xl border border-zinc-850/40">
                        <span className="font-bold text-emerald-400 block mb-1">POSTING TIME ADVICE:</span>
                        <span className="text-zinc-400 text-[11px] leading-relaxed font-semibold">{data.aiSuggestions.postingTimeRecommendations}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 bg-zinc-950/40 rounded-xl border border-zinc-850/40">
                        <span className="font-bold text-rose-400 block mb-1">VISUAL/IMAGE ADVICE:</span>
                        <span className="text-zinc-400 text-[11px] leading-relaxed font-semibold">{data.aiSuggestions.imageRecommendations}</span>
                      </div>
                      <div className="p-3 bg-zinc-950/40 rounded-xl border border-zinc-850/40">
                        <span className="font-bold text-purple-400 block mb-1">ENGAGEMENT STRATEGY:</span>
                        <span className="text-zinc-400 text-[11px] leading-relaxed font-semibold">{data.aiSuggestions.engagementStrategy}</span>
                      </div>
                    </div>
                  </div>
                </div>

              </div>

            </div>
          ) : null}
        </div>

        {/* Modal Footer */}
        {data && !loading && (
          <div className="flex items-center justify-end gap-3.5 p-5 border-t border-zinc-850 dark:border-zinc-800/40 bg-zinc-950/40 backdrop-blur-md rounded-b-3xl">
            {repostStatus === 'success' && (
              <span className="text-xs text-emerald-400 font-bold mr-auto">
                ✓ Post successfully scheduled at the recommended time: {new Date(data.aiSuggestions.nextBestPostingTime || Date.now() + 24*60*60*1000).toLocaleString()}!
              </span>
            )}
            {repostStatus === 'error' && (
              <span className="text-xs text-rose-400 font-bold mr-auto">
                ✗ Failed to schedule repost: {repostError}
              </span>
            )}
            
            <button
              onClick={onClose}
              className="px-4.5 py-2 border border-zinc-850 hover:border-zinc-700 bg-zinc-950 text-zinc-400 hover:text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleRepost}
              disabled={reposting || repostStatus === 'success'}
              className="flex items-center space-x-2 px-5 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:from-zinc-800 disabled:to-zinc-800 disabled:text-zinc-650 disabled:border-zinc-900 disabled:cursor-not-allowed text-xs font-bold text-white rounded-xl shadow-lg shadow-indigo-500/25 transition-all cursor-pointer"
            >
              {reposting ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Scheduling...</span>
                </>
              ) : repostStatus === 'success' ? (
                <span>Repost Scheduled!</span>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5 animate-pulse" />
                  <span>Accept & Repost with AI Improvements</span>
                </>
              )}
            </button>
          </div>
        )}

      </div>
    </div>
  );
};

export default PostAnalysisModal;
