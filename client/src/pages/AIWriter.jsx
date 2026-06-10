import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, Copy, Check, RefreshCw, Send, Hash, 
  Languages, Edit, Bookmark, FilePlus, 
  AlertCircle, Info, Eye, ClipboardList,
  Image, Upload, Download, Trash2,
  Brain, Cog, X, Calendar
} from 'lucide-react';
import aiService from '../services/aiService';
import contentService from '../services/contentService';

const AIWriter = () => {
  const location = useLocation();
  const navigate = useNavigate();
  // Tabs config
  const tabs = [
    { id: 'posts', name: 'Post Creator', icon: Image, desc: 'Generate stunning social media graphics based on your topic and key points.' },
    { id: 'captions', name: 'Caption Generator', icon: Sparkles, desc: 'Write engaging, optimized captions for AI-generated or custom images/videos.' },
    { id: 'hashtags', name: 'Hashtag Finder', icon: Hash, desc: 'Find targeted hashtag sets for maximum discoverability from images, captions, or both.' },
    { id: 'translate', name: 'Universal Translator', icon: Languages, desc: 'Translate copy while preserving platform formatting and tone.' }
  ];

  const [activeTab, setActiveTab] = useState('posts');
  const [useBrandBrain, setUseBrandBrain] = useState(false);
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

  const { learningProfile, fetchLearningProfile } = useData();

  useEffect(() => {
    fetchBrandProfile();
    fetchLearningProfile();
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
          keywords: suggs.keywords || prev.keywords,
          competitors: suggs.competitors || prev.competitors
        }));
        showToast('Suggested fields populated successfully!', 'success');
      } else {
        throw new Error(response.message || 'Failed to get suggestions');
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to get brand suggestions', 'error');
    } finally {
      setSuggestingBrand(false);
    }
  };

  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [result, setResult] = useState('');
  const [isMock, setIsMock] = useState(false);
  const [mockReason, setMockReason] = useState(null);
  const [previewTab, setPreviewTab] = useState('preview'); // 'preview' or 'raw'
  
  // Media states
  const [mediaUrl, setMediaUrl] = useState(null);
  const [carousel, setCarousel] = useState(null);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

  // Toast notification state
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 4000);
  };

  // Key points auto-suggest states
  const [suggestedKeyPoints, setSuggestedKeyPoints] = useState([]);
  const [loadingKeyPoints, setLoadingKeyPoints] = useState(false);

  // CTA auto-suggest states
  const [suggestedCtas, setSuggestedCtas] = useState([]);
  const [loadingCtas, setLoadingCtas] = useState(false);

  const handleSuggestKeyPoints = async () => {
    const topic = formState[activeTab]?.topic;
    if (!topic || !topic.trim()) {
      showToast('Please enter a topic first to get suggestions', 'error');
      return;
    }
    setLoadingKeyPoints(true);
    try {
      const data = await aiService.generate('keypoints', { 
        topic, 
        platform: formState[activeTab]?.platform || 'linkedin',
        isImage: activeTab === 'posts'
      });
      if (data.success && Array.isArray(data.result)) {
        setSuggestedKeyPoints(data.result);
        showToast(
          activeTab === 'posts' 
            ? 'Suggested visual details generated!' 
            : 'Suggested trending key points generated!', 
          'success'
        );
      } else {
        throw new Error('Could not get suggestions');
      }
    } catch (err) {
      console.error(err);
      showToast(
        activeTab === 'posts' 
          ? 'Failed to get visual detail suggestions' 
          : 'Failed to get key point suggestions', 
        'error'
      );
    } finally {
      setLoadingKeyPoints(false);
    }
  };

  const isPointAdded = (point) => {
    const current = formState[activeTab]?.keyPoints || '';
    const cleanPoint = point.toLowerCase().trim();
    return current.split('\n').some(line => {
      const cleanLine = line.replace(/^[-*•\s\d.]+|[-*•\s\d.]+$/g, '').trim().toLowerCase();
      return cleanLine === cleanPoint;
    });
  };

  const addKeyPoint = (point) => {
    const current = formState[activeTab]?.keyPoints || '';
    const separator = current.trim() ? '\n' : '';
    const updated = `${current.trim()}${separator}- ${point}`;
    handleInputChange(activeTab, 'keyPoints', updated);
    showToast('Added key point!', 'success');
  };

  const removeKeyPoint = (point) => {
    const current = formState[activeTab]?.keyPoints || '';
    const lines = current.split('\n');
    const cleanPoint = point.toLowerCase().trim();
    const updatedLines = lines.filter(line => {
      const cleanLine = line.replace(/^[-*•\s\d.]+|[-*•\s\d.]+$/g, '').trim().toLowerCase();
      return cleanLine !== cleanPoint;
    });
    handleInputChange(activeTab, 'keyPoints', updatedLines.join('\n'));
    showToast('Removed key point!', 'success');
  };

  const toggleKeyPoint = (point) => {
    if (isPointAdded(point)) {
      removeKeyPoint(point);
    } else {
      addKeyPoint(point);
    }
  };

  const handleSuggestCtas = async () => {
    const topic = formState[activeTab]?.topic;
    if (!topic || !topic.trim()) {
      showToast('Please enter a topic first to get suggestions', 'error');
      return;
    }
    setLoadingCtas(true);
    try {
      const data = await aiService.generate('cta', { topic, platform: formState[activeTab]?.platform || 'linkedin' });
      if (data.success && Array.isArray(data.result)) {
        setSuggestedCtas(data.result);
        showToast('Suggested CTAs generated!', 'success');
      } else {
        throw new Error('Could not get suggestions');
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to get CTA suggestions', 'error');
    } finally {
      setLoadingCtas(false);
    }
  };

  const selectCta = (ctaText) => {
    handleInputChange(activeTab, 'cta', ctaText);
    setSuggestedCtas(prev => prev.filter(c => c !== ctaText));
    showToast('Applied Call to Action!', 'success');
  };

  // Action loading states
  const [savingIdea, setSavingIdea] = useState(false);
  const [savingPost, setSavingPost] = useState(false);

  // Global / Shared Ref References
  const [generatedImage, setGeneratedImage] = useState(null);
  const [generatedCaption, setGeneratedCaption] = useState('');

  // Form states per tab
  const [formState, setFormState] = useState({
    posts: { topic: '', keyPoints: '' },
    captions: { platform: 'instagram', tone: 'engaging', topic: '', keyPoints: '', cta: '', length: 'medium', emojis: true, hashtags: true, imageSource: 'none', image: '' },
    hashtags: { platform: 'instagram', count: 8, focus: 'mixed', content: '', hashtagSource: 'caption', imageSource: 'none', image: '', caption: '' },
    translate: { originalText: '', language: 'Spanish', tonePreservation: true }
  });

  useEffect(() => {
    if (location.state?.retryPost) {
      const retry = location.state.retryPost;
      setFormState(prev => ({
        ...prev,
        posts: {
          ...prev.posts,
          topic: retry.content || '',
        }
      }));
      setResult(retry.content || '');
      if (retry.media && retry.media.length > 0) {
        setMediaUrl(retry.media[0].url);
        setGeneratedImage(retry.media[0].url);
      }
      setActiveTab('posts');
      setTimeout(() => {
        showToast('Pre-populated post details for retry/edit!', 'success');
      }, 500);
    }
  }, [location.state]);

  // Handle cross-tab state syncing
  useEffect(() => {
    if (activeTab === 'hashtags') {
      if (!formState.hashtags.caption && generatedCaption) {
        handleInputChange('hashtags', 'caption', generatedCaption);
      }
      if (formState.hashtags.imageSource === 'ai' && generatedImage) {
        handleInputChange('hashtags', 'image', generatedImage);
      }
    }
    if (activeTab === 'captions') {
      if (formState.captions.imageSource === 'ai' && generatedImage) {
        handleInputChange('captions', 'image', generatedImage);
      }
    }
  }, [activeTab, generatedCaption, generatedImage]);

  const handleInputChange = (tab, field, value) => {
    setFormState(prev => ({
      ...prev,
      [tab]: {
        ...prev[tab],
        [field]: value
      }
    }));
  };

  const handleImageError = () => {
    const fallbackUrl = `https://picsum.photos/1080/1080?random=${Math.floor(Math.random() * 1000)}`;
    console.warn(`[AIWriter] Image load failed. Setting fallback URL: ${fallbackUrl}`);
    setGeneratedImage(fallbackUrl);
    
    setFormState(prev => {
      const updated = { ...prev };
      if (prev.captions.imageSource === 'ai') {
        updated.captions = { ...prev.captions, image: fallbackUrl };
      }
      if (prev.hashtags.imageSource === 'ai') {
        updated.hashtags = { ...prev.hashtags, image: fallbackUrl };
      }
      return updated;
    });
  };

  const handleImageUpload = (tab, file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      handleInputChange(tab, 'image', reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (tab, e) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageUpload(tab, file);
    }
  };

  const downloadImage = async (url, filename = 'generated-image.jpg') => {
    if (!url) return;
    try {
      if (url.startsWith('data:')) {
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        const response = await fetch(url);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
      }
    } catch (err) {
      console.error('Failed to download image:', err);
      // Fallback: open in new tab
      window.open(url, '_blank');
    }
  };

  const getActiveOptions = () => {
    return formState[activeTab];
  };

  const performGeneration = async (tabName, customOptions) => {
    const rawOptions = customOptions || formState[tabName];
    const options = { ...rawOptions, useBrandBrain };
    
    // Check validation
    if (tabName === 'posts' && !options.topic.trim()) return;
    if (tabName === 'captions') {
      if (!options.topic.trim()) return;
      if (options.imageSource === 'ai') {
        const activeImg = customOptions ? customOptions.image : generatedImage;
        if (!activeImg) {
          showToast('No AI generated image found. Please generate an image in the Post Creator first.', 'error');
          return;
        }
        options.image = activeImg;
      } else if (options.imageSource === 'upload') {
        if (!options.image) {
          showToast('Please upload an image first.', 'error');
          return;
        }
      } else {
        options.image = null;
      }
    }
    if (tabName === 'hashtags') {
      const source = options.hashtagSource;
      if (source === 'image') {
        const img = options.imageSource === 'ai' ? generatedImage : options.image;
        if (!img) {
          showToast('Please provide an image first.', 'error');
          return;
        }
        options.image = img;
        options.caption = null;
      } else if (source === 'caption') {
        if (!options.caption?.trim()) {
          showToast('Please enter a caption first.', 'error');
          return;
        }
        options.image = null;
      } else if (source === 'both') {
        const img = options.imageSource === 'ai' ? generatedImage : options.image;
        if (!img) {
          showToast('Please provide an image.', 'error');
          return;
        }
        if (!options.caption?.trim()) {
          showToast('Please enter a caption.', 'error');
          return;
        }
        options.image = img;
      }
    }
    if (tabName === 'translate' && !options.originalText.trim()) return;

    setGenerating(true);
    setResult('');
    setIsMock(false);
    setMediaUrl(null);
    setCarousel(null);
    setCurrentSlideIndex(0);
    setSuggestedKeyPoints([]);
    setSuggestedCtas([]);

    const typeMapping = {
      posts: 'post',
      captions: 'caption',
      hashtags: 'hashtags',
      translate: 'translate'
    };
    const apiType = typeMapping[tabName] || tabName;

    try {
      const data = await aiService.generate(apiType, options);
      if (data.success) {
        setResult(data.result);
        setIsMock(!!data.isMock);
        setMediaUrl(data.mediaUrl || null);
        setCarousel(data.carousel || null);
        setMockReason(data.mockReason || null);
        
        // Save to global shared refs
        if (apiType === 'post' && data.mediaUrl) {
          setGeneratedImage(data.mediaUrl);
        }
        if (apiType === 'caption') {
          setGeneratedCaption(data.result);
        }

        if (data.isTimeoutFallback) {
          showToast('AI API timed out. Displaying fallback response.', 'warning');
        } else if (data.isMock) {
          showToast('Demo mode — using fallback response', 'warning');
        } else {
          showToast('Content generated successfully!', 'success');
        }
      } else {
        throw new Error(data.message || 'Generation failed');
      }
    } catch (err) {
      console.error(err);
      showToast(err.response?.data?.message || err.message || 'Failed to generate content', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerate = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    await performGeneration(activeTab);
  };

  const handleContinueToCaption = () => {
    const postTopic = formState.posts.topic;
    const postKeyPoints = formState.posts.keyPoints;
    
    // Sync to caption options
    const captionOptions = {
      ...formState.captions,
      topic: postTopic || formState.captions.topic,
      keyPoints: postKeyPoints || formState.captions.keyPoints,
      imageSource: 'ai',
      image: generatedImage || '',
      useBrandBrain
    };

    setFormState(prev => ({
      ...prev,
      captions: captionOptions
    }));
    
    setActiveTab('captions');
    setResult('');
    
    // Directly trigger generation with the new options
    if (postTopic && postTopic.trim()) {
      performGeneration('captions', captionOptions);
    }
  };

  const handleContinueToHashtags = () => {
    const captionText = result || formState.captions.topic;
    const sourceImage = formState.captions.imageSource === 'ai' ? generatedImage : formState.captions.image;
    
    const hashtagOptions = {
      ...formState.hashtags,
      content: captionText || formState.hashtags.content,
      caption: captionText || formState.hashtags.caption,
      hashtagSource: sourceImage ? 'both' : 'caption',
      imageSource: sourceImage ? (formState.captions.imageSource === 'ai' ? 'ai' : 'upload') : 'none',
      image: sourceImage || ''
    };

    setFormState(prev => ({
      ...prev,
      hashtags: hashtagOptions
    }));
    
    setActiveTab('hashtags');
    setResult('');
    
    // Automatically trigger hashtag finder with preloaded copy
    if (captionText && captionText.trim()) {
      performGeneration('hashtags', hashtagOptions);
    }
  };

  const handleContinueToScheduler = () => {
    const captionText = formState.hashtags.caption || '';
    const hashtagsText = result || '';
    const combinedContent = `${captionText}\n\n${hashtagsText}`.trim();
    const sourceImage = formState.hashtags.imageSource === 'ai' ? generatedImage : formState.hashtags.image;

    navigate('/scheduler', {
      state: {
        prefilledPost: {
          content: combinedContent,
          platform: formState.hashtags.platform || 'linkedin',
          mediaUrl: sourceImage || ''
        }
      }
    });
  };

  const copyToClipboard = () => {
    if (!result) return;
    navigator.clipboard.writeText(result);
    setCopied(true);
    showToast('Copied content to clipboard!', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveAsIdea = async () => {
    if (!result) return;
    setSavingIdea(true);
    try {
      const options = getActiveOptions();
      const platform = options.platform || 'linkedin';
      const topicText = options.topic || options.content || options.originalText || 'AI Content Studio';
      const shortTitle = topicText.length > 30 ? `${topicText.substring(0, 30)}...` : topicText;

      const payload = {
        title: `AI: ${shortTitle}`,
        description: result,
        status: 'idea',
        platform: platform,
        contentType: 'post',
        aiGenerated: true,
        tags: [activeTab, 'ai-generated']
      };

      await contentService.createContentIdea(payload);
      showToast('Saved successfully to Content Ideas!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to save content idea', 'error');
    } finally {
      setSavingIdea(false);
    }
  };

  const handleCreateDraftPost = async () => {
    if (!result) return;
    setSavingPost(true);
    try {
      const options = getActiveOptions();
      const platform = options.platform || 'linkedin';

      let mediaPayload = [];
      let postMediaUrl = mediaUrl;

      // Handle modular images in Caption Generator
      if (activeTab === 'captions') {
        if (options.imageSource === 'ai') {
          postMediaUrl = generatedImage;
        } else if (options.imageSource === 'upload') {
          postMediaUrl = options.image;
        }
      }

      if (carousel && carousel.length > 0) {
        mediaPayload = carousel.map(slide => ({ url: slide.image, type: 'image' }));
      } else if (postMediaUrl) {
        mediaPayload = [{ url: postMediaUrl, type: 'image' }];
      }

      const payload = {
        content: result,
        platform: platform,
        status: 'DRAFT',
        media: mediaPayload
      };

      await contentService.createPost(payload);
      showToast('Draft post created in Publisher!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to create draft post', 'error');
    } finally {
      setSavingPost(false);
    }
  };

  const renderCarouselViewer = () => {
    if (!carousel || carousel.length === 0) return null;
    const slide = carousel[currentSlideIndex];
    if (!slide) return null;
    return (
      <div className="bg-zinc-950 border border-zinc-800/80 rounded-xl overflow-hidden text-left font-sans text-sm shadow-md mt-3 flex flex-col select-none">
        {/* Top bar with progress indicator */}
        <div className="flex items-center justify-between p-3 border-b border-zinc-900 bg-zinc-950/80">
          <span className="text-[11px] font-semibold text-zinc-400">Carousel Deck • Slide {currentSlideIndex + 1} of {carousel.length}</span>
          <div className="flex space-x-1.5">
            {carousel.map((_, idx) => (
              <div 
                key={idx} 
                className={`h-1.5 w-1.5 rounded-full transition-all duration-300 ${idx === currentSlideIndex ? 'bg-indigo-500 w-3' : 'bg-zinc-800'}`} 
              />
            ))}
          </div>
        </div>
        
        {/* Slide Canvas */}
        <div className="aspect-square relative w-full flex flex-col justify-end p-6 overflow-hidden bg-zinc-900">
          {/* Slide Background Image */}
          {slide.image && (
            <img 
              src={slide.image} 
              alt={slide.title} 
              className="absolute inset-0 w-full h-full object-cover z-0 opacity-40 mix-blend-luminosity hover:opacity-55 transition-opacity duration-700" 
            />
          )}
          
          {/* Ambient Glow */}
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/60 to-transparent z-10" />

          {/* Slide Content */}
          <div className="relative z-20 space-y-2">
            <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest bg-indigo-950/70 border border-indigo-500/20 px-2 py-0.5 rounded-full">
              Slide #{slide.slideNumber}
            </span>
            <h3 className="text-sm font-bold text-white tracking-tight leading-tight">{slide.title}</h3>
            <p className="text-xs text-zinc-300 leading-relaxed font-medium">{slide.text}</p>
          </div>
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between border-t border-zinc-900 p-2 bg-zinc-950">
          <button 
            type="button"
            disabled={currentSlideIndex === 0}
            onClick={() => setCurrentSlideIndex(prev => prev - 1)}
            className="px-2.5 py-1 text-[10px] font-bold text-zinc-400 hover:text-white border border-zinc-800/80 bg-zinc-900/50 rounded-lg hover:border-zinc-700 transition-all cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
          >
            ← Previous
          </button>
          <button 
            type="button"
            disabled={currentSlideIndex === carousel.length - 1}
            onClick={() => setCurrentSlideIndex(prev => prev + 1)}
            className="px-2.5 py-1 text-[10px] font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-all cursor-pointer disabled:opacity-30 disabled:pointer-events-none shadow-md shadow-indigo-500/10"
          >
            Next Slide →
          </button>
        </div>
      </div>
    );
  };

  const renderMediaPreview = () => {
    if (activeTab === 'posts') {
      return null;
    }

    let previewImage = null;

    if (activeTab === 'captions') {
      const source = formState.captions.imageSource;
      if (source === 'ai') {
        previewImage = generatedImage;
      } else if (source === 'upload') {
        previewImage = formState.captions.image;
      }
    } else if (activeTab === 'hashtags') {
      const source = formState.hashtags.hashtagSource;
      if (source === 'image' || source === 'both') {
        const imgSource = formState.hashtags.imageSource;
        if (imgSource === 'ai') {
          previewImage = generatedImage;
        } else if (imgSource === 'upload') {
          previewImage = formState.hashtags.image;
        }
      }
    }

    if (previewImage) {
      return (
        <div className="mt-3 overflow-hidden rounded-xl border border-zinc-800/60 bg-zinc-950 shadow-md">
          <img 
            src={previewImage} 
            alt="Post Graphic" 
            className="w-full h-auto object-cover max-h-[300px]"
            onError={(e) => {
              e.target.src = `https://picsum.photos/1080/1080?random=${Math.floor(Math.random() * 1000)}`;
            }}
          />
        </div>
      );
    }

    if (carousel && carousel.length > 0) {
      return renderCarouselViewer();
    }

    if (!mediaUrl) return null;

    const options = getActiveOptions();
    const mediaType = options.mediaType || 'none';

    if (mediaType === 'image') {
      return (
        <div className="mt-3 overflow-hidden rounded-xl border border-zinc-800/60 bg-zinc-950 shadow-md">
          <img 
            src={mediaUrl} 
            alt="AI Post Graphic" 
            className="w-full h-auto object-cover max-h-[300px]"
            onError={(e) => {
              e.target.src = `https://picsum.photos/1080/1080?random=${Math.floor(Math.random() * 1000)}`;
            }}
          />
        </div>
      );
    }

    if (mediaType === 'video') {
      return (
        <div className="mt-3 overflow-hidden rounded-xl border border-zinc-800/60 bg-zinc-950 shadow-md aspect-video relative">
          <video 
            src={mediaUrl} 
            controls 
            loop 
            muted 
            autoPlay
            className="w-full h-full object-cover"
          />
        </div>
      );
    }

    return null;
  };

  // Render preview card elements for various platforms
  const renderSocialPreview = () => {
    if (activeTab === 'posts') {
      if (!generatedImage) return null;
      return (
        <div className="space-y-4">
          <div className="relative group overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-lg">
            <img 
              src={generatedImage} 
              alt="Generated Art" 
              className="w-full h-auto object-contain max-h-[400px] mx-auto rounded-2xl"
              onError={handleImageError}
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
              <button
                type="button"
                onClick={() => downloadImage(generatedImage)}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold text-xs flex items-center space-x-2 transition-all shadow-lg cursor-pointer"
              >
                <Download className="h-4 w-4" />
                <span>Download Image</span>
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => downloadImage(generatedImage)}
              className="flex items-center justify-center space-x-2 py-3 bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white rounded-xl font-semibold text-xs transition-all cursor-pointer"
            >
              <Download className="h-4 w-4" />
              <span>Download Image</span>
            </button>
            <button
              type="button"
              onClick={handleContinueToCaption}
              className="flex items-center justify-center space-x-2 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold text-xs transition-all cursor-pointer shadow-md shadow-indigo-500/10"
            >
              <Sparkles className="h-4 w-4 animate-pulse" />
              <span>Write Caption</span>
            </button>
          </div>
        </div>
      );
    }

    const options = getActiveOptions();
    const platform = options.platform || 'linkedin';

    if (platform === 'linkedin') {
      return (
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-left font-sans text-sm shadow-md">
          <div className="flex items-center space-x-3 mb-3">
            <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-violet-600 to-indigo-500 flex items-center justify-center font-bold text-white shadow-sm">
              TF
            </div>
            <div>
              <div className="font-semibold text-zinc-100 flex items-center space-x-1.5">
                <span>Tarasaka Media</span>
                <span className="text-xs text-zinc-500 font-normal">• 1st</span>
              </div>
              <div className="text-xs text-zinc-400">Marketing automation & growth strategy</div>
              <div className="text-[10px] text-zinc-500 mt-0.5">1h • Edited • 🌐</div>
            </div>
          </div>
          <div className="text-zinc-200 leading-relaxed whitespace-pre-line break-words select-text">
            {result}
          </div>
          {renderMediaPreview()}
          <div className="mt-4 pt-2 border-t border-zinc-900 flex items-center justify-between text-zinc-500 text-xs font-semibold px-1">
            <button className="hover:text-indigo-400 transition-colors flex items-center space-x-1.5 py-1">👍 <span>Like</span></button>
            <button className="hover:text-indigo-400 transition-colors flex items-center space-x-1.5 py-1">💬 <span>Comment</span></button>
            <button className="hover:text-indigo-400 transition-colors flex items-center space-x-1.5 py-1">🔁 <span>Repost</span></button>
            <button className="hover:text-indigo-400 transition-colors flex items-center space-x-1.5 py-1">✉️ <span>Send</span></button>
          </div>
        </div>
      );
    }

    if (platform === 'twitter') {
      const tweets = result.split('---').map(t => t.trim()).filter(Boolean);
      return (
        <div className="space-y-3">
          {tweets.map((tweet, idx) => (
            <div key={idx} className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-left font-sans text-sm shadow-md relative">
              {tweets.length > 1 && idx < tweets.length - 1 && (
                <div className="absolute left-9 top-14 bottom-0 w-0.5 bg-zinc-800 -mb-6 z-0" />
              )}
              <div className="flex items-start space-x-3 relative z-10">
                <div className="h-9 w-9 rounded-full bg-indigo-500 flex items-center justify-center font-bold text-white shadow-sm shrink-0">
                  T
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-1.5">
                    <span className="font-semibold text-zinc-100">Tarasaka Media</span>
                    <span className="text-xs text-zinc-500">@tarasaka_media • 5m</span>
                  </div>
                  <div className="text-zinc-200 mt-1 leading-relaxed whitespace-pre-line break-words select-text">
                    {tweet}
                  </div>
                  {idx === 0 && renderMediaPreview()}
                  <div className="mt-3 flex items-center space-x-8 text-zinc-500 text-xs">
                    <span className="hover:text-blue-400 transition-colors cursor-pointer">💬 12</span>
                    <span className="hover:text-green-400 transition-colors cursor-pointer">🔁 4</span>
                    <span className="hover:text-red-400 transition-colors cursor-pointer">❤️ 45</span>
                    <span className="hover:text-blue-400 transition-colors cursor-pointer">📊 1.2K</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (platform === 'instagram') {
      let activeImage = null;
      if (activeTab === 'captions') {
        const source = formState.captions.imageSource;
        if (source === 'ai') {
          activeImage = generatedImage;
        } else if (source === 'upload') {
          activeImage = formState.captions.image;
        }
      } else if (activeTab === 'hashtags') {
        const source = formState.hashtags.hashtagSource;
        if (source === 'image' || source === 'both') {
          const imgSource = formState.hashtags.imageSource;
          if (imgSource === 'ai') {
            activeImage = generatedImage;
          } else if (imgSource === 'upload') {
            activeImage = formState.hashtags.image;
          }
        }
      }

      return (
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden text-left font-sans text-sm shadow-md">
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b border-zinc-900">
            <div className="flex items-center space-x-2.5">
              <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-yellow-500 via-red-500 to-purple-600 p-0.5 shadow-sm">
                <div className="h-full w-full rounded-full bg-zinc-950 flex items-center justify-center font-bold text-white text-[10px]">
                  TM
                </div>
              </div>
              <div className="font-semibold text-zinc-100">tarasaka_media</div>
            </div>
            <span className="text-zinc-400 font-bold tracking-widest cursor-pointer text-xs">•••</span>
          </div>
          
          {/* Media Content */}
          {activeImage || mediaUrl || carousel ? (
            renderMediaPreview()
          ) : (
            <div className="aspect-square bg-gradient-to-br from-indigo-950 via-zinc-900 to-violet-950 border-b border-zinc-900 flex flex-col items-center justify-center text-zinc-500 relative group">
              <Sparkles className="h-10 w-10 text-indigo-400/30 group-hover:scale-110 transition-transform duration-500 mb-2" />
              <span className="text-xs font-medium text-zinc-400">Post Visual Placeholder</span>
              <span className="text-[10px] text-zinc-650 mt-1">Ready for Instagram upload</span>
            </div>
          )}

          {/* Interactions */}
          <div className="p-3">
            <div className="flex items-center justify-between text-zinc-300 text-lg mb-2">
              <div className="flex items-center space-x-3.5">
                <span className="hover:text-red-500 transition-colors cursor-pointer">❤️</span>
                <span className="hover:text-zinc-100 transition-colors cursor-pointer">💬</span>
                <span className="hover:text-zinc-100 transition-colors cursor-pointer">✈️</span>
              </div>
              <span className="hover:text-zinc-100 transition-colors cursor-pointer">📥</span>
            </div>
            <div className="font-semibold text-zinc-200 text-xs mb-1">104 likes</div>
            <div className="text-zinc-300 leading-relaxed text-xs break-words select-text">
              <span className="font-semibold text-zinc-100 mr-2">tarasaka_media</span>
              {result}
            </div>
            <div className="text-[9px] text-zinc-500 uppercase mt-2 tracking-wider">3 minutes ago</div>
          </div>
        </div>
      );
    }

    // Default social view (Facebook/other fallback)
    return (
      <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-left font-sans text-sm shadow-md">
        <div className="flex items-center space-x-2.5 mb-3">
          <div className="h-8 w-8 rounded-full bg-zinc-800 flex items-center justify-center font-bold text-white">
            TF
          </div>
          <div>
            <div className="font-semibold text-zinc-100 uppercase text-xs">{platform} Preview</div>
            <div className="text-[10px] text-zinc-500">Draft version</div>
          </div>
        </div>
        <div className="text-zinc-200 leading-relaxed whitespace-pre-line break-words select-text">
          {result}
        </div>
        {renderMediaPreview()}
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 py-4 relative"
    >
      {/* Floating Status Toast */}
      <AnimatePresence>
        {toast.show && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className={`fixed top-4 right-4 z-50 flex items-center space-x-2.5 px-4.5 py-3 rounded-xl border shadow-xl backdrop-blur-xl ${
              toast.type === 'error' 
                ? 'bg-red-500/10 border-red-500/20 text-red-400' 
                : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
            }`}
          >
            {toast.type === 'error' ? <AlertCircle className="h-4.5 w-4.5" /> : <Check className="h-4.5 w-4.5" />}
            <span className="text-sm font-semibold">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-zinc-800/40 pb-6">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-zinc-900 via-zinc-850 to-zinc-700 dark:from-white dark:via-zinc-100 dark:to-zinc-400 bg-clip-text text-transparent flex items-center space-x-3.5">
            <Sparkles className="h-8 w-8 text-indigo-400 animate-pulse" />
            <span>AI Content Studio</span>
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1.5">
            Elevate your digital marketing. Generate stunning AI graphics, optimized social captions, hashtags, or instantly translate content.
          </p>
        </div>

        {/* Brand Brain Switch Widget */}
        <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-2xl p-4 flex items-center justify-between gap-6 shadow-md shadow-zinc-950/50 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 rounded-xl">
              <Brain className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <div className="text-xs font-bold text-zinc-300 flex items-center space-x-1">
                <span>🧠 Brand Brain</span>
                <span className={`inline-block h-1.5 w-1.5 rounded-full ${useBrandBrain ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-400 dark:bg-zinc-600'}`} />
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors mt-0.5 block text-left cursor-pointer"
              >
                Configure Settings →
              </button>
            </div>
          </div>
          <div className="flex items-center">
            <button
              type="button"
              onClick={() => setUseBrandBrain(!useBrandBrain)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 transition-colors duration-200 ease-in-out focus:outline-none ${
                useBrandBrain 
                  ? 'bg-indigo-600 border-indigo-600' 
                  : 'bg-zinc-300 dark:bg-zinc-700 border-zinc-400 dark:border-zinc-600'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${useBrandBrain ? 'translate-x-5' : 'translate-x-0'}`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Content studio interface grid */}
      <div className="grid gap-8 lg:grid-cols-12 items-start">
        
        {/* Left Side: Navigation Tabs + Input Forms (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Tab buttons */}
          <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-4">
            <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-500 uppercase tracking-wider mb-3 px-1">Select Studio Tool</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-3 gap-2.5">
              {tabs.map((tab) => {
                const TabIcon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id);
                      setResult('');
                      setSuggestedKeyPoints([]);
                      setSuggestedCtas([]);
                    }}
                    className={`flex items-center space-x-2.5 px-3 py-2.5 rounded-xl border text-xs font-semibold transition-all ${
                      activeTab === tab.id
                        ? 'bg-indigo-600/10 border-indigo-500/30 text-indigo-500 dark:text-indigo-400 shadow-md shadow-indigo-500/5'
                        : 'bg-zinc-950/40 border-zinc-800/60 text-zinc-500 dark:text-zinc-400 hover:border-zinc-700 hover:text-zinc-300'
                    }`}
                  >
                    <TabIcon className="h-4.5 w-4.5 shrink-0" />
                    <span className="truncate">{tab.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Current tool parameters form */}
          <form onSubmit={handleGenerate} className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-6 space-y-6">
            
            {/* Tool Header info */}
            <div className="border-b border-zinc-800/50 pb-4">
              <h2 className="text-base font-bold text-zinc-800 dark:text-zinc-200 flex items-center space-x-2">
                {React.createElement(tabs.find(t => t.id === activeTab).icon, { className: "h-5 w-5 text-indigo-400" })}
                <span>{tabs.find(t => t.id === activeTab).name} Options</span>
              </h2>
              <p className="text-xs text-zinc-500 mt-1">
                {tabs.find(t => t.id === activeTab).desc}
              </p>
            </div>

            {useBrandBrain && brandForm.companyName && (
              <div className="bg-indigo-650/10 border border-indigo-500/20 text-indigo-400 p-3.5 rounded-xl flex items-start space-x-2.5 text-xs animate-fade-in">
                <Brain className="h-4.5 w-4.5 shrink-0 text-indigo-400 mt-0.5 animate-pulse" />
                <div>
                  <span className="font-bold">Brand Brain Active:</span> Personalizing generated copy for <span className="font-bold text-zinc-100">{brandForm.companyName}</span> ({brandForm.industry || 'General Industry'}). The brand voice, audience profile, and core keywords will automatically take priority during content drafting.
                </div>
              </div>
            )}

            {useBrandBrain && learningProfile && learningProfile.latestSuggestions && (
              <div className="bg-indigo-500/5 border border-indigo-500/25 p-4 rounded-xl space-y-3.5 text-xs text-indigo-300 animate-fade-in text-left">
                <div className="flex items-center space-x-2.5">
                  <Brain className="h-4.5 w-4.5 text-indigo-400 animate-pulse shrink-0" />
                  <span className="font-extrabold text-white">Applied Performance Suggestions</span>
                </div>
                <p className="text-zinc-400 leading-relaxed text-xs">
                  Based on your connected channels performance metrics, the Brand Brain is applying these growth strategies to maximize reach & engagement:
                </p>
                <div className="grid gap-3 sm:grid-cols-2 bg-zinc-950/45 p-3 rounded-xl border border-zinc-800/40 text-left">
                  {learningProfile.latestSuggestions.captionRecommendations?.style && (
                    <div>
                      <span className="font-bold text-indigo-400 block mb-0.5 uppercase tracking-wide text-[9px]">Formatting Style:</span>
                      <span className="text-zinc-300 leading-normal">{learningProfile.latestSuggestions.captionRecommendations.style}</span>
                    </div>
                  )}
                  {learningProfile.latestSuggestions.captionRecommendations?.toneAdvice && (
                    <div>
                      <span className="font-bold text-indigo-400 block mb-0.5 uppercase tracking-wide text-[9px]">Tone Directive:</span>
                      <span className="text-zinc-300 leading-normal">{learningProfile.latestSuggestions.captionRecommendations.toneAdvice}</span>
                    </div>
                  )}
                  {learningProfile.latestSuggestions.hashtagRecommendations?.strategy && (
                    <div className="sm:col-span-2">
                      <span className="font-bold text-indigo-400 block mb-0.5 uppercase tracking-wide text-[9px]">Hashtag Strategy:</span>
                      <span className="text-zinc-300 leading-normal">{learningProfile.latestSuggestions.hashtagRecommendations.strategy}</span>
                    </div>
                  )}
                  {learningProfile.latestSuggestions.postingStrategy?.rationale && (
                    <div className="sm:col-span-2">
                      <span className="font-bold text-indigo-400 block mb-0.5 uppercase tracking-wide text-[9px]">Growth Insight:</span>
                      <span className="text-zinc-300 leading-normal">{learningProfile.latestSuggestions.postingStrategy.rationale}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 1: POSTS (Post Creator - ONLY IMAGE) */}
            {activeTab === 'posts' && (
              <div className="space-y-5">
                <div className="relative">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">Topic or Concept for Image *</label>
                    {formState.posts.topic && formState.posts.topic.trim().length > 3 && (
                      <button
                        type="button"
                        onClick={handleSuggestKeyPoints}
                        disabled={loadingKeyPoints}
                        className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors flex items-center space-x-1 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                      >
                        {loadingKeyPoints ? (
                          <>
                            <RefreshCw className="h-3 w-3 animate-spin text-indigo-400" />
                            <span>Analyzing...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-3 w-3 text-indigo-400" />
                            <span>✨ Suggest Image Details</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    required
                    value={formState.posts.topic}
                    onChange={(e) => handleInputChange('posts', 'topic', e.target.value)}
                    placeholder="e.g. A futuristic workspace in dark mode with glowing neon accents"
                    className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/50 py-2.5 px-3.5 text-sm text-zinc-850 dark:text-zinc-200 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all placeholder-zinc-400 dark:placeholder-zinc-650"
                  />
                  
                  {/* Suggested Key Points List */}
                  {suggestedKeyPoints.length > 0 && (
                    <div className="mt-3.5 p-3.5 bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/50 rounded-xl space-y-2.5">
                      <div className="text-[10px] font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                        <span>💡 AI Suggested Image Details (Click to Add)</span>
                        <button 
                          type="button" 
                          onClick={() => setSuggestedKeyPoints([])}
                          className="text-zinc-500 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors text-[9px] font-bold cursor-pointer"
                        >
                          Clear
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {suggestedKeyPoints.map((point, idx) => (
                          <button 
                            key={idx}
                            type="button"
                            onClick={() => toggleKeyPoint(point)}
                            className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all shadow-sm cursor-pointer select-none text-left border ${
                              isPointAdded(point) 
                                ? 'bg-indigo-50 dark:bg-indigo-950/30 border-indigo-500/50 text-indigo-600 dark:text-indigo-300' 
                                : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800/80 hover:border-indigo-500 dark:hover:border-indigo-500/50 text-zinc-700 dark:text-zinc-200'
                            }`}
                          >
                            <span className="leading-snug">{point}</span>
                            {isPointAdded(point) ? (
                              <Check className="h-3 w-3 text-indigo-550 dark:text-indigo-400 shrink-0" />
                            ) : (
                              <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold font-sans">＋</span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Key Details to Include in Image (Optional)</label>
                  <textarea
                    rows={3}
                    value={formState.posts.keyPoints}
                    onChange={(e) => handleInputChange('posts', 'keyPoints', e.target.value)}
                    placeholder="e.g. - Include a cup of coffee with steam rising&#10;- Minimalist layout with code editor on screen&#10;- Blue and purple ambient lighting"
                    className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/50 p-3 text-sm text-zinc-850 dark:text-zinc-200 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all placeholder-zinc-400 dark:placeholder-zinc-650 resize-none"
                  />
                </div>

                {generatedImage && (
                  <div className="p-4 bg-indigo-950/20 border border-indigo-500/20 rounded-xl space-y-3">
                    <div className="text-xs text-zinc-400 leading-relaxed">
                      <span className="font-semibold text-indigo-400 block mb-1">✨ Next Step Option</span>
                      Your AI graphic is ready! Click below to transition to the **Caption Generator**, auto-load this image, and immediately write an optimized caption.
                    </div>
                    <button
                      type="button"
                      onClick={handleContinueToCaption}
                      className="w-full flex items-center justify-center space-x-2 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-md"
                    >
                      <Sparkles className="h-3.5 w-3.5 animate-pulse" />
                      <span>Directly Generate Caption →</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: CAPTIONS (Caption Generator) */}
            {activeTab === 'captions' && (
              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Social Platform</label>
                    <select
                      value={formState.captions.platform}
                      onChange={(e) => handleInputChange('captions', 'platform', e.target.value)}
                      className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/50 py-2.5 px-3.5 text-sm text-zinc-850 dark:text-zinc-200 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
                    >
                      <option value="instagram">Instagram</option>
                      <option value="linkedin">LinkedIn</option>
                      <option value="facebook">Facebook</option>
                      <option value="threads">Threads</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Tone</label>
                    <select
                      value={useBrandBrain && brandForm.toneOfVoice ? 'brand_brain' : formState.captions.tone}
                      disabled={useBrandBrain && !!brandForm.toneOfVoice}
                      onChange={(e) => handleInputChange('captions', 'tone', e.target.value)}
                      className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/50 py-2.5 px-3.5 text-sm text-zinc-850 dark:text-zinc-200 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all disabled:opacity-75 disabled:cursor-not-allowed"
                    >
                      {useBrandBrain && brandForm.toneOfVoice && (
                        <option value="brand_brain">✨ Brand Voice: {brandForm.toneOfVoice}</option>
                      )}
                      <option value="engaging">Engaging & Casual</option>
                      <option value="professional">Professional / Business</option>
                      <option value="funny">Humorous & Snappy</option>
                      <option value="creative">Creative / Poetic</option>
                    </select>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Caption Length</label>
                    <select
                      value={formState.captions.length}
                      onChange={(e) => handleInputChange('captions', 'length', e.target.value)}
                      className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/50 py-2.5 px-3.5 text-sm text-zinc-850 dark:text-zinc-200 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
                    >
                      <option value="short">Short & Snappy (1-2 sentences)</option>
                      <option value="medium">Medium (1-2 paragraphs)</option>
                      <option value="long">Long-form (In-depth details)</option>
                    </select>
                  </div>
                  <div className="flex items-center space-x-6 h-full pt-6">
                    <label className="flex items-center space-x-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={formState.captions.emojis}
                        onChange={(e) => handleInputChange('captions', 'emojis', e.target.checked)}
                        className="h-4.5 w-4.5 text-indigo-600 rounded border-zinc-800"
                      />
                      <span className="text-xs font-semibold text-zinc-400">Include Emojis</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={formState.captions.hashtags}
                        onChange={(e) => handleInputChange('captions', 'hashtags', e.target.checked)}
                        className="h-4.5 w-4.5 text-indigo-600 rounded border-zinc-800"
                      />
                      <span className="text-xs font-semibold text-zinc-400">Add Hashtags</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Image Source</label>
                  <select
                    value={formState.captions.imageSource}
                    onChange={(e) => {
                      const val = e.target.value;
                      handleInputChange('captions', 'imageSource', val);
                      if (val === 'ai') {
                        handleInputChange('captions', 'image', generatedImage || '');
                      } else {
                        handleInputChange('captions', 'image', '');
                      }
                    }}
                    className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/50 py-2.5 px-3.5 text-sm text-zinc-850 dark:text-zinc-200 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all mb-3"
                  >
                    <option value="none">Text Only (No Image)</option>
                    <option value="ai">Use AI Image (from Post Creator)</option>
                    <option value="upload">Upload Custom Image</option>
                  </select>

                  {formState.captions.imageSource === 'ai' && (
                    <div className="p-3 bg-zinc-950/40 border border-zinc-800/80 rounded-xl">
                      {generatedImage ? (
                        <div className="flex items-center space-x-4">
                          <img 
                            src={generatedImage} 
                            alt="AI generated" 
                            className="w-16 h-16 object-cover rounded-lg border border-zinc-800 bg-zinc-950" 
                            onError={handleImageError}
                          />
                          <div className="text-xs text-zinc-400">
                            <span className="font-semibold text-indigo-400 block">AI Image Loaded</span>
                            Visual content details will be analyzed to generate the caption.
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-amber-500 flex items-center space-x-2 py-1">
                          <AlertCircle className="h-4 w-4 shrink-0" />
                          <span>No AI image generated yet. Generate one in Post Creator first, or choose "Upload Custom Image".</span>
                        </div>
                      )}
                    </div>
                  )}

                  {formState.captions.imageSource === 'upload' && (
                    <div>
                      {formState.captions.image ? (
                        <div className="flex items-center space-x-4 p-3 bg-zinc-950/40 border border-zinc-800/80 rounded-xl">
                          <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-zinc-800 bg-zinc-950">
                            <img 
                              src={formState.captions.image} 
                              alt="Uploaded preview" 
                              className="w-full h-full object-cover" 
                              onError={(e) => {
                                e.target.onerror = null;
                                e.target.src = `https://picsum.photos/1080/1080?random=${Math.floor(Math.random() * 1000)}`;
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => handleInputChange('captions', 'image', '')}
                              className="absolute top-0.5 right-0.5 p-0.5 bg-red-600/90 hover:bg-red-500 text-white rounded transition-colors cursor-pointer"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                          <div className="text-xs text-zinc-400">
                            <span className="font-semibold text-indigo-400 block">Custom Image Selected</span>
                            Upload matches! Image will be analyzed for caption relevance.
                          </div>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center border border-dashed border-zinc-800 hover:border-indigo-500/60 rounded-xl p-4.5 cursor-pointer bg-zinc-950/20 hover:bg-indigo-950/5 transition-all text-center">
                          <input 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            onChange={(e) => handleFileChange('captions', e)} 
                          />
                          <Upload className="h-5 w-5 text-zinc-500 mb-1.5" />
                          <span className="text-xs font-semibold text-zinc-400">Click to upload custom image</span>
                          <span className="text-[10px] text-zinc-650 mt-0.5">Supports PNG, JPG, JPEG</span>
                        </label>
                      )}
                    </div>
                  )}
                </div>

                <div className="relative">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">Description of the Topic / Visual Concept *</label>
                    {formState.captions.topic && formState.captions.topic.trim().length > 3 && (
                      <button
                        type="button"
                        onClick={handleSuggestKeyPoints}
                        disabled={loadingKeyPoints}
                        className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors flex items-center space-x-1 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                      >
                        {loadingKeyPoints ? (
                          <>
                            <RefreshCw className="h-3 w-3 animate-spin text-indigo-400" />
                            <span>Analyzing...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-3 w-3 text-indigo-400" />
                            <span>✨ Suggest Key Points</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                  <textarea
                    rows={3}
                    required
                    value={formState.captions.topic}
                    onChange={(e) => handleInputChange('captions', 'topic', e.target.value)}
                    placeholder="Describe what this post/image is about..."
                    className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/50 p-3 text-sm text-zinc-850 dark:text-zinc-200 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all placeholder-zinc-400 dark:placeholder-zinc-650 resize-none"
                  />
                  
                  {/* Suggested Key Points List */}
                  {suggestedKeyPoints.length > 0 && (
                    <div className="mt-3.5 p-3.5 bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/50 rounded-xl space-y-2.5">
                      <div className="text-[10px] font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                        <span>💡 AI Suggested Key Points (Click to Add)</span>
                        <button 
                          type="button" 
                          onClick={() => setSuggestedKeyPoints([])}
                          className="text-zinc-500 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors text-[9px] font-bold cursor-pointer"
                        >
                          Clear
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {suggestedKeyPoints.map((point, idx) => (
                          <button 
                            key={idx}
                            type="button"
                            onClick={() => toggleKeyPoint(point)}
                            className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all shadow-sm cursor-pointer select-none text-left border ${
                              isPointAdded(point) 
                                ? 'bg-indigo-50 dark:bg-indigo-950/30 border-indigo-500/50 text-indigo-600 dark:text-indigo-300' 
                                : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800/80 hover:border-indigo-500 dark:hover:border-indigo-500/50 text-zinc-700 dark:text-zinc-200'
                            }`}
                          >
                            <span className="leading-snug">{point}</span>
                            {isPointAdded(point) ? (
                              <Check className="h-3 w-3 text-indigo-550 dark:text-indigo-400 shrink-0" />
                            ) : (
                              <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold font-sans">＋</span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Key Points to Include (Optional)</label>
                  <textarea
                    rows={3}
                    value={formState.captions.keyPoints}
                    onChange={(e) => handleInputChange('captions', 'keyPoints', e.target.value)}
                    placeholder="e.g. - Highlighting tech features&#10;- Relate to workspace aesthetics"
                    className="w-full text-sm p-3 focus:outline-none resize-none"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">Call to Action (Optional)</label>
                    {formState.captions.topic && formState.captions.topic.trim().length > 3 && (
                      <button
                        type="button"
                        onClick={handleSuggestCtas}
                        disabled={loadingCtas}
                        className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors flex items-center space-x-1 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                      >
                        {loadingCtas ? (
                          <>
                            <RefreshCw className="h-3 w-3 animate-spin text-indigo-400" />
                            <span>Analyzing...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-3 w-3 text-indigo-400" />
                            <span>✨ Suggest CTAs</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={formState.captions.cta || ''}
                    onChange={(e) => handleInputChange('captions', 'cta', e.target.value)}
                    placeholder="e.g. What does your Monday setup look like? Comment below!"
                    className="w-full text-sm py-2 px-3 focus:outline-none"
                  />
                  
                  {/* Suggested CTAs List */}
                  {suggestedCtas.length > 0 && (
                    <div className="mt-3 p-3.5 bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/50 rounded-xl space-y-2.5">
                      <div className="text-[10px] font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                        <span>💡 AI Suggested CTAs (Click to Use)</span>
                        <button 
                          type="button" 
                          onClick={() => setSuggestedCtas([])}
                          className="text-zinc-500 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors text-[9px] font-bold cursor-pointer"
                        >
                          Clear
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {suggestedCtas.map((cta, idx) => (
                          <button 
                            key={idx}
                            type="button"
                            onClick={() => selectCta(cta)}
                            className="flex items-center space-x-1.5 px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/80 hover:border-indigo-500 dark:hover:border-indigo-500/50 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 rounded-xl text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all shadow-sm cursor-pointer select-none text-left"
                          >
                            <span className="leading-snug">{cta}</span>
                            <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold font-sans">＋</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: HASHTAGS (Hashtag Finder) */}
            {activeTab === 'hashtags' && (
              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Platform</label>
                    <select
                      value={formState.hashtags.platform}
                      onChange={(e) => handleInputChange('hashtags', 'platform', e.target.value)}
                      className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/50 py-2.5 px-3.5 text-sm text-zinc-850 dark:text-zinc-200 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
                    >
                      <option value="instagram">Instagram</option>
                      <option value="linkedin">LinkedIn</option>
                      <option value="facebook">Facebook</option>
                      <option value="threads">Threads</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Hashtag Focus</label>
                    <select
                      value={formState.hashtags.focus}
                      onChange={(e) => handleInputChange('hashtags', 'focus', e.target.value)}
                      className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/50 py-2.5 px-3.5 text-sm text-zinc-850 dark:text-zinc-200 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
                    >
                      <option value="mixed">Mixed (Niche & Broad)</option>
                      <option value="niche">Niche & Targeted</option>
                      <option value="broad">Broad & Viral</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Count ({formState.hashtags.count})</label>
                    <div className="pt-2">
                      <input
                        type="range"
                        min={3}
                        max={20}
                        step={1}
                        value={formState.hashtags.count}
                        onChange={(e) => handleInputChange('hashtags', 'count', parseInt(e.target.value))}
                        className="w-full accent-indigo-500 bg-zinc-800"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Hashtag Generation Basis</label>
                  <select
                    value={formState.hashtags.hashtagSource}
                    onChange={(e) => handleInputChange('hashtags', 'hashtagSource', e.target.value)}
                    className="w-full text-sm py-2 px-3 focus:outline-none"
                  >
                    <option value="caption">Caption Text Only</option>
                    <option value="image">Image Only</option>
                    <option value="both">Both (Image + Caption)</option>
                  </select>
                </div>

                {(formState.hashtags.hashtagSource === 'image' || formState.hashtags.hashtagSource === 'both') && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Image Source</label>
                      <select
                        value={formState.hashtags.imageSource}
                        onChange={(e) => {
                          const val = e.target.value;
                          handleInputChange('hashtags', 'imageSource', val);
                          if (val === 'ai') {
                            handleInputChange('hashtags', 'image', generatedImage || '');
                          } else {
                            handleInputChange('hashtags', 'image', '');
                          }
                        }}
                        className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/50 py-2.5 px-3.5 text-sm text-zinc-855 dark:text-zinc-200 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all mb-3"
                      >
                        <option value="none">Select Image Source...</option>
                        <option value="ai">Use AI Image (from Post Creator)</option>
                        <option value="upload">Upload Custom Image</option>
                      </select>
                    </div>

                    {formState.hashtags.imageSource === 'ai' && (
                      <div className="p-3 bg-zinc-950/40 border border-zinc-800/80 rounded-xl">
                        {generatedImage ? (
                          <div className="flex items-center space-x-4">
                            <img 
                              src={generatedImage} 
                              alt="AI generated" 
                              className="w-16 h-16 object-cover rounded-lg border border-zinc-800 bg-zinc-950" 
                              onError={handleImageError}
                            />
                            <div className="text-xs text-zinc-400">
                              <span className="font-semibold text-indigo-400 block">AI Image Loaded</span>
                              Keywords will be analyzed from visual content.
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-amber-500 flex items-center space-x-2 py-1">
                            <AlertCircle className="h-4 w-4 shrink-0" />
                            <span>No AI image generated yet. Generate one in Post Creator first, or choose "Upload Custom Image".</span>
                          </div>
                        )}
                      </div>
                    )}

                    {formState.hashtags.imageSource === 'upload' && (
                      <div>
                        {formState.hashtags.image ? (
                          <div className="flex items-center space-x-4 p-3 bg-zinc-950/40 border border-zinc-800/80 rounded-xl">
                            <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-zinc-800 bg-zinc-950">
                              <img 
                                src={formState.hashtags.image} 
                                alt="Uploaded preview" 
                                className="w-full h-full object-cover" 
                                onError={(e) => {
                                  e.target.onerror = null;
                                  e.target.src = `https://picsum.photos/1080/1080?random=${Math.floor(Math.random() * 1000)}`;
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => handleInputChange('hashtags', 'image', '')}
                                className="absolute top-0.5 right-0.5 p-0.5 bg-red-600/90 hover:bg-red-500 text-white rounded transition-colors cursor-pointer"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                            <div className="text-xs text-zinc-400">
                              <span className="font-semibold text-indigo-400 block">Custom Image Selected</span>
                              Keywords will be analyzed from the uploaded custom image.
                            </div>
                          </div>
                        ) : (
                          <label className="flex flex-col items-center justify-center border border-dashed border-zinc-800 hover:border-indigo-500/60 rounded-xl p-4.5 cursor-pointer bg-zinc-950/20 hover:bg-indigo-950/5 transition-all text-center">
                            <input 
                              type="file" 
                              accept="image/*" 
                              className="hidden" 
                              onChange={(e) => handleFileChange('hashtags', e)} 
                            />
                            <Upload className="h-5 w-5 text-zinc-500 mb-1.5" />
                            <span className="text-xs font-semibold text-zinc-400">Click to upload custom image</span>
                            <span className="text-[10px] text-zinc-650 mt-0.5">Supports PNG, JPG, JPEG</span>
                          </label>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {(formState.hashtags.hashtagSource === 'caption' || formState.hashtags.hashtagSource === 'both') && (
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Caption Copy *</label>
                    <textarea
                      rows={4}
                      required
                      value={formState.hashtags.caption || ''}
                      onChange={(e) => handleInputChange('hashtags', 'caption', e.target.value)}
                      placeholder="Paste your post caption here so we can analyze the copy and suggest hashtags..."
                      className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/50 p-3 text-sm text-zinc-850 dark:text-zinc-200 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all placeholder-zinc-400 dark:placeholder-zinc-650 resize-none"
                    />
                  </div>
                )}

                {formState.hashtags.hashtagSource === 'image' && (
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Topic or Concept Context (Optional)</label>
                    <input
                      type="text"
                      value={formState.hashtags.content || ''}
                      onChange={(e) => handleInputChange('hashtags', 'content', e.target.value)}
                      placeholder="e.g. workspace, tech, coding"
                      className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/50 py-2.5 px-3.5 text-sm text-zinc-850 dark:text-zinc-200 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all placeholder-zinc-400 dark:placeholder-zinc-650"
                    />
                  </div>
                )}
              </div>
            )}



            {/* TAB 7: TRANSLATE (Universal Translator) */}
            {activeTab === 'translate' && (
              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Target Language</label>
                    <select
                      value={formState.translate.language}
                      onChange={(e) => handleInputChange('translate', 'language', e.target.value)}
                      className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/50 py-2.5 px-3.5 text-sm text-zinc-850 dark:text-zinc-200 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
                    >
                      <option value="Spanish">Spanish (Español)</option>
                      <option value="French">French (Français)</option>
                      <option value="German">German (Deutsch)</option>
                      <option value="Japanese">Japanese (日本語)</option>
                      <option value="Chinese">Chinese (中文)</option>
                      <option value="Hindi">Hindi (हिन्दी)</option>
                      <option value="Portuguese">Portuguese (Português)</option>
                      <option value="Italian">Italian (Italiano)</option>
                    </select>
                  </div>
                  <div className="flex items-center space-x-3 pt-6">
                    <label className="flex items-center space-x-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={formState.translate.tonePreservation}
                        onChange={(e) => handleInputChange('translate', 'tonePreservation', e.target.checked)}
                        className="h-4.5 w-4.5 text-indigo-600 rounded border-zinc-800"
                      />
                      <span className="text-xs font-semibold text-zinc-400">Preserve format, hashtags & emojis</span>
                    </label>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Text to Translate *</label>
                  <textarea
                    rows={5}
                    required
                    value={formState.translate.originalText}
                    onChange={(e) => handleInputChange('translate', 'originalText', e.target.value)}
                    placeholder="Enter the copy that needs translation..."
                    className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/50 p-3 text-sm text-zinc-850 dark:text-zinc-200 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all placeholder-zinc-400 dark:placeholder-zinc-650 resize-none"
                  />
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={generating}
                className="w-full flex items-center justify-center space-x-2 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-sm font-semibold text-white rounded-xl shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/35 transition-all cursor-pointer select-none"
              >
                {generating ? (
                  <>
                    <RefreshCw className="h-4.5 w-4.5 animate-spin" />
                    <span>Analyzing & Drafting Copy...</span>
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    <span>Generate AI Content</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Right Side: Preview & Actions Panel (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-6 flex flex-col min-h-[480px]">
            
            {/* Header panel */}
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800/50">
              <div className="flex items-center space-x-2">
                <ClipboardList className="h-4.5 w-4.5 text-zinc-400" />
                <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200">Studio Output</span>
              </div>
              {result && (
                <div className="flex items-center space-x-1.5 p-0.5 bg-zinc-950 rounded-lg border border-zinc-800">
                  <button
                    onClick={() => setPreviewTab('preview')}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all ${
                      previewTab === 'preview'
                        ? 'bg-zinc-900 text-indigo-400 border border-zinc-800/80'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    <div className="flex items-center space-x-1">
                      <Eye className="h-3 w-3" />
                      <span>Social Preview</span>
                    </div>
                  </button>
                  <button
                    onClick={() => setPreviewTab('raw')}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all ${
                      previewTab === 'raw'
                        ? 'bg-zinc-900 text-indigo-400 border border-zinc-800/80'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    <span>Raw Text</span>
                  </button>
                </div>
              )}
            </div>

            {/* Display Body */}
            <div className="flex-1 mt-6 flex flex-col justify-center">
              <AnimatePresence mode="wait">
                {generating ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-4 w-full"
                  >
                    <div className="h-4 bg-zinc-800/50 rounded-lg animate-pulse w-3/4" />
                    <div className="h-4 bg-zinc-800/50 rounded-lg animate-pulse w-5/6" />
                    <div className="h-4 bg-zinc-800/50 rounded-lg animate-pulse w-2/3" />
                    <div className="h-4 bg-zinc-800/50 rounded-lg animate-pulse w-1/2" />
                    <div className="h-4 bg-zinc-800/50 rounded-lg animate-pulse w-3/5" />
                  </motion.div>
                ) : result ? (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex-1 flex flex-col justify-between"
                  >
                    {/* Render raw or feed preview */}
                    <div className="flex-1 overflow-y-auto max-h-[360px] pr-1.5 scrollbar-thin">
                      {previewTab === 'preview' ? (
                        renderSocialPreview()
                      ) : (
                        <textarea
                          value={result}
                          onChange={(e) => setResult(e.target.value)}
                          className="w-full h-[320px] text-xs text-zinc-300 leading-relaxed font-mono bg-zinc-950/60 p-4 rounded-xl border border-zinc-800/40 focus:outline-none focus:border-indigo-500/50 resize-none text-left select-text whitespace-pre-wrap"
                        />
                      )}
                    </div>

                    {/* Metadata details (Characters, Words, Read time) */}
                    <div className="flex items-center justify-between text-[11px] text-zinc-500 font-semibold mt-4 pt-3 border-t border-zinc-800/50">
                      <div>Characters: {result.length}</div>
                      <div>Words: {result.split(/\s+/).filter(Boolean).length}</div>
                      <div>Read: {Math.max(1, Math.ceil(result.split(/\s+/).filter(Boolean).length / 200))} min</div>
                    </div>
                  </motion.div>
                ) : (
                  <div className="text-center py-12">
                    <Sparkles className="h-12 w-12 mx-auto text-zinc-800/80 mb-3.5" />
                    <p className="text-sm font-semibold text-zinc-500">Awaiting your parameters</p>
                    <p className="text-xs text-zinc-650 mt-1 max-w-[240px] mx-auto">Select a tool, adjust options, and hit generate to draft AI content.</p>
                  </div>
                )}
              </AnimatePresence>
            </div>

            {/* Bottom Actions Row */}
            {result && !generating && (
              <div className="mt-6 pt-4 border-t border-zinc-800/50 space-y-3">
                {activeTab === 'captions' && (
                  <button
                    type="button"
                    onClick={handleContinueToHashtags}
                    className="w-full flex items-center justify-center space-x-2 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-500/10 cursor-pointer"
                  >
                    <Hash className="h-4 w-4 animate-pulse" />
                    <span>Find Hashtags for this Caption →</span>
                  </button>
                )}

                {activeTab === 'hashtags' && (
                  <button
                    type="button"
                    onClick={handleContinueToScheduler}
                    className="w-full flex items-center justify-center space-x-2 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-500/10 cursor-pointer"
                  >
                    <Calendar className="h-4 w-4 animate-pulse" />
                    <span>Schedule in Calendar →</span>
                  </button>
                )}

                <div className="grid grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={copyToClipboard}
                    className="flex items-center justify-center space-x-1.5 py-2.5 rounded-xl border border-zinc-800 bg-zinc-950 text-xs font-semibold text-zinc-400 hover:text-white hover:border-zinc-700 transition-all cursor-pointer"
                  >
                    {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                  <button
                    type="button"
                    disabled={savingIdea}
                    onClick={handleSaveAsIdea}
                    className="flex items-center justify-center space-x-1.5 py-2.5 rounded-xl border border-zinc-800 bg-zinc-950 text-xs font-semibold text-zinc-400 hover:text-white hover:border-zinc-700 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {savingIdea ? <RefreshCw className="h-4 w-4 animate-spin text-indigo-400" /> : <Bookmark className="h-4 w-4" />}
                    <span>Save Idea</span>
                  </button>
                  <button
                    type="button"
                    disabled={savingPost}
                    onClick={handleCreateDraftPost}
                    className="flex items-center justify-center space-x-1.5 py-2.5 rounded-xl border border-zinc-800 bg-zinc-950 text-xs font-semibold text-zinc-400 hover:text-white hover:border-zinc-755 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {savingPost ? <RefreshCw className="h-4 w-4 animate-spin text-indigo-400" /> : <FilePlus className="h-4 w-4" />}
                    <span>Draft Post</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Mock/Sandbox warning badge */}
          {isMock && (
            <div className="bg-zinc-900/40 border border-amber-500/20 rounded-2xl p-4 flex items-start space-x-3 text-amber-500/80">
              <Info className="h-5 w-5 shrink-0 text-amber-500 mt-0.5" />
              <div>
                <div className="text-xs font-bold uppercase tracking-wider">Demo / Sandbox Mode</div>
                <div className="text-[11px] leading-relaxed mt-1 text-zinc-400">
                  {mockReason === 'api_timeout'
                    ? 'The AI API request timed out. The fallback response is shown instead. Try again or check your network/API configuration.'
                    : mockReason === 'missing_api_key'
                    ? 'The `QWEN_API_KEY` is not defined in the backend server\'s `.env` file. Add `QWEN_API_KEY=your_key` to `.env` to enable real-time Qwen generation.'
                    : 'The AI API returned a fallback response. Your API key may be invalid or the service is unreachable. Check your `.env` configuration and restart the server.'
                  }
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Toast Notification Overlay */}
      {toast.show && (
        <div className={`fixed top-5 right-5 z-50 flex items-center space-x-2.5 px-4.5 py-3 rounded-xl border shadow-xl transition-all duration-300 ${
          toast.type === 'success' 
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
              <div className="p-5 border-b border-zinc-150 dark:border-zinc-900 flex items-center justify-between shrink-0 bg-zinc-50 dark:bg-zinc-950">
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
                          className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors flex items-center space-x-1 cursor-pointer disabled:opacity-50"
                        >
                          {suggestingBrand ? (
                            <>
                              <RefreshCw className="h-3 w-3 animate-spin text-indigo-500" />
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
                      className="w-full text-xs py-2 px-3 bg-white dark:bg-zinc-900 border border-zinc-250 dark:border-zinc-800/80 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-zinc-800 dark:text-zinc-200 transition-all placeholder-zinc-400 dark:placeholder-zinc-600"
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
              <div className="p-5 pb-12 border-t border-zinc-150 dark:border-zinc-900 bg-zinc-50 dark:bg-zinc-950 grid grid-cols-2 gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="w-full py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-500 hover:text-zinc-850 dark:text-zinc-450 dark:hover:text-white dark:hover:border-zinc-700 transition-all bg-white dark:bg-zinc-900 cursor-pointer text-center"
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
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
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
      </AnimatePresence>
    </motion.div>
  );
};

export default AIWriter;
