import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

const getHeaders = (workspaceId = null) => {
  const token = localStorage.getItem('accessToken');
  const headers = { Authorization: `Bearer ${token}` };
  if (workspaceId) {
    headers['X-Workspace-ID'] = workspaceId;
  }
  return headers;
};

const workspaceService = {
  createWorkspace: async (name, logoUrl = '') => {
    const response = await axios.post(
      `${API_URL}/workspace`,
      { name, logoUrl },
      { headers: getHeaders() }
    );
    return response.data;
  },

  getWorkspaces: async () => {
    const response = await axios.get(
      `${API_URL}/workspace`,
      { headers: getHeaders() }
    );
    return response.data;
  },

  getWorkspaceMembers: async (workspaceId) => {
    const response = await axios.get(
      `${API_URL}/workspace/${workspaceId}/members`,
      { headers: getHeaders(workspaceId) }
    );
    return response.data;
  },

  inviteMember: async (workspaceId, payload) => {
    const response = await axios.post(
      `${API_URL}/workspace/${workspaceId}/invite`,
      payload,
      { headers: getHeaders(workspaceId) }
    );
    return response.data;
  },

  resendInvitation: async (workspaceId, email, role = 'Viewer', expirationHours = 24) => {
    const response = await axios.post(
      `${API_URL}/workspace/${workspaceId}/invite/resend`,
      { email, role, expirationHours },
      { headers: getHeaders(workspaceId) }
    );
    return response.data;
  },

  getInvitation: async (token) => {
    const response = await axios.get(
      `${API_URL}/workspace/invite/${token}`
    );
    return response.data;
  },

  acceptInvitation: async (token, payload) => {
    const response = await axios.post(
      `${API_URL}/workspace/invite/${token}/accept`,
      payload
    );
    return response.data;
  },

  removeMember: async (workspaceId, memberId) => {
    const response = await axios.delete(
      `${API_URL}/workspace/${workspaceId}/members/${memberId}`,
      { headers: getHeaders(workspaceId) }
    );
    return response.data;
  },

  changeRole: async (workspaceId, memberId, role) => {
    const response = await axios.put(
      `${API_URL}/workspace/${workspaceId}/members/${memberId}/role`,
      { role },
      { headers: getHeaders(workspaceId) }
    );
    return response.data;
  },

  updatePermissions: async (workspaceId, memberId, customPermissions) => {
    const response = await axios.put(
      `${API_URL}/workspace/${workspaceId}/members/${memberId}/permissions`,
      { customPermissions },
      { headers: getHeaders(workspaceId) }
    );
    return response.data;
  },

  suspendMember: async (workspaceId, memberId, suspend) => {
    const response = await axios.put(
      `${API_URL}/workspace/${workspaceId}/members/${memberId}/suspend`,
      { suspend },
      { headers: getHeaders(workspaceId) }
    );
    return response.data;
  },

  getAuditLogs: async (workspaceId) => {
    const response = await axios.get(
      `${API_URL}/workspace/${workspaceId}/audit-logs`,
      { headers: getHeaders(workspaceId) }
    );
    return response.data;
  },

  getSessions: async (workspaceId, userId) => {
    const response = await axios.get(
      `${API_URL}/workspace/${workspaceId}/sessions/${userId}`,
      { headers: getHeaders(workspaceId) }
    );
    return response.data;
  },

  revokeSession: async (workspaceId, userId, tokenHash) => {
    const response = await axios.post(
      `${API_URL}/workspace/${workspaceId}/sessions/${userId}/revoke`,
      { tokenHash },
      { headers: getHeaders(workspaceId) }
    );
    return response.data;
  },

  updateSettings: async (workspaceId, name, logoUrl) => {
    const response = await axios.put(
      `${API_URL}/workspace/${workspaceId}/settings`,
      { name, logoUrl },
      { headers: getHeaders(workspaceId) }
    );
    return response.data;
  }
};

export default workspaceService;
