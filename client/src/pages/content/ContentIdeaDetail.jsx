import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import contentService from '../../services/contentService';

const ContentIdeaDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [idea, setIdea] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchIdea();
  }, [id]);

  const fetchIdea = async () => {
    setLoading(true);
    try {
      const data = await contentService.getContentIdeaById(id);
      setIdea(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch content idea');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (updatedData) => {
    try {
      const updatedIdea = await contentService.updateContentIdea(id, updatedData);
      setIdea(updatedIdea);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update content idea');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this content idea?')) {
      return;
    }
    try {
      await contentService.deleteContentIdea(id);
      navigate('/content/ideas');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete content idea');
    }
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-16rem)] flex items-center justify-center">
        <div className="animate-pulse">
          <div className="space-y-4 text-center">
            <div className="h-8 w-8 rounded bg-indigo-200 mx-auto" />
            <h3 className="text-lg font-medium text-gray-900">Loading content idea...</h3>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[calc(100vh-16rem)] flex flex-col items-center justify-center p-6">
        <div className="space-y-6 text-center">
          <div className="h-12 w-12 rounded bg-red-200 flex items-center justify-center mx-auto">
            <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.001M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900">Something went wrong</h2>
          <p className="text-sm text-gray-500">
            {error}
          </p>
          <Link
            to="/content/ideas"
            className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            Back to Ideas
          </Link>
        </div>
      </div>
    );
  }

  if (!idea) {
    return (
      <div className="min-h-[calc(100vh-16rem)] flex flex-col items-center justify-center p-6">
        <div className="space-y-4 text-center">
          <p className="text-gray-500">Content idea not found</p>
          <Link
            to="/content/ideas"
            className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            Back to Ideas
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{idea.title}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {idea.status.charAt(0).toUpperCase() + idea.status.slice(1)} •
            {idea.platform ? idea.platform.charAt(0).toUpperCase() + idea.platform.slice(1) : 'No platform'} •
            {idea.contentType ? idea.contentType.charAt(0).toUpperCase() + idea.contentType.slice(1) : 'No type'}
          </p>
        </div>
        <div className="flex space-x-3">
          <Link
            to="/content/ideas"
            className="px-3 py-1 text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            Back to Ideas
          </Link>
          <button
            onClick={() => navigate(`/content/ideas/${id}/edit`)}
            className="px-3 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            Edit
          </button>
        </div>
      </div>

      {/* Status badge */}
      <div className="flex items-center space-x-3 mb-6">
        <div className={`h-8 w-8 flex-shrink-0 rounded ${
          idea.status === 'idea' ? 'bg-gray-100' :
          idea.status === 'approved' ? 'bg-green-100' :
          idea.status === 'scheduled' ? 'bg-blue-100' :
          idea.status === 'published' ? 'bg-purple-100' :
          'bg-red-100'
        } flex items-center justify-center`}>
          <span className={`${
            idea.status === 'idea' ? 'text-gray-600' :
            idea.status === 'approved' ? 'text-green-600' :
            idea.status === 'scheduled' ? 'text-blue-600' :
            idea.status === 'published' ? 'text-purple-600' :
            'text-red-600'
          } text-xs font-medium`}>
            {idea.status.charAt(0).toUpperCase() + idea.status.slice(1)}
          </span>
        </div>
        <p className="text-sm font-medium text-gray-700">Status</p>
      </div>

      {/* Content */}
      <div className="bg-white rounded-xl shadow p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Description</h2>
        <p className="text-gray-700 leading-relaxed">
          {idea.description || 'No description provided'}
        </p>
      </div>

      {/* Details */}
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="bg-white rounded-xl shadow p-4">
          <h3 className="text-lg font-medium text-gray-900 mb-3">Details</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Content Type:</span>
              <span className="font-medium text-gray-900">
                {idea.contentType ? idea.contentType.charAt(0).toUpperCase() + idea.contentType.slice(1) : 'Not specified'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Platform:</span>
              <span className="font-medium text-gray-900">
                {idea.platform ? idea.platform.charAt(0).toUpperCase() + idea.platform.slice(1) : 'Not specified'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">AI Generated:</span>
              <span className="font-medium text-gray-900">
                {idea.aiGenerated ? 'Yes' : 'No'}
              </span>
            </div>
            {idea.promptUsed && (
              <div className="flex justify-between mt-2">
                <span className="text-sm text-gray-500">AI Prompt:</span>
                <span className="font-medium text-gray-900 block">{idea.promptUsed}</span>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-4">
          <h3 className="text-lg font-medium text-gray-900 mb-3">Scheduling</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Scheduled For:</span>
              <span className="font-medium text-gray-900">
                {idea.scheduledFor ? new Date(idea.scheduledFor).toLocaleString() : 'Not scheduled'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Published At:</span>
              <span className="font-medium text-gray-900">
                {idea.publishedAt ? new Date(idea.publishedAt).toLocaleString() : 'Not published'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tags */}
      {idea.tags && idea.tags.length > 0 && (
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Tags</h2>
          <div className="flex flex-wrap gap-2">
            {idea.tags.map((tag, index) => (
              <span key={index} className="px-3 py-1 text-sm font-medium bg-gray-100 text-gray-800 rounded">
                #{tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end space-x-3">
        {idea.status === 'idea' && (
          <button
            onClick={() => {
              // Schedule the idea
              contentService.scheduleContentIdea(id, {
                scheduledFor: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
                platform: idea.platform || 'instagram'
              }).then(() => {
                // Refresh the idea data
                fetchIdea();
              });
            }}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            Schedule for Tomorrow
          </button>
        )}
        <button
          onClick={handleDelete}
          className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
        >
          Delete Idea
        </button>
      </div>
    </div>
  );
};

export default ContentIdeaDetail;