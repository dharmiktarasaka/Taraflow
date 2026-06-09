import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import contentService from '../../services/contentService';

const ContentIdeaForm = () => {
  const { id } = useParams(); // If present, we are in Edit mode
  const navigate = useNavigate();
  const isEditMode = !!id;

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: 'idea',
    platform: 'facebook',
    contentType: 'post',
    tags: '',
    aiGenerated: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isEditMode) {
      fetchIdea();
    }
  }, [id]);

  const fetchIdea = async () => {
    setLoading(true);
    try {
      const data = await contentService.getContentIdeaById(id);
      setFormData({
        title: data.title || '',
        description: data.description || '',
        status: data.status || 'idea',
        platform: data.platform || 'facebook',
        contentType: data.contentType || 'post',
        tags: data.tags ? data.tags.join(', ') : '',
        aiGenerated: data.aiGenerated || false,
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch content idea details');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Parse comma-separated tags
    const tagsArray = formData.tags
      ? formData.tags.split(',').map((tag) => tag.trim().replace(/^#/, '')).filter(Boolean)
      : [];

    const payload = {
      ...formData,
      tags: tagsArray,
    };

    try {
      if (isEditMode) {
        await contentService.updateContentIdea(id, payload);
      } else {
        await contentService.createContentIdea(payload);
      }
      navigate('/content/ideas');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save content idea');
    } finally {
      setLoading(false);
    }
  };

  if (loading && isEditMode) {
    return (
      <div className="min-h-[calc(100vh-16rem)] flex items-center justify-center">
        <div className="animate-pulse space-y-4 text-center">
          <div className="h-8 w-8 rounded bg-indigo-200 mx-auto" />
          <h3 className="text-lg font-medium text-gray-900">Loading form details...</h3>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-md overflow-hidden p-6 sm:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {isEditMode ? 'Edit Content Idea' : 'Create New Content Idea'}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {isEditMode ? 'Update your content idea parameters below.' : 'Draft a new post idea or prepare a prompt for scheduling.'}
        </p>
      </div>

      {error && (
        <div className="bg-red-50 text-red-500 p-4 rounded-lg mb-6">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
          <input
            type="text"
            name="title"
            required
            value={formData.title}
            onChange={handleChange}
            placeholder="e.g. 10 Tips to Learn Tailwind CSS"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            name="description"
            rows="4"
            value={formData.description}
            onChange={handleChange}
            placeholder="What is this idea about? Draft some lines..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Platform</label>
            <select
              name="platform"
              value={formData.platform}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="facebook">Facebook</option>
              <option value="instagram">Instagram</option>
              <option value="linkedin">LinkedIn</option>
              <option value="threads">Threads</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Content Type</label>
            <select
              name="contentType"
              value={formData.contentType}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="post">Post</option>
              <option value="carousel">Carousel</option>
              <option value="video">Video</option>
              <option value="story">Story</option>
              <option value="reel">Reel</option>
            </select>
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              name="status"
              value={formData.status}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="idea">Idea</option>
              <option value="approved">Approved</option>
              <option value="scheduled">Scheduled</option>
              <option value="published">Published</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tags (comma separated)</label>
            <input
              type="text"
              name="tags"
              value={formData.tags}
              onChange={handleChange}
              placeholder="e.g. dev, web, design"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            name="aiGenerated"
            id="aiGenerated"
            checked={formData.aiGenerated}
            onChange={handleChange}
            className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
          />
          <label htmlFor="aiGenerated" className="ml-2 block text-sm text-gray-900">
            Generate using AI helper
          </label>
        </div>

        <div className="flex justify-end space-x-3 border-t pt-6">
          <Link
            to="/content/ideas"
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {loading ? 'Saving...' : isEditMode ? 'Update Idea' : 'Create Idea'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ContentIdeaForm;
