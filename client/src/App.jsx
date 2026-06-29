import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import ContainStudio from './pages/ContainStudio';
import CarouselBuilder from './pages/CarouselBuilder';
import Scheduler from './pages/Scheduler';
import Analytics from './pages/Analytics';
import SocialAccounts from './pages/SocialAccounts';
import SocialCallback from './pages/SocialCallback';
import Workspace from './pages/Workspace';
import WorkspaceInviteAccept from './pages/WorkspaceInviteAccept';
import Billing from './pages/Billing';
import SettingsPage from './pages/Settings';
import CompetitorIntelligence from './pages/CompetitorIntelligence';

import axios from 'axios';

import { DataProvider, useData } from './context/DataContext';

// Mock authentication for development purposes
if (!localStorage.getItem('accessToken') || localStorage.getItem('accessToken') === 'undefined') {
  localStorage.setItem('accessToken', 'development_mock_jwt_token');
}

// Global request interceptor to attach JWT token and active Workspace ID
axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    const activeWorkspaceId = localStorage.getItem('activeWorkspaceId');
    if (activeWorkspaceId) {
      config.headers['X-Workspace-ID'] = activeWorkspaceId;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Global response interceptor to handle token expiration/invalidation in dev mode
axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      console.warn('Access token invalid or expired. Resetting to development mock token.');
      localStorage.setItem('accessToken', 'development_mock_jwt_token');
      originalRequest.headers['Authorization'] = 'Bearer development_mock_jwt_token';
      return axios(originalRequest);
    }
    return Promise.reject(error);
  }
);

// Legacy permission string to key map for route checks
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

const ProtectedRoute = ({ children, requiredPermission }) => {
  const { currentWorkspace, loading } = useData();

  if (loading.user) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  if (!currentWorkspace) {
    return children;
  }

  // Owner bypasses all checks
  if (currentWorkspace.role === 'Owner') {
    return children;
  }

  const permissions = currentWorkspace.permissions || {};
  
  const checkSingle = (perm) => {
    const key = permissionMap[perm] || perm;
    return permissions[key] === true;
  };

  const hasAccess = Array.isArray(requiredPermission)
    ? requiredPermission.some(p => checkSingle(p))
    : checkSingle(requiredPermission);

  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="h-16 w-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mb-6">
          <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-2xl font-black text-zinc-900 dark:text-white">403 Access Denied</h2>
        <p className="text-zinc-550 dark:text-zinc-400 mt-2 max-w-md text-sm">
          You do not have permission to access this page. Contact your workspace administrator.
        </p>
      </div>
    );
  }

  return children;
};

const App = () => {
  return (
    <DataProvider>
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Layout>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={
              <ProtectedRoute requiredPermission="adminDashboard">
                <Dashboard />
              </ProtectedRoute>
            } />
            
            <Route path="/contain-studio" element={
              <ProtectedRoute requiredPermission={['contentStudio', 'aiWriter', 'imageGenerator']}>
                <ContainStudio />
              </ProtectedRoute>
            } />
            <Route path="/carousel-builder" element={
              <ProtectedRoute requiredPermission={['contentStudio', 'aiWriter']}>
                <CarouselBuilder />
              </ProtectedRoute>
            } />
            <Route path="/scheduler" element={
              <ProtectedRoute requiredPermission={['contentStudio', 'postScheduling']}>
                <Scheduler />
              </ProtectedRoute>
            } />
            <Route path="/analytics" element={
              <ProtectedRoute requiredPermission="analytics">
                <Analytics />
              </ProtectedRoute>
            } />
            <Route path="/competitor-intelligence" element={
              <ProtectedRoute requiredPermission="competitorAI">
                <CompetitorIntelligence />
              </ProtectedRoute>
            } />
            <Route path="/social-accounts" element={
              <ProtectedRoute requiredPermission="connectedAccounts">
                <SocialAccounts />
              </ProtectedRoute>
            } />
            <Route path="/social/callback/:platform" element={<SocialCallback />} />
            <Route path="/workspace" element={<Navigate to="/dashboard" replace />} />
            <Route path="/workspace/invite/:token" element={<Navigate to="/dashboard" replace />} />
            <Route path="/billing" element={
              <ProtectedRoute requiredPermission={['billing', 'subscription']}>
                <Billing />
              </ProtectedRoute>
            } />
            <Route path="/settings" element={
              <ProtectedRoute requiredPermission="settings">
                <SettingsPage />
              </ProtectedRoute>
            } />
            <Route path="*" element={
              <div className="text-center py-24">
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">404 - Page Not Found</h2>
                <p className="text-zinc-550 mt-2">The page you are looking for does not exist.</p>
              </div>
            } />
          </Routes>
        </Layout>
      </Router>
    </DataProvider>
  );
};

export default App;
