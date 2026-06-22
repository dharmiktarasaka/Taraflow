import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

const billingService = {
  checkout: async (plan, gateway) => {
    const token = localStorage.getItem('accessToken');
    if (!token) throw new Error('Authentication required');

    const response = await axios.post(
      `${API_URL}/billing/checkout`,
      { plan, gateway },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  },

  verifyRazorpay: async (payload) => {
    const token = localStorage.getItem('accessToken');
    if (!token) throw new Error('Authentication required');

    const response = await axios.post(
      `${API_URL}/billing/verify-razorpay`,
      payload,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  },

  verifyStripe: async (sessionId) => {
    const token = localStorage.getItem('accessToken');
    if (!token) throw new Error('Authentication required');

    const response = await axios.post(
      `${API_URL}/billing/verify-stripe`,
      { sessionId },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  },

  submitUPIPayment: async (utr, plan) => {
    const token = localStorage.getItem('accessToken');
    if (!token) throw new Error('Authentication required');

    const response = await axios.post(
      `${API_URL}/billing/verify-upi`,
      { utr, plan },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  },

  verifyMockCheckout: async (sessionId, plan) => {
    const token = localStorage.getItem('accessToken');
    if (!token) throw new Error('Authentication required');

    const response = await axios.post(
      `${API_URL}/billing/verify-mock-checkout`,
      { sessionId, plan },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  },

  getInvoices: async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) throw new Error('Authentication required');

    const response = await axios.get(
      `${API_URL}/billing/invoices`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  },

  getProfile: async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) throw new Error('Authentication required');

    const response = await axios.get(
      `${API_URL}/auth/me`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  }
};

export default billingService;
