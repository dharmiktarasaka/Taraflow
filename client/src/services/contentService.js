import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

const contentService = {
  // Get all content ideas
  getContentIdeas: async (filters = {}) => {
    const token = localStorage.getItem('accessToken');
    if (!token) throw new Error('No access token');

    const params = new URLSearchParams(filters);
    const response = await axios.get(`${API_URL}/content/ideas?${params}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  },

  // Create a new content idea
  createContentIdea: async (ideaData) => {
    const token = localStorage.getItem('accessToken');
    if (!token) throw new Error('No access token');

    const response = await axios.post(`${API_URL}/content/ideas`, ideaData, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  },

  // Get a single content idea by ID
  getContentIdeaById: async (id) => {
    const token = localStorage.getItem('accessToken');
    if (!token) throw new Error('No access token');

    const response = await axios.get(`${API_URL}/content/ideas/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  },

  // Update a content idea
  updateContentIdea: async (id, ideaData) => {
    const token = localStorage.getItem('accessToken');
    if (!token) throw new Error('No access token');

    const response = await axios.put(`${API_URL}/content/ideas/${id}`, ideaData, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  },

  // Delete a content idea
  deleteContentIdea: async (id) => {
    const token = localStorage.getItem('accessToken');
    if (!token) throw new Error('No access token');

    const response = await axios.delete(`${API_URL}/content/ideas/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  },

  // Schedule a content idea
  scheduleContentIdea: async (id, scheduleData) => {
    const token = localStorage.getItem('accessToken');
    if (!token) throw new Error('No access token');

    const response = await axios.post(`${API_URL}/content/ideas/${id}/schedule`, scheduleData, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  },

  // Get all posts
  getPosts: async (filters = {}) => {
    const token = localStorage.getItem('accessToken');
    if (!token) throw new Error('No access token');

    const params = new URLSearchParams(filters);
    const response = await axios.get(`${API_URL}/content/posts?${params}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  },

  // Create a new post
  createPost: async (postData) => {
    const token = localStorage.getItem('accessToken');
    if (!token) throw new Error('No access token');

    const response = await axios.post(`${API_URL}/content/posts`, postData, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  },

  // Get a single post by ID
  getPostById: async (id) => {
    const token = localStorage.getItem('accessToken');
    if (!token) throw new Error('No access token');

    const response = await axios.get(`${API_URL}/content/posts/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  },

  // Update a post
  updatePost: async (id, postData) => {
    const token = localStorage.getItem('accessToken');
    if (!token) throw new Error('No access token');

    const response = await axios.put(`${API_URL}/content/posts/${id}`, postData, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  },

  // Delete a post
  deletePost: async (id) => {
    const token = localStorage.getItem('accessToken');
    if (!token) throw new Error('No access token');

    const response = await axios.delete(`${API_URL}/content/posts/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  },

  // Publish a post immediately
  publishPostNow: async (id) => {
    const token = localStorage.getItem('accessToken');
    if (!token) throw new Error('No access token');

    const response = await axios.post(`${API_URL}/content/posts/${id}/publish-now`, {}, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  },
};

export default contentService;