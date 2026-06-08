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
  }
};

export default analyticsService;
