import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

const analyticsService = {
  getOverview: async (filters = {}) => {
    const token = localStorage.getItem('accessToken');
    if (!token) throw new Error('Authentication required');

    const params = new URLSearchParams(filters);
    const response = await axios.get(`${API_URL}/analytics/overview?${params}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  },

  getTopPosts: async (filters = {}) => {
    const token = localStorage.getItem('accessToken');
    if (!token) throw new Error('Authentication required');

    const params = new URLSearchParams(filters);
    const response = await axios.get(`${API_URL}/analytics/top-posts?${params}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  },

  seedMetrics: async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) throw new Error('Authentication required');

    const response = await axios.post(`${API_URL}/analytics/seed`, {}, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  },

  getPostAnalysis: async (id, platform, mediaUrl, mediaType) => {
    const token = localStorage.getItem('accessToken');
    if (!token) throw new Error('Authentication required');

    const params = { platform };
    if (mediaUrl) params.mediaUrl = mediaUrl;
    if (mediaType) params.mediaType = mediaType;

    const response = await axios.get(`${API_URL}/analytics/posts/${id}/analysis`, {
      params,
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  },

  repostWithImprovements: async (id, content, scheduledAt) => {
    const token = localStorage.getItem('accessToken');
    if (!token) throw new Error('Authentication required');

    const response = await axios.post(`${API_URL}/analytics/posts/${id}/repost`, { content, scheduledAt }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  },

  // ── AI Suggestions & Continuous Learning ──────────────────────────────────

  /**
   * Generate AI suggestions from real analytics data.
   * @param {string} platform - 'all' | 'linkedin' | 'instagram' | 'facebook' | 'threads'
   * @param {boolean} refresh - Force bypass cache
   */
  getSuggestions: async (platform = 'all', refresh = false) => {
    const token = localStorage.getItem('accessToken');
    if (!token) throw new Error('Authentication required');

    const response = await axios.get(`${API_URL}/ai-suggestions`, {
      params: { platform, refresh },
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  },

  /**
   * Get the user's current AI learning profile (for transparency UI).
   */
  getLearningProfile: async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) throw new Error('Authentication required');

    const response = await axios.get(`${API_URL}/ai-suggestions/learning-profile`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  },

  /**
   * Toggle AI learning on/off (GDPR opt-in/opt-out).
   * @param {boolean} enabled
   */
  updateLearningConsent: async (enabled) => {
    const token = localStorage.getItem('accessToken');
    if (!token) throw new Error('Authentication required');

    const response = await axios.patch(
      `${API_URL}/ai-suggestions/learning-profile`,
      { learningEnabled: enabled },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  },

  /**
   * Hard-delete the user's learning profile (GDPR erasure).
   */
  deleteLearningData: async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) throw new Error('Authentication required');

    const response = await axios.delete(`${API_URL}/ai-suggestions/learning-profile`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  }
};

export default analyticsService;
