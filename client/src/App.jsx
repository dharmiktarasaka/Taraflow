import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import ContentIdeas from './pages/content/ContentIdeas';
import ContentIdeaDetail from './pages/content/ContentIdeaDetail';
import ContentIdeaForm from './pages/content/ContentIdeaForm';
import AIWriter from './pages/AIWriter';
import CarouselBuilder from './pages/CarouselBuilder';
import Scheduler from './pages/Scheduler';
import Analytics from './pages/Analytics';
import SocialAccounts from './pages/SocialAccounts';
import SocialCallback from './pages/SocialCallback';
import Workspace from './pages/Workspace';
import Billing from './pages/Billing';
import SettingsPage from './pages/Settings';
import AdminDashboard from './pages/AdminDashboard';

import axios from 'axios';

// Mock authentication for development purposes
if (!localStorage.getItem('accessToken') || localStorage.getItem('accessToken') === 'undefined') {
  localStorage.setItem('accessToken', 'development_mock_jwt_token');
}

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

const App = () => {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/content-studio" element={<ContentIdeas />} />
          {/* Support legacy route redirects */}
          <Route path="/content/ideas" element={<Navigate to="/content-studio" replace />} />
          <Route path="/content/ideas/create" element={<ContentIdeaForm />} />
          <Route path="/content/ideas/:id" element={<ContentIdeaDetail />} />
          <Route path="/content/ideas/:id/edit" element={<ContentIdeaForm />} />
          
          <Route path="/ai-writer" element={<AIWriter />} />
          <Route path="/carousel-builder" element={<CarouselBuilder />} />
          <Route path="/scheduler" element={<Scheduler />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/social-accounts" element={<SocialAccounts />} />
          <Route path="/social/callback/:platform" element={<SocialCallback />} />
          <Route path="/workspace" element={<Workspace />} />
          <Route path="/billing" element={<Billing />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="*" element={
            <div className="text-center py-24">
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">404 - Page Not Found</h2>
              <p className="text-zinc-500 mt-2">The page you are looking for does not exist.</p>
            </div>
          } />
        </Routes>
      </Layout>
    </Router>
  );
};

export default App;
