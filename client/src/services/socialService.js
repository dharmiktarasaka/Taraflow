import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

const getHeaders = () => {
  const token = localStorage.getItem('accessToken');
  if (!token) throw new Error('No access token found. Please log in.');
  return { Authorization: `Bearer ${token}` };
};

const socialService = {
  getAccounts: async () => {
    const response = await axios.get(`${API_URL}/social/accounts`, {
      headers: getHeaders(),
    });
    return response.data;
  },

  getConnectUrl: async (platform) => {
    const response = await axios.get(`${API_URL}/social/connect/${platform}`, {
      headers: getHeaders(),
    });
    return response.data;
  },

  reconnectAccount: async (platform) => {
    const response = await axios.get(`${API_URL}/social/reconnect/${platform}`, {
      headers: getHeaders(),
    });
    return response.data;
  },

  callback: async (platform, code) => {
    const response = await axios.post(
      `${API_URL}/social/callback/${platform}`,
      { code },
      { headers: getHeaders() }
    );
    return response.data;
  },

  disconnectAccount: async (id) => {
    const response = await axios.delete(`${API_URL}/social/accounts/${id}`, {
      headers: getHeaders(),
    });
    return response.data;
  },
};

export default socialService;
