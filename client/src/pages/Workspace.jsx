import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, Plus, Mail, ShieldAlert, Key, Settings, Activity, ShieldCheck, 
  Trash2, Edit, AlertTriangle, Play, Pause, ChevronRight, Laptop, 
  Globe, Clock, Search, X, Loader2, Sparkles, CreditCard, HardDrive,
  CheckCircle
} from 'lucide-react';
import { useData } from '../context/DataContext';
import workspaceService from '../services/workspaceService';

const ALL_PERMISSIONS = [
  { key: 'contentStudio', label: 'Content Studio', category: 'Content' },
  { key: 'aiWriter', label: 'AI Writer', category: 'Content' },
  { key: 'imageGenerator', label: 'Image Generator', category: 'Content' },
  { key: 'contentCalendar', label: 'Content Calendar', category: 'Content' },
  { key: 'postScheduling', label: 'Post Scheduling', category: 'Content' },
  { key: 'approvals', label: 'Approvals', category: 'Content' },
  { key: 'mediaLibrary', label: 'Media Library', category: 'Content' },
  
  { key: 'analytics', label: 'Analytics', category: 'Analytics' },
  { key: 'competitorAI', label: 'AI Competitor Intelligence', category: 'Analytics' },
  { key: 'reports', label: 'Reports', category: 'Analytics' },
  
  { key: 'connectedAccounts', label: 'Connected Accounts', category: 'Integrations' },
  { key: 'integrations', label: 'Integrations', category: 'Integrations' },
  
  { key: 'seo', label: 'SEO', category: 'Marketing' },
  { key: 'googleBusiness', label: 'Google Business Profile', category: 'Marketing' },
  { key: 'reviewManagement', label: 'Review Management', category: 'Marketing' },
  { key: 'emailAutomation', label: 'Email Automation', category: 'Marketing' },
  { key: 'whatsappAutomation', label: 'WhatsApp Automation', category: 'Marketing' },
  
  { key: 'workspace', label: 'Workspace Management', category: 'Settings' },
  { key: 'team', label: 'Team Management', category: 'Settings' },
  { key: 'settings', label: 'Settings', category: 'Settings' },
  { key: 'transferOwnership', label: 'Transfer Ownership', category: 'Settings' },
  { key: 'deleteWorkspace', label: 'Delete Workspace', category: 'Settings' },
  
  { key: 'billing', label: 'Billing', category: 'Billing' },
  { key: 'subscription', label: 'Subscription', category: 'Billing' },
  { key: 'billingOwner', label: 'Billing Owner', category: 'Billing' },
  
  { key: 'apiKeys', label: 'API Keys', category: 'Developer' },
  { key: 'developerTools', label: 'Developer Tools', category: 'Developer' },
  
  { key: 'adminDashboard', label: 'Admin Dashboard', category: 'General' },
  { key: 'readOnly', label: 'Read Only', category: 'General' }
];

const PERMISSION_CATEGORIES = ['Content', 'Analytics', 'Marketing', 'Integrations', 'Settings', 'Billing', 'Developer', 'General'];

const ROLES = ['Admin', 'Manager', 'Content Creator', 'Analyst', 'Viewer'];

const ROLE_TEMPLATES = {
  Admin: {
    contentStudio: true,
    aiWriter: true,
    imageGenerator: true,
    contentCalendar: true,
    postScheduling: true,
    connectedAccounts: true,
    analytics: true,
    competitorAI: true,
    reports: true,
    seo: true,
    googleBusiness: true,
    reviewManagement: true,
    emailAutomation: true,
    whatsappAutomation: true,
    workspace: true,
    team: true,
    billing: true,
    subscription: true,
    settings: true,
    apiKeys: true,
    integrations: true,
    developerTools: true,
    adminDashboard: true,
    transferOwnership: false,
    deleteWorkspace: false,
    billingOwner: false,
    approvals: true,
    mediaLibrary: true,
    readOnly: false
  },
  Manager: {
    contentStudio: true,
    aiWriter: false,
    imageGenerator: false,
    contentCalendar: false,
    postScheduling: false,
    connectedAccounts: false,
    analytics: true,
    competitorAI: true,
    reports: true,
    seo: false,
    googleBusiness: false,
    reviewManagement: false,
    emailAutomation: false,
    whatsappAutomation: false,
    workspace: false,
    team: false,
    billing: false,
    subscription: false,
    settings: false,
    apiKeys: false,
    integrations: false,
    developerTools: false,
    adminDashboard: true,
    transferOwnership: false,
    deleteWorkspace: false,
    billingOwner: false,
    approvals: true,
    mediaLibrary: false,
    readOnly: false
  },
  'Content Creator': {
    contentStudio: true,
    aiWriter: true,
    imageGenerator: true,
    contentCalendar: false,
    postScheduling: true,
    connectedAccounts: false,
    analytics: false,
    competitorAI: false,
    reports: false,
    seo: false,
    googleBusiness: false,
    reviewManagement: false,
    emailAutomation: false,
    whatsappAutomation: false,
    workspace: false,
    team: false,
    billing: false,
    subscription: false,
    settings: false,
    apiKeys: false,
    integrations: false,
    developerTools: false,
    adminDashboard: true,
    transferOwnership: false,
    deleteWorkspace: false,
    billingOwner: false,
    approvals: false,
    mediaLibrary: true,
    readOnly: false
  },
  Analyst: {
    contentStudio: false,
    aiWriter: false,
    imageGenerator: false,
    contentCalendar: false,
    postScheduling: false,
    connectedAccounts: false,
    analytics: true,
    competitorAI: true,
    reports: true,
    seo: false,
    googleBusiness: false,
    reviewManagement: false,
    emailAutomation: false,
    whatsappAutomation: false,
    workspace: false,
    team: false,
    billing: false,
    subscription: false,
    settings: false,
    apiKeys: false,
    integrations: false,
    developerTools: false,
    adminDashboard: true,
    transferOwnership: false,
    deleteWorkspace: false,
    billingOwner: false,
    approvals: false,
    mediaLibrary: false,
    readOnly: false
  },
  Viewer: {
    contentStudio: false,
    aiWriter: false,
    imageGenerator: false,
    contentCalendar: false,
    postScheduling: false,
    connectedAccounts: false,
    analytics: true,
    competitorAI: false,
    reports: true,
    seo: false,
    googleBusiness: false,
    reviewManagement: false,
    emailAutomation: false,
    whatsappAutomation: false,
    workspace: false,
    team: false,
    billing: false,
    subscription: false,
    settings: false,
    apiKeys: false,
    integrations: false,
    developerTools: false,
    adminDashboard: true,
    transferOwnership: false,
    deleteWorkspace: false,
    billingOwner: false,
    approvals: false,
    mediaLibrary: false,
    readOnly: true
  }
};

const Workspace = () => {
  const { currentWorkspace, currentUser, workspaces, switchWorkspace, fetchUser, setWorkspaces, setCurrentWorkspace, loading: globalLoading } = useData();

  const permissionMap = {
    'Manage Members': 'team',
    'Connect Social Accounts': 'connectedAccounts',
    'Disconnect Accounts': 'connectedAccounts',
    'Create Posts': 'contentStudio',
    'Delete Posts': 'contentStudio',
    'Approve AI': 'approvals',
    'Generate AI Reports': 'reports',
    'Competitor Analysis': 'competitorAI',
    'Billing': 'billing',
    'Workspace Settings': 'settings',
    'AI Credits': 'billing',
    'Export Reports': 'reports',
    'Analytics': 'analytics',
    'GMB': 'googleBusiness',
    'SEO': 'seo',
    'Email Automation': 'emailAutomation',
    'WhatsApp Automation': 'whatsappAutomation',
    'Review Management': 'reviewManagement'
  };

  const hasPermission = (permissionName) => {
    if (!currentWorkspace) return false;
    if (currentWorkspace.role === 'Owner') return true;
    const permissions = currentWorkspace.permissions || {};
    const key = permissionMap[permissionName] || permissionName;
    return permissions[key] === true;
  };

  const [activeTab, setActiveTab] = useState('members');
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(false);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [retryingEmail, setRetryingEmail] = useState(''); // tracks which log email is being retried

  // Workspace Data
  const [members, setMembers] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [userRole, setUserRole] = useState('Viewer');

  // Modals & Form States
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [editPermissionsModalOpen, setEditPermissionsModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [newWorkspaceModalOpen, setNewWorkspaceModalOpen] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('Viewer');
  const [inviteExpiration, setInviteExpiration] = useState(24);
  const [invitePermissions, setInvitePermissions] = useState({ ...ROLE_TEMPLATES['Viewer'] });
  const [customPerms, setCustomPerms] = useState({});
  const [wsName, setWsName] = useState('');
  const [wsLogo, setWsLogo] = useState('');
  const [logSearch, setLogSearch] = useState('');

  useEffect(() => {
    if (currentWorkspace) {
      setWsName(currentWorkspace.name || '');
      setWsLogo(currentWorkspace.logoUrl || '');
      loadWorkspaceData();
    }
  }, [currentWorkspace]);

  useEffect(() => {
    if (activeTab === 'logs' || activeTab === 'settings') {
      if (currentWorkspace && currentWorkspace.role !== 'Owner' && !currentWorkspace.permissions?.settings) {
        setActiveTab('members');
      }
    }
  }, [activeTab, currentWorkspace]);

  // Synchronize invite permission checkboxes automatically when invite role is changed
  useEffect(() => {
    setInvitePermissions({ ...(ROLE_TEMPLATES[inviteRole] || {}) });
  }, [inviteRole]);
  const showSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const fetchMembers = async () => {
    if (!currentWorkspace) return;
    try {
      const workspaceId = currentWorkspace._id;
      const membersRes = await workspaceService.getWorkspaceMembers(workspaceId);
      if (membersRes && membersRes.success) {
        setMembers(membersRes.members || []);
        const currentMember = membersRes.members.find(m => m.userId?._id === currentUser?.id || m.userId?._id === currentUser?._id);
        if (currentMember) {
          setUserRole(currentMember.role);
        }
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to reload workspace members.');
    }
  };

  const fetchLogs = async () => {
    if (!currentWorkspace) return;
    try {
      setLogsLoading(true);
      const logsRes = await workspaceService.getAuditLogs(currentWorkspace._id);
      if (logsRes && logsRes.success) {
        setAuditLogs(logsRes.auditLogs || []);
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to retrieve audit logs.');
    } finally {
      setLogsLoading(false);
    }
  };

  const fetchSessions = async () => {
    if (!currentWorkspace) return;
    try {
      setSessionsLoading(true);
      const sessionsRes = await workspaceService.getSessions(currentWorkspace._id, currentUser?.id || currentUser?._id);
      if (sessionsRes && sessionsRes.success) {
        setSessions(sessionsRes.sessions || []);
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to retrieve active sessions.');
    } finally {
      setSessionsLoading(false);
    }
  };

  const loadWorkspaceData = async () => {
    try {
      setLoading(true);
      setError('');
      
      const workspaceId = currentWorkspace._id;
      
      // Fetch members
      const membersRes = await workspaceService.getWorkspaceMembers(workspaceId);
      if (membersRes && membersRes.success) {
        setMembers(membersRes.members || []);
        
        // Find current user's role in this workspace
        const currentMember = membersRes.members.find(m => m.userId?._id === currentUser?.id || m.userId?._id === currentUser?._id);
        if (currentMember) {
          setUserRole(currentMember.role);
        }
      }

      // Fetch logs
      if (activeTab === 'logs') {
        setLogsLoading(true);
        const logsRes = await workspaceService.getAuditLogs(workspaceId);
        if (logsRes && logsRes.success) {
          setAuditLogs(logsRes.auditLogs || []);
        }
        setLogsLoading(false);
      }

      // Fetch sessions
      if (activeTab === 'security') {
        setSessionsLoading(true);
        const sessionsRes = await workspaceService.getSessions(workspaceId, currentUser?.id || currentUser?._id);
        if (sessionsRes && sessionsRes.success) {
          setSessions(sessionsRes.sessions || []);
        }
        setSessionsLoading(false);
      }

    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to load workspace administration details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentWorkspace) {
      if (activeTab === 'logs') {
        fetchLogs();
      } else if (activeTab === 'security') {
        fetchSessions();
      }
    }
  }, [activeTab]);

  // Clear error state whenever invite or create modals open/close
  useEffect(() => {
    setError('');
  }, [inviteModalOpen, newWorkspaceModalOpen]);

  const handleCreateWorkspace = async (e) => {
    e.preventDefault();
    if (!newWorkspaceName.trim()) return;

    try {
      setActionLoading(true);
      setError('');
      const res = await workspaceService.createWorkspace(newWorkspaceName);
      if (res && res.success) {
        showSuccess('Workspace created successfully!');
        setNewWorkspaceName('');
        setNewWorkspaceModalOpen(false);
        
        // Reload workspaces
        const wsRes = await workspaceService.getWorkspaces();
        if (wsRes && wsRes.success) {
          setWorkspaces(wsRes.workspaces);
          // Switch to new workspace
          setCurrentWorkspace(res.workspace);
          localStorage.setItem('activeWorkspaceId', res.workspace._id);
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create workspace.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    try {
      setActionLoading(true);
      setError('');
      const res = await workspaceService.inviteMember(currentWorkspace._id, {
        email: inviteEmail.trim(),
        role: inviteRole,
        customPermissions: Object.keys(invitePermissions).filter(k => invitePermissions[k] === true),
        expirationHours: inviteExpiration
      });

      if (res && res.success) {
        showSuccess(`Invitation sent successfully to ${inviteEmail}.`);
        setInviteEmail('');
        setInviteRole('Viewer');
        setInvitePermissions({ ...ROLE_TEMPLATES['Viewer'] });
        setInviteModalOpen(false);
        fetchMembers();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send workspace invitation.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSuspend = async (memberId, isSuspended) => {
    try {
      setActionLoading(true);
      const res = await workspaceService.suspendMember(currentWorkspace._id, memberId, !isSuspended);
      if (res && res.success) {
        showSuccess(`Member ${isSuspended ? 'reactivated' : 'suspended'} successfully.`);
        fetchMembers();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update member status.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemove = async (memberId) => {
    if (!window.confirm('Are you sure you want to remove this member from the workspace?')) return;

    try {
      setActionLoading(true);
      const res = await workspaceService.removeMember(currentWorkspace._id, memberId);
      if (res && res.success) {
        showSuccess('Member removed successfully.');
        fetchMembers();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to remove member.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRoleChange = async (memberId, newRole) => {
    try {
      setActionLoading(true);
      const res = await workspaceService.changeRole(currentWorkspace._id, memberId, newRole);
      if (res && res.success) {
        showSuccess('Role changed successfully.');
        fetchMembers();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update user role.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenPermissions = (member) => {
    setSelectedMember(member);
    const saved = member.permissions ? (member.permissions instanceof Map ? Object.fromEntries(member.permissions) : member.permissions) : {};
    const defaults = ROLE_TEMPLATES[member.role] || ROLE_TEMPLATES['Viewer'];
    setCustomPerms({ ...defaults, ...saved });
    setEditPermissionsModalOpen(true);
  };

  const handleSavePermissions = async (e) => {
    e.preventDefault();
    if (!selectedMember) return;

    try {
      setActionLoading(true);
      const res = await workspaceService.updatePermissions(currentWorkspace._id, selectedMember._id, customPerms);
      if (res && res.success) {
        showSuccess('Custom permissions updated successfully.');
        setEditPermissionsModalOpen(false);
        fetchMembers();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update custom permissions.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevokeSession = async (tokenHash) => {
    if (!window.confirm('Are you sure you want to revoke this session? The device will be signed out immediately.')) return;

    try {
      setActionLoading(true);
      const res = await workspaceService.revokeSession(
        currentWorkspace._id, 
        currentUser?.id || currentUser?._id, 
        tokenHash
      );
      if (res && res.success) {
        showSuccess('Session revoked successfully.');
        fetchSessions();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to revoke session.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateSettings = async (e) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      setError('');
      const res = await workspaceService.updateSettings(currentWorkspace._id, wsName, wsLogo);
      if (res && res.success) {
        showSuccess('Workspace settings saved.');
        fetchUser(true); // force user profile reload to update sidebar/navbar context
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update workspace details.');
    } finally {
      setActionLoading(false);
    }
  };

  const toggleInvitePermission = (permKey) => {
    setInvitePermissions(prev => ({
      ...prev,
      [permKey]: !prev[permKey]
    }));
  };

  const toggleEditPermission = (permKey) => {
    setCustomPerms(prev => ({
      ...prev,
      [permKey]: !prev[permKey]
    }));
  };

  // Parse email from audit log detail string: `Invited "email@example.com" as Role.`
  const parseEmailFromLogDetail = (detail = '') => {
    const match = detail.match(/Invited\s+"([^"]+)"/);
    return match ? match[1] : null;
  };

  // Parse role from audit log detail string
  const parseRoleFromLogDetail = (detail = '') => {
    const match = detail.match(/as\s+([^.]+)\.?$/);
    return match ? match[1].trim() : 'Viewer';
  };

  const handleResendInvite = async (log) => {
    const email = parseEmailFromLogDetail(log.details);
    const role  = parseRoleFromLogDetail(log.details);
    if (!email) return;
    setRetryingEmail(email);
    try {
      await workspaceService.resendInvitation(currentWorkspace._id, email, role);
      showSuccess(`Invitation re-sent to ${email}.`);
    } catch (err) {
      setError(err.response?.data?.message || `Failed to resend invitation to ${email}.`);
    } finally {
      setRetryingEmail('');
    }
  };

  const hasAccess = (requiredRole) => {
    const hierarchy = { 'Owner': 4, 'Admin': 3, 'Manager': 2, 'Content Creator': 1, 'Analyst': 1, 'Viewer': 0 };
    return (hierarchy[userRole] || 0) >= (hierarchy[requiredRole] || 0);
  };

  const filteredLogs = auditLogs.filter(log => 
    log.action.toLowerCase().includes(logSearch.toLowerCase()) ||
    log.details.toLowerCase().includes(logSearch.toLowerCase()) ||
    log.actorEmail.toLowerCase().includes(logSearch.toLowerCase())
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 py-4 text-zinc-950 dark:text-zinc-100"
    >
      {/* Top Banner Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-xs uppercase tracking-widest mb-1.5 animate-pulse">
            <ShieldCheck className="h-4.5 w-4.5" /> Workspace Control Room
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-700 dark:from-white dark:via-zinc-100 dark:to-zinc-400 bg-clip-text text-transparent">
            Workspace & Team Administration
          </h1>
          <p className="text-sm text-zinc-550 dark:text-zinc-400 mt-1 max-w-2xl">
            Configure enterprise security settings, manage active login sessions, view audit logs, adjust custom role-based permissions, and invite collaborators.
          </p>
        </div>

        {/* Workspace Switcher */}
        <div className="flex items-center gap-3 bg-zinc-100 dark:bg-zinc-900/40 p-2.5 rounded-2xl border border-zinc-200 dark:border-zinc-800/80 shadow-lg">
          <label className="text-xs text-zinc-500 dark:text-zinc-400 font-medium px-2">Workspace:</label>
          <select
            value={currentWorkspace?._id || ''}
            onChange={(e) => switchWorkspace(e.target.value)}
            className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-sm text-zinc-800 dark:text-zinc-200 rounded-lg px-3 py-1.5 outline-none focus:border-indigo-500 transition-colors"
          >
            {workspaces.map(w => (
              <option key={w._id} value={w._id}>{w.name}</option>
            ))}
          </select>
          <button
            onClick={() => setNewWorkspaceModalOpen(true)}
            className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-indigo-650 dark:text-indigo-400 rounded-xl transition-all cursor-pointer border border-transparent hover:border-indigo-500/20"
            title="Create Workspace"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/25 rounded-2xl text-xs text-emerald-450 flex items-center gap-2.5 animate-bounce">
          <CheckCircle className="h-4.5 w-4.5" /> {successMsg}
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/25 rounded-2xl text-xs text-red-400 flex items-center gap-2.5">
          <AlertTriangle className="h-4.5 w-4.5" /> {error}
        </div>
      )}

      {globalLoading?.user ? (
        <div className="py-24 text-center">
          <Loader2 className="h-10 w-10 text-indigo-500 animate-spin mx-auto mb-4" />
          <p className="text-sm text-zinc-500 dark:text-zinc-400 animate-pulse">Loading workspace control room...</p>
        </div>
      ) : !currentWorkspace ? (
        <div className="max-w-md mx-auto text-center py-16 px-6 bg-white dark:bg-zinc-900/35 border border-zinc-200 dark:border-zinc-800 rounded-3xl space-y-6 shadow-xl backdrop-blur-sm mt-8">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Settings className="h-8 w-8 text-white animate-spin" style={{ animationDuration: '6s' }} />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-zinc-900 dark:text-white">No Active Workspace</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-xs mx-auto leading-relaxed">
              You need an active workspace to manage team members, access security audit logs, and configure workspace settings.
            </p>
          </div>
          <button
            onClick={() => setNewWorkspaceModalOpen(true)}
            className="w-full bg-indigo-600 hover:bg-indigo-400 text-white font-bold text-xs py-3 px-4 rounded-xl transition-all shadow-lg shadow-indigo-650/15 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Plus className="h-4.5 w-4.5" /> Create Your First Workspace
          </button>
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div className="flex border-b border-zinc-200 dark:border-zinc-800 gap-4 overflow-x-auto">
            <button
              onClick={() => setActiveTab('members')}
              className={`pb-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${activeTab === 'members' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-zinc-500 dark:text-zinc-550 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
            >
              <Users className="h-4 w-4" /> Members & Roles
            </button>
            {hasPermission('Workspace Settings') && (
              <button
                onClick={() => setActiveTab('logs')}
                className={`pb-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${activeTab === 'logs' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-zinc-500 dark:text-zinc-550 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
              >
                <Activity className="h-4 w-4" /> Audit Trails
              </button>
            )}
            <button
              onClick={() => setActiveTab('security')}
              className={`pb-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${activeTab === 'security' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-zinc-500 dark:text-zinc-550 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
            >
              <Key className="h-4 w-4" /> Session Security
            </button>
            {hasPermission('Workspace Settings') && (
              <button
                onClick={() => setActiveTab('settings')}
                className={`pb-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${activeTab === 'settings' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-zinc-500 dark:text-zinc-550 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
              >
                <Settings className="h-4 w-4" /> Settings & Metrics
              </button>
            )}
          </div>

          {loading ? (
            <div className="py-24 text-center">
              <Loader2 className="h-10 w-10 text-indigo-500 animate-spin mx-auto mb-4" />
              <p className="text-sm text-zinc-500">Loading secure workspace settings...</p>
            </div>
          ) : (
            <div className="space-y-8">
          {/* TAB 1: MEMBERS */}
          {activeTab === 'members' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Members Table */}
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white dark:bg-zinc-900/40 border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl p-6 shadow-sm space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="font-bold text-zinc-800 dark:text-white text-base">Active Collaborators ({members.length})</h3>
                    {hasPermission('Manage Members') && (
                      <button
                        onClick={() => setInviteModalOpen(true)}
                        className="bg-indigo-600 hover:bg-indigo-400 text-white font-semibold text-xs px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 shadow-md shadow-indigo-650/15 cursor-pointer"
                      >
                        <Plus className="h-4 w-4" /> Invite Member
                      </button>
                    )}
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500 dark:text-zinc-400 uppercase">
                          <th className="py-3">User</th>
                          <th>Role</th>
                          <th>Status</th>
                          <th className="text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/50">
                        {members.map((member) => (
                          <tr key={member._id} className="text-zinc-700 dark:text-zinc-350">
                            <td className="py-4">
                              <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center font-bold text-white text-xs">
                                  {member.userId?.firstName?.substring(0, 2).toUpperCase() || 'TM'}
                                </div>
                                <div>
                                  <div className="font-semibold text-zinc-900 dark:text-white text-sm">
                                    {member.userId?.firstName} {member.userId?.lastName}
                                  </div>
                                  <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">{member.userId?.email}</div>
                                </div>
                              </div>
                            </td>
                            <td>
                              {hasPermission('Manage Members') && member.role !== 'Owner' ? (
                                <select
                                  value={member.role}
                                  onChange={(e) => handleRoleChange(member._id, e.target.value)}
                                  className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs rounded px-2 py-1 text-zinc-800 dark:text-zinc-200 outline-none"
                                >
                                  {ROLES.map(r => (
                                    <option key={r} value={r}>{r}</option>
                                  ))}
                                </select>
                              ) : (
                                <span className="font-semibold text-zinc-800 dark:text-zinc-300 text-xs">{member.role}</span>
                              )}
                            </td>
                            <td>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${member.status === 'active' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}`}>
                                {member.status}
                              </span>
                            </td>
                            <td className="text-right py-4">
                              {member.role !== 'Owner' && hasPermission('Manage Members') && (
                                <div className="flex justify-end gap-2.5">
                                  <button
                                    onClick={() => handleOpenPermissions(member)}
                                    className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-indigo-650 dark:text-indigo-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                                    title="Edit Permissions"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => handleSuspend(member._id, member.status)}
                                    className={`p-1.5 rounded-lg transition-colors cursor-pointer ${member.status === 'active' ? 'text-amber-500 hover:text-white hover:bg-amber-600' : 'text-emerald-500 hover:text-white hover:bg-emerald-600'}`}
                                    title={member.status === 'active' ? 'Suspend Member' : 'Reactivate Member'}
                                  >
                                    {member.status === 'active' ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                                  </button>
                                  <button
                                    onClick={() => handleRemove(member._id)}
                                    className="p-1.5 hover:bg-red-600 text-red-500 hover:text-white rounded-lg transition-colors cursor-pointer"
                                    title="Remove Member"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Roles Description Sidebar */}
              <div className="space-y-6">
                <div className="bg-zinc-50/50 dark:bg-zinc-900/20 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-6 space-y-4">
                  <h4 className="text-xs font-bold text-zinc-500 uppercase flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-indigo-500" /> Permission Guidelines
                  </h4>
                  <div className="space-y-3.5 text-xs">
                    <div>
                      <strong className="text-zinc-800 dark:text-zinc-200 block mb-0.5">👑 Owner</strong>
                      <span className="text-zinc-650 dark:text-zinc-400">Full administrative control over billing, integrations, and member management. Can delete workspace or transfer ownership.</span>
                    </div>
                    <div className="border-t border-zinc-200 dark:border-zinc-800/50 pt-2.5">
                      <strong className="text-zinc-800 dark:text-zinc-200 block mb-0.5">🛡️ Admin</strong>
                      <span className="text-zinc-650 dark:text-zinc-400">Can invite/remove manager, creator, and analyst roles, modify settings, and connect social handles. No billing access.</span>
                    </div>
                    <div className="border-t border-zinc-200 dark:border-zinc-800/50 pt-2.5">
                      <strong className="text-zinc-800 dark:text-zinc-200 block mb-0.5">💼 Manager</strong>
                      <span className="text-zinc-650 dark:text-zinc-400">Can schedule posts, generate AI content, check analytics reports, and scan competitors. No member management.</span>
                    </div>
                    <div className="border-t border-zinc-200 dark:border-zinc-800/50 pt-2.5">
                      <strong className="text-zinc-800 dark:text-zinc-200 block mb-0.5">✍️ Content Creator</strong>
                      <span className="text-zinc-650 dark:text-zinc-400">Focused on creating campaign drafts, publishing visual carousels, and writing copy. No access to settings.</span>
                    </div>
                    <div className="border-t border-zinc-200 dark:border-zinc-800/50 pt-2.5">
                      <strong className="text-zinc-800 dark:text-zinc-200 block mb-0.5">📊 Analyst</strong>
                      <span className="text-zinc-650 dark:text-zinc-400">Read-only access to campaign analytics, GMB charts, and SEO statistics. Can export Deloitte-style reports.</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: AUDIT TRAILS */}
          {activeTab === 'logs' && (
            <div className="bg-white dark:bg-zinc-900/40 border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h3 className="font-bold text-zinc-800 dark:text-white text-base">Workspace Audit Logs</h3>
                <div className="relative w-full sm:w-72">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Search className="h-4 w-4 text-zinc-400 dark:text-zinc-500" />
                  </div>
                  <input
                    type="text"
                    value={logSearch}
                    onChange={(e) => setLogSearch(e.target.value)}
                    placeholder="Search logs by action or details..."
                    className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl py-1.5 pl-9 pr-4 text-xs text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 uppercase font-bold">
                      <th className="py-2.5">Time</th>
                      <th>Action</th>
                      <th>User</th>
                      <th>Details</th>
                      <th>IP / Network</th>
                      {hasPermission('Manage Members') && <th className="text-right">Retry</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/30">
                    {logsLoading ? (
                      <tr>
                        <td colSpan="5" className="py-12 text-center text-zinc-500 dark:text-zinc-400">
                          <Loader2 className="h-6 w-6 text-indigo-500 animate-spin mx-auto mb-2" />
                          <span>Fetching secure audit logs...</span>
                        </td>
                      </tr>
                    ) : filteredLogs.length > 0 ? (
                      filteredLogs.map(log => (
                        <tr key={log._id} className="text-zinc-700 dark:text-zinc-350 hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                          <td className="py-3 text-zinc-500 dark:text-zinc-400"><Clock className="inline mr-1 h-3 w-3" /> {new Date(log.timestamp).toLocaleString()}</td>
                          <td className="font-bold text-indigo-650 dark:text-indigo-400">{log.action}</td>
                          <td className="text-zinc-600 dark:text-zinc-300">{log.actorEmail}</td>
                          <td className="max-w-xs truncate text-zinc-700 dark:text-zinc-300" title={log.details}>{log.details}</td>
                          <td>
                            <div className="flex flex-col">
                              <span className="text-[10px] text-zinc-550 dark:text-zinc-400">{log.ipAddress || 'Unknown'}</span>
                              <span className="text-[8px] text-zinc-400 dark:text-zinc-500 truncate max-w-[120px]">{log.userAgent}</span>
                            </div>
                          </td>
                          {hasPermission('Manage Members') && (
                            <td className="text-right pr-1">
                              {log.action === 'Member invited' && parseEmailFromLogDetail(log.details) && (
                                <button
                                  onClick={() => handleResendInvite(log)}
                                  disabled={retryingEmail === parseEmailFromLogDetail(log.details)}
                                  title={`Resend invitation to ${parseEmailFromLogDetail(log.details)}`}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-wait"
                                >
                                  {retryingEmail === parseEmailFromLogDetail(log.details)
                                    ? <Loader2 className="h-3 w-3 animate-spin" />
                                    : <Mail className="h-3 w-3" />}
                                  Retry
                                </button>
                              )}
                            </td>
                          )}
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="5" className="py-12 text-center text-zinc-500">No logs found matching search criteria.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: SESSIONS */}
          {activeTab === 'security' && (
            <div className="bg-white dark:bg-zinc-900/40 border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl p-6 shadow-sm space-y-4">
              <div>
                <h3 className="font-bold text-zinc-800 dark:text-white text-base">Active Logged-In Sessions</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Review active devices connected to your profile context in this workspace.</p>
              </div>

              <div className="space-y-3">
                {sessionsLoading ? (
                  <div className="py-12 text-center text-zinc-500 dark:text-zinc-400">
                    <Loader2 className="h-6 w-6 text-indigo-500 animate-spin mx-auto mb-2" />
                    <span>Retrieving active sessions...</span>
                  </div>
                ) : sessions.length > 0 ? (
                  sessions.map((session, idx) => (
                    <div key={idx} className="p-4 bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-xl flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3.5">
                        <div className="h-10 w-10 bg-indigo-500/10 border border-indigo-500/20 text-indigo-650 dark:text-indigo-400 rounded-xl flex items-center justify-center">
                          <Laptop className="h-5.5 w-5.5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-zinc-800 dark:text-white">{session.browser || 'Browser'} on {session.device || 'Device'}</span>
                            {localStorage.getItem('refreshTokenHash') === session.tokenHash || idx === 0 && (
                              <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[9px] font-bold rounded-full">Current Session</span>
                            )}
                          </div>
                          <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5 flex flex-wrap gap-x-3 gap-y-1">
                            <span className="flex items-center gap-1"><Globe className="h-3 w-3" /> {session.ipAddress} - {session.location}</span>
                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Active: {new Date(session.lastActive).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => handleRevokeSession(session.tokenHash)}
                        className="px-3 py-1.5 hover:bg-red-600 text-red-500 hover:text-white rounded-xl text-xs border border-red-500/20 dark:border-red-500/15 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all cursor-pointer"
                      >
                        Revoke Session
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="py-12 text-center text-zinc-500">No active sessions tracked.</div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: SETTINGS & METRICS */}
          {activeTab === 'settings' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Workspace Settings Form */}
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white dark:bg-zinc-900/40 border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl p-6 shadow-sm space-y-6">
                  <div>
                    <h3 className="font-bold text-zinc-800 dark:text-white text-base">Workspace Profile Settings</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Modify workspace profile configuration.</p>
                  </div>

                  <form onSubmit={handleUpdateSettings} className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">Workspace Name</label>
                      <input
                        type="text"
                        required
                        value={wsName}
                        onChange={(e) => setWsName(e.target.value)}
                        className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 py-2.5 px-4 text-xs text-zinc-800 dark:text-zinc-200 focus:border-indigo-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">Logo URL</label>
                      <input
                        type="text"
                        value={wsLogo}
                        onChange={(e) => setWsLogo(e.target.value)}
                        placeholder="https://company.com/logo.png"
                        className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 py-2.5 px-4 text-xs text-zinc-800 dark:text-zinc-200 focus:border-indigo-500 outline-none"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={actionLoading}
                      className="px-5 py-2.5 bg-indigo-650 hover:bg-indigo-600 text-white font-semibold text-xs rounded-xl shadow transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                      Save Profile Settings
                    </button>
                  </form>
                </div>
              </div>

              {/* Workspace Metrics Sidebar */}
              <div className="space-y-6">
                <div className="bg-zinc-50/50 dark:bg-zinc-900/20 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-6 space-y-5">
                  <h4 className="text-xs font-bold text-zinc-500 uppercase flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-indigo-400" /> Usage Metrics
                  </h4>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3.5 bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/80 rounded-xl">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4.5 w-4.5 text-indigo-650 dark:text-indigo-400" />
                        <div>
                          <span className="text-[10px] text-zinc-500 uppercase font-bold block">AI Credit Balance</span>
                          <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200">{currentWorkspace?.aiCredits || 1000} credits</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3.5 bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/80 rounded-xl">
                      <div className="flex items-center gap-2">
                        <HardDrive className="h-4.5 w-4.5 text-indigo-650 dark:text-indigo-400" />
                        <div>
                          <span className="text-[10px] text-zinc-500 uppercase font-bold block">Storage Consumption</span>
                          <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200">{(currentWorkspace?.storageUsedBytes || 0) / 1024 / 1024} MB / 10 GB</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
        </>
      )}

      {/* CREATE WORKSPACE MODAL */}
      <AnimatePresence>
        {newWorkspaceModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setNewWorkspaceModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs cursor-pointer"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-2xl z-10 space-y-6"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-black text-zinc-900 dark:text-white flex items-center gap-1.5"><Plus className="h-5 w-5 text-indigo-600 dark:text-indigo-400" /> Create Workspace</h3>
                <button onClick={() => setNewWorkspaceModalOpen(false)} className="text-zinc-400 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-white transition-colors cursor-pointer"><X className="h-4.5 w-4.5" /></button>
              </div>

              {error && (
                <div className="p-3.5 bg-red-500/10 border border-red-500/25 rounded-2xl text-xs text-red-400 flex items-center gap-2">
                  <AlertTriangle className="h-4.5 w-4.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleCreateWorkspace} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">Workspace Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Tarasaka Growth Studio"
                    value={newWorkspaceName}
                    onChange={(e) => setNewWorkspaceName(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl py-2.5 px-4 text-xs text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-650 focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={actionLoading}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-indigo-600 hover:bg-indigo-400 text-xs font-bold text-white rounded-xl shadow cursor-pointer transition-all disabled:opacity-50"
                >
                  {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  <span>Generate Workspace</span>
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* INVITE COLLABORATOR MODAL */}
      <AnimatePresence>
        {inviteModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setInviteModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs cursor-pointer"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-2xl z-10 space-y-6"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-black text-zinc-900 dark:text-white flex items-center gap-1.5"><Mail className="h-5 w-5 text-indigo-650 dark:text-indigo-400" /> Invite Collaborator</h3>
                <button onClick={() => setInviteModalOpen(false)} className="text-zinc-400 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-white transition-colors cursor-pointer"><X className="h-4.5 w-4.5" /></button>
              </div>

              {error && (
                <div className="p-3.5 bg-red-500/10 border border-red-500/25 rounded-2xl text-xs text-red-400 flex items-center gap-2">
                  <AlertTriangle className="h-4.5 w-4.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleInvite} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">Email Address</label>
                    <input
                      type="email"
                      required
                      placeholder="colleague@company.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className="w-full bg-zinc-50 dark:bg-zinc-955 border border-zinc-200 dark:border-zinc-800 rounded-xl py-2.5 px-4 text-xs text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-650 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">Role Placement</label>
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value)}
                      className="w-full bg-zinc-50 dark:bg-zinc-955 border border-zinc-200 dark:border-zinc-800 rounded-xl py-2.5 px-4 text-xs text-zinc-800 dark:text-zinc-200 focus:border-indigo-500 focus:outline-none"
                    >
                      {ROLES.map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">Invitation Expiration (Hours)</label>
                  <select
                    value={inviteExpiration}
                    onChange={(e) => setInviteExpiration(Number(e.target.value))}
                    className="w-full bg-zinc-50 dark:bg-zinc-955 border border-zinc-200 dark:border-zinc-800 rounded-xl py-2 px-4 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
                  >
                    <option value={1}>1 Hour</option>
                    <option value={12}>12 Hours</option>
                    <option value={24}>24 Hours (Default)</option>
                    <option value={48}>48 Hours</option>
                    <option value={168}>7 Days</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">Custom Permission Overrides (Optional)</label>
                  <div className="space-y-4 max-h-[180px] overflow-y-auto p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl scrollbar-thin scrollbar-thumb-zinc-200 dark:scrollbar-thumb-zinc-800">
                    {PERMISSION_CATEGORIES.map(cat => {
                      const permsInCat = ALL_PERMISSIONS.filter(p => p.category === cat);
                      return (
                        <div key={cat} className="space-y-1.5">
                          <h4 className="text-[9px] font-bold text-indigo-650 dark:text-indigo-400 uppercase tracking-wider border-b border-zinc-200/50 dark:border-zinc-850 pb-0.5">{cat}</h4>
                          <div className="grid grid-cols-2 gap-2">
                            {permsInCat.map(perm => (
                              <label key={perm.key} className="flex items-center space-x-2 text-xs text-zinc-700 dark:text-zinc-350 cursor-pointer p-0.5 rounded hover:bg-zinc-100/50 dark:hover:bg-zinc-900/50 transition-colors">
                                <input
                                  type="checkbox"
                                  checked={invitePermissions[perm.key] === true}
                                  onChange={() => toggleInvitePermission(perm.key)}
                                  className="rounded text-indigo-650 focus:ring-indigo-650 border-zinc-350 dark:border-zinc-800 bg-white dark:bg-zinc-900 cursor-pointer"
                                />
                                <span>{perm.label}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={actionLoading}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-indigo-600 hover:bg-indigo-400 text-xs font-bold text-white rounded-xl shadow cursor-pointer transition-all disabled:opacity-50"
                >
                  {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                  <span>Dispatch Secure Invitation</span>
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* EDIT CUSTOM PERMISSIONS MODAL */}
      <AnimatePresence>
        {editPermissionsModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditPermissionsModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs cursor-pointer"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-2xl z-10 space-y-6"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-black text-zinc-900 dark:text-white flex items-center gap-1.5"><ShieldAlert className="h-5 w-5 text-indigo-650 dark:text-indigo-400" /> Edit Member Custom Permissions</h3>
                <button onClick={() => setEditPermissionsModalOpen(false)} className="text-zinc-400 hover:text-zinc-900 dark:text-zinc-550 dark:hover:text-white transition-colors cursor-pointer"><X className="h-4.5 w-4.5" /></button>
              </div>

              <div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  Modify individual permissions for <strong className="text-zinc-800 dark:text-zinc-200">{selectedMember?.userId?.firstName} {selectedMember?.userId?.lastName}</strong>. These settings override the default permissions mapped to the <strong className="text-indigo-600 dark:text-indigo-400 font-semibold">{selectedMember?.role}</strong> role.
                </p>
              </div>

              <form onSubmit={handleSavePermissions} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">Workspace Permission Overrides</label>
                  <div className="space-y-4 max-h-[220px] overflow-y-auto p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl scrollbar-thin scrollbar-thumb-zinc-200 dark:scrollbar-thumb-zinc-800">
                    {PERMISSION_CATEGORIES.map(cat => {
                      const permsInCat = ALL_PERMISSIONS.filter(p => p.category === cat);
                      return (
                        <div key={cat} className="space-y-1.5">
                          <h4 className="text-[9px] font-bold text-indigo-650 dark:text-indigo-400 uppercase tracking-wider border-b border-zinc-200/50 dark:border-zinc-850 pb-0.5">{cat}</h4>
                          <div className="grid grid-cols-2 gap-2">
                            {permsInCat.map(perm => (
                              <label key={perm.key} className="flex items-center space-x-2 text-xs text-zinc-700 dark:text-zinc-350 cursor-pointer p-0.5 rounded hover:bg-zinc-100/50 dark:hover:bg-zinc-900/50 transition-colors">
                                <input
                                  type="checkbox"
                                  checked={customPerms[perm.key] === true}
                                  onChange={() => toggleEditPermission(perm.key)}
                                  className="rounded text-indigo-650 focus:ring-indigo-650 border-zinc-350 dark:border-zinc-800 bg-white dark:bg-zinc-900 cursor-pointer"
                                />
                                <span>{perm.label}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={actionLoading}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-indigo-600 hover:bg-indigo-400 text-xs font-bold text-white rounded-xl shadow cursor-pointer transition-all disabled:opacity-50"
                >
                  {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  <span>Save Permission Modifiers</span>
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default Workspace;
