import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, DollarSign, Activity, Database, Lock, Search, 
  Settings, ShieldAlert, AlertCircle, CheckCircle2, Loader2, 
  HelpCircle, Calendar, Edit, ShieldCheck, ChevronLeft, 
  ChevronRight, ArrowUpRight, BarChart3, Layers, Clock
} from 'lucide-react';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, 
  CartesianGrid, Tooltip, BarChart, Bar, Cell, PieChart, Pie, Legend, LineChart, Line
} from 'recharts';
import adminService from '../services/adminService';

const AdminDashboard = () => {
  const [unlocked, setUnlocked] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [passcodeError, setPasscodeError] = useState('');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [usersData, setUsersData] = useState({ users: [], pagination: {} });
  const [aiStats, setAIStats] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  
  // Modals / Status UI
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [activeTab, setActiveTab] = useState('overview'); // overview, users, ai, audits
  const [userFilters, setUserFilters] = useState({ page: 1, limit: 10, search: '', plan: '', status: '' });
  const [overrideUser, setOverrideUser] = useState(null); // User targeted for subscription override
  const [overrideForm, setOverrideForm] = useState({ plan: 'free', status: 'none', currentPeriodEnd: '' });
  const [actionLoading, setActionLoading] = useState(null); // Specific user ID doing status/role update

  useEffect(() => {
    const isUnlocked = sessionStorage.getItem('adminAccessKey') === 'taramation';
    setUnlocked(isUnlocked);
    if (isUnlocked) {
      loadStatsAndData();
    } else {
      setLoading(false);
    }
  }, []);

  const handleUnlock = (e) => {
    e.preventDefault();
    if (passcode === 'taramation') {
      sessionStorage.setItem('adminAccessKey', 'taramation');
      setUnlocked(true);
      setPasscodeError('');
      loadStatsAndData();
    } else {
      setPasscodeError('Invalid administrative key code.');
    }
  };

  const loadStatsAndData = async () => {
    setLoading(true);
    try {
      const [statsRes, aiRes, logsRes] = await Promise.all([
        adminService.getDashboardStats(),
        adminService.getAIUsageStats(),
        adminService.getAuditLogs()
      ]);

      if (statsRes.success) setStats(statsRes.data);
      if (aiRes.success) setAIStats(aiRes.data);
      if (logsRes.success) setAuditLogs(logsRes.data);

      await fetchUsers();
    } catch (err) {
      console.error(err);
      showToast(err.response?.data?.message || 'Failed to fetch platform metrics.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async (overrideFilters = null) => {
    try {
      const activeFilters = overrideFilters || userFilters;
      const res = await adminService.getUsers(activeFilters);
      if (res.success) {
        setUsersData(res.data);
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to fetch platform user directories.', 'error');
    }
  };

  const handleFilterChange = (key, value) => {
    const updated = { ...userFilters, [key]: value, page: 1 };
    setUserFilters(updated);
    fetchUsers(updated);
  };

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > usersData.pagination.pages) return;
    const updated = { ...userFilters, page: newPage };
    setUserFilters(updated);
    fetchUsers(updated);
  };

  const handleToggleStatus = async (user) => {
    setActionLoading(user._id);
    const newStatus = !user.isActive;
    try {
      const res = await adminService.updateUserStatus(user._id, newStatus);
      if (res.success) {
        showToast(`Account status for ${user.email} successfully ${newStatus ? 'activated' : 'blocked'}!`);
        // Update user state locally
        setUsersData(prev => ({
          ...prev,
          users: prev.users.map(u => u._id === user._id ? { ...u, isActive: newStatus } : u)
        }));
        // Reload logs
        const logsRes = await adminService.getAuditLogs();
        if (logsRes.success) setAuditLogs(logsRes.data);
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to toggle account block status.', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleRole = async (user) => {
    setActionLoading(user._id);
    const newRole = user.role === 'SUPER_ADMIN' ? 'USER' : 'SUPER_ADMIN';
    try {
      const res = await adminService.updateUserRole(user._id, newRole);
      if (res.success) {
        showToast(`User role successfully changed to ${newRole}!`);
        // Update user state locally
        setUsersData(prev => ({
          ...prev,
          users: prev.users.map(u => u._id === user._id ? { ...u, role: newRole } : u)
        }));
        // Reload logs
        const logsRes = await adminService.getAuditLogs();
        if (logsRes.success) setAuditLogs(logsRes.data);
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to update user security role.', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const openOverrideModal = (user) => {
    setOverrideUser(user);
    setOverrideForm({
      plan: user.subscription?.plan || 'free',
      status: user.subscription?.status || 'none',
      currentPeriodEnd: user.subscription?.currentPeriodEnd 
        ? new Date(user.subscription.currentPeriodEnd).toISOString().split('T')[0] 
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    });
  };

  const handleOverrideSave = async (e) => {
    e.preventDefault();
    try {
      const res = await adminService.manualOverrideSubscription(overrideUser._id, overrideForm);
      if (res.success) {
        showToast(`Manually overrode plan parameters for ${overrideUser.email}!`);
        setOverrideUser(null);
        // Reload directories & stats
        await Promise.all([
          loadStatsAndData(),
          fetchUsers()
        ]);
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to override user subscription.', 'error');
    }
  };

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 4000);
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  };

  const formatTokens = (val) => {
    if (val >= 1000000) return (val / 1000000).toFixed(1) + 'M';
    if (val >= 1000) return (val / 1000).toFixed(1) + 'k';
    return val;
  };

  if (loading) {
    return (
      <div className="min-h-[500px] flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-10 w-10 text-indigo-500 animate-spin" />
          <p className="text-zinc-500 dark:text-zinc-400 text-sm font-medium">Entering secure admin console...</p>
        </div>
      </div>
    );
  }

  // 1. Password Lock Gate Screen
  if (!unlocked) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4 relative">
        <div className="absolute top-1/4 left-1/4 h-72 w-72 bg-indigo-500/10 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-1/4 right-1/4 h-72 w-72 bg-fuchsia-500/10 rounded-full blur-[100px]"></div>

        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-md w-full bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/80 rounded-3xl p-8 shadow-2xl relative overflow-hidden backdrop-blur-md"
        >
          <div className="space-y-6 flex flex-col items-center text-center">
            <div className="h-14 w-14 rounded-2xl bg-indigo-550/10 dark:bg-indigo-650/15 border border-indigo-500/30 flex items-center justify-center shadow-inner">
              <Lock className="h-6 w-6 text-indigo-550 dark:text-indigo-400" />
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-black text-zinc-950 dark:text-white tracking-tight">Admin Lock Console</h1>
              <p className="text-zinc-500 dark:text-zinc-450 text-xs max-w-xs leading-relaxed">
                Authorized credentials validation required. Enter administrative key to access client databases.
              </p>
            </div>

            <form onSubmit={handleUnlock} className="w-full space-y-4">
              <div className="space-y-1">
                <input
                  type="password"
                  placeholder="Enter administrative passcode"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-950/80 border border-zinc-200 dark:border-zinc-800/80 rounded-xl py-3 px-4 text-sm text-zinc-900 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-center tracking-widest"
                  autoFocus
                />
                {passcodeError && (
                  <p className="text-[11px] text-red-500 font-semibold text-left flex items-center gap-1.5 mt-2.5">
                    <AlertCircle className="h-3.5 w-3.5" />
                    <span>{passcodeError}</span>
                  </p>
                )}
              </div>

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl py-3 text-sm font-bold shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/35 transition-all cursor-pointer flex items-center justify-center space-x-2"
              >
                <span>Unlock Terminal</span>
                <ArrowUpRight className="h-4 w-4" />
              </button>
            </form>
          </div>
        </motion.div>
      </div>
    );
  }

  // Plan HSL highlights
  const PLAN_COLORS = {
    free: 'text-zinc-500 bg-zinc-500/10 border-zinc-500/20',
    starter: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
    professional: 'text-violet-500 bg-violet-500/10 border-violet-500/20',
    agency: 'text-rose-500 bg-rose-500/10 border-rose-500/20'
  };

  const kpis = stats?.kpis || {};

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="space-y-8 py-4"
    >
      {/* Toast Alert */}
      <AnimatePresence>
        {toast.show && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-6 right-6 z-50 flex items-center space-x-3 px-4 py-3 rounded-xl border text-sm font-semibold shadow-xl backdrop-blur-md ${
              toast.type === 'error'
                ? 'bg-red-500/10 border-red-500/20 text-red-400'
                : toast.type === 'info'
                ? 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
            }`}
          >
            {toast.type === 'error' ? (
              <AlertCircle className="h-5 w-5 shrink-0" />
            ) : (
              <CheckCircle2 className="h-5 w-5 shrink-0" />
            )}
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Admin header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-zinc-200 dark:border-zinc-800/80">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-700 dark:from-white dark:via-zinc-100 dark:to-zinc-400 bg-clip-text text-transparent flex items-center space-x-3">
            <Settings className="h-8 w-8 text-indigo-500 shrink-0" />
            <span>Taraflow Control Deck</span>
          </h1>
          <p className="text-zinc-550 dark:text-zinc-400 text-sm mt-1">
            Global aggregates, system metrics billing, users logs tracking, and manually overrides.
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex p-1 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-bold shadow-sm shrink-0">
          {[
            { id: 'overview', name: 'Overview' },
            { id: 'users', name: 'User Management' },
            { id: 'ai', name: 'AI & Usage' },
            { id: 'audits', name: 'Audit Logs' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-2 rounded-lg transition-all cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-white dark:bg-zinc-800 text-indigo-600 dark:text-white shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-850 dark:hover:text-zinc-350'
              }`}
            >
              {tab.name}
            </button>
          ))}
        </div>
      </div>

      {/* Overview Tab View */}
      {activeTab === 'overview' && (
        <div className="space-y-8 animate-fade-in">
          {/* KPI Dashboard Cards Grid */}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { name: 'Platform Users', value: kpis.totalUsers || 0, sub: 'Total signups', icon: Users, color: 'from-blue-600 to-indigo-500' },
              { name: 'MRR', value: formatCurrency(kpis.mrr || 0), sub: 'Active recurring income', icon: DollarSign, color: 'from-emerald-600 to-teal-500' },
              { name: 'Cumulative Revenue', value: formatCurrency(kpis.totalRevenue || 0), sub: 'Gross transactions', icon: DollarSign, color: 'from-violet-600 to-purple-500' },
              { name: 'AI Generative Tokens', value: formatTokens(kpis.totalTokensUsed || 0), sub: 'Overall model load', icon: Activity, color: 'from-rose-600 to-pink-500' }
            ].map((card, i) => (
              <div
                key={i}
                className="bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-6 relative overflow-hidden group shadow-sm hover:border-zinc-300 dark:hover:border-zinc-700 transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-450 dark:text-zinc-500 uppercase tracking-widest">{card.name}</span>
                  <div className={`h-8 w-8 rounded-lg bg-gradient-to-tr ${card.color} flex items-center justify-center shadow`}>
                    <card.icon className="h-4.5 w-4.5 text-white" />
                  </div>
                </div>
                <div className="mt-4 space-y-1">
                  <span className="text-3xl font-black text-zinc-900 dark:text-white tracking-tight">{card.value}</span>
                  <span className="text-[10px] text-zinc-450 dark:text-zinc-550 block font-medium">{card.sub}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Revenue and Subscription distributions */}
          <div className="grid gap-8 lg:grid-cols-3">
            {/* Revenue Trend Area Chart */}
            <div className="lg:col-span-2 bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-6 shadow-sm space-y-4">
              <div>
                <h3 className="font-bold text-zinc-950 dark:text-white text-base">Revenue Timeline</h3>
                <p className="text-[11px] text-zinc-400 dark:text-zinc-550">Daily gross revenue compiled over historical invoices</p>
              </div>

              <div className="h-72">
                {stats?.revenueTimeline && stats.revenueTimeline.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={stats.revenueTimeline} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="revenueGlow" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" className="dark:hidden" />
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" className="hidden dark:block" />
                      <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} tickLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} tickFormatter={(v) => `$${v}`} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'rgba(24, 24, 27, 0.9)', 
                          border: '1px solid rgba(63, 63, 70, 0.4)', 
                          borderRadius: '12px',
                          color: '#fff'
                        }}
                      />
                      <Area type="monotone" dataKey="amount" stroke="#6366f1" strokeWidth={2.5} fillOpacity={1} fill="url(#revenueGlow)" name="Revenue ($)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-zinc-500 text-xs">
                    No timeline invoice transactions logged.
                  </div>
                )}
              </div>
            </div>

            {/* Plans Distribution chart */}
            <div className="bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-6 shadow-sm space-y-4">
              <div>
                <h3 className="font-bold text-zinc-950 dark:text-white text-base">Subscription Tiers</h3>
                <p className="text-[11px] text-zinc-400 dark:text-zinc-550">Distribution of platform accounts by membership plan</p>
              </div>

              <div className="h-72 flex items-center justify-center">
                {stats?.subscriptionDistribution ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stats.subscriptionDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={85}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {[
                          { plan: 'Free', color: '#94a3b8' },
                          { plan: 'Starter', color: '#3b82f6' },
                          { plan: 'Professional', color: '#8b5cf6' },
                          { plan: 'Agency', color: '#ec4899' }
                        ].map((cell, index) => (
                          <Cell key={`cell-${index}`} fill={cell.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'rgba(24, 24, 27, 0.9)',
                          border: '1px solid rgba(63, 63, 70, 0.4)',
                          borderRadius: '12px',
                          color: '#fff'
                        }}
                      />
                      <Legend verticalAlign="bottom" height={36} iconSize={10} iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-zinc-500 text-xs">No distribution records found.</div>
                )}
              </div>
            </div>
          </div>

          {/* Recent Sales History */}
          <div className="bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-6 shadow-sm space-y-4">
            <div>
              <h3 className="font-bold text-zinc-950 dark:text-white text-base">Recent Sales Invoices</h3>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-550">Latest paid transactions processed via Stripe & Razorpay</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-zinc-800 text-zinc-400 dark:text-zinc-500 uppercase tracking-widest font-black text-[10px]">
                    <th className="py-3 px-4">Invoice ID</th>
                    <th className="py-3 px-4">User</th>
                    <th className="py-3 px-4">Gateway</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50 dark:divide-zinc-850/60 text-zinc-700 dark:text-zinc-300">
                  {stats?.recentInvoices && stats.recentInvoices.length > 0 ? (
                    stats.recentInvoices.map((invoice) => (
                      <tr key={invoice._id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/10">
                        <td className="py-3.5 px-4 font-bold text-zinc-950 dark:text-white">{invoice.invoiceId}</td>
                        <td className="py-3.5 px-4">
                          <p className="font-semibold">{invoice.userId ? `${invoice.userId.firstName} ${invoice.userId.lastName}` : 'N/A'}</p>
                          <p className="text-[10px] text-zinc-500">{invoice.userId?.email}</p>
                        </td>
                        <td className="py-3.5 px-4 font-semibold capitalize text-zinc-500">{invoice.gateway}</td>
                        <td className="py-3.5 px-4 font-extrabold text-zinc-900 dark:text-zinc-250">
                          {invoice.currency === 'inr' ? '₹' : '$'}{invoice.amount.toFixed(2)}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center rounded-full bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 text-[9px] font-extrabold text-emerald-600 dark:text-emerald-400 uppercase">
                            {invoice.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-zinc-400">
                          {new Date(invoice.date).toLocaleDateString()}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-zinc-500">No transaction invoice histories logged.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* User Directory Tab View */}
      {activeTab === 'users' && (
        <div className="space-y-6 animate-fade-in">
          {/* User Filters bar */}
          <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-zinc-450 dark:text-zinc-500" />
              <input
                type="text"
                placeholder="Search user email or display names..."
                value={userFilters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="w-full bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/80 rounded-xl py-2.5 pl-10 pr-4 text-xs text-zinc-900 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-650 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-sm"
              />
            </div>

            {/* Plan filter */}
            <div className="flex gap-4 shrink-0">
              <select
                value={userFilters.plan}
                onChange={(e) => handleFilterChange('plan', e.target.value)}
                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-700 dark:text-zinc-300 focus:outline-none shadow-sm font-semibold cursor-pointer"
              >
                <option value="">All Plan Tiers</option>
                <option value="free">Free</option>
                <option value="starter">Starter</option>
                <option value="professional">Professional</option>
                <option value="agency">Agency</option>
              </select>

              {/* Status filter */}
              <select
                value={userFilters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-700 dark:text-zinc-300 focus:outline-none shadow-sm font-semibold cursor-pointer"
              >
                <option value="">All Statuses</option>
                <option value="active">Active Accounts</option>
                <option value="blocked">Blocked Accounts</option>
              </select>
            </div>
          </div>

          {/* Users List directory Table */}
          <div className="bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-6 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-zinc-800 text-zinc-400 dark:text-zinc-500 uppercase tracking-widest font-black text-[10px]">
                    <th className="py-3 px-4">User Name</th>
                    <th className="py-3 px-4">Membership Plan</th>
                    <th className="py-3 px-4">Security Role</th>
                    <th className="py-3 px-4">Billing Status</th>
                    <th className="py-3 px-4">Created Date</th>
                    <th className="py-3 px-4 text-right">Actions Operations</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50 dark:divide-zinc-850/60 text-zinc-700 dark:text-zinc-300">
                  {usersData.users && usersData.users.length > 0 ? (
                    usersData.users.map((user) => (
                      <tr key={user._id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/10">
                        <td className="py-3.5 px-4">
                          <p className="font-bold text-zinc-900 dark:text-white">{user.firstName} {user.lastName}</p>
                          <p className="text-[10px] text-zinc-450 dark:text-zinc-500">{user.email}</p>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[9px] font-extrabold uppercase ${PLAN_COLORS[user.subscription?.plan || 'free']}`}>
                            {user.subscription?.plan || 'free'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`font-bold uppercase text-[10px] ${user.role === 'SUPER_ADMIN' ? 'text-indigo-400' : 'text-zinc-450'}`}>
                            {user.role}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase ${
                            user.isActive 
                              ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
                              : 'bg-red-500/10 text-red-500 border border-red-500/20'
                          }`}>
                            {user.isActive ? 'Active' : 'Blocked'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-zinc-450">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-3.5 px-4 text-right space-x-2 shrink-0">
                          {/* Block/Unblock toggle */}
                          <button
                            type="button"
                            disabled={actionLoading === user._id}
                            onClick={() => handleToggleStatus(user)}
                            className={`px-2 py-1 rounded text-[10px] font-bold transition-all cursor-pointer ${
                              user.isActive 
                                ? 'bg-red-550/10 hover:bg-red-500 hover:text-white text-red-400 border border-red-500/20' 
                                : 'bg-emerald-550/10 hover:bg-emerald-500 hover:text-white text-emerald-450 border border-emerald-550/20'
                            } disabled:opacity-50`}
                          >
                            {user.isActive ? 'Block' : 'Unblock'}
                          </button>

                          {/* Role Toggle */}
                          <button
                            type="button"
                            disabled={actionLoading === user._id}
                            onClick={() => handleToggleRole(user)}
                            className="px-2 py-1 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-200/50 dark:border-zinc-700 rounded text-[10px] font-bold transition-all cursor-pointer disabled:opacity-50"
                          >
                            Role
                          </button>

                          {/* Subscription Override button */}
                          <button
                            type="button"
                            onClick={() => openOverrideModal(user)}
                            className="inline-flex items-center space-x-1 px-2 py-1 bg-indigo-600 hover:bg-indigo-550 text-white rounded text-[10px] font-bold transition-all cursor-pointer"
                          >
                            <Edit className="h-3 w-3" />
                            <span>Override</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-zinc-500">No users found match criteria.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls bar */}
            {usersData.pagination && usersData.pagination.pages > 1 && (
              <div className="flex justify-between items-center border-t border-zinc-100 dark:border-zinc-800/80 pt-4 mt-4 text-xs font-semibold text-zinc-550 dark:text-zinc-450">
                <span>Page {usersData.pagination.page} of {usersData.pagination.pages}</span>
                <div className="flex space-x-2">
                  <button
                    disabled={usersData.pagination.page === 1}
                    onClick={() => handlePageChange(usersData.pagination.page - 1)}
                    className="p-2 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900 cursor-pointer disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    disabled={usersData.pagination.page === usersData.pagination.pages}
                    onClick={() => handlePageChange(usersData.pagination.page + 1)}
                    className="p-2 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900 cursor-pointer disabled:opacity-40"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* AI & Usage Tab View */}
      {activeTab === 'ai' && (
        <div className="space-y-8 animate-fade-in">
          {/* Usage KPIs cards */}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { name: 'Total Requests', value: aiStats?.totals?.totalRequests || 0, icon: Database, color: 'from-blue-600 to-indigo-500' },
              { name: 'Prompt Tokens', value: formatTokens(aiStats?.totals?.totalPromptTokens || 0), icon: Activity, color: 'from-violet-600 to-purple-500' },
              { name: 'Completion Tokens', value: formatTokens(aiStats?.totals?.totalCompletionTokens || 0), icon: ArrowUpRight, color: 'from-rose-600 to-pink-500' },
              { name: 'Combined Token Loads', value: formatTokens(aiStats?.totals?.totalTokens || 0), icon: Layers, color: 'from-amber-600 to-orange-500' }
            ].map((kpi, idx) => (
              <div key={idx} className="bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-450 dark:text-zinc-500 uppercase tracking-widest">{kpi.name}</span>
                  <div className={`h-8 w-8 rounded-lg bg-gradient-to-tr ${kpi.color} flex items-center justify-center shadow`}>
                    <kpi.icon className="h-4.5 w-4.5 text-white" />
                  </div>
                </div>
                <div className="mt-4">
                  <span className="text-3xl font-black text-zinc-900 dark:text-white tracking-tight">{kpi.value}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-8 lg:grid-cols-3">
            {/* Daily usage timeline line graph */}
            <div className="lg:col-span-2 bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-6 shadow-sm space-y-4">
              <div>
                <h3 className="font-bold text-zinc-950 dark:text-white text-base">Token Timeline Trends</h3>
                <p className="text-[11px] text-zinc-400 dark:text-zinc-550">Timeline metrics of prompt, completion, and total combined usage</p>
              </div>

              <div className="h-72">
                {aiStats?.timeline && aiStats.timeline.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={aiStats.timeline} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" className="hidden dark:block" />
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" className="dark:hidden" />
                      <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} tickLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'rgba(24, 24, 27, 0.9)',
                          border: '1px solid rgba(63, 63, 70, 0.4)',
                          borderRadius: '12px',
                          color: '#fff'
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                      <Line type="monotone" dataKey="promptTokens" stroke="#8b5cf6" strokeWidth={2} name="Prompt Tokens" dot={false} />
                      <Line type="monotone" dataKey="completionTokens" stroke="#ec4899" strokeWidth={2} name="Completion Tokens" dot={false} />
                      <Line type="monotone" dataKey="totalTokens" stroke="#3b82f6" strokeWidth={2.5} name="Total Tokens" dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-zinc-500 text-xs">
                    No timeline generations metrics logged.
                  </div>
                )}
              </div>
            </div>

            {/* Breakdown by tool usage pie chart */}
            <div className="bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-6 shadow-sm space-y-4">
              <div>
                <h3 className="font-bold text-zinc-950 dark:text-white text-base">Tool Generation Breakdowns</h3>
                <p className="text-[11px] text-zinc-400 dark:text-zinc-550">Distribution of total tokens consumed by request feature type</p>
              </div>

              <div className="h-72 flex items-center justify-center">
                {aiStats?.breakdown && aiStats.breakdown.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={aiStats.breakdown}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={80}
                        paddingAngle={4}
                        dataKey="tokens"
                        nameKey="type"
                      >
                        {aiStats.breakdown.map((entry, index) => {
                          const COLORS = ['#6366f1', '#a855f7', '#ec4899', '#3b82f6', '#0ea5e9', '#10b981', '#f59e0b'];
                          return <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />;
                        })}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'rgba(24, 24, 27, 0.9)',
                          border: '1px solid rgba(63, 63, 70, 0.4)',
                          borderRadius: '12px',
                          color: '#fff'
                        }}
                      />
                      <Legend verticalAlign="bottom" height={42} layout="horizontal" iconSize={8} iconType="circle" wrapperStyle={{ fontSize: '9px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-zinc-500 text-xs">No tool requests logged.</div>
                )}
              </div>
            </div>
          </div>

          {/* Top Token users table */}
          <div className="bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-6 shadow-sm space-y-4">
            <div>
              <h3 className="font-bold text-zinc-950 dark:text-white text-base">Top Token Users</h3>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-550">Users consuming highest volumes of system AI tokens</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-zinc-800 text-zinc-400 dark:text-zinc-500 uppercase tracking-widest font-black text-[10px]">
                    <th className="py-3 px-4">User</th>
                    <th className="py-3 px-4">Tokens Consumed</th>
                    <th className="py-3 px-4">Generative Requests</th>
                    <th className="py-3 px-4 text-right">Avg Tokens / Request</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50 dark:divide-zinc-850/60 text-zinc-700 dark:text-zinc-300">
                  {aiStats?.topUsers && aiStats.topUsers.length > 0 ? (
                    aiStats.topUsers.map((item, idx) => (
                      <tr key={item.userId} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/10">
                        <td className="py-3 px-4 flex items-center space-x-3.5">
                          <span className="font-black text-zinc-400 w-4">{idx + 1}</span>
                          <div>
                            <p className="font-bold text-zinc-950 dark:text-white">{item.name}</p>
                            <p className="text-[10px] text-zinc-500">{item.email}</p>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-extrabold text-zinc-900 dark:text-zinc-200">{formatTokens(item.tokens)}</td>
                        <td className="py-3 px-4 font-semibold text-zinc-500">{item.requests} requests</td>
                        <td className="py-3 px-4 text-right text-zinc-400">
                          {Math.round(item.tokens / item.requests)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-zinc-500">No token activity records logged.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* System Audit logs tab */}
      {activeTab === 'audits' && (
        <div className="bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-6 shadow-sm space-y-4 animate-fade-in">
          <div>
            <h3 className="font-bold text-zinc-950 dark:text-white text-base flex items-center space-x-2">
              <ShieldCheck className="h-5 w-5 text-indigo-500 shrink-0" />
              <span>Administrative Audit Trail</span>
            </h3>
            <p className="text-[11px] text-zinc-400 dark:text-zinc-550">Chronological trail of updates, status changes, overrides made by administrators</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800 text-zinc-400 dark:text-zinc-500 uppercase tracking-widest font-black text-[10px]">
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Administrator</th>
                  <th className="py-3 px-4">Target User</th>
                  <th className="py-3 px-4">Log Description details</th>
                  <th className="py-3 px-4">IP Address</th>
                  <th className="py-3 px-4 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50 dark:divide-zinc-850/60 text-zinc-700 dark:text-zinc-300">
                {auditLogs && auditLogs.length > 0 ? (
                  auditLogs.map((log) => (
                    <tr key={log._id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/10">
                      <td className="py-3.5 px-4">
                        <span className="capitalize text-[10px] font-bold bg-zinc-100 dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded border border-zinc-200/50 dark:border-zinc-700">
                          {log.action.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="font-semibold">{log.adminId ? `${log.adminId.firstName} ${log.adminId.lastName}` : 'System'}</p>
                        <p className="text-[10px] text-zinc-500">{log.adminEmail}</p>
                      </td>
                      <td className="py-3.5 px-4 text-zinc-500">
                        {log.targetUserId ? `${log.targetUserId.firstName} ${log.targetUserId.lastName}` : 'None'}
                      </td>
                      <td className="py-3.5 px-4 font-medium max-w-[280px] truncate" title={log.details}>
                        {log.details}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-zinc-500">{log.ipAddress || '127.0.0.1'}</td>
                      <td className="py-3.5 px-4 text-right text-zinc-400">
                        <span className="flex items-center justify-end space-x-1.5">
                          <Clock className="h-3 w-3 text-zinc-500" />
                          <span>{new Date(log.timestamp).toLocaleString()}</span>
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-zinc-500">No administrative logs recorded.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Subscription Override Modal Overlay */}
      {overrideUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-805 rounded-2xl p-6 shadow-2xl space-y-6"
          >
            <div>
              <h3 className="font-black text-lg text-zinc-950 dark:text-white flex items-center space-x-2">
                <Layers className="h-5 w-5 text-indigo-500" />
                <span>Override Subscription</span>
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-450 mt-1">
                Target User: <strong className="text-zinc-700 dark:text-zinc-300">{overrideUser.firstName} {overrideUser.lastName}</strong> ({overrideUser.email})
              </p>
            </div>

            <form onSubmit={handleOverrideSave} className="space-y-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">
              {/* Choose Plan */}
              <div className="space-y-2">
                <label className="block">Plan Tier</label>
                <select
                  value={overrideForm.plan}
                  onChange={(e) => setOverrideForm({ ...overrideForm, plan: e.target.value })}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl py-2.5 px-3 text-zinc-800 dark:text-zinc-200 focus:outline-none"
                >
                  <option value="free">Free</option>
                  <option value="starter">Starter ($29/mo)</option>
                  <option value="professional">Professional ($79/mo)</option>
                  <option value="agency">Agency ($249/mo)</option>
                </select>
              </div>

              {/* Status */}
              <div className="space-y-2">
                <label className="block">Billing Status</label>
                <select
                  value={overrideForm.status}
                  onChange={(e) => setOverrideForm({ ...overrideForm, status: e.target.value })}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl py-2.5 px-3 text-zinc-800 dark:text-zinc-200 focus:outline-none"
                >
                  <option value="none">None</option>
                  <option value="active">Active</option>
                  <option value="trialing">Trialing</option>
                  <option value="past_due">Past Due</option>
                  <option value="canceled">Canceled</option>
                  <option value="unpaid">Unpaid</option>
                </select>
              </div>

              {/* Period End */}
              <div className="space-y-2">
                <label className="block flex items-center space-x-1.5">
                  <Calendar className="h-3.5 w-3.5 text-zinc-450" />
                  <span>Current Period End Date</span>
                </label>
                <input
                  type="date"
                  value={overrideForm.currentPeriodEnd}
                  onChange={(e) => setOverrideForm({ ...overrideForm, currentPeriodEnd: e.target.value })}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl py-2.5 px-3 text-zinc-800 dark:text-zinc-200 focus:outline-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3 pt-4 font-bold tracking-normal text-sm uppercase-none normal-case">
                <button
                  type="button"
                  onClick={() => setOverrideUser(null)}
                  className="flex-1 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 rounded-xl py-2.5 font-bold transition-all cursor-pointer text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-indigo-650 hover:bg-indigo-600 text-white rounded-xl py-2.5 font-bold transition-all cursor-pointer text-center shadow-lg shadow-indigo-500/10"
                >
                  Save Override
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
};

export default AdminDashboard;
