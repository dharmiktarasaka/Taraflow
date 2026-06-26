import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Download,
  Check,
  AlertCircle,
  Loader2,
  ArrowRight,
  TrendingUp,
  Info,
  Shield,
  Calendar,
  Users,
  FileText,
  ChevronDown,
  Globe,
  Settings,
  Star,
  Activity,
  Cpu,
  Brain,
  X,
  Trash2
} from 'lucide-react';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend
} from 'recharts';
import axios from 'axios';
import aiService from '../services/aiService';

// API root resolver
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

const renderSourceBadge = (source) => {
  if (source === 'scraped') {
    return <span className="inline-block ml-1.5 px-1.5 py-0.5 rounded text-[8px] font-extrabold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">🔌 Scraped</span>;
  }
  if (source === 'user') {
    return <span className="inline-block ml-1.5 px-1.5 py-0.5 rounded text-[8px] font-extrabold bg-indigo-500/10 text-indigo-650 dark:text-indigo-400 border border-indigo-500/20">✍️ User Provided</span>;
  }
  return <span className="inline-block ml-1.5 px-1.5 py-0.5 rounded text-[8px] font-extrabold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">🤖 AI Estimated</span>;
};

const CompetitorIntelligence = () => {
  // Page states
  const [analysesList, setAnalysesList] = useState([]);
  const [selectedAnalysis, setSelectedAnalysis] = useState(null);
  const [loadingList, setLoadingList] = useState(true);

  // Creation state
  const [competitors, setCompetitors] = useState([
    { name: '', website: '', socialHandles: { facebook: '', instagram: '', threads: '', linkedin: '' }, followers: '', rating: '', reviewsCount: '', showOptional: false }
  ]);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Active SWOT Tab
  const [activeSwotTab, setActiveSwotTab] = useState('user');

  // Selected Score for detail accordion
  const [hoveredScore, setHoveredScore] = useState(null);

  // Workflow activation
  const [workflowStatus, setWorkflowStatus] = useState({ loading: false, success: false, message: '' });

  // Brand Brain / Profile states
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [savingBrand, setSavingBrand] = useState(false);
  const [suggestingBrand, setSuggestingBrand] = useState(false);
  const [brandForm, setBrandForm] = useState({
    companyName: '',
    industry: '',
    products: '',
    services: '',
    targetAudience: '',
    toneOfVoice: '',
    keywords: '',
    competitors: ''
  });
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
  };

  useEffect(() => {
    fetchAnalyses();
    fetchBrandProfile();
  }, []);

  const fetchBrandProfile = async () => {
    try {
      const response = await aiService.getBrandProfile();
      if (response && response.success && response.result) {
        setBrandForm({
          companyName: response.result.companyName || '',
          industry: response.result.industry || '',
          products: response.result.products || '',
          services: response.result.services || '',
          targetAudience: response.result.targetAudience || '',
          toneOfVoice: response.result.toneOfVoice || '',
          keywords: response.result.keywords || '',
          competitors: response.result.competitors || ''
        });
      }
    } catch (err) {
      console.error('Failed to load brand profile', err);
    }
  };

  const handleBrandFormChange = (key, val) => {
    setBrandForm(prev => ({
      ...prev,
      [key]: val
    }));
  };

  const handleSaveBrandProfile = async () => {
    setSavingBrand(true);
    try {
      const response = await aiService.saveBrandProfile(brandForm);
      if (response && response.success) {
        showToast('Brand Brain saved successfully!', 'success');
        setDrawerOpen(false);
      } else {
        throw new Error('Save failed');
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to save Brand Brain details', 'error');
    } finally {
      setSavingBrand(false);
    }
  };

  const handleSuggestBrandProfile = async () => {
    if (!brandForm.companyName || !brandForm.companyName.trim()) {
      showToast('Please enter a Company Name first to get suggestions', 'error');
      return;
    }
    setSuggestingBrand(true);
    try {
      const response = await aiService.generate('brand_brain_suggestions', {
        companyName: brandForm.companyName,
        industry: brandForm.industry,
        products: brandForm.products
      });
      if (response && response.success && response.result) {
        const suggs = response.result;
        setBrandForm(prev => ({
          ...prev,
          industry: suggs.industry || prev.industry,
          products: suggs.products || prev.products,
          services: suggs.services || prev.services,
          targetAudience: suggs.targetAudience || prev.targetAudience,
          toneOfVoice: suggs.toneOfVoice || prev.toneOfVoice,
          keywords: suggs.keywords || prev.keywords
        }));
        showToast('Auto-filled suggestions successfully!', 'success');
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to generate brand brain suggestions', 'error');
    } finally {
      setSuggestingBrand(false);
    }
  };

  // Poll status if an analysis is pending or processing
  useEffect(() => {
    let timer;
    if (selectedAnalysis && (selectedAnalysis.status === 'pending' || selectedAnalysis.status === 'processing')) {
      timer = setInterval(() => {
        pollAnalysisStatus(selectedAnalysis._id);
      }, 3000);
    }
    return () => clearInterval(timer);
  }, [selectedAnalysis]);

  const fetchAnalyses = async () => {
    try {
      setLoadingList(true);
      const token = localStorage.getItem('accessToken');
      const res = await axios.get(`${API_URL}/competitor`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success) {
        const list = res.data.analyses || [];
        setAnalysesList(list);
      }
    } catch (err) {
      console.error('Failed to fetch analyses list:', err);
    } finally {
      setLoadingList(false);
    }
  };

  const pollAnalysisStatus = async (id) => {
    try {
      const token = localStorage.getItem('accessToken');
      const res = await axios.get(`${API_URL}/competitor/status/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success) {
        const updated = res.data.analysis;

        // Trigger notification upon completion or failure transitions
        if (selectedAnalysis && (selectedAnalysis.status === 'pending' || selectedAnalysis.status === 'processing')) {
          if (updated.status === 'completed') {
            showToast(`Report successfully generated by ${updated.modelUsed || 'AI Model'}!`, 'success');
          } else if (updated.status === 'failed') {
            showToast(`Report generation failed: ${updated.error || 'AI Error'}`, 'error');
          }
        }

        setSelectedAnalysis(updated);

        // Update list as well
        setAnalysesList(prev => prev.map(a => a._id === id ? updated : a));

        if (updated.status === 'completed' || updated.status === 'failed') {
          // Re-fetch entire list to update timestamps
          fetchAnalyses();
        }
      }
    } catch (err) {
      console.error('Polling error:', err);
    }
  };

  const handleAutoDetect = async () => {
    try {
      setIsDetecting(true);
      setSubmitError('');
      const token = localStorage.getItem('accessToken');
      const res = await axios.get(`${API_URL}/competitor/detect`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data?.success && res.data.competitors?.length > 0) {
        setCompetitors(res.data.competitors.map(c => ({
          name: c.name || '',
          website: c.website || '',
          socialHandles: {
            facebook: c.socialHandles?.facebook || '',
            instagram: c.socialHandles?.instagram || '',
            threads: c.socialHandles?.threads || '',
            linkedin: c.socialHandles?.linkedin || '',
          },
          followers: '',
          rating: '',
          reviewsCount: '',
          showOptional: false
        })));
      } else {
        setSubmitError(res.data?.message || 'Could not auto-detect competitors. Please complete your Brand Profile.');
      }
    } catch (err) {
      setSubmitError('Failed to auto-detect. Please check your network connection.');
    } finally {
      setIsDetecting(false);
    }
  };

  const handleAddCompetitor = () => {
    if (competitors.length >= 5) return;
    setCompetitors([
      ...competitors,
      { name: '', website: '', socialHandles: { facebook: '', instagram: '', threads: '', linkedin: '' }, followers: '', rating: '', reviewsCount: '', showOptional: false }
    ]);
  };

  const handleRemoveCompetitor = (index) => {
    setCompetitors(competitors.filter((_, idx) => idx !== index));
  };

  const handleCompetitorChange = (index, field, value) => {
    const updated = [...competitors];
    updated[index][field] = value;
    setCompetitors(updated);
  };

  const handleHandleChange = (index, platform, value) => {
    const updated = [...competitors];
    updated[index].socialHandles[platform] = value;
    setCompetitors(updated);
  };

  const handleSubmitAnalysis = async (e) => {
    e.preventDefault();
    setSubmitError('');

    // Validation
    const validCompetitors = competitors.filter(c => c.name.trim() !== '');
    if (validCompetitors.length === 0) {
      setSubmitError('Please enter at least one competitor name.');
      return;
    }

    // Metric input validation
    for (const c of validCompetitors) {
      if (c.followers && (isNaN(Number(c.followers)) || Number(c.followers) < 0)) {
        setSubmitError(`Followers count for "${c.name}" must be a non-negative number.`);
        return;
      }
      if (c.rating && (isNaN(Number(c.rating)) || Number(c.rating) < 0 || Number(c.rating) > 5)) {
        setSubmitError(`Rating for "${c.name}" must be a number between 0 and 5.`);
        return;
      }
      if (c.reviewsCount && (isNaN(Number(c.reviewsCount)) || Number(c.reviewsCount) < 0)) {
        setSubmitError(`Reviews count for "${c.name}" must be a non-negative number.`);
        return;
      }
    }

    try {
      setIsSubmitting(true);
      const token = localStorage.getItem('accessToken');
      const res = await axios.post(
        `${API_URL}/competitor/analyze`,
        { targetCompetitors: validCompetitors },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.data?.success) {
        const newAnalysis = res.data.analysis;
        setAnalysesList(prev => [newAnalysis, ...prev]);
        setSelectedAnalysis(newAnalysis);
        // Clear form
        setCompetitors([{ name: '', website: '', socialHandles: { facebook: '', instagram: '', threads: '', linkedin: '' }, followers: '', rating: '', reviewsCount: '', showOptional: false }]);
      }
    } catch (err) {
      setSubmitError(err.response?.data?.message || 'Failed to submit analysis request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownload = async (id, format) => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await axios.get(`${API_URL}/competitor/download/${id}/${format}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });

      // Create a link element to trigger downloading
      const blob = new Blob([response.data], {
        type: format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `competitor_analysis_${id}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
    } catch (err) {
      alert(`Error downloading report. Make sure the background job is fully finished.`);
    }
  };

  const handleDeleteAnalysis = async (id) => {
    if (!window.confirm('Are you sure you want to delete this analysis report from your history?')) {
      return;
    }
    try {
      const token = localStorage.getItem('accessToken');
      const res = await axios.delete(`${API_URL}/competitor/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success) {
        showToast('Analysis deleted successfully!', 'success');
        setAnalysesList(prev => prev.filter(a => a._id !== id));
        if (selectedAnalysis?._id === id) {
          setSelectedAnalysis(null);
        }
      }
    } catch (err) {
      console.error('Delete analysis error:', err);
      showToast('Failed to delete analysis report.', 'error');
    }
  };

  const handleAcceptRecommendations = async (analysisId) => {
    try {
      setWorkflowStatus({ loading: true, success: false, message: '' });
      const token = localStorage.getItem('accessToken');
      const res = await axios.post(
        `${API_URL}/competitor/accept`,
        { analysisId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data?.success) {
        setWorkflowStatus({
          loading: false,
          success: true,
          message: res.data.message || 'Draft posts scheduled successfully!'
        });
      }
    } catch (err) {
      setWorkflowStatus({
        loading: false,
        success: false,
        message: err.response?.data?.message || 'Failed to schedule campaign workflows.'
      });
    }
  };

  // Recharts score mapper
  const getRadarData = () => {
    if (!selectedAnalysis?.analysis?.scores) return [];

    const scores = selectedAnalysis.analysis.scores;
    const labels = Object.keys(scores);

    return labels.map(k => {
      const label = k.charAt(0).toUpperCase() + k.slice(1).replace(/([A-Z])/g, ' $1');
      const detail = scores[k];
      const maxComp = Math.max(...(detail.competitors || [0]));
      return {
        subject: label,
        User: detail.user,
        CompetitorMax: maxComp,
        fullMark: 100
      };
    });
  };

  // Recharts metrics mapper
  const getBarData = () => {
    if (!selectedAnalysis?.analysis?.metrics) return [];
    const metrics = selectedAnalysis.analysis.metrics;

    // Normalize into categories for display
    const data = [
      { name: 'Avg Engagement %', User: metrics.engagementRate?.user || 0, Competitor: metrics.engagementRate?.competitors?.[0] || 0 },
      { name: 'Posts Per Week', User: metrics.postsPerWeek?.user || 0, Competitor: metrics.postsPerWeek?.competitors?.[0] || 0 },
      { name: 'Reviews Count (x10)', User: (metrics.reviewsCount?.user || 0) / 10, Competitor: (metrics.reviewsCount?.competitors?.[0] || 0) / 10 },
      { name: 'Rating (x10)', User: (metrics.rating?.user || 0) * 10, Competitor: (metrics.rating?.competitors?.[0] || 0) * 10 }
    ];
    return data;
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'completed':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5"><Check className="h-3.5 w-3.5" /> Ready</span>;
      case 'processing':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Processing</span>;
      case 'pending':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-zinc-500/10 text-zinc-400 border border-zinc-500/20 flex items-center gap-1.5">Queued</span>;
      case 'failed':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-red-500/10 text-red-400 border border-red-500/20 flex items-center gap-1.5"><AlertCircle className="h-3.5 w-3.5" /> Failed</span>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-8 py-4 text-zinc-950 dark:text-zinc-100">
      {/* Top Banner Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-xs uppercase tracking-widest mb-1.5">
            <Cpu className="h-4.5 w-4.5" /> Enterprise Level Intelligence
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-700 dark:from-white dark:via-zinc-100 dark:to-zinc-400 bg-clip-text text-transparent">
            AI Competitor Intelligence
          </h1>
          <p className="text-sm text-zinc-550 dark:text-zinc-400 mt-1 max-w-2xl">
            Real-time competitor analytics, deep corporate SWOT sheets, automated marketing roadmaps, and premium downloadable consulting reports.
          </p>
        </div>

        {/* Existing reports selector */}
        {analysesList.length > 0 && (
          <div className="flex items-center gap-3 bg-white dark:bg-zinc-900/40 p-2 rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 shadow-sm">
            <label className="text-xs text-zinc-500 dark:text-zinc-405 font-medium px-2">Select Report:</label>
            <select
              value={selectedAnalysis?._id || ''}
              onChange={(e) => setSelectedAnalysis(analysesList.find(a => a._id === e.target.value) || null)}
              className="bg-zinc-50 dark:bg-zinc-955 border border-zinc-200 dark:border-zinc-800 text-sm text-zinc-800 dark:text-zinc-200 rounded-lg px-3 py-1.5 outline-none focus:border-indigo-500 transition-colors"
            >
              <option value="">-- Select a previous report --</option>
              {analysesList.map(a => (
                <option key={a._id} value={a._id}>
                  {new Date(a.createdAt).toLocaleDateString()} - {a.targetCompetitors?.[0]?.name || 'Analysis'} ({a.status})
                </option>
              ))}
            </select>
            {selectedAnalysis && (
              <button
                type="button"
                onClick={() => handleDeleteAnalysis(selectedAnalysis._id)}
                className="p-1.5 text-red-500 hover:text-white hover:bg-red-650 dark:hover:bg-red-600 rounded-xl transition-all cursor-pointer flex items-center justify-center shrink-0 border border-transparent hover:border-red-500/25"
                title="Delete Report"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Informational Data Duality Banner */}
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-start gap-3 text-xs text-amber-800 dark:text-amber-300 leading-relaxed shadow-sm">
        <Info className="h-5 w-5 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold block mb-1">Verify Competitor Data Quality</span>
          Competitor website speed and online status are scanned in real-time (labeled {renderSourceBadge('scraped')}). Social metrics like followers, ratings, and reviews are estimated by the AI using industry benchmarks (labeled {renderSourceBadge('ai')}) since platforms restrict direct access.
          To show actual, exact values and override AI estimates, configure your competitor's actual numbers under the <strong>"Real Metrics (Optional)"</strong> panel. These values will be labeled {renderSourceBadge('user')}.
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Form & History */}
        <div className="lg:col-span-4 space-y-8">

          {/* Analyze New Form */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-zinc-900/40 backdrop-blur-md rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 p-6 shadow-sm"
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-lg text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-indigo-550 dark:text-indigo-400" /> Start Analysis
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDrawerOpen(true)}
                  className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-550 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 rounded-lg border border-zinc-200 dark:border-zinc-800 transition-colors flex items-center gap-1.5 cursor-pointer"
                  title="Configure Brand Profile"
                >
                  <Settings className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={handleAutoDetect}
                  disabled={isDetecting}
                  className="text-xs font-semibold bg-indigo-50 dark:bg-indigo-500/10 text-indigo-650 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 border border-indigo-200 dark:border-indigo-500/20 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  {isDetecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Auto Detect'}
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmitAnalysis} className="space-y-4">
              <div className="max-h-[350px] overflow-y-auto pr-1 space-y-4 scrollbar-thin scrollbar-thumb-zinc-200 dark:scrollbar-thumb-zinc-800">
                {competitors.map((comp, idx) => (
                  <div key={idx} className="bg-zinc-50/50 dark:bg-zinc-955/60 p-4 rounded-xl border border-zinc-200 dark:border-zinc-850 space-y-3 relative group">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-zinc-450 dark:text-zinc-500 uppercase">Competitor #{idx + 1}</span>
                      {competitors.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveCompetitor(idx)}
                          className="text-xs text-red-500 hover:text-red-400 transition-colors"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <div className="space-y-2">
                      <input
                        type="text"
                        placeholder="Company Name (e.g. Acme Corp)"
                        value={comp.name}
                        onChange={(e) => handleCompetitorChange(idx, 'name', e.target.value)}
                        required
                        className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 focus:border-indigo-500 outline-none transition-colors"
                      />
                      <input
                        type="text"
                        placeholder="Website (e.g. acme.com)"
                        value={comp.website}
                        onChange={(e) => handleCompetitorChange(idx, 'website', e.target.value)}
                        className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 focus:border-indigo-500 outline-none transition-colors"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-zinc-200 dark:border-zinc-850">
                      <input
                        type="text"
                        placeholder="IG handle"
                        value={comp.socialHandles.instagram}
                        onChange={(e) => handleHandleChange(idx, 'instagram', e.target.value)}
                        className="bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-850 rounded-md px-2 py-1 text-xs text-zinc-800 dark:text-zinc-300 placeholder-zinc-450 outline-none focus:border-indigo-500"
                      />
                      <input
                        type="text"
                        placeholder="LinkedIn handle"
                        value={comp.socialHandles.linkedin}
                        onChange={(e) => handleHandleChange(idx, 'linkedin', e.target.value)}
                        className="bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-850 rounded-md px-2 py-1 text-xs text-zinc-800 dark:text-zinc-300 placeholder-zinc-450 outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div className="pt-2 border-t border-zinc-200 dark:border-zinc-850">
                      <button
                        type="button"
                        onClick={() => {
                          const updated = [...competitors];
                          updated[idx].showOptional = !updated[idx].showOptional;
                          setCompetitors(updated);
                        }}
                        className="text-[10px] font-bold text-zinc-550 dark:text-zinc-400 hover:text-indigo-500 dark:hover:text-indigo-400 flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <ChevronDown className={`h-3 w-3 transform transition-transform ${comp.showOptional ? 'rotate-180' : ''}`} />
                        {comp.showOptional ? 'Hide Real Metrics (Optional)' : 'Configure Real Metrics (Optional)'}
                      </button>

                      {comp.showOptional && (
                        <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-dashed border-zinc-200 dark:border-zinc-800/80">
                          <div>
                            <label className="block text-[8px] font-bold text-zinc-450 dark:text-zinc-500 uppercase tracking-wider mb-1">Followers</label>
                            <input
                              type="number"
                              min="0"
                              placeholder="e.g. 15000"
                              value={comp.followers || ''}
                              onChange={(e) => handleCompetitorChange(idx, 'followers', e.target.value)}
                              className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-850 rounded px-1.5 py-1 text-[10px] text-zinc-800 dark:text-zinc-300 placeholder-zinc-450 outline-none focus:border-indigo-500"
                            />
                          </div>
                          <div>
                            <label className="block text-[8px] font-bold text-zinc-450 dark:text-zinc-500 uppercase tracking-wider mb-1">Rating</label>
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              max="5"
                              placeholder="e.g. 4.7"
                              value={comp.rating || ''}
                              onChange={(e) => handleCompetitorChange(idx, 'rating', e.target.value)}
                              className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-850 rounded px-1.5 py-1 text-[10px] text-zinc-800 dark:text-zinc-300 placeholder-zinc-450 outline-none focus:border-indigo-500"
                            />
                          </div>
                          <div>
                            <label className="block text-[8px] font-bold text-zinc-450 dark:text-zinc-500 uppercase tracking-wider mb-1">Reviews</label>
                            <input
                              type="number"
                              min="0"
                              placeholder="e.g. 84"
                              value={comp.reviewsCount || ''}
                              onChange={(e) => handleCompetitorChange(idx, 'reviewsCount', e.target.value)}
                              className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-850 rounded px-1.5 py-1 text-[10px] text-zinc-800 dark:text-zinc-300 placeholder-zinc-450 outline-none focus:border-indigo-500"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {competitors.length < 5 && (
                <button
                  type="button"
                  onClick={handleAddCompetitor}
                  className="w-full border border-dashed border-zinc-200 dark:border-zinc-800 hover:border-zinc-350 dark:hover:border-zinc-700 text-zinc-550 dark:text-zinc-400 text-xs py-2 rounded-xl transition-all"
                >
                  + Add Competitor (Max 5)
                </button>
              )}

              {submitError && (
                <div className="p-3 bg-red-550/10 border border-red-500/20 text-red-500 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" /> {submitError}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-gradient-to-r from-indigo-600 to-violet-500 text-white font-semibold text-sm py-2.5 rounded-xl hover:from-indigo-500 hover:to-violet-400 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-650/20"
              >
                {isSubmitting ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <Activity className="h-4.5 w-4.5" />}
                Analyze Competitors
              </button>
            </form>
          </motion.div>

          {/* Secure details Block */}
          <div className="bg-zinc-50/50 dark:bg-zinc-900/20 rounded-2xl border border-zinc-200 dark:border-zinc-800/80 p-5 space-y-3">
            <h4 className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase flex items-center gap-2">
              <Shield className="h-4 w-4 text-emerald-555 dark:text-emerald-400" /> Security & Platform Policy
            </h4>
            <p className="text-xs text-zinc-550 dark:text-zinc-400 leading-relaxed">
              We encrypt all stored handles. The analysis scans public DOM structures and authorized APIs. Private competitor statistics are estimated using localized search matrices and LLM reasoning.
            </p>
          </div>
        </div>

        {/* Right Column: Dashboard Results */}
        <div className="lg:col-span-8">
          <AnimatePresence mode="wait">
            {!selectedAnalysis ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="bg-white dark:bg-zinc-900/30 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-12 text-center shadow-sm"
              >
                <div className="h-16 w-16 bg-zinc-100 dark:bg-zinc-800/50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-zinc-200 dark:border-zinc-700/50">
                  <Cpu className="h-8 w-8 text-zinc-550" />
                </div>
                <h3 className="font-bold text-xl text-zinc-800 dark:text-zinc-200">No Analysis Available</h3>
                <p className="text-zinc-500 dark:text-zinc-500 text-sm mt-2 max-w-md mx-auto">
                  Type competitor details or click "Auto Detect" to trigger our background consultant engine.
                </p>
              </motion.div>
            ) : selectedAnalysis.status === 'pending' || selectedAnalysis.status === 'processing' ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="bg-white dark:bg-zinc-900/30 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-16 text-center space-y-6 shadow-sm"
              >
                <div className="relative h-20 w-20 mx-auto">
                  <div className="absolute inset-0 rounded-full border-4 border-indigo-500/10" />
                  <div className="absolute inset-0 rounded-full border-4 border-t-indigo-500 border-r-transparent border-b-transparent border-l-transparent animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Sparkles className="h-8 w-8 text-indigo-500 dark:text-indigo-400 animate-pulse" />
                  </div>
                </div>
                <div>
                  <h3 className="font-bold text-xl text-zinc-800 dark:text-zinc-150">AI Consultant at Work</h3>
                  <p className="text-zinc-550 dark:text-zinc-450 text-sm mt-2 max-w-md mx-auto">
                    We are fetching website load speeds, evaluating SEO metrics, and compiling deep SWOT indices. Heavy reports will be ready in under 60 seconds.
                  </p>
                </div>
                <div className="inline-block">{getStatusBadge(selectedAnalysis.status)}</div>
              </motion.div>
            ) : selectedAnalysis.status === 'failed' ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="bg-white dark:bg-zinc-900/30 rounded-2xl border border-zinc-200 dark:border-zinc-850 p-12 text-center shadow-sm"
              >
                <div className="h-14 w-14 bg-red-500/10 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-500/25">
                  <AlertCircle className="h-7 w-7" />
                </div>
                <h3 className="font-bold text-lg text-zinc-800 dark:text-zinc-200">Analysis Failed</h3>
                <p className="text-red-500 text-sm mt-2 max-w-md mx-auto">
                  {selectedAnalysis.error || 'An unexpected error occurred during report generation.'}
                </p>
                <button
                  onClick={() => pollAnalysisStatus(selectedAnalysis._id)}
                  className="mt-4 px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-650 dark:text-zinc-300 rounded-xl text-xs hover:bg-zinc-200 transition-colors"
                >
                  Retry Verification
                </button>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className=""
              >
                {/* Status Bar */}
                <div className="bg-white dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm">
                  <div className="flex flex-wrap items-center gap-3">
                    {getStatusBadge(selectedAnalysis.status)}
                    <span className="text-xs text-zinc-500 dark:text-zinc-450 font-medium">
                      Generated on {new Date(selectedAnalysis.updatedAt).toLocaleString()}
                    </span>
                    {selectedAnalysis.modelUsed && (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-550/15 text-indigo-650 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20">
                        AI Model: {selectedAnalysis.modelUsed}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2.5">
                    <button
                      onClick={() => handleDownload(selectedAnalysis._id, 'pdf')}
                      className="px-3.5 py-2 text-xs font-semibold bg-zinc-55 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-750 border border-zinc-200 dark:border-zinc-700/50 text-zinc-700 dark:text-zinc-200 rounded-xl transition-all flex items-center gap-2"
                    >
                      <Download className="h-4 w-4" /> Download PDF
                    </button>
                    <button
                      onClick={() => handleDownload(selectedAnalysis._id, 'docx')}
                      className="px-3.5 py-2 text-xs font-semibold bg-zinc-55 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-750 border border-zinc-200 dark:border-zinc-700/50 text-zinc-700 dark:text-zinc-200 rounded-xl transition-all flex items-center gap-2"
                    >
                      <FileText className="h-4 w-4" /> Download Word
                    </button>
                  </div>
                </div>

                {/* Score Accordions Grid */}
                <div>
                  <h3 className="font-bold text-lg text-zinc-800 dark:text-zinc-200 mb-4 flex items-center gap-2">
                    <Star className="h-5 w-5 text-indigo-500 dark:text-indigo-400" /> Strategic Benchmark Scores
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.entries(selectedAnalysis.analysis.scores || {}).map(([key, val]) => {
                      const label = key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1');
                      const maxComp = Math.max(...(val.competitors || [0]));
                      return (
                        <div
                          key={key}
                          onMouseEnter={() => setHoveredScore({ key, label, val })}
                          onMouseLeave={() => setHoveredScore(null)}
                          className="bg-white dark:bg-zinc-900/40 hover:bg-zinc-50 dark:hover:bg-zinc-900 border border-zinc-200/85 dark:border-zinc-800 hover:border-indigo-500/40 dark:hover:border-indigo-500/40 p-4 rounded-2xl relative transition-all cursor-help group shadow-sm"
                        >
                          <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-wider block mb-1">{label}</span>
                          <div className="flex justify-between items-baseline">
                            <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{val.user}%</span>
                            <span className="text-xs text-zinc-500 dark:text-zinc-450">vs {maxComp}%</span>
                          </div>

                          {/* Floating Improvement Tip */}
                          <div className="absolute left-1/2 bottom-full mb-2 -translate-x-1/2 w-56 p-3 bg-zinc-950 border border-zinc-800 rounded-xl shadow-xl z-55 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 text-xs">
                            <p className="font-semibold text-indigo-300 mb-1">Target: {val.target || 85}%</p>
                            <p className="text-zinc-350 leading-relaxed">{val.improve}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Charts Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Radar Chart */}
                  <div className="bg-white dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl space-y-4 shadow-sm">
                    <h4 className="font-bold text-sm text-zinc-800 dark:text-zinc-200">Radar Mapping (Benchmarking)</h4>
                    <div className="h-[280px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart cx="50%" cy="50%" radius="80%" data={getRadarData()}>
                          <PolarGrid stroke="#374151" />
                          <PolarAngleAxis dataKey="subject" tick={{ fill: '#6B7280', fontSize: 10 }} />
                          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#6B7280' }} />
                          <Radar name="My Brand" dataKey="User" stroke="#6366F1" fill="#6366F1" fillOpacity={0.3} />
                          <Radar name="Competitor Limit" dataKey="CompetitorMax" stroke="#06B6D4" fill="#06B6D4" fillOpacity={0.15} />
                          <Tooltip contentStyle={{ backgroundColor: '#090D16', border: '1px solid #1F2937', color: '#E5E7EB' }} />
                          <Legend />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Metrics Bar Chart */}
                  <div className="bg-white dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl space-y-4 shadow-sm">
                    <h4 className="font-bold text-sm text-zinc-800 dark:text-zinc-200">Key Performance Metric Indicators</h4>
                    <div className="h-[280px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={getBarData()}>
                          <XAxis dataKey="name" stroke="#6B7280" tick={{ fontSize: 9 }} />
                          <YAxis stroke="#6B7280" />
                          <Tooltip contentStyle={{ backgroundColor: '#090D16', border: '1px solid #1F2937', color: '#E5E7EB' }} />
                          <Legend />
                          <Bar dataKey="User" fill="#6366F1" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="Competitor" fill="#9CA3AF" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* Competitors List & Website details Table */}
                <div className="bg-white dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-850 rounded-2xl p-6 space-y-4 shadow-sm">
                  <h4 className="font-bold text-sm text-zinc-800 dark:text-zinc-200">Competitor Platform Details & Scraping Log</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-zinc-200 dark:border-zinc-800 text-xs text-zinc-550 dark:text-zinc-450 uppercase">
                          <th className="py-2.5">Competitor</th>
                          <th>Website Status</th>
                          <th>Website Speed</th>
                          <th>Followers (IG)</th>
                          <th>Rating / Reviews</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/60">
                        {/* User Row */}
                        <tr className="text-zinc-800 dark:text-zinc-200">
                          <td className="py-3 font-semibold text-indigo-650 dark:text-indigo-400">My Brand (User)</td>
                          <td><span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-550 dark:text-emerald-400">Active</span></td>
                          <td>
                            {selectedAnalysis.userStats?.webSpeedSeconds}s
                            {renderSourceBadge('scraped')}
                          </td>
                          <td>
                            {selectedAnalysis.userStats?.followers}
                            {renderSourceBadge('user')}
                          </td>
                          <td>
                            {selectedAnalysis.userStats?.rating} ★ ({selectedAnalysis.userStats?.reviewsCount})
                            {renderSourceBadge('user')}
                          </td>
                        </tr>
                        {/* Competitors Rows */}
                        {selectedAnalysis.targetCompetitors.map((comp, idx) => {
                          const scrap = selectedAnalysis.competitorsData?.[comp.name]?.website || {};
                          const followers = selectedAnalysis.analysis.metrics?.followers?.competitors?.[idx] || 'N/A';
                          const rating = selectedAnalysis.analysis.metrics?.rating?.competitors?.[idx] || 'N/A';
                          const reviews = selectedAnalysis.analysis.metrics?.reviewsCount?.competitors?.[idx] || 'N/A';
                          
                          const followersSource = comp.followers !== null && comp.followers !== undefined ? 'user' : 'ai';
                          const ratingSource = (comp.rating !== null && comp.rating !== undefined) || (comp.reviewsCount !== null && comp.reviewsCount !== undefined) ? 'user' : 'ai';

                          return (
                            <tr key={idx} className="text-zinc-650 dark:text-zinc-350">
                              <td className="py-3 font-medium text-zinc-800 dark:text-zinc-200">{comp.name}</td>
                              <td>
                                <span className={`px-2 py-0.5 rounded text-[10px] ${scrap.status === 'online' ? 'bg-emerald-500/10 text-emerald-550 dark:text-emerald-400' : 'bg-red-500/10 text-red-500 dark:text-red-400'}`}>
                                  {scrap.status || 'Offline'}
                                </span>
                              </td>
                              <td>
                                {scrap.loadTimeMs ? `${(scrap.loadTimeMs / 1000).toFixed(2)}s` : 'N/A'}
                                {scrap.loadTimeMs ? renderSourceBadge('scraped') : ''}
                              </td>
                              <td>
                                {followers}
                                {followers !== 'N/A' && renderSourceBadge(followersSource)}
                              </td>
                              <td>
                                {rating} ★ ({reviews})
                                {rating !== 'N/A' && renderSourceBadge(ratingSource)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* SWOT matrix Block */}
                <div className="bg-white dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 space-y-4 shadow-sm">
                  <div className="flex justify-between items-center border-b border-zinc-200 dark:border-zinc-800 pb-3">
                    <h4 className="font-bold text-sm text-zinc-800 dark:text-zinc-200">SWOT Strategy Comparison Matrix</h4>

                    {/* Tabs */}
                    <div className="flex bg-zinc-100 dark:bg-zinc-950 p-1 rounded-lg border border-zinc-200 dark:border-zinc-850">
                      <button
                        type="button"
                        onClick={() => setActiveSwotTab('user')}
                        className={`px-3 py-1 rounded text-xs transition-colors ${activeSwotTab === 'user' ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-650 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20' : 'text-zinc-550 dark:text-zinc-400'}`}
                      >
                        My Brand
                      </button>
                      {selectedAnalysis.targetCompetitors.map((c, i) => (
                        <button
                          type="button"
                          key={i}
                          onClick={() => setActiveSwotTab(`comp${i + 1}`)}
                          className={`px-3 py-1 rounded text-xs transition-colors ${activeSwotTab === `comp${i + 1}` ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-650 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20' : 'text-zinc-555 dark:text-zinc-400'}`}
                        >
                          {c.name.split(' ')[0]}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* SWOT Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Strengths */}
                    <div className="bg-zinc-50/50 dark:bg-zinc-950/60 p-4 rounded-xl border border-zinc-200 dark:border-zinc-850/80 space-y-2">
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Strengths (Internal)</span>
                      <ul className="space-y-1.5 text-xs text-zinc-650 dark:text-zinc-350 list-disc list-inside pl-1">
                        {(selectedAnalysis.analysis.swot?.[activeSwotTab]?.strengths || ['High conversion rate', 'Direct connection']).map((bullet, idx) => (
                          <li key={idx} className="leading-relaxed">{bullet}</li>
                        ))}
                      </ul>
                    </div>
                    {/* Weaknesses */}
                    <div className="bg-zinc-50/50 dark:bg-zinc-950/60 p-4 rounded-xl border border-zinc-200 dark:border-zinc-850/80 space-y-2">
                      <span className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-widest">Weaknesses (Internal)</span>
                      <ul className="space-y-1.5 text-xs text-zinc-650 dark:text-zinc-350 list-disc list-inside pl-1">
                        {(selectedAnalysis.analysis.swot?.[activeSwotTab]?.weaknesses || ['Inconsistent schedule', 'Low SEO rankings']).map((bullet, idx) => (
                          <li key={idx} className="leading-relaxed">{bullet}</li>
                        ))}
                      </ul>
                    </div>
                    {/* Opportunities */}
                    <div className="bg-zinc-50/50 dark:bg-zinc-950/60 p-4 rounded-xl border border-zinc-200 dark:border-zinc-850/80 space-y-2">
                      <span className="text-xs font-bold text-sky-600 dark:text-sky-400 uppercase tracking-widest">Opportunities (External)</span>
                      <ul className="space-y-1.5 text-xs text-zinc-650 dark:text-zinc-350 list-disc list-inside pl-1">
                        {(selectedAnalysis.analysis.swot?.[activeSwotTab]?.opportunities || ['Leverage video reels', 'Update local GMB']).map((bullet, idx) => (
                          <li key={idx} className="leading-relaxed">{bullet}</li>
                        ))}
                      </ul>
                    </div>
                    {/* Threats */}
                    <div className="bg-zinc-50/50 dark:bg-zinc-950/60 p-4 rounded-xl border border-zinc-200 dark:border-zinc-850/80 space-y-2">
                      <span className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest">Threats (External)</span>
                      <ul className="space-y-1.5 text-xs text-zinc-650 dark:text-zinc-350 list-disc list-inside pl-1">
                        {(selectedAnalysis.analysis.swot?.[activeSwotTab]?.threats || ['Aggressive competitor ads', 'Platform updates']).map((bullet, idx) => (
                          <li key={idx} className="leading-relaxed">{bullet}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Gap Analysis Section */}
                <div className="bg-white dark:bg-zinc-900/30 border border-zinc-200 dark:border-indigo-800 p-6 rounded-2xl shadow-sm space-y-4">
                  <h4 className="font-bold text-sm text-zinc-800 dark:text-zinc-200">Competitor Gap Analysis & Strategic Impact</h4>
                  <div className="space-y-3">
                    {(selectedAnalysis.analysis.gapAnalysis || []).map((gap, i) => (
                      <div key={i} className="p-4 bg-zinc-50/50 dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-850 rounded-xl space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-sm text-indigo-650 dark:text-indigo-400">{gap.area}</span>
                          <span className="px-2 py-0.5 bg-rose-500/10 text-rose-600 dark:text-rose-450 border border-rose-500/20 text-[10px] font-semibold rounded">High Impact</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-xs">
                          <div>
                            <span className="text-zinc-450 dark:text-zinc-500 block uppercase tracking-wider text-[9px] mb-0.5">Competitor Status</span>
                            <span className="text-zinc-700 dark:text-zinc-300">{gap.competitorStatus}</span>
                          </div>
                          <div>
                            <span className="text-zinc-450 dark:text-zinc-500 block uppercase tracking-wider text-[9px] mb-0.5">Your Status</span>
                            <span className="text-zinc-650 dark:text-zinc-355">{gap.userStatus}</span>
                          </div>
                        </div>
                        <p className="text-xs text-zinc-600 dark:text-zinc-400 border-t border-zinc-200 dark:border-zinc-850/65 pt-2 mt-1">
                          <strong className="text-zinc-750 dark:text-zinc-300">Strategic Impact:</strong> {gap.impact}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Strategic Roadmap Timeline */}
                <div className="bg-white dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm space-y-5">
                  <h4 className="font-bold text-sm text-zinc-800 dark:text-zinc-200">AI Implementation Roadmap</h4>
                  <div className="relative border-l border-zinc-200 dark:border-zinc-800 ml-3.5 space-y-6">
                    {(selectedAnalysis.analysis.roadmap || []).map((step, idx) => (
                      <div key={idx} className="relative pl-7 group">
                        {/* Bullet circle */}
                        <div className="absolute -left-1.5 top-1.5 h-3.5 w-3.5 rounded-full bg-white dark:bg-zinc-950 border-2 border-indigo-500 group-hover:scale-125 transition-transform" />

                        <div className="bg-zinc-50/50 dark:bg-zinc-950/60 p-4 rounded-xl border border-zinc-200 dark:border-zinc-855 space-y-2">
                          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                            <span className="text-xs font-bold text-indigo-650 dark:text-indigo-400 uppercase tracking-wide">{step.timeframe}</span>
                            <div className="flex gap-2">
                              <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-500/20 text-[9px] font-semibold rounded-full">
                                Priority: {step.priority}
                              </span>
                              <span className="px-2 py-0.5 bg-zinc-100 dark:bg-zinc-850 text-zinc-550 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 text-[9px] font-semibold rounded-full">
                                Diff: {step.difficulty}
                              </span>
                            </div>
                          </div>

                          <h5 className="font-bold text-sm text-zinc-800 dark:text-zinc-250">{step.task}</h5>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1 border-t border-zinc-200 dark:border-zinc-850">
                            <p className="text-zinc-650 dark:text-zinc-400">
                              <strong className="text-zinc-800 dark:text-zinc-300">Expected Impact:</strong> {step.impact}
                            </p>
                            <p className="text-zinc-650 dark:text-zinc-400">
                              <strong className="text-zinc-800 dark:text-zinc-300">Expected Growth:</strong> {step.growth}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Content Strategy pillars */}
                <div className="bg-white dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 space-y-5 shadow-sm">
                  <h4 className="font-bold text-sm text-zinc-800 dark:text-zinc-200">Recommended Social Media Content Strategy</h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div className="p-4 bg-zinc-50/50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-850 rounded-xl space-y-1">
                      <span className="text-xs text-indigo-600 dark:text-indigo-400 font-bold block mb-1">Content Pillars</span>
                      <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
                        {Array.isArray(selectedAnalysis.analysis.contentStrategy?.pillars)
                          ? selectedAnalysis.analysis.contentStrategy.pillars.join(' | ')
                          : (typeof selectedAnalysis.analysis.contentStrategy?.pillars === 'string'
                            ? selectedAnalysis.analysis.contentStrategy.pillars
                            : 'Brand positioning, competitive analysis')}
                      </p>
                    </div>
                    <div className="p-4 bg-zinc-50/50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-850 rounded-xl space-y-1">
                      <span className="text-xs text-indigo-600 dark:text-indigo-400 font-bold block mb-1">Posting Schedule</span>
                      <p className="text-zinc-700 dark:text-zinc-300">{selectedAnalysis.analysis.contentStrategy?.schedule || '3-4 times/week'}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-450 block uppercase tracking-wider font-bold">Video Reels Concepts</span>
                      <ul className="space-y-2 text-xs text-zinc-600 dark:text-zinc-355">
                        {(() => {
                          const videoIdeas = selectedAnalysis.analysis.contentStrategy?.ideas?.video;
                          const arrayToMap = Array.isArray(videoIdeas)
                            ? videoIdeas
                            : (typeof videoIdeas === 'string' ? [videoIdeas] : ['Show behind-the-scenes content', 'Explain 3 common client pain points']);
                          return arrayToMap.slice(0, 3).map((v, i) => (
                            <li key={i} className="p-2.5 bg-zinc-50/50 dark:bg-zinc-950/40 rounded-lg border border-zinc-200 dark:border-zinc-850">• {v}</li>
                          ));
                        })()}
                      </ul>
                    </div>

                    <div className="space-y-2">
                      <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-450 block uppercase tracking-wider font-bold">LinkedIn post Topics</span>
                      <ul className="space-y-2 text-xs text-zinc-605 dark:text-zinc-350">
                        {(() => {
                          const linkedinIdeas = selectedAnalysis.analysis.contentStrategy?.ideas?.linkedin;
                          const arrayToMap = Array.isArray(linkedinIdeas)
                            ? linkedinIdeas
                            : (typeof linkedinIdeas === 'string' ? [linkedinIdeas] : ['Share industry trends data', 'Case study of client transformation']);
                          return arrayToMap.slice(0, 3).map((l, i) => (
                            <li key={i} className="p-2.5 bg-zinc-50/50 dark:bg-zinc-950/40 rounded-lg border border-zinc-200 dark:border-zinc-850">• {l}</li>
                          ));
                        })()}
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Growth Predictions */}
                <div className="bg-indigo-50/30 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-500/15 rounded-2xl p-6 space-y-4 shadow-sm">
                  <h4 className="font-bold text-sm text-indigo-700 dark:text-indigo-300 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" /> 6-Month growth Projections (Projections Only)
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs text-zinc-700 dark:text-zinc-350">
                    <div className="p-3 bg-white dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-850/80 rounded-xl">
                      <strong className="text-zinc-800 dark:text-zinc-200 block mb-0.5">Follower Growth:</strong>
                      {selectedAnalysis.analysis.growthPredictions?.followers}
                    </div>
                    <div className="p-3 bg-white dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-850/80 rounded-xl">
                      <strong className="text-zinc-800 dark:text-zinc-200 block mb-0.5">Engagement Rate:</strong>
                      {selectedAnalysis.analysis.growthPredictions?.engagement}
                    </div>
                    <div className="p-3 bg-white dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-850/80 rounded-xl">
                      <strong className="text-zinc-800 dark:text-zinc-200 block mb-0.5">Google Reviews:</strong>
                      {selectedAnalysis.analysis.growthPredictions?.reviews}
                    </div>
                    <div className="p-3 bg-white dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-850/80 rounded-xl">
                      <strong className="text-zinc-800 dark:text-zinc-200 block mb-0.5">Social Reach:</strong>
                      {selectedAnalysis.analysis.growthPredictions?.reach}
                    </div>
                    <div className="p-3 bg-white dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-850/80 rounded-xl">
                      <strong className="text-zinc-800 dark:text-zinc-200 block mb-0.5">Brand Authority:</strong>
                      {selectedAnalysis.analysis.growthPredictions?.authority}
                    </div>
                    <div className="p-3 bg-white dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-850/80 rounded-xl">
                      <strong className="text-zinc-800 dark:text-zinc-200 block mb-0.5">Business Leads:</strong>
                      {selectedAnalysis.analysis.growthPredictions?.leads}
                    </div>
                  </div>
                  <div className="p-3 bg-indigo-50 dark:bg-indigo-500/5 text-indigo-700 dark:text-indigo-400/90 rounded-xl text-[10px] leading-relaxed flex items-start gap-2 border border-indigo-100 dark:border-transparent">
                    <Info className="h-4 w-4 shrink-0" />
                    Disclaimer: These metrics represent projections calculated by AI analysis models based on the assumption that recommended guidelines are closely integrated. They are estimates and do not represent guaranteed results.
                  </div>
                </div>

                {/* AI Assistant Acceptance box */}
                <div className="bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-900/40 dark:to-violet-900/40 border border-indigo-200 dark:border-indigo-500/30 rounded-2xl p-6 flex flex-col md:flex-row justify-between items-center gap-4 shadow-sm">
                  <div className="space-y-1 text-center md:text-left">
                    <h4 className="font-bold text-base text-zinc-850 dark:text-zinc-150 flex items-center justify-center md:justify-start gap-2">
                      <Sparkles className="h-5 w-5 text-indigo-650 dark:text-indigo-400 animate-pulse" /> Deploy AI Recommendations
                    </h4>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 max-w-xl">
                      Accept recommendations to automatically queue Google Business Profile updates, generate missing LinkedIn articles, design Instagram carousels, and configure custom hashtag collections in your draft studio.
                    </p>
                  </div>

                  <button
                    onClick={() => handleAcceptRecommendations(selectedAnalysis._id)}
                    disabled={workflowStatus.loading || workflowStatus.success}
                    className="shrink-0 bg-indigo-600 hover:bg-indigo-500 disabled:bg-emerald-600 disabled:text-zinc-100 text-white font-semibold text-xs px-5 py-3 rounded-xl transition-all shadow-md flex items-center gap-2"
                  >
                    {workflowStatus.loading ? (
                      <Loader2 className="h-4.5 w-4.5 animate-spin" />
                    ) : workflowStatus.success ? (
                      <Check className="h-4.5 w-4.5" />
                    ) : (
                      <ArrowRight className="h-4.5 w-4.5" />
                    )}
                    {workflowStatus.success ? 'Workflows Configured' : 'Accept AI Recommendations'}
                  </button>
                </div>

                {workflowStatus.message && (
                  <div className={`p-3.5 text-xs rounded-xl border ${workflowStatus.success ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-450' : 'bg-red-500/10 border-red-500/25 text-red-500'}`}>
                    {workflowStatus.message}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Toast Notification Overlay */}
      {toast.show && (
        <div className={`fixed top-5 right-5 z-[9999] flex items-center space-x-2.5 px-4.5 py-3 rounded-xl border shadow-xl transition-all duration-300 ${toast.type === 'success'
            ? 'bg-zinc-900 border-emerald-500/30 text-emerald-400'
            : toast.type === 'warning'
              ? 'bg-zinc-900 border-amber-500/30 text-amber-400 animate-pulse'
              : 'bg-zinc-900 border-red-500/30 text-red-400'
          }`}>
          <div className="h-2 w-2 rounded-full animate-ping shrink-0 bg-current" />
          <div className="text-xs font-semibold">{toast.message}</div>
        </div>
      )}

      {/* Brand Brain Drawer */}
      {createPortal(
        <AnimatePresence>
          {drawerOpen && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setDrawerOpen(false)}
                className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs cursor-pointer"
              />

              {/* Drawer Panel */}
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-md bg-white dark:bg-zinc-950 border-l border-zinc-200 dark:border-zinc-900 shadow-2xl flex flex-col"
              >
                {/* Drawer Header */}
                <div className="p-5 border-b border-zinc-150 dark:border-zinc-900 flex items-center justify-between shrink-0 bg-zinc-50 dark:bg-zinc-955">
                  <div className="flex items-center space-x-2.5">
                    <Brain className="h-5 w-5 text-indigo-500" />
                    <div>
                      <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-100">Brand Brain Settings</h3>
                      <p className="text-[10px] text-zinc-450 dark:text-zinc-400 mt-0.5">Define your brand identity to personalize AI output</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDrawerOpen(false)}
                    className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-400 hover:text-zinc-650 dark:hover:text-zinc-300 rounded-xl transition-colors cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Drawer Content Form */}
                <div className="flex-1 overflow-y-auto p-5 space-y-5 scrollbar-thin bg-white dark:bg-zinc-950/40">
                  <div className="space-y-4">
                    {/* Company Name */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Company Name</label>
                        {brandForm.companyName && brandForm.companyName.trim() && (
                          <button
                            type="button"
                            onClick={handleSuggestBrandProfile}
                            disabled={suggestingBrand}
                            className="text-[10px] font-bold text-indigo-650 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors flex items-center space-x-1 cursor-pointer disabled:opacity-50"
                          >
                            {suggestingBrand ? (
                              <>
                                <Loader2 className="h-3 w-3 animate-spin text-indigo-500" />
                                <span>Suggesting...</span>
                              </>
                            ) : (
                              <>
                                <Sparkles className="h-3 w-3 text-indigo-500 animate-pulse" />
                                <span>✨ Auto-Fill via AI</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        value={brandForm.companyName}
                        onChange={(e) => handleBrandFormChange('companyName', e.target.value)}
                        placeholder="e.g. Tarasaka Media"
                        className="w-full text-xs py-2 px-3 bg-white dark:bg-zinc-900 border border-zinc-250 dark:border-zinc-800/80 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-zinc-800 dark:text-zinc-200 transition-all placeholder-zinc-400 dark:placeholder-zinc-600"
                      />
                    </div>

                    {/* Industry */}
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">Industry</label>
                      <input
                        type="text"
                        value={brandForm.industry}
                        onChange={(e) => handleBrandFormChange('industry', e.target.value)}
                        placeholder="e.g. SaaS, Marketing Automation"
                        className="w-full text-xs py-2 px-3 bg-white dark:bg-zinc-900 border border-zinc-250 dark:border-zinc-800/80 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-zinc-800 dark:text-zinc-200 transition-all placeholder-zinc-400 dark:placeholder-zinc-600"
                      />
                    </div>

                    {/* Products */}
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">Products</label>
                      <input
                        type="text"
                        value={brandForm.products}
                        onChange={(e) => handleBrandFormChange('products', e.target.value)}
                        placeholder="e.g. BullMQ Scheduler, AI Writer Studio"
                        className="w-full text-xs py-2 px-3 bg-white dark:bg-zinc-900 border border-zinc-255 dark:border-zinc-800/80 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-zinc-800 dark:text-zinc-200 transition-all placeholder-zinc-400 dark:placeholder-zinc-600"
                      />
                    </div>

                    {/* Services */}
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">Services</label>
                      <input
                        type="text"
                        value={brandForm.services}
                        onChange={(e) => handleBrandFormChange('services', e.target.value)}
                        placeholder="e.g. Social media growth, SEO consulting"
                        className="w-full text-xs py-2 px-3 bg-white dark:bg-zinc-900 border border-zinc-250 dark:border-zinc-800/80 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-zinc-800 dark:text-zinc-200 transition-all placeholder-zinc-400 dark:placeholder-zinc-600"
                      />
                    </div>

                    {/* Target Audience */}
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">Target Audience</label>
                      <textarea
                        rows={3}
                        value={brandForm.targetAudience}
                        onChange={(e) => handleBrandFormChange('targetAudience', e.target.value)}
                        placeholder="e.g. Social media managers, SaaS founders, growth marketers"
                        className="w-full text-xs p-3 bg-white dark:bg-zinc-900 border border-zinc-250 dark:border-zinc-800/80 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-zinc-800 dark:text-zinc-200 transition-all placeholder-zinc-400 dark:placeholder-zinc-600 resize-none"
                      />
                    </div>

                    {/* Tone Of Voice */}
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">Tone of Voice</label>
                      <input
                        type="text"
                        value={brandForm.toneOfVoice}
                        onChange={(e) => handleBrandFormChange('toneOfVoice', e.target.value)}
                        placeholder="e.g. Professional yet witty, concise and punchy"
                        className="w-full text-xs py-2 px-3 bg-white dark:bg-zinc-900 border border-zinc-250 dark:border-zinc-800/80 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-zinc-800 dark:text-zinc-200 transition-all placeholder-zinc-400 dark:placeholder-zinc-600"
                      />
                    </div>

                    {/* Keywords */}
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">Core Keywords</label>
                      <input
                        type="text"
                        value={brandForm.keywords}
                        onChange={(e) => handleBrandFormChange('keywords', e.target.value)}
                        placeholder="e.g. automation, BullMQ, dark mode UI, queue management"
                        className="w-full text-xs py-2 px-3 bg-white dark:bg-zinc-900 border border-zinc-250 dark:border-zinc-800/80 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-zinc-800 dark:text-zinc-200 transition-all placeholder-zinc-400 dark:placeholder-zinc-600"
                      />
                    </div>

                    {/* Competitors */}
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">Competitors</label>
                      <input
                        type="text"
                        value={brandForm.competitors}
                        onChange={(e) => handleBrandFormChange('competitors', e.target.value)}
                        placeholder="e.g. Buffer, Hootsuite, Jasper AI"
                        className="w-full text-xs py-2 px-3 bg-white dark:bg-zinc-900 border border-zinc-250 dark:border-zinc-800/80 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-zinc-800 dark:text-zinc-200 transition-all placeholder-zinc-400 dark:placeholder-zinc-600"
                      />
                    </div>
                  </div>
                </div>

                {/* Drawer Footer Actions */}
                <div className="p-5 pb-12 border-t border-zinc-150 dark:border-zinc-900 bg-zinc-50 dark:bg-zinc-955 grid grid-cols-2 gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => setDrawerOpen(false)}
                    className="w-full py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-500 hover:text-zinc-855 dark:text-zinc-450 dark:hover:text-white dark:hover:border-zinc-700 transition-all bg-white dark:bg-zinc-900 cursor-pointer text-center"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveBrandProfile}
                    disabled={savingBrand}
                    className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-all cursor-pointer text-center flex items-center justify-center space-x-1.5 disabled:opacity-50 shadow-md shadow-indigo-500/10"
                  >
                    {savingBrand ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        <span>Save Brand</span>
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
};

export default CompetitorIntelligence;
