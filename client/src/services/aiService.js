import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

const aiService = {
  /**
   * General generation endpoint
   * @param {string} type - 'caption' | 'post' | 'comment' | 'hashtags' | 'hook' | 'rewrite' | 'translate'
   * @param {object} options - Options specific to the generation type
   */
  generate: async (type, options) => {
    const token = localStorage.getItem('accessToken');
    if (!token) throw new Error('Authentication required');

    const response = await axios.post(
      `${API_URL}/ai/generate`,
      { type, options },
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    return response.data;
  },

  getBrandProfile: async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) throw new Error('Authentication required');

    const response = await axios.get(
      `${API_URL}/brand-profile`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    return response.data;
  },

  saveBrandProfile: async (profileData) => {
    const token = localStorage.getItem('accessToken');
    if (!token) throw new Error('Authentication required');

    const response = await axios.post(
      `${API_URL}/brand-profile`,
      profileData,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    return response.data;
  }
};

export default aiService;
