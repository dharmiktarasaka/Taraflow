import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

const getHeaders = () => {
  const token = localStorage.getItem('accessToken');
  const adminKey = sessionStorage.getItem('adminAccessKey') || '';
  return {
    Authorization: `Bearer ${token}`,
    'x-admin-key': adminKey
  };
};

const adminService = {
  getDashboardStats: async () => {
    const response = await axios.get(`${API_URL}/admin/stats`, { headers: getHeaders() });
    return response.data;
  },

  getUsers: async (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    const response = await axios.get(`${API_URL}/admin/users?${params}`, { headers: getHeaders() });
    return response.data;
  },

  updateUserRole: async (userId, role) => {
    const response = await axios.patch(
      `${API_URL}/admin/users/${userId}/role`,
      { role },
      { headers: getHeaders() }
    );
    return response.data;
  },

  updateUserStatus: async (userId, isActive) => {
    const response = await axios.patch(
      `${API_URL}/admin/users/${userId}/status`,
      { isActive },
      { headers: getHeaders() }
    );
    return response.data;
  },

  manualOverrideSubscription: async (userId, subscriptionData) => {
    const response = await axios.patch(
      `${API_URL}/admin/users/${userId}/subscription`,
      subscriptionData,
      { headers: getHeaders() }
    );
    return response.data;
  },

  getAIUsageStats: async () => {
    const response = await axios.get(`${API_URL}/admin/ai-usage`, { headers: getHeaders() });
    return response.data;
  },

  getAuditLogs: async () => {
    const response = await axios.get(`${API_URL}/admin/audit-logs`, { headers: getHeaders() });
    return response.data;
  }
};

export default adminService;
