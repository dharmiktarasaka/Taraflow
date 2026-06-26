import React, { createContext, useState, useEffect, useContext } from 'react';
import socialService from '../services/socialService';
import contentService from '../services/contentService';
import billingService from '../services/billingService';
import analyticsService from '../services/analyticsService';
import aiService from '../services/aiService';
import workspaceService from '../services/workspaceService';

const DataContext = createContext(null);

export const DataProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [connectedAccounts, setConnectedAccounts] = useState([]);
  const [learningProfile, setLearningProfile] = useState(null);
  const [brandProfile, setBrandProfile] = useState({
    companyName: '',
    industry: '',
    products: '',
    services: '',
    targetAudience: '',
    toneOfVoice: '',
    keywords: '',
    competitors: ''
  });
  
  const [workspaces, setWorkspaces] = useState([]);
  const [currentWorkspace, setCurrentWorkspace] = useState(null);

  // Analytics Cache by platform and days
  // Key format: `${platform}_${days}`
  const [analyticsCache, setAnalyticsCache] = useState({});
  const [topPostsCache, setTopPostsCache] = useState({});

  const [loading, setLoading] = useState({
    user: true,
    posts: true,
    accounts: true,
    brand: true,
    learning: true,
    analytics: false
  });

  const [errors, setErrors] = useState({
    user: '',
    posts: '',
    accounts: '',
    brand: '',
    learning: '',
    analytics: ''
  });

  const fetchUser = async (force = false) => {
    if (!force && currentUser) return;
    setLoading(prev => ({ ...prev, user: true }));
    try {
      const res = await billingService.getProfile();
      if (res && res.success) {
        setCurrentUser(res.data.user);
        
        // Fetch workspaces associated with the user
        const workspaceRes = await workspaceService.getWorkspaces();
        if (workspaceRes && workspaceRes.success) {
          const list = workspaceRes.workspaces || [];
          setWorkspaces(list);
          if (list.length > 0) {
            const cachedId = localStorage.getItem('activeWorkspaceId');
            const found = list.find(w => w._id === cachedId);
            const active = found || list[0];
            setCurrentWorkspace(active);
            localStorage.setItem('activeWorkspaceId', active._id);
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch user profile:', err);
      setErrors(prev => ({ ...prev, user: 'Failed to load user profile.' }));
    } finally {
      setLoading(prev => ({ ...prev, user: false }));
    }
  };

  const fetchPosts = async (force = false) => {
    if (!force && posts.length > 0) return;
    setLoading(prev => ({ ...prev, posts: true }));
    try {
      const postsData = await contentService.getPosts();
      setPosts(postsData || []);
    } catch (err) {
      console.error('Failed to fetch posts:', err);
      setErrors(prev => ({ ...prev, posts: 'Failed to load posts.' }));
    } finally {
      setLoading(prev => ({ ...prev, posts: false }));
    }
  };

  const fetchAccounts = async (force = false) => {
    if (!force && connectedAccounts.length > 0) return;
    setLoading(prev => ({ ...prev, accounts: true }));
    try {
      const response = await socialService.getAccounts();
      setConnectedAccounts(response.data || []);
    } catch (err) {
      console.error('Failed to fetch accounts:', err);
      setErrors(prev => ({ ...prev, accounts: 'Failed to load social accounts.' }));
    } finally {
      setLoading(prev => ({ ...prev, accounts: false }));
    }
  };

  const fetchLearningProfile = async (force = false) => {
    if (!force && learningProfile) return;
    setLoading(prev => ({ ...prev, learning: true }));
    try {
      const response = await analyticsService.getLearningProfile();
      if (response && response.success) {
        setLearningProfile(response.profile || null);
      }
    } catch (err) {
      console.error('Failed to fetch learning profile:', err);
      setErrors(prev => ({ ...prev, learning: 'Failed to load learning profile.' }));
    } finally {
      setLoading(prev => ({ ...prev, learning: false }));
    }
  };

  const fetchBrandProfile = async (force = false) => {
    if (!force && brandProfile.companyName) return;
    setLoading(prev => ({ ...prev, brand: true }));
    try {
      const response = await aiService.getBrandProfile();
      if (response && response.success && response.result) {
        setBrandFormState(response.result);
      }
    } catch (err) {
      console.error('Failed to load brand profile', err);
      setErrors(prev => ({ ...prev, brand: 'Failed to load brand profile.' }));
    } finally {
      setLoading(prev => ({ ...prev, brand: false }));
    }
  };

  const setBrandFormState = (data) => {
    setBrandProfile({
      companyName: data.companyName || '',
      industry: data.industry || '',
      products: data.products || '',
      services: data.services || '',
      targetAudience: data.targetAudience || '',
      toneOfVoice: data.toneOfVoice || '',
      keywords: data.keywords || '',
      competitors: data.competitors || ''
    });
  };

  const fetchAnalytics = async (platform = 'all', days = 30, force = false) => {
    const cacheKey = `${platform}_${days}`;
    if (!force && analyticsCache[cacheKey] && topPostsCache[cacheKey]) {
      return {
        overview: analyticsCache[cacheKey],
        topPosts: topPostsCache[cacheKey]
      };
    }

    setLoading(prev => ({ ...prev, analytics: true }));
    try {
      const [overviewRes, postsRes] = await Promise.all([
        analyticsService.getOverview({ platform, days }),
        analyticsService.getTopPosts({ limit: 10, sortBy: 'engagementRate', platform })
      ]);

      let overviewData = null;
      if (overviewRes && overviewRes.success) {
        overviewData = overviewRes;
        setAnalyticsCache(prev => ({ ...prev, [cacheKey]: overviewRes }));
      }

      let topPostsData = [];
      if (postsRes && postsRes.success) {
        topPostsData = postsRes.posts || [];
        setTopPostsCache(prev => ({ ...prev, [cacheKey]: topPostsData }));
      }

      return { overview: overviewData, topPosts: topPostsData };
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
      setErrors(prev => ({ ...prev, analytics: 'Failed to load analytics data.' }));
      throw err;
    } finally {
      setLoading(prev => ({ ...prev, analytics: false }));
    }
  };

  // Pre-load all primary data once when the application starts
  useEffect(() => {
    fetchUser();
    fetchPosts();
    fetchAccounts();
    fetchLearningProfile();
    fetchBrandProfile();
  }, []);

  const refreshAll = async () => {
    await Promise.all([
      fetchUser(true),
      fetchPosts(true),
      fetchAccounts(true),
      fetchLearningProfile(true),
      fetchBrandProfile(true)
    ]);
  };

  const switchWorkspace = async (workspaceId) => {
    const found = workspaces.find(w => w._id === workspaceId);
    if (found) {
      setCurrentWorkspace(found);
      localStorage.setItem('activeWorkspaceId', workspaceId);
      await refreshAll();
    }
  };

  return (
    <DataContext.Provider value={{
      currentUser,
      setCurrentUser,
      posts,
      setPosts,
      connectedAccounts,
      setConnectedAccounts,
      learningProfile,
      setLearningProfile,
      brandProfile,
      setBrandProfile,
      setBrandFormState,
      analyticsCache,
      setAnalyticsCache,
      topPostsCache,
      setTopPostsCache,
      loading,
      errors,
      fetchUser,
      fetchPosts,
      fetchAccounts,
      fetchLearningProfile,
      fetchBrandProfile,
      fetchAnalytics,
      refreshAll,
      workspaces,
      setWorkspaces,
      currentWorkspace,
      setCurrentWorkspace,
      switchWorkspace
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};
