import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Sparkles, Trash2, Calendar, Eye, RefreshCw, Sparkle, Plus } from 'lucide-react';
import contentService from '../../services/contentService';

const ContentIdeas = () => {
  const [ideas, setIdeas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    status: '',
    platform: '',
    contentType: '',
    tag: '',
  });
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  // Fetch ideas on mount or when filters change
  useEffect(() => {
    fetchIdeas();
  }, [filters, searchTerm]);

  const fetchIdeas = async () => {
    setLoading(true);
    try {
      const filterParams = { ...filters };
      // Remove empty filters
      Object.keys(filterParams).forEach(
        (key) => filterParams[key] === '' && delete filterParams[key]
      );

      if (searchTerm) {
        filterParams.title = { $regex: searchTerm, $options: 'i' };
      }

      const data = await contentService.getContentIdeas(filterParams);
      setIdeas(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch content ideas');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this content idea?')) {
      return;
    }
    try {
      await contentService.deleteContentIdea(id);
      setIdeas(ideas.filter(idea => idea._id !== id));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete content idea');
    }
  };

  const handleSchedule = async (id) => {
    try {
      await contentService.scheduleContentIdea(id, {
        scheduledFor: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
        platform: 'instagram' // Default platform
      });
      fetchIdeas(); // Refresh the list
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to schedule content idea');
    }
  };

  const hasActiveFilters = filters.status || filters.platform || filters.contentType || filters.tag;

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4 text-center">
          <RefreshCw className="h-8 w-8 text-indigo-500 animate-spin" />
          <p className="text-zinc-500 dark:text-zinc-400 text-sm font-medium">Fetching creative ideas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 py-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-700 dark:from-white dark:via-zinc-100 dark:to-zinc-400 bg-clip-text text-transparent flex items-center space-x-3">
            <Sparkle className="h-8 w-8 text-indigo-400 animate-pulse" />
            <span>Content Studio</span>
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            Brainstorm, draft, filter, and schedule your social media content ideas.
          </p>
        </div>

        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-initial">
            <input
              type="text"
              placeholder="Search ideas..."
              className="w-full sm:w-64 rounded-xl border border-zinc-800 bg-zinc-950 py-2.5 pl-3 pr-4 text-sm text-zinc-200 placeholder-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Link
            to="/content/ideas/create"
            className="flex items-center space-x-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold text-white rounded-xl shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>New Idea</span>
          </Link>
        </div>
      </div>

      {/* Status messages */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-5 border-b border-zinc-800/50 pb-3">
          <h2 className="text-base font-bold text-zinc-900 dark:text-white">Filter Ideas</h2>
          {hasActiveFilters && (
            <button
              onClick={() => setFilters({status: '', platform: '', contentType: '', tag: ''})}
              className="flex items-center space-x-1 px-3 py-1 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
            >
              <RefreshCw className="h-3 w-3" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>
        
        <div className="grid gap-4 sm:grid-cols-4">
          <div>
            <label className="block text-xs text-zinc-555 font-bold uppercase tracking-wider mb-2">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({...filters, status: e.target.value})}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 py-2.5 px-3 text-sm text-zinc-200 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
            >
              <option value="">All Statuses</option>
              <option value="idea">Idea</option>
              <option value="approved">Approved</option>
              <option value="scheduled">Scheduled</option>
              <option value="published">Published</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-zinc-555 font-bold uppercase tracking-wider mb-2">Platform</label>
            <select
              value={filters.platform}
              onChange={(e) => setFilters({...filters, platform: e.target.value})}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 py-2.5 px-3 text-sm text-zinc-200 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
            >
              <option value="">All Platforms</option>
              <option value="facebook">Facebook</option>
              <option value="instagram">Instagram</option>
              <option value="linkedin">LinkedIn</option>
              <option value="threads">Threads</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-zinc-555 font-bold uppercase tracking-wider mb-2">Content Type</label>
            <select
              value={filters.contentType}
              onChange={(e) => setFilters({...filters, contentType: e.target.value})}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 py-2.5 px-3 text-sm text-zinc-200 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
            >
              <option value="">All Types</option>
              <option value="post">Post</option>
              <option value="carousel">Carousel</option>
              <option value="video">Video</option>
              <option value="story">Story</option>
              <option value="reel">Reel</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-zinc-555 font-bold uppercase tracking-wider mb-2">Tag</label>
            <input
              type="text"
              placeholder="Enter tag..."
              value={filters.tag}
              onChange={(e) => setFilters({...filters, tag: e.target.value})}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 py-2.5 px-3 text-sm text-zinc-200 placeholder-zinc-650 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
            />
          </div>
        </div>
      </div>

      {/* Ideas List */}
      <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-6">
        <h2 className="text-base font-bold text-zinc-900 dark:text-white mb-6">Your Ideas ({ideas.length})</h2>
        {ideas.length === 0 ? (
          <div className="text-center text-zinc-500 py-12">
            <Sparkles className="h-10 w-10 mx-auto text-zinc-800 mb-3" />
            <p className="text-sm">No content ideas found. Create your first idea above.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {ideas.map((idea) => (
              <div 
                key={idea._id} 
                className="p-5 bg-zinc-900/10 dark:bg-zinc-950/20 border border-zinc-200 dark:border-zinc-800/60 rounded-2xl hover:border-zinc-300 dark:hover:border-zinc-700/60 hover:bg-zinc-900/20 dark:hover:bg-zinc-900/10 transition-all group flex flex-col sm:flex-row justify-between items-start sm:items-center gap-5"
              >
                <div className="flex-1 min-w-0 space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    {/* Status Badge */}
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border shrink-0 ${
                      idea.status === 'idea' ? 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800/40 dark:text-zinc-400 border-zinc-250 dark:border-zinc-700/50' :
                      idea.status === 'approved' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' :
                      idea.status === 'scheduled' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' :
                      idea.status === 'published' ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20' :
                      'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                    }`}>
                      {idea.status}
                    </span>
                    
                    <h3 className="font-bold text-zinc-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors text-base sm:text-lg truncate">
                      {idea.title}
                    </h3>
                  </div>

                  <p className="text-sm text-zinc-550 dark:text-zinc-400 line-clamp-2 max-w-3xl">
                    {idea.description || 'No description provided.'}
                  </p>

                  <div className="flex flex-wrap gap-2 text-xs">
                    {idea.platform && (
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                        idea.platform === 'facebook' ? 'bg-blue-500/10 border-blue-500/20 text-blue-500 dark:text-blue-400' :
                        idea.platform === 'instagram' ? 'bg-pink-500/10 border-pink-500/20 text-pink-500 dark:text-pink-400' :
                        idea.platform === 'linkedin' ? 'bg-sky-500/10 border-sky-500/20 text-sky-600 dark:text-sky-400' :
                        idea.platform === 'threads' ? 'bg-zinc-800/10 border-zinc-800/20 text-zinc-800 dark:text-zinc-200' :
                        'bg-zinc-500/10 border-zinc-500/20 text-zinc-650 dark:text-zinc-300'
                      } capitalize`}>
                        {idea.platform}
                      </span>
                    )}
                    {idea.contentType && (
                      <span className="px-2.5 py-1 rounded-lg text-xs font-semibold border border-zinc-250 dark:border-zinc-800/60 bg-zinc-50 dark:bg-zinc-900/30 text-zinc-550 dark:text-zinc-400 capitalize">
                        {idea.contentType}
                      </span>
                    )}
                    {idea.aiGenerated && (
                      <span className="flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-semibold border border-indigo-500/25 bg-indigo-500/10 text-indigo-500 dark:text-indigo-400">
                        <Sparkles className="h-3 w-3" />
                        <span>AI Drafted</span>
                      </span>
                    )}
                    {idea.tags && idea.tags.length > 0 && (
                      idea.tags.map((tag, index) => (
                        <span key={index} className="px-2.5 py-1 rounded-lg text-xs font-semibold border border-zinc-250 dark:border-zinc-800/60 bg-zinc-50 dark:bg-zinc-900/30 text-zinc-550 dark:text-zinc-400">
                          #{tag}
                        </span>
                      ))
                    )}
                  </div>
                </div>
                
                <div className="flex items-center space-x-2.5 self-end sm:self-auto shrink-0">
                  <button
                    onClick={() => navigate(`/content/ideas/${idea._id}`)}
                    className="flex items-center space-x-1 px-3 py-2 text-xs font-semibold border border-zinc-250 dark:border-zinc-800/60 hover:border-zinc-350 dark:hover:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 rounded-xl transition-all cursor-pointer"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span>View</span>
                  </button>
                  {idea.status === 'idea' && (
                    <>
                      <button
                        onClick={() => handleSchedule(idea._id)}
                        className="flex items-center space-x-1 px-3 py-2 text-xs font-semibold border border-transparent bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow shadow-indigo-500/10 transition-all cursor-pointer"
                      >
                        <Calendar className="h-3.5 w-3.5" />
                        <span>Schedule</span>
                      </button>
                      <button
                        onClick={() => handleDelete(idea._id)}
                        className="flex items-center justify-center p-2 text-xs font-semibold border border-transparent hover:bg-rose-500/10 text-rose-500 dark:text-rose-400 rounded-xl transition-all cursor-pointer"
                        title="Delete Idea"
                      >
                        <Trash2 className="h-4.5 w-4.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ContentIdeas;