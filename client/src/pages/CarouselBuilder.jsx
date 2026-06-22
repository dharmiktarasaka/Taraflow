import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Layers, Plus, Trash2, ArrowLeft, ArrowRight, Palette,
  Type, Layout, Sparkles, Download, Check, RefreshCw,
  HelpCircle, AlignLeft, AlignCenter, AlignRight, FileText,
  Smartphone, Monitor, ChevronRight, User, Sliders, Grid, Quote, Heading,
  Share2, Globe, AlertCircle, CheckCircle, XCircle, ExternalLink
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import aiService from '../services/aiService';
import socialService from '../services/socialService';
import contentService from '../services/contentService';

const themes = [
  { name: 'Indigo Cyber', class: 'from-violet-600 via-indigo-700 to-indigo-900', textColor: '#ffffff', textClass: 'text-white' },
  { name: 'Sunset Glow', class: 'from-orange-500 via-rose-500 to-rose-600', textColor: '#ffffff', textClass: 'text-white' },
  { name: 'Midnight Emerald', class: 'from-emerald-500 via-teal-600 to-cyan-600', textColor: '#ffffff', textClass: 'text-white' },
  { name: 'Dark Void', class: 'from-zinc-900 via-zinc-950 to-black', textColor: '#ffffff', textClass: 'text-white border border-zinc-800/80' },
  { name: 'Soft Clean Light', class: 'from-zinc-50 via-zinc-100 to-zinc-200', textColor: '#18181b', textClass: 'text-zinc-900 border border-zinc-300' },
];

const mapTailwindClassToColors = (themeClass) => {
  if (!themeClass) return { start: '#6366f1', via: '#4f46e5', to: '#312e81' };
  if (themeClass.includes('from-violet-600')) {
    return { start: '#7c3aed', via: '#4338ca', to: '#312e81' };
  }
  if (themeClass.includes('from-orange-500')) {
    return { start: '#f97316', via: '#f43f5e', to: '#e11d48' };
  }
  if (themeClass.includes('from-emerald-500')) {
    return { start: '#10b981', via: '#0d9488', to: '#0891b2' };
  }
  if (themeClass.includes('from-zinc-900')) {
    return { start: '#18181b', via: '#09090b', to: '#000000' };
  }
  if (themeClass.includes('from-zinc-50')) {
    return { start: '#fafafa', via: '#f4f4f5', to: '#e4e4e7' };
  }
  return { start: '#6366f1', via: '#4f46e5', to: '#312e81' };
};

const getIsDarkText = (slide) => {
  const color = slide.textColor || slide.titleColor || '#ffffff';
  if (color === '#18181b' || color === '#111827' || color === '#000000' || color === 'black' || color === '#27272a' || color === '#1f2937') return true;
  if (color.startsWith('#')) {
    const hex = color.replace('#', '');
    let r = 255, g = 255, b = 255;
    if (hex.length === 3) {
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
    } else if (hex.length === 6) {
      r = parseInt(hex.substring(0, 2), 16);
      g = parseInt(hex.substring(2, 4), 16);
      b = parseInt(hex.substring(4, 6), 16);
    }
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness < 128;
  }
  return false;
};

const fonts = [
  { name: 'Inter (Sans)', value: 'Inter, system-ui, sans-serif' },
  { name: 'Outfit (Modern)', value: 'Outfit, system-ui, sans-serif' },
  { name: 'Playfair (Serif)', value: 'Playfair Display, Georgia, serif' },
  { name: 'Space Grotesk', value: 'Space Grotesk, monospace' }
];

const templates = [
  {
    name: 'Minimalist Tech',
    description: 'Clean sans-serif typography, soft light theme, dot grid pattern, and left alignment.',
    fontFamily: 'Inter, system-ui, sans-serif',
    theme: themes[4], // Soft Clean Light
    bgPattern: 'dots',
    patternOpacity: 15,
    titleSize: 1.8,
    bodySize: 0.9,
    textAlign: 'left',
    swipeStyle: 'dots',
    layoutSequence: ['peek', 'standard', 'standard', 'standard', 'quote']
  },
  {
    name: 'SaaS Pitch',
    description: 'Vibrant indigo gradient, bold Outfit typeface, full grid lines, and centered text.',
    fontFamily: 'Outfit, system-ui, sans-serif',
    theme: themes[0], // Indigo Cyber
    bgPattern: 'grid',
    patternOpacity: 15,
    titleSize: 2.2,
    bodySize: 1.0,
    textAlign: 'center',
    swipeStyle: 'text',
    layoutSequence: ['peek', 'split', 'standard', 'split', 'quote']
  },
  {
    name: 'Dark Developer',
    description: 'Monospace tech console styling, dark void theme, and monospace coding boxes.',
    fontFamily: 'Space Grotesk, monospace',
    theme: themes[3], // Dark Void
    bgPattern: 'dots',
    patternOpacity: 25,
    titleSize: 1.9,
    bodySize: 1.0,
    textAlign: 'left',
    swipeStyle: 'arrows',
    layoutSequence: ['peek', 'technical', 'technical', 'technical', 'standard']
  },
  {
    name: 'Sunset Minimalist',
    description: 'High energy sunset gradient, stripes background texture, and animated swipe indicators.',
    fontFamily: 'Outfit, system-ui, sans-serif',
    theme: themes[1], // Sunset Glow
    bgPattern: 'stripes',
    patternOpacity: 15,
    titleSize: 2.3,
    bodySize: 1.1,
    textAlign: 'center',
    swipeStyle: 'hand',
    layoutSequence: ['peek', 'standard', 'standard', 'quote', 'peek']
  },
  {
    name: 'Editorial Serif',
    description: 'Elegant Playfair display typeface, deep emerald theme, clean solid backgrounds.',
    fontFamily: 'Playfair Display, Georgia, serif',
    theme: themes[2], // Midnight Emerald
    bgPattern: 'none',
    patternOpacity: 0,
    titleSize: 2.1,
    bodySize: 1.0,
    textAlign: 'left',
    swipeStyle: 'text',
    layoutSequence: ['standard', 'standard', 'standard', 'standard', 'standard']
  }
];

const parseCaptionToSlides = (content, platform, theme) => {
  if (!content) return [];
  const lines = content.split('\n').map(line => line.trim()).filter(Boolean);
  if (lines.length === 0) return [];
  
  const title = lines[0];
  const bulletPoints = [];
  
  // Find lines that look like bullet points
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('•') || line.startsWith('-') || line.startsWith('*') || /^\d+\./.test(line)) {
      // Clean up bullet prefix
      const cleanLine = line.replace(/^([•\-*\s]|\d+\.)+/, '').trim();
      if (cleanLine) {
        bulletPoints.push(cleanLine);
      }
    }
  }
  
  const reconstructedSlides = [];
  const mapped = mapTailwindClassToColors(theme.class);
  // 1. Cover slide
  reconstructedSlides.push({
    id: Date.now(),
    title: title,
    body: "Tap to edit body text",
    imagePrompt: title,
    gradient: theme.class,
    textClass: theme.textClass,
    textColor: theme.textColor,
    layout: 'peek',
    bgType: 'tailwind',
    bgSolidColor: mapped.start,
    bgGradientStart: mapped.start,
    bgGradientVia: mapped.via,
    bgGradientTo: mapped.to,
    titleColor: theme.textColor,
    bodyColor: theme.textColor === '#18181b' ? '#27272a' : '#d4d4d8'
  });
  
  // 2. Bullet slides
  bulletPoints.forEach((point, idx) => {
    reconstructedSlides.push({
      id: Date.now() + idx + 1,
      title: point,
      body: "Re-edit or modify this slide content.",
      imagePrompt: point,
      gradient: theme.class,
      textClass: theme.textClass,
      textColor: theme.textColor,
      layout: 'standard',
      bgType: 'tailwind',
      bgSolidColor: mapped.start,
      bgGradientStart: mapped.start,
      bgGradientVia: mapped.via,
      bgGradientTo: mapped.to,
      titleColor: theme.textColor,
      bodyColor: theme.textColor === '#18181b' ? '#27272a' : '#d4d4d8'
    });
  });
  
  // 3. CTA slide
  reconstructedSlides.push({
    id: Date.now() + bulletPoints.length + 1,
    title: "Conclusion & CTA",
    body: "Follow for more premium content!",
    imagePrompt: "CTA",
    gradient: theme.class,
    textClass: theme.textClass,
    textColor: theme.textColor,
    layout: 'quote',
    bgType: 'tailwind',
    bgSolidColor: mapped.start,
    bgGradientStart: mapped.start,
    bgGradientVia: mapped.via,
    bgGradientTo: mapped.to,
    titleColor: theme.textColor,
    bodyColor: theme.textColor === '#18181b' ? '#27272a' : '#d4d4d8'
  });
  
  return reconstructedSlides;
};

const CarouselBuilder = () => {
  // Navigation: 'setup' | 'outline' | 'editor'
  const [step, setStep] = useState('setup');
  const location = useLocation();

  // Setup Form state
  const [topic, setTopic] = useState('');
  const [platform, setPlatform] = useState('linkedin');
  const [slideCount, setSlideCount] = useState(5);
  const [useBrandBrain, setUseBrandBrain] = useState(true);
  const [selectedTheme, setSelectedTheme] = useState(themes[0]);
  const [isGeneratingOutline, setIsGeneratingOutline] = useState(false);

  // Outline state
  const [outline, setOutline] = useState([]);
  const [isGeneratingSlides, setIsGeneratingSlides] = useState(false);

  // Editor state
  const [slides, setSlides] = useState([]);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [fontFamily, setFontFamily] = useState(fonts[0].value);
  const [textAlign, setTextAlign] = useState('center');
  const [brandWatermark, setBrandWatermark] = useState('taraflow.ai');
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  // CarouselMaker-style Design settings
  const [designTab, setDesignTab] = useState('templates');
  const [selectedTemplateName, setSelectedTemplateName] = useState('');
  const [showProfile, setShowProfile] = useState(true);
  const [profileName, setProfileName] = useState('Taraflow AI');
  const [profileHandle, setProfileHandle] = useState('@taraflow');
  const [profileInitials, setProfileInitials] = useState('TF');
  const [bgPattern, setBgPattern] = useState('none');
  const [patternOpacity, setPatternOpacity] = useState(15);
  const [swipeStyle, setSwipeStyle] = useState('text');
  const [titleSize, setTitleSize] = useState(2.0);
  const [bodySize, setBodySize] = useState(1.0);

  const [bgType, setBgType] = useState('tailwind'); // 'tailwind' | 'solid' | 'gradient'
  const [bgSolidColor, setBgSolidColor] = useState('#1e1b4b');
  const [bgGradientStart, setBgGradientStart] = useState('#7c3aed');
  const [bgGradientVia, setBgGradientVia] = useState('#4338ca');
  const [bgGradientTo, setBgGradientTo] = useState('#312e81');
  const [titleColor, setTitleColor] = useState('#ffffff');
  const [bodyColor, setBodyColor] = useState('#d4d4d8');
  const [isGeneratingTheme, setIsGeneratingTheme] = useState(false);

  const updateGlobalColors = (updates) => {
    setSlides((prev) =>
      prev.map((slide) => ({
        ...slide,
        ...updates
      }))
    );
  };

  const handleBgTypeChange = (type) => {
    setBgType(type);
    updateGlobalColors({ bgType: type });
  };
  const handleBgSolidColorChange = (color) => {
    setBgSolidColor(color);
    updateGlobalColors({ bgSolidColor: color, bgType: 'solid' });
  };
  const handleBgGradientStartChange = (color) => {
    setBgGradientStart(color);
    updateGlobalColors({ bgGradientStart: color, bgType: 'gradient' });
  };
  const handleBgGradientViaChange = (color) => {
    setBgGradientVia(color);
    updateGlobalColors({ bgGradientVia: color, bgType: 'gradient' });
  };
  const handleBgGradientToChange = (color) => {
    setBgGradientTo(color);
    updateGlobalColors({ bgGradientTo: color, bgType: 'gradient' });
  };
  const handleTitleColorChange = (color) => {
    setTitleColor(color);
    updateGlobalColors({ titleColor: color });
  };
  const handleBodyColorChange = (color) => {
    setBodyColor(color);
    updateGlobalColors({ bodyColor: color });
  };

  const handleGenerateAITheme = async () => {
    if (!topic.trim()) {
      showToast('Please enter a topic in the setup step first!', 'error');
      return;
    }
    setIsGeneratingTheme(true);
    showToast('AI is brainstorming a custom color palette...', 'info');
    try {
      const promptText = `Generate a modern, beautiful color theme for a social media carousel based on the topic: "${topic}".
Output MUST be a single, valid JSON object with the following fields and no other text or explanation:
{
  "bgType": "gradient", // can be "solid" or "gradient"
  "bgSolidColor": "#HEX", // a solid background color if bgType is "solid"
  "bgGradientStart": "#HEX", // gradient start hex color
  "bgGradientVia": "#HEX", // optional gradient middle hex color, or empty string if not needed
  "bgGradientTo": "#HEX", // gradient end hex color
  "titleColor": "#HEX", // title text color that has high contrast on the background
  "bodyColor": "#HEX" // body/subtitle text color that has high contrast on the background
}
Make the color theme visually stunning, premium, cohesive, and perfectly fitting the topic. Return ONLY the JSON object.`;

      const response = await aiService.generate('rewrite', {
        originalText: promptText,
        objective: 'Generate a color palette JSON object matching the topic.',
        tone: 'professional'
      });

      if (response && response.success && response.result) {
        let jsonText = response.result.replace(/```json/gi, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(jsonText);

        if (parsed.bgType && (parsed.bgType === 'solid' || parsed.bgType === 'gradient')) {
          setBgType(parsed.bgType);
          if (parsed.bgSolidColor) setBgSolidColor(parsed.bgSolidColor);
          if (parsed.bgGradientStart) setBgGradientStart(parsed.bgGradientStart);
          setBgGradientVia(parsed.bgGradientVia || '');
          if (parsed.bgGradientTo) setBgGradientTo(parsed.bgGradientTo);
          if (parsed.titleColor) setTitleColor(parsed.titleColor);
          if (parsed.bodyColor) setBodyColor(parsed.bodyColor);

          // Apply to all slides
          setSlides((prev) =>
            prev.map((slide) => ({
              ...slide,
              bgType: parsed.bgType,
              bgSolidColor: parsed.bgSolidColor || slide.bgSolidColor,
              bgGradientStart: parsed.bgGradientStart || slide.bgGradientStart,
              bgGradientVia: parsed.bgGradientVia || '',
              bgGradientTo: parsed.bgGradientTo || slide.bgGradientTo,
              titleColor: parsed.titleColor || slide.titleColor,
              bodyColor: parsed.bodyColor || slide.bodyColor,
              textColor: parsed.titleColor || slide.textColor
            }))
          );

          showToast('AI color palette generated and applied successfully!');
        } else {
          throw new Error('Invalid theme format received from AI.');
        }
      } else {
        throw new Error('No theme returned from AI.');
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to generate AI theme. Try choosing colors manually.', 'error');
    } finally {
      setIsGeneratingTheme(false);
    }
  };

  // Social publishing state
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [connectedAccounts, setConnectedAccounts] = useState([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [publishCaption, setPublishCaption] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishError, setPublishError] = useState('');
  const [publishMode, setPublishMode] = useState('now'); // 'now' | 'schedule'
  const [scheduledDate, setScheduledDate] = useState(new Date().toISOString().split('T')[0]);
  const [scheduledTime, setScheduledTime] = useState('12:00');

  useEffect(() => {
    if (location.state?.retryPost) {
      const retry = location.state.retryPost;
      const parsedTopic = retry.content.split('\n')[0].trim();
      setTopic(parsedTopic);
      setPlatform(retry.platform || 'linkedin');
      
      // Reconstruct slides
      const theme = selectedTheme || themes[0];
      const parsedSlides = parseCaptionToSlides(retry.content, retry.platform, theme);
      if (parsedSlides.length > 0) {
        setSlides(parsedSlides);
        setActiveSlideIndex(0);
        setStep('editor');
      }
      
      // Load accounts and open publish modal with prefilled caption
      const loadPublishData = async () => {
        setIsPublishModalOpen(true);
        setIsLoadingAccounts(true);
        setPublishError('');
        setPublishMode('now');
        if (retry.scheduledAt) {
          const dateObj = new Date(retry.scheduledAt);
          if (!isNaN(dateObj.getTime())) {
            setScheduledDate(dateObj.toISOString().split('T')[0]);
            setScheduledTime(dateObj.toTimeString().substring(0, 5));
            setPublishMode('schedule');
          }
        }
        setPublishCaption(retry.content || '');
        try {
          const response = await socialService.getAccounts();
          const accounts = response?.data || [];
          setConnectedAccounts(accounts);
          if (accounts && accounts.length > 0) {
            const preselected = accounts.find(acc => acc.platform === retry.platform) || accounts[0];
            setSelectedAccount(preselected);
          }
        } catch (err) {
          console.error('Failed to load social accounts', err);
          setPublishError(err.message || 'Could not load connected channels.');
        } finally {
          setIsLoadingAccounts(false);
        }
      };
      
      loadPublishData();
      
      // Clean up Router state so reloading doesn't prompt modal again
      window.history.replaceState({}, document.title);
      
      setTimeout(() => {
        showToast('Pre-populated carousel details for retry/edit!', 'success');
      }, 500);
    }
  }, [location.state]);

  const layoutOptions = [
    { id: 'standard', name: 'Standard', desc: 'Centered title + description body text', icon: FileText },
    { id: 'peek', name: 'Hook / Peek', desc: 'Huge bold centered title ideal for intro/outros', icon: Heading },
    { id: 'split', name: 'Split Columns', desc: 'Dual-column structure with divider lines', icon: Layout },
    { id: 'quote', name: 'Quote Card', desc: 'Testimonial/quote layout with avatar references', icon: Quote },
    { id: 'technical', name: 'Technical Step', desc: 'Monospace code block/step outline', icon: Sliders },
  ];

  const getPatternStyle = (pattern, opacity, textColor) => {
    if (!pattern || pattern === 'none') return {};
    const color = textColor === '#ffffff' || textColor === 'white' ? '255, 255, 255' : '24, 24, 27';
    if (pattern === 'dots') {
      return {
        backgroundImage: `radial-gradient(rgba(${color}, 0.25) 1.5px, transparent 1.5px)`,
        backgroundSize: '24px 24px',
        opacity: opacity / 100,
      };
    }
    if (pattern === 'grid') {
      return {
        backgroundImage: `linear-gradient(rgba(${color}, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(${color}, 0.1) 1px, transparent 1px)`,
        backgroundSize: '30px 30px',
        opacity: opacity / 100,
      };
    }
    if (pattern === 'stripes') {
      return {
        backgroundImage: `repeating-linear-gradient(45deg, rgba(${color}, 0.06), rgba(${color}, 0.06) 10px, transparent 10px, transparent 20px)`,
        opacity: opacity / 100,
      };
    }
    return {};
  };

  const renderFooterPagination = (index, totalSlides, isDark) => {
    const textClass = isDark ? 'text-zinc-800' : 'text-white';
    if (swipeStyle === 'arrows') {
      return (
        <div className={`flex justify-between items-center w-full text-[10px] sm:text-xs font-bold opacity-60 ${textClass}`}>
          <div />
          <span>← Page {index + 1} of {totalSlides} →</span>
          <div />
        </div>
      );
    }
    if (swipeStyle === 'dots') {
      return (
        <div className={`flex justify-between items-center w-full text-[10px] sm:text-xs font-bold opacity-60 ${textClass}`}>
          <div className="w-10 text-left">{index + 1} / {totalSlides}</div>
          <div className="flex space-x-1.5 items-center justify-center flex-1">
            {Array.from({ length: totalSlides }).map((_, i) => (
              <div 
                key={i} 
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === index 
                    ? `w-4 ${isDark ? 'bg-zinc-800' : 'bg-white'}` 
                    : isDark ? 'bg-zinc-300/60' : 'bg-white/30'
                }`} 
              />
            ))}
          </div>
          <div className="w-10 text-right">Swipe</div>
        </div>
      );
    }
    if (swipeStyle === 'hand') {
      return (
        <div className={`flex justify-between items-center w-full text-[10px] sm:text-xs font-bold opacity-60 ${textClass}`}>
          <span className="flex items-center space-x-1">
            <span>Swipe Left</span>
            <ArrowRight className="h-3 w-3 animate-pulse text-indigo-400" />
          </span>
          <span>{index + 1} / {totalSlides}</span>
        </div>
      );
    }
    return (
      <div className={`flex justify-between items-center w-full text-[10px] sm:text-xs font-bold opacity-60 ${textClass}`}>
        <span>Swipe Left →</span>
        <span>{index + 1} / {totalSlides}</span>
      </div>
    );
  };

  const renderFooterPaginationHighRes = (index, totalSlides, isDark) => {
    const textColor = isDark ? '#18181b' : '#ffffff';
    if (swipeStyle === 'arrows') {
      return (
        <div style={{ display: 'flex', justifyContent: 'center', fontSize: '16px', fontWeight: 'bold', opacity: 0.6, color: textColor }}>
          <span>← Page {index + 1} of {totalSlides} →</span>
        </div>
      );
    }
    if (swipeStyle === 'dots') {
      return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '16px', fontWeight: 'bold', opacity: 0.6, color: textColor }}>
          <div style={{ width: '80px', textAlign: 'left' }}>{index + 1} / {totalSlides}</div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'center' }}>
            {Array.from({ length: totalSlides }).map((_, i) => (
              <div 
                key={i} 
                style={{
                  height: '8px',
                  borderRadius: '4px',
                  width: i === index ? '24px' : '8px',
                  background: textColor,
                  opacity: i === index ? 1 : 0.35,
                  transition: 'all 0.3s'
                }} 
              />
            ))}
          </div>
          <div style={{ width: '80px', textAlign: 'right' }}>Swipe</div>
        </div>
      );
    }
    if (swipeStyle === 'hand') {
      return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '16px', fontWeight: 'bold', opacity: 0.6, color: textColor }}>
          <span>Swipe Left →</span>
          <span>{index + 1} / {totalSlides}</span>
        </div>
      );
    }
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '18px', fontWeight: 'bold', opacity: 0.6, color: textColor }}>
        <span>Swipe Left →</span>
        <span>{index + 1} / {totalSlides}</span>
      </div>
    );
  };

  // Show status toasts
  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  };

  // Generate outlines via API
  const handleGenerateOutline = async () => {
    if (!topic.trim()) {
      showToast('Please enter a topic or concept first!', 'error');
      return;
    }
    setIsGeneratingOutline(true);
    try {
      const response = await aiService.generate('carousel_outline', {
        topic,
        platform,
        slideCount,
        useBrandBrain
      });
      if (response && response.success && Array.isArray(response.result)) {
        setOutline(response.result);
        setStep('outline');
        showToast('Outline generated successfully!');
      } else {
        throw new Error('Failed to generate outlines');
      }
    } catch (err) {
      console.error(err);
      showToast('API request failed. Loading backup templates...', 'warning');
      // Load fallback mock outlines
      const mockOutlines = [
        { slideNumber: 1, title: `Intro to ${topic}`, concept: 'Visual overview of topic' },
        { slideNumber: 2, title: 'Key Challenge', concept: 'Problem definition graphic' },
        { slideNumber: 3, title: 'Core Solution', concept: 'Illustration of core steps' },
        { slideNumber: 4, title: 'Practical Tip', concept: 'Diagram representing code or design' },
        { slideNumber: 5, title: 'Conclusion & CTA', concept: 'Final slide with download action' },
      ];
      setOutline(mockOutlines);
      setStep('outline');
    } finally {
      setIsGeneratingOutline(false);
    }
  };

  // Generate detailed slide contents based on outlines
  const handleGenerateSlides = async () => {
    setIsGeneratingSlides(true);
    try {
      const response = await aiService.generate('carousel_slides', {
        topic,
        platform,
        outline,
        useBrandBrain
      });

      if (response && response.success && Array.isArray(response.result)) {
        const generatedSlides = response.result.map((slide, idx) => ({
          id: Date.now() + idx,
          title: slide.title || outline[idx]?.title || `Slide ${idx + 1}`,
          body: slide.body || '',
          imagePrompt: slide.imagePrompt || '',
          gradient: selectedTheme.class,
          textClass: selectedTheme.textClass,
          textColor: selectedTheme.textColor,
          layout: 'standard',
          bgType,
          bgSolidColor,
          bgGradientStart,
          bgGradientVia,
          bgGradientTo,
          titleColor,
          bodyColor
        }));
        setSlides(generatedSlides);
        setActiveSlideIndex(0);
        setStep('editor');
        showToast('Slides generated successfully!');
      } else {
        throw new Error('Failed to generate slides');
      }
    } catch (err) {
      console.error(err);
      showToast('API request failed. Loading backup slide copy...', 'warning');
      // Fallback slides
      const mockSlides = outline.map((item, idx) => ({
        id: Date.now() + idx,
        title: item.title,
        body: `Detailed sub-content covering the outline theme "${item.concept}". Customize this text to fit your exact message.`,
        imagePrompt: item.concept,
        gradient: selectedTheme.class,
        textClass: selectedTheme.textClass,
        textColor: selectedTheme.textColor,
        layout: 'standard',
        bgType,
        bgSolidColor,
        bgGradientStart,
        bgGradientVia,
        bgGradientTo,
        titleColor,
        bodyColor
      }));
      setSlides(mockSlides);
      setActiveSlideIndex(0);
      setStep('editor');
    } finally {
      setIsGeneratingSlides(false);
    }
  };

  // Outline modification helper functions
  const updateOutlineItem = (index, field, value) => {
    setOutline((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, [field]: value } : item))
    );
  };

  const addOutlineItem = () => {
    const newItem = {
      slideNumber: outline.length + 1,
      title: 'New Headline Hook',
      concept: 'Visual theme description'
    };
    setOutline([...outline, newItem]);
  };

  const deleteOutlineItem = (indexToDelete) => {
    if (outline.length <= 1) return;
    const filtered = outline.filter((_, idx) => idx !== indexToDelete);
    const updated = filtered.map((item, idx) => ({
      ...item,
      slideNumber: idx + 1
    }));
    setOutline(updated);
  };

  // Editor screen modifications
  const updateActiveSlide = (key, value) => {
    setSlides((prev) =>
      prev.map((slide, idx) => (idx === activeSlideIndex ? { ...slide, [key]: value } : slide))
    );
  };

  const addEditorSlide = () => {
    const newSlide = {
      id: Date.now(),
      title: 'New Slide Headline',
      body: 'Add key bullet details or description here.',
      imagePrompt: 'Visual description',
      gradient: selectedTheme.class,
      textClass: selectedTheme.textClass,
      textColor: selectedTheme.textColor,
      layout: 'standard',
      bgType,
      bgSolidColor,
      bgGradientStart,
      bgGradientVia,
      bgGradientTo,
      titleColor,
      bodyColor
    };
    setSlides([...slides, newSlide]);
    setActiveSlideIndex(slides.length);
  };

  const deleteEditorSlide = (indexToDelete) => {
    if (slides.length <= 1) return;
    const filtered = slides.filter((_, idx) => idx !== indexToDelete);
    setSlides(filtered);
    setActiveSlideIndex(Math.max(0, indexToDelete - 1));
  };

  // Apply visual theme selection to all slides
  const applyThemeToAll = (theme) => {
    setSelectedTheme(theme);
    const mapped = mapTailwindClassToColors(theme.class);
    setBgType('tailwind');
    setBgSolidColor(mapped.start);
    setBgGradientStart(mapped.start);
    setBgGradientVia(mapped.via);
    setBgGradientTo(mapped.to);
    setTitleColor(theme.textColor);
    setBodyColor(theme.textColor === '#18181b' ? '#27272a' : '#d4d4d8');

    setSlides((prev) =>
      prev.map((slide) => ({
        ...slide,
        gradient: theme.class,
        textClass: theme.textClass,
        textColor: theme.textColor,
        bgType: 'tailwind',
        bgSolidColor: mapped.start,
        bgGradientStart: mapped.start,
        bgGradientVia: mapped.via,
        bgGradientTo: mapped.to,
        titleColor: theme.textColor,
        bodyColor: theme.textColor === '#18181b' ? '#27272a' : '#d4d4d8'
      }))
    );
  };

  const handleApplyTemplate = (tpl) => {
    setSelectedTemplateName(tpl.name);
    setFontFamily(tpl.fontFamily);
    setBgPattern(tpl.bgPattern);
    setPatternOpacity(tpl.patternOpacity);
    setTitleSize(tpl.titleSize);
    setBodySize(tpl.bodySize);
    setTextAlign(tpl.textAlign);
    setSwipeStyle(tpl.swipeStyle);
    setSelectedTheme(tpl.theme);

    const mapped = mapTailwindClassToColors(tpl.theme.class);
    setBgType('tailwind');
    setBgSolidColor(mapped.start);
    setBgGradientStart(mapped.start);
    setBgGradientVia(mapped.via);
    setBgGradientTo(mapped.to);
    setTitleColor(tpl.theme.textColor);
    setBodyColor(tpl.theme.textColor === '#18181b' ? '#27272a' : '#d4d4d8');

    setSlides((prev) =>
      prev.map((slide, idx) => {
        const sequenceLength = tpl.layoutSequence.length;
        let layout = 'standard';
        if (prev.length === 1) {
          layout = tpl.layoutSequence[0] || 'standard';
        } else if (idx === 0) {
          layout = tpl.layoutSequence[0] || 'standard';
        } else if (idx === prev.length - 1) {
          layout = tpl.layoutSequence[sequenceLength - 1] || 'standard';
        } else {
          if (sequenceLength > 2) {
            const innerIndex = ((idx - 1) % (sequenceLength - 2)) + 1;
            layout = tpl.layoutSequence[innerIndex] || 'standard';
          } else {
            layout = 'standard';
          }
        }

        return {
          ...slide,
          layout,
          gradient: tpl.theme.class,
          textClass: tpl.theme.textClass,
          textColor: tpl.theme.textColor,
          bgType: 'tailwind',
          bgSolidColor: mapped.start,
          bgGradientStart: mapped.start,
          bgGradientVia: mapped.via,
          bgGradientTo: mapped.to,
          titleColor: tpl.theme.textColor,
          bodyColor: tpl.theme.textColor === '#18181b' ? '#27272a' : '#d4d4d8'
        };
      })
    );

    showToast(`Applied "${tpl.name}" template design successfully!`);
  };

  const handleOpenPublishModal = async () => {
    setIsPublishModalOpen(true);
    setIsLoadingAccounts(true);
    setPublishError('');
    setSelectedAccount(null);
    setPublishMode('now');
    setScheduledDate(new Date().toISOString().split('T')[0]);
    setScheduledTime('12:00');

    // Generate draft caption: topic, main title, some hashtags
    const mainTitle = slides[0]?.title || '';
    const bodyPoints = slides.slice(1, slides.length - 1).map(s => `• ${s.title}`).join('\n');
    const defaultCaption = `${mainTitle}\n\nHere are the key takeaways:\n${bodyPoints}\n\n#contentstrategy #design #marketing #carousel #taraflow`;
    setPublishCaption(defaultCaption);

    try {
      const response = await socialService.getAccounts();
      const accounts = response?.data || [];
      setConnectedAccounts(accounts);
      if (accounts && accounts.length > 0) {
        setSelectedAccount(accounts[0]);
      }
    } catch (err) {
      console.error('Failed to load social accounts', err);
      setPublishError(err.message || 'Could not load connected channels. Please connect accounts in Social Accounts first.');
    } finally {
      setIsLoadingAccounts(false);
    }
  };

  const handlePublishToSocial = async () => {
    if (isPublishing) return;
    if (!selectedAccount) {
      setPublishError('Please select a connected account first.');
      return;
    }
    if (!publishCaption.trim()) {
      setPublishError('Please write a caption/post description.');
      return;
    }

    let parsedScheduledDate = null;
    if (publishMode === 'schedule') {
      parsedScheduledDate = new Date(`${scheduledDate}T${scheduledTime}`);
      if (isNaN(parsedScheduledDate.getTime())) {
        setPublishError('Invalid date or time format.');
        return;
      }
      if (parsedScheduledDate < new Date()) {
        setPublishError('Schedule time must be in the future.');
        return;
      }
    }

    setIsPublishing(true);
    setPublishError('');

    try {
      const mediaList = [];
      for (let i = 0; i < slides.length; i++) {
        const slideElement = document.getElementById(`carousel-slide-full-${i}`);
        if (!slideElement) continue;

        showToast(`Rasterizing slide ${i + 1} of ${slides.length}...`, 'info');
        const canvas = await html2canvas(slideElement, {
          scale: 1.5,
          useCORS: true,
          logging: false
        });
        const base64DataUri = canvas.toDataURL('image/jpeg', 0.92);
        mediaList.push({ url: base64DataUri, type: 'image' });
      }

      if (mediaList.length === 0) {
        throw new Error('No slide elements found in DOM.');
      }

      showToast(publishMode === 'schedule' ? 'Scheduling post...' : 'Creating social post...', 'info');

      // Step 2: Create a post
      const postData = {
        content: publishCaption,
        platform: selectedAccount.platform,
        media: mediaList,
        status: publishMode === 'schedule' ? 'SCHEDULED' : 'DRAFT',
        scheduledAt: publishMode === 'schedule' ? parsedScheduledDate.toISOString() : new Date().toISOString(),
        isCarousel: true
      };

      const createdPost = await contentService.createPost(postData);
      if (!createdPost || !createdPost._id) {
        throw new Error('Failed to create post in publishing queue.');
      }

      if (publishMode === 'now') {
        showToast('Publishing live...', 'info');
        // Step 3: Publish immediately
        await contentService.publishPostNow(createdPost._id);
        showToast('Post published successfully!');
      } else {
        showToast('Post scheduled successfully!');
      }

      setIsPublishModalOpen(false);
    } catch (err) {
      console.error(err);
      setPublishError(err.response?.data?.message || err.message || 'Action failed. Please check backend integration.');
    } finally {
      setIsPublishing(false);
    }
  };

  // Dimensions of export canvas based on platform
  const getDimensions = () => {
    // Standard LinkedIn/Instagram portrait is 4:5 (1080x1350)
    // Facebook landscape is 1.91:1 (1200x630)
    // Default square is 1:1 (1080x1080)
    if (platform === 'linkedin' || platform === 'instagram') {
      return { width: 1080, height: 1350, aspectClass: 'aspect-[4/5] w-full max-w-[280px] sm:max-w-[320px] md:max-w-[360px]' };
    }
    if (platform === 'facebook') {
      return { width: 1200, height: 630, aspectClass: 'aspect-[1.91/1] w-full max-w-[320px] sm:max-w-[400px] md:max-w-[480px]' };
    }
    return { width: 1080, height: 1080, aspectClass: 'aspect-square w-full max-w-[280px] sm:max-w-[340px] md:max-w-[380px]' };
  };

  const { width, height, aspectClass } = getDimensions();

  // Export PDF from the slides
  const handleExportPDF = async () => {
    if (slides.length === 0) return;
    setIsGeneratingPDF(true);
    showToast('Compiling high-resolution PDF pages...', 'info');

    try {
      const pdf = new jsPDF({
        orientation: width > height ? 'landscape' : 'portrait',
        unit: 'px',
        format: [width, height]
      });

      for (let i = 0; i < slides.length; i++) {
        const slideElement = document.getElementById(`carousel-slide-full-${i}`);
        if (!slideElement) continue;

        // Render at scale:2 for high fidelity vector text rasterization
        const canvas = await html2canvas(slideElement, {
          scale: 2.2,
          useCORS: true,
          logging: false
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.96);

        if (i > 0) {
          pdf.addPage([width, height]);
        }

        pdf.addImage(imgData, 'JPEG', 0, 0, width, height);
      }

      const filename = `${topic.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'carousel'}-deck.pdf`;
      pdf.save(filename);
      showToast('PDF downloaded successfully!');
    } catch (err) {
      console.error(err);
      showToast('Failed to compile PDF. Check log console.', 'error');
    } finally {
      setIsGeneratingPDF(false);
    }
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
            className={`fixed top-4 right-4 z-50 flex items-center space-x-2.5 px-5 py-3 rounded-xl border shadow-xl backdrop-blur-xl ${toast.type === 'error'
                ? 'bg-red-500/10 border-red-500/20 text-red-400'
                : toast.type === 'warning'
                  ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                  : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              }`}
          >
            <span className="text-sm font-semibold">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header section with stepper */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 border-b border-zinc-800/40 pb-6">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-700 dark:from-white dark:via-zinc-100 dark:to-zinc-400 bg-clip-text text-transparent flex items-center space-x-3.5">
            <Layers className="h-8 w-8 text-indigo-400 animate-pulse" />
            <span>AI Carousel Studio</span>
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1.5">
            Generate high-converting, visually stunning slides for LinkedIn and Instagram.
          </p>
        </div>

        {/* Wizard Steps Stepper */}
        <div className="relative flex items-center bg-zinc-900/20 backdrop-blur-xl border border-zinc-800/80 p-2 sm:p-3 px-3 sm:px-5 rounded-2xl shrink-0 gap-2 sm:gap-3.5 shadow-lg shadow-zinc-950/50 mx-auto lg:mx-0 self-center lg:self-auto">
          {[
            { id: 'setup', num: '1', name: 'Setup', label: 'Configure' },
            { id: 'outline', num: '2', name: 'Outline', label: 'Structure', disabled: outline.length === 0 },
            { id: 'editor', num: '3', name: 'Design', label: 'Customize', disabled: slides.length === 0 }
          ].map((item, idx, arr) => {
            const isCompleted = (item.id === 'setup' && step !== 'setup') || (item.id === 'outline' && step === 'editor');
            const isActive = step === item.id;
            return (
              <React.Fragment key={item.id}>
                <button
                  type="button"
                  disabled={item.disabled}
                  onClick={() => setStep(item.id)}
                  className={`flex items-center space-x-2 sm:space-x-3 text-left group transition-all duration-300 focus:outline-none ${item.disabled ? 'opacity-35 cursor-not-allowed' : 'cursor-pointer'
                    }`}
                >
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs border transition-all duration-300 ${isActive
                      ? 'bg-indigo-600/15 border-indigo-500 text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.35)]'
                      : isCompleted
                        ? 'bg-emerald-500/15 border-emerald-500 text-emerald-400'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-500 group-hover:border-zinc-700 group-hover:text-zinc-300'
                    }`}>
                    {isCompleted ? <Check className="h-4 w-4" /> : item.num}
                  </div>
                  <div className="hidden sm:block">
                    <div className={`text-xs font-bold transition-colors ${isActive ? 'text-zinc-200' : 'text-zinc-500 group-hover:text-zinc-300'
                      }`}>{item.name}</div>
                    <div className="text-[9px] font-medium text-zinc-600 group-hover:text-zinc-500 leading-none mt-0.5">{item.label}</div>
                  </div>
                </button>
                {idx < arr.length - 1 && (
                  <div className={`h-[1px] w-4 sm:w-10 rounded transition-all duration-500 ${isCompleted ? 'bg-emerald-500/30' : isActive ? 'bg-indigo-500/20' : 'bg-zinc-800'
                    }`} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Screen step transitions */}
      <AnimatePresence mode="wait">

        {/* STEP 1: SETUP FORM */}
        {step === 'setup' && (
          <motion.div
            key="setup-screen"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="max-w-2xl mx-auto bg-zinc-900/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-8 space-y-7 shadow-2xl relative overflow-hidden"
          >
            {/* Background design glow */}
            <div className="absolute -top-24 -right-24 h-48 w-48 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 h-48 w-48 rounded-full bg-rose-500/5 blur-3xl pointer-events-none" />

            <div className="flex items-center space-x-3.5 pb-4 border-b border-zinc-800/60 relative z-10">
              <div className="p-2.5 bg-indigo-650/10 border border-indigo-500/20 text-indigo-400 rounded-2xl shadow-inner shadow-indigo-550/5">
                <Sparkles className="h-5 w-5 animate-pulse" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-zinc-150 tracking-tight">Configure Your Slide Deck</h2>
                <p className="text-xs text-zinc-500 mt-0.5">Let AI generate a high-performing visual outline for you.</p>
              </div>
            </div>

            <div className="space-y-6 relative z-10">
              {/* Topic input */}
              <div className="space-y-2">
                <label className="block text-[10px] text-zinc-400 uppercase font-bold tracking-wider">What is your carousel topic?</label>
                <textarea
                  rows={3}
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. 5 Node.js Scaling Bottlenecks and how to resolve them with Redis and BullMQ"
                  className="w-full rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4 text-sm text-zinc-200 focus:border-indigo-500/80 focus:outline-none focus:ring-1 focus:ring-indigo-500/40 resize-none placeholder-zinc-700 leading-relaxed shadow-inner"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* Target Platform */}
                <div className="space-y-2">
                  <label className="block text-[10px] text-zinc-400 uppercase font-bold tracking-wider">Destination Platform</label>
                  <select
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value)}
                    className="w-full rounded-2xl border border-zinc-800 bg-zinc-950/40 py-3 px-4 text-sm text-zinc-200 focus:border-indigo-500/80 focus:outline-none focus:ring-1 focus:ring-indigo-500/40 transition-all shadow-inner"
                  >
                    <option value="linkedin">LinkedIn (Portrait PDF)</option>
                    <option value="instagram">Instagram (Portrait / Square)</option>
                    <option value="facebook">Facebook (Landscape / Square)</option>
                  </select>
                </div>

                {/* Slide Count */}
                <div className="space-y-2">
                  <label className="block text-[10px] text-zinc-400 uppercase font-bold tracking-wider">Slide Deck Length</label>
                  <select
                    value={slideCount}
                    onChange={(e) => setSlideCount(parseInt(e.target.value, 10))}
                    className="w-full rounded-2xl border border-zinc-800 bg-zinc-950/40 py-3 px-4 text-sm text-zinc-200 focus:border-indigo-500/80 focus:outline-none focus:ring-1 focus:ring-indigo-500/40 transition-all shadow-inner"
                  >
                    {[3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                      <option key={num} value={num}>{num} Slide Pages</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Theme Selector */}
              <div className="space-y-2.5">
                <label className="block text-[10px] text-zinc-400 uppercase font-bold tracking-wider">Initial Aesthetic Vibe</label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {themes.map((t) => (
                    <button
                      key={t.name}
                      type="button"
                      onClick={() => applyThemeToAll(t)}
                      className={`h-16 rounded-2xl bg-gradient-to-tr ${t.class} border hover:scale-[1.03] active:scale-[0.98] transition-all flex flex-col justify-between p-3.5 cursor-pointer relative overflow-hidden group select-none shadow-md ${selectedTheme.name === t.name
                          ? 'border-indigo-500 ring-2 ring-indigo-500/35 shadow-[0_0_15px_rgba(99,102,241,0.25)]'
                          : 'border-white/10'
                        }`}
                    >
                      {/* Checkmark overlay for selection */}
                      {selectedTheme.name === t.name && (
                        <div className="absolute top-1.5 right-1.5 h-3.5 w-3.5 rounded-full bg-white text-zinc-950 flex items-center justify-center shadow-md animate-scaleUp">
                          <Check className="h-2 w-2 stroke-[3]" />
                        </div>
                      )}
                      <div className="w-full mt-auto">
                        <span className={`text-[8px] font-bold tracking-wider uppercase block truncate ${t.textClass}`}>{t.name}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Brand Brain Switch */}
              <div className="flex items-center justify-between p-4 bg-zinc-900/40 border border-zinc-800 rounded-2xl shadow-inner transition-all hover:bg-zinc-950/50">
                <div className="flex items-center space-x-3.5">
                  <div className="p-2 bg-indigo-650/10 border border-indigo-500/20 text-indigo-400 rounded-xl">
                    <Layers className="h-4.5 w-4.5 text-indigo-400 animate-pulse" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-zinc-200">Personalize with Brand Brain</h4>
                    <p className="text-[10px] text-zinc-550 leading-relaxed mt-0.5">Adapt content styles and keywords dynamically from brand profile settings.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setUseBrandBrain(!useBrandBrain)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${useBrandBrain
                      ? 'bg-indigo-600 shadow-[0_0_10px_rgba(99,102,241,0.35)]'
                      : 'bg-zinc-700 dark:bg-zinc-800'
                    }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out ${useBrandBrain ? 'translate-x-5' : 'translate-x-0'
                      }`}
                  />
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-zinc-800/60 relative z-10">
              <button
                type="button"
                onClick={handleGenerateOutline}
                disabled={isGeneratingOutline}
                className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-sm font-semibold text-white rounded-2xl shadow-lg shadow-indigo-500/20 transition-all cursor-pointer disabled:opacity-50"
              >
                {isGeneratingOutline ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin text-white" />
                    <span>Analyzing Outline...</span>
                  </>
                ) : (
                  <>
                    <span>Generate AI Outline</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}

        {/* STEP 2: OUTLINE REVIEW */}
        {step === 'outline' && (
          <motion.div
            key="outline-screen"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="max-w-3xl mx-auto space-y-6"
          >
            <div className="bg-zinc-900/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-8 shadow-2xl space-y-5 relative overflow-hidden">
              {/* Background glows */}
              <div className="absolute -top-20 -left-20 h-40 w-40 rounded-full bg-indigo-500/5 blur-3xl pointer-events-none" />
              <div className="absolute -bottom-20 -right-20 h-40 w-40 rounded-full bg-rose-500/5 blur-3xl pointer-events-none" />

              <div className="flex items-center justify-between pb-4 border-b border-zinc-800/60 relative z-10">
                <div className="flex items-center space-x-3.5">
                  <div className="p-2.5 bg-indigo-650/10 border border-indigo-500/20 text-indigo-400 rounded-2xl">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-zinc-150 tracking-tight">Review Slide Outline</h2>
                    <p className="text-xs text-zinc-500 mt-0.5">Customize slide topics and visual prompts before drafting copies.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={addOutlineItem}
                  className="flex items-center space-x-1.5 px-4 py-2 bg-zinc-950/60 border border-zinc-800 hover:border-zinc-700 text-xs font-bold text-zinc-300 rounded-xl transition-all cursor-pointer shadow-sm active:scale-[0.98]"
                >
                  <Plus className="h-3.5 w-3.5 text-indigo-450" />
                  <span>Add Slide</span>
                </button>
              </div>

              {/* Outline Deck Items */}
              <div className="space-y-4 relative z-10 max-h-[50vh] overflow-y-auto pr-1">
                {outline.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-4 p-4 bg-zinc-900/40 border border-zinc-800 hover:border-zinc-700/60 rounded-2xl transition-all shadow-sm group"
                  >
                    <div className="bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center justify-center shadow-inner shrink-0 select-none">
                      {idx + 1}
                    </div>

                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="block text-[9px] text-zinc-550 uppercase font-bold tracking-wider">Slide Headline/Hook</label>
                        <input
                          type="text"
                          value={item.title}
                          onChange={(e) => updateOutlineItem(idx, 'title', e.target.value)}
                          className="w-full rounded-xl border border-zinc-800 bg-zinc-950/40 py-2 px-3 text-xs text-zinc-200 focus:border-indigo-500/85 focus:outline-none focus:ring-1 focus:ring-indigo-500/40 transition-all"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[9px] text-zinc-555 uppercase font-bold tracking-wider">Visual Concept Description</label>
                        <input
                          type="text"
                          value={item.concept}
                          onChange={(e) => updateOutlineItem(idx, 'concept', e.target.value)}
                          className="w-full rounded-xl border border-zinc-800 bg-zinc-950/40 py-2 px-3 text-xs text-zinc-200 focus:border-indigo-500/85 focus:outline-none focus:ring-1 focus:ring-indigo-500/40 transition-all"
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => deleteOutlineItem(idx)}
                      disabled={outline.length <= 1}
                      className="p-2 text-zinc-600 hover:text-red-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer shrink-0"
                      title="Delete Slide"
                    >
                      <Trash2 className="h-4.5 w-4.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex justify-between items-center pt-4 border-t border-zinc-800/60 relative z-10">
                <button
                  type="button"
                  onClick={() => setStep('setup')}
                  className="flex items-center space-x-2 px-5 py-2.5 bg-zinc-950/60 border border-zinc-800 hover:border-zinc-700 text-xs font-bold text-zinc-400 hover:text-zinc-300 rounded-xl transition-all cursor-pointer whitespace-nowrap"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Back to Setup</span>
                </button>

                <button
                  type="button"
                  onClick={handleGenerateSlides}
                  disabled={isGeneratingSlides}
                  className="flex items-center space-x-2 px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-xs font-bold text-white rounded-xl shadow-lg shadow-indigo-500/15 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isGeneratingSlides ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin text-white" />
                      <span>Drafting Slides Copy...</span>
                    </>
                  ) : (
                    <>
                      <span>Draft Slide Content</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* STEP 3: LIVE EDITOR */}
        {step === 'editor' && (
<motion.div
            key="editor-screen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid gap-8 lg:grid-cols-3 items-start"
          >
            {/* Customizer Settings - 1 Col */}
            <div className="bg-zinc-900/60 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 space-y-6 shadow-2xl relative overflow-hidden order-2 lg:order-1">
              {/* Background glow */}
              <div className="absolute -top-20 -left-20 h-40 w-40 rounded-full bg-indigo-500/5 blur-3xl pointer-events-none" />

              <div className="flex items-center justify-between pb-3 border-b border-zinc-800/60 relative z-10">
                <h3 className="font-extrabold text-zinc-200 flex items-center space-x-2 text-xs uppercase tracking-wider">
                  <Palette className="h-4 w-4 text-indigo-400 animate-pulse" />
                  <span>Design Panel</span>
                </h3>
                <button
                  type="button"
                  onClick={addEditorSlide}
                  className="text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors flex items-center space-x-1"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Slide</span>
                </button>
              </div>

              {/* Visual Tabs Navigator */}
              <div className="flex border-b border-zinc-800/60 pb-3 mb-4 space-x-1 z-10 relative overflow-x-auto scrollbar-none shrink-0">
                {[
                  { id: 'templates', label: 'Templates', icon: Sparkles },
                  { id: 'layouts', label: 'Layouts', icon: Layout },
                  { id: 'style', label: 'Style', icon: Sliders },
                  { id: 'branding', label: 'Branding', icon: User },
                  { id: 'themes', label: 'Themes', icon: Palette }
                ].map((tab) => {
                  const TabIcon = tab.icon;
                  const isActive = designTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setDesignTab(tab.id)}
                      className={`flex-1 min-w-[65px] sm:min-w-0 flex-shrink-0 flex flex-col items-center justify-center py-2 rounded-xl transition-all cursor-pointer ${
                        isActive 
                          ? 'bg-indigo-600/15 border border-indigo-500/30 text-indigo-400 font-extrabold shadow-sm' 
                          : 'text-zinc-500 border border-transparent hover:text-zinc-300'
                      }`}
                    >
                      <TabIcon className="h-4 w-4 mb-1" />
                      <span className="text-[9px] uppercase tracking-wider font-bold">{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Visual Layout settings */}
              <div className="space-y-4 text-left relative z-10">
                {designTab === 'templates' && (
                  <div className="space-y-4">
                    <label className="block text-[9px] text-zinc-500 uppercase font-bold tracking-wider">Select Deck Template</label>
                    <div className="grid grid-cols-1 gap-2.5 max-h-[320px] overflow-y-auto pr-1">
                      {templates.map((tpl) => {
                        const isSelected = selectedTemplateName === tpl.name;
                        return (
                          <button
                            key={tpl.name}
                            type="button"
                            onClick={() => handleApplyTemplate(tpl)}
                            className={`w-full flex flex-col p-3 rounded-2xl border text-left transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer shadow-sm group relative overflow-hidden ${
                              isSelected 
                                ? 'bg-indigo-600/10 border-indigo-500/80 shadow-[0_0_15px_rgba(99,102,241,0.15)]' 
                                : 'bg-zinc-950/40 border-zinc-800 hover:border-zinc-700'
                            }`}
                          >
                            <div className="flex items-center justify-between w-full">
                              <h4 className={`text-xs font-bold ${isSelected ? 'text-indigo-400' : 'text-zinc-200'}`}>{tpl.name}</h4>
                              <div className="flex space-x-1 shrink-0">
                                <span className="text-[7px] font-bold px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 capitalize">{tpl.swipeStyle}</span>
                                <span className="text-[7px] font-bold px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 capitalize">{tpl.bgPattern}</span>
                              </div>
                            </div>
                            <p className="text-[9px] text-zinc-500 mt-1 leading-relaxed">{tpl.description}</p>
                            
                            {/* Color bar preview of the template theme */}
                            <div className={`h-1.5 w-full rounded-full bg-gradient-to-r ${tpl.theme.class} mt-2.5 opacity-80`} />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {designTab === 'layouts' && (
                  <div className="space-y-4">
                    <label className="block text-[9px] text-zinc-500 uppercase font-bold tracking-wider">Select Slide Layout Preset</label>
                    <div className="grid grid-cols-1 gap-2.5">
                      {layoutOptions.map((opt) => {
                        const OptIcon = opt.icon;
                        const isSelected = (slides[activeSlideIndex]?.layout || 'standard') === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => updateActiveSlide('layout', opt.id)}
                            className={`w-full flex items-start p-3 rounded-2xl border text-left transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer shadow-sm group ${
                              isSelected 
                                ? 'bg-indigo-600/10 border-indigo-500/80 shadow-[0_0_15px_rgba(99,102,241,0.15)]' 
                                : 'bg-zinc-950/40 border-zinc-800 hover:border-zinc-700'
                            }`}
                          >
                            <div className={`p-2 rounded-xl mr-3 shrink-0 ${
                              isSelected ? 'bg-indigo-600/20 text-indigo-400' : 'bg-zinc-900 border border-zinc-800 text-zinc-500 group-hover:text-zinc-350'
                            }`}>
                              <OptIcon className="h-4 w-4" />
                            </div>
                            <div>
                              <h4 className={`text-xs font-bold ${isSelected ? 'text-indigo-400' : 'text-zinc-200'}`}>{opt.name}</h4>
                              <p className="text-[10px] text-zinc-550 mt-0.5 leading-relaxed">{opt.desc}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {designTab === 'style' && (
                  <div className="space-y-5 animate-fadeIn">
                    <div className="grid grid-cols-2 gap-3.5">
                      <div className="space-y-1.5">
                        <label className="block text-[9px] text-zinc-500 uppercase font-bold tracking-wider">Typography</label>
                        <select
                          value={fontFamily}
                          onChange={(e) => setFontFamily(e.target.value)}
                          className="w-full rounded-xl border border-zinc-800 bg-zinc-950/40 py-2.5 px-3 text-xs text-zinc-200 focus:border-indigo-500/80 focus:outline-none focus:ring-1 focus:ring-indigo-500/40 transition-all shadow-inner"
                        >
                          {fonts.map((f) => (
                            <option key={f.name} value={f.value}>{f.name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-[9px] text-zinc-500 uppercase font-bold tracking-wider">Alignment</label>
                        <div className="flex space-x-1.5 bg-zinc-950/40 p-1 rounded-xl border border-zinc-800 shadow-inner h-[38px] items-center">
                          {[
                            { value: 'left', icon: AlignLeft },
                            { value: 'center', icon: AlignCenter },
                            { value: 'right', icon: AlignRight }
                          ].map((align) => {
                            const Icon = align.icon;
                            const isBtnActive = textAlign === align.value;
                            return (
                              <button
                                key={align.value}
                                type="button"
                                onClick={() => setTextAlign(align.value)}
                                className={`flex-1 flex justify-center py-1 rounded-lg transition-all cursor-pointer ${
                                  isBtnActive 
                                    ? 'bg-indigo-600/15 border border-indigo-500/30 text-indigo-400 shadow-sm' 
                                    : 'text-zinc-550 hover:text-zinc-300'
                                }`}
                              >
                                <Icon className="h-3.5 w-3.5" />
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4 pt-1">
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-[9px] text-zinc-500 uppercase font-bold tracking-wider">
                          <span>Title Font Size</span>
                          <span className="text-indigo-400 font-mono">{titleSize.toFixed(1)}x</span>
                        </div>
                        <input
                          type="range"
                          min="1.0"
                          max="3.0"
                          step="0.1"
                          value={titleSize}
                          onChange={(e) => setTitleSize(parseFloat(e.target.value))}
                          className="w-full accent-indigo-600 bg-zinc-950/40 h-1.5 rounded-lg border border-zinc-800 cursor-pointer"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-[9px] text-zinc-500 uppercase font-bold tracking-wider">
                          <span>Body Font Size</span>
                          <span className="text-indigo-400 font-mono">{bodySize.toFixed(1)}x</span>
                        </div>
                        <input
                          type="range"
                          min="0.6"
                          max="1.8"
                          step="0.1"
                          value={bodySize}
                          onChange={(e) => setBodySize(parseFloat(e.target.value))}
                          className="w-full accent-indigo-600 bg-zinc-950/40 h-1.5 rounded-lg border border-zinc-800 cursor-pointer"
                        />
                      </div>
                    </div>

                    <div className="border-t border-zinc-800/60 pt-4 space-y-4">
                      <div className="space-y-1.5">
                        <label className="block text-[9px] text-zinc-500 uppercase font-bold tracking-wider">Background Pattern</label>
                        <div className="grid grid-cols-4 gap-1.5">
                          {[
                            { id: 'none', label: 'None' },
                            { id: 'dots', label: 'Dots' },
                            { id: 'grid', label: 'Grid' },
                            { id: 'stripes', label: 'Stripes' }
                          ].map((pat) => (
                            <button
                              key={pat.id}
                              type="button"
                              onClick={() => setBgPattern(pat.id)}
                              className={`py-2 px-1 text-[10px] font-bold rounded-lg border cursor-pointer transition-all ${
                                bgPattern === pat.id 
                                  ? 'bg-indigo-600/15 border-indigo-500/50 text-indigo-400 shadow-sm' 
                                  : 'bg-zinc-950/40 border-zinc-800 text-zinc-500 hover:text-zinc-350'
                              }`}
                            >
                              {pat.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {bgPattern !== 'none' && (
                        <div className="space-y-1.5">
                          <div className="flex justify-between items-center text-[9px] text-zinc-500 uppercase font-bold tracking-wider">
                            <span>Pattern Opacity</span>
                            <span className="text-indigo-400 font-mono">{patternOpacity}%</span>
                          </div>
                          <input
                            type="range"
                            min="5"
                            max="50"
                            step="5"
                            value={patternOpacity}
                            onChange={(e) => setPatternOpacity(parseInt(e.target.value, 10))}
                            className="w-full accent-indigo-600 bg-zinc-950/40 h-1.5 rounded-lg border border-zinc-800 cursor-pointer"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {designTab === 'branding' && (
                  <div className="space-y-4 animate-fadeIn">
                    <div className="flex items-center justify-between p-3.5 bg-zinc-950/40 border border-zinc-800 rounded-2xl shadow-inner">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 rounded-xl">
                          <User className="h-4 w-4" />
                        </div>
                        <div className="text-left">
                          <h4 className="text-xs font-bold text-zinc-200">Show Profile Badge</h4>
                          <p className="text-[9px] text-zinc-550 leading-relaxed mt-0.5">Embed avatar and handle on slides.</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowProfile(!showProfile)}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          showProfile ? 'bg-indigo-600' : 'bg-zinc-850'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ease-in-out mt-0.5 ${
                            showProfile ? 'translate-x-4 ml-0.5' : 'translate-x-0 ml-0.5'
                          }`}
                        />
                      </button>
                    </div>

                    {showProfile && (
                      <div className="space-y-3 pt-1 border-b border-zinc-800/60 pb-4">
                        <div className="grid grid-cols-3 gap-2 text-left">
                          <div className="space-y-1">
                            <label className="block text-[8px] text-zinc-550 uppercase font-bold tracking-wider">Initials</label>
                            <input
                              type="text"
                              maxLength={3}
                              value={profileInitials}
                              onChange={(e) => setProfileInitials(e.target.value)}
                              className="w-full rounded-xl border border-zinc-800 bg-zinc-950/40 py-2 px-2.5 text-xs text-zinc-200 focus:border-indigo-500/80 focus:outline-none"
                            />
                          </div>
                          <div className="space-y-1 col-span-2">
                            <label className="block text-[8px] text-zinc-550 uppercase font-bold tracking-wider">Creator Name</label>
                            <input
                              type="text"
                              value={profileName}
                              onChange={(e) => setProfileName(e.target.value)}
                              className="w-full rounded-xl border border-zinc-800 bg-zinc-950/40 py-2 px-2.5 text-xs text-zinc-200 focus:border-indigo-500/80 focus:outline-none"
                            />
                          </div>
                        </div>

                        <div className="space-y-1 text-left">
                          <label className="block text-[8px] text-zinc-555 uppercase font-bold tracking-wider">Social Handle</label>
                          <input
                            type="text"
                            value={profileHandle}
                            onChange={(e) => setProfileHandle(e.target.value)}
                            className="w-full rounded-xl border border-zinc-800 bg-zinc-950/40 py-2 px-2.5 text-xs text-zinc-200 focus:border-indigo-500/80 focus:outline-none"
                          />
                        </div>
                      </div>
                    )}

                    <div className="space-y-1.5 text-left">
                      <label className="block text-[9px] text-zinc-500 uppercase font-bold tracking-wider">Watermark Website URL</label>
                      <input
                        type="text"
                        value={brandWatermark}
                        onChange={(e) => setBrandWatermark(e.target.value)}
                        className="w-full rounded-xl border border-zinc-800 bg-zinc-950/40 py-2.5 px-3 text-xs text-zinc-200 focus:border-indigo-500/80 focus:outline-none transition-all shadow-inner"
                      />
                    </div>

                    <div className="space-y-1.5 text-left">
                      <label className="block text-[9px] text-zinc-500 uppercase font-bold tracking-wider">Swipe Cue Style</label>
                      <select
                        value={swipeStyle}
                        onChange={(e) => setSwipeStyle(e.target.value)}
                        className="w-full rounded-xl border border-zinc-800 bg-zinc-950/40 py-2.5 px-3 text-xs text-zinc-200 focus:border-indigo-500/80 focus:outline-none transition-all shadow-inner"
                      >
                        <option value="text">Swipe Text ("Swipe Left →")</option>
                        <option value="arrows">Pagination Arrows ("← Page 1 of 5 →")</option>
                        <option value="dots">Modern Pagination Dots</option>
                        <option value="hand">Animated Action Cue</option>
                      </select>
                    </div>
                  </div>
                )}

                {designTab === 'themes' && (
                  <div className="space-y-4 text-left animate-fadeIn">
                    <label className="block text-[9px] text-zinc-500 uppercase font-bold tracking-wider">Select Deck Visual Preset</label>
                    <div className="grid grid-cols-2 gap-2">
                      {themes.map((t) => {
                        const isPresetSelected = selectedTheme.name === t.name && bgType === 'tailwind';
                        return (
                          <button
                            key={t.name}
                            type="button"
                            onClick={() => applyThemeToAll(t)}
                            className={`h-11 rounded-xl bg-gradient-to-tr ${t.class} border hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer relative overflow-hidden group shadow-sm flex items-center justify-center ${
                              isPresetSelected 
                                ? 'border-indigo-500 ring-2 ring-indigo-500/30' 
                                : 'border-white/10'
                            }`}
                            title={t.name}
                          >
                            {isPresetSelected && (
                              <div className="h-4.5 w-4.5 rounded-full bg-white text-zinc-950 flex items-center justify-center shadow shadow-zinc-950/20">
                                <Check className="h-2.5 w-2.5 stroke-[3]" />
                              </div>
                            )}
                            <span className="absolute bottom-1 right-2 text-[7px] font-bold opacity-30 group-hover:opacity-75 uppercase tracking-wider transition-opacity select-none">{t.name}</span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="space-y-3.5 pt-4 border-t border-zinc-800/60">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-zinc-205 uppercase tracking-wider flex items-center space-x-1.5">
                          <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                          <span>AI Smart Theme</span>
                        </h4>
                        <button
                          type="button"
                          onClick={handleGenerateAITheme}
                          disabled={isGeneratingTheme}
                          className="px-3 py-1.5 bg-indigo-600/10 border border-indigo-500/20 hover:bg-indigo-650/25 text-[10px] font-bold text-indigo-400 rounded-lg hover:text-white transition-all cursor-pointer flex items-center space-x-1"
                        >
                          {isGeneratingTheme ? (
                            <RefreshCw className="h-3 w-3 animate-spin text-indigo-400" />
                          ) : (
                            <Sparkles className="h-3 w-3" />
                          )}
                          <span>{isGeneratingTheme ? 'Generating...' : 'Magic Generate'}</span>
                        </button>
                      </div>
                      <p className="text-[9px] text-zinc-550 leading-relaxed">
                        Let AI brainstorm a custom high-contrast color palette matching your topic: <span className="text-indigo-400 italic">"{topic || 'untitled'}"</span>.
                      </p>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-zinc-800/60">
                      <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center space-x-1.5">
                        <Palette className="h-3.5 w-3.5 text-indigo-400" />
                        <span>Custom Theme Builder</span>
                      </h4>

                      {/* Background Type Selector */}
                      <div className="space-y-1.5">
                        <label className="block text-[9px] text-zinc-550 uppercase font-bold tracking-wider">Background Type</label>
                        <div className="grid grid-cols-2 gap-2 bg-zinc-950/40 p-1 rounded-xl border border-zinc-800">
                          <button
                            type="button"
                            onClick={() => handleBgTypeChange('solid')}
                            className={`py-1.5 text-[10px] font-bold rounded-lg cursor-pointer transition-all ${
                              bgType === 'solid'
                                ? 'bg-indigo-600/15 border border-indigo-500/30 text-indigo-400 shadow-sm'
                                : 'text-zinc-500 hover:text-zinc-350'
                            }`}
                          >
                            Solid
                          </button>
                          <button
                            type="button"
                            onClick={() => handleBgTypeChange('gradient')}
                            className={`py-1.5 text-[10px] font-bold rounded-lg cursor-pointer transition-all ${
                              bgType === 'gradient'
                                ? 'bg-indigo-600/15 border border-indigo-500/30 text-indigo-400 shadow-sm'
                                : 'text-zinc-500 hover:text-zinc-350'
                            }`}
                          >
                            Gradient
                          </button>
                        </div>
                      </div>

                      {/* Solid background color picker */}
                      {bgType === 'solid' && (
                        <div className="space-y-1.5">
                          <label className="block text-[9px] text-zinc-550 uppercase font-bold tracking-wider">Background Color</label>
                          <div className="flex items-center space-x-2">
                            <input
                              type="color"
                              value={bgSolidColor}
                              onChange={(e) => handleBgSolidColorChange(e.target.value)}
                              className="w-10 h-10 rounded-xl border border-zinc-800 bg-transparent cursor-pointer overflow-hidden p-0"
                            />
                            <input
                              type="text"
                              value={bgSolidColor}
                              onChange={(e) => handleBgSolidColorChange(e.target.value)}
                              className="flex-1 rounded-xl border border-zinc-800 bg-zinc-950/40 py-2 px-3 text-xs text-zinc-200 focus:border-indigo-500/80 focus:outline-none font-mono"
                            />
                          </div>
                        </div>
                      )}

                      {/* Gradient background color pickers */}
                      {bgType === 'gradient' && (
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <label className="block text-[8px] text-zinc-550 uppercase font-bold tracking-wider">Start Color</label>
                              <div className="flex items-center space-x-1.5">
                                <input
                                  type="color"
                                  value={bgGradientStart}
                                  onChange={(e) => handleBgGradientStartChange(e.target.value)}
                                  className="w-8 h-8 rounded-lg border border-zinc-800 bg-transparent cursor-pointer overflow-hidden p-0"
                                />
                                <input
                                  type="text"
                                  value={bgGradientStart}
                                  onChange={(e) => handleBgGradientStartChange(e.target.value)}
                                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950/40 py-1.5 px-2 text-[10px] text-zinc-200 focus:border-indigo-500/80 focus:outline-none font-mono"
                                />
                              </div>
                            </div>

                            <div className="space-y-1">
                              <label className="block text-[8px] text-zinc-550 uppercase font-bold tracking-wider">End Color</label>
                              <div className="flex items-center space-x-1.5">
                                <input
                                  type="color"
                                  value={bgGradientTo}
                                  onChange={(e) => handleBgGradientToChange(e.target.value)}
                                  className="w-8 h-8 rounded-lg border border-zinc-800 bg-transparent cursor-pointer overflow-hidden p-0"
                                />
                                <input
                                  type="text"
                                  value={bgGradientTo}
                                  onChange={(e) => handleBgGradientToChange(e.target.value)}
                                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950/40 py-1.5 px-2 text-[10px] text-zinc-200 focus:border-indigo-500/80 focus:outline-none font-mono"
                                />
                              </div>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <div className="flex justify-between items-center">
                              <label className="block text-[8px] text-zinc-550 uppercase font-bold tracking-wider">Middle Color (Optional)</label>
                              {bgGradientVia && (
                                <button
                                  type="button"
                                  onClick={() => handleBgGradientViaChange('')}
                                  className="text-[8px] text-red-400 hover:text-red-300 font-bold uppercase tracking-wider transition-colors"
                                >
                                  Clear
                                </button>
                              )}
                            </div>
                            <div className="flex items-center space-x-1.5">
                              <input
                                  type="color"
                                  value={bgGradientVia || '#000000'}
                                  onChange={(e) => handleBgGradientViaChange(e.target.value)}
                                  className="w-8 h-8 rounded-lg border border-zinc-800 bg-transparent cursor-pointer overflow-hidden p-0"
                              />
                              <input
                                type="text"
                                placeholder="No middle color"
                                value={bgGradientVia}
                                onChange={(e) => handleBgGradientViaChange(e.target.value)}
                                className="flex-1 rounded-lg border border-zinc-800 bg-zinc-950/40 py-1.5 px-2 text-[10px] text-zinc-200 focus:border-indigo-500/80 focus:outline-none font-mono"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Custom text colors */}
                      <div className="grid grid-cols-2 gap-2.5 pt-1">
                        <div className="space-y-1">
                          <label className="block text-[8px] text-zinc-550 uppercase font-bold tracking-wider">Title Color</label>
                          <div className="flex items-center space-x-1.5">
                            <input
                              type="color"
                              value={titleColor}
                              onChange={(e) => handleTitleColorChange(e.target.value)}
                              className="w-8 h-8 rounded-lg border border-zinc-800 bg-transparent cursor-pointer overflow-hidden p-0"
                            />
                            <input
                              type="text"
                              value={titleColor}
                              onChange={(e) => handleTitleColorChange(e.target.value)}
                              className="w-full rounded-lg border border-zinc-800 bg-zinc-950/40 py-1.5 px-2 text-[10px] text-zinc-200 focus:border-indigo-500/80 focus:outline-none font-mono"
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="block text-[8px] text-zinc-550 uppercase font-bold tracking-wider">Body Color</label>
                          <div className="flex items-center space-x-1.5">
                            <input
                              type="color"
                              value={bodyColor}
                              onChange={(e) => handleBodyColorChange(e.target.value)}
                              className="w-8 h-8 rounded-lg border border-zinc-800 bg-transparent cursor-pointer overflow-hidden p-0"
                            />
                            <input
                              type="text"
                              value={bodyColor}
                              onChange={(e) => handleBodyColorChange(e.target.value)}
                              className="w-full rounded-lg border border-zinc-800 bg-zinc-950/40 py-1.5 px-2 text-[10px] text-zinc-200 focus:border-indigo-500/80 focus:outline-none font-mono"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Active Slide customizer (always visible below tabs) */}
                {slides.length > 0 && slides[activeSlideIndex] && (
                  <div className="border-t border-zinc-800/60 pt-4 space-y-4">
                    <div className="space-y-1.5 text-left">
                      <label className="block text-[9px] text-zinc-500 uppercase font-bold tracking-wider flex items-center space-x-1">
                        <Type className="h-3.5 w-3.5 text-indigo-400" />
                        <span>Active Slide Title</span>
                      </label>
                      <input
                        type="text"
                        value={slides[activeSlideIndex].title}
                        onChange={(e) => updateActiveSlide('title', e.target.value)}
                        className="w-full rounded-xl border border-zinc-805 bg-zinc-950/40 py-2.5 px-3.5 text-xs text-zinc-200 focus:border-indigo-500/80 focus:outline-none focus:ring-1 focus:ring-indigo-500/40 transition-all shadow-inner"
                      />
                    </div>

                    <div className="space-y-1.5 text-left">
                      <label className="block text-[9px] text-zinc-500 uppercase font-bold tracking-wider flex items-center space-x-1">
                        <Layout className="h-3.5 w-3.5 text-indigo-400" />
                        <span>Slide Content Body</span>
                      </label>
                      <textarea
                        rows={4}
                        value={slides[activeSlideIndex].body}
                        onChange={(e) => updateActiveSlide('body', e.target.value)}
                        className="w-full rounded-xl border border-zinc-800 bg-zinc-950/40 p-3 text-xs text-zinc-200 focus:border-indigo-500/80 focus:outline-none focus:ring-1 focus:ring-indigo-500/40 transition-all shadow-inner resize-none leading-relaxed"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Deck Action buttons */}
              <div className="border-t border-zinc-800/60 pt-4 grid grid-cols-2 sm:flex lg:grid lg:grid-cols-2 gap-2 relative z-10">
                <button
                  type="button"
                  onClick={() => setStep('outline')}
                  className="flex justify-center items-center space-x-1.5 px-2.5 py-2.5 bg-zinc-950/60 border border-zinc-800 hover:border-zinc-700 text-xs font-bold text-zinc-400 hover:text-zinc-300 rounded-xl transition-all cursor-pointer whitespace-nowrap sm:flex-1"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Outline</span>
                </button>

                <button
                  type="button"
                  onClick={() => deleteEditorSlide(activeSlideIndex)}
                  disabled={slides.length <= 1}
                  className="flex justify-center items-center space-x-1.5 px-2.5 py-2.5 text-zinc-500 hover:text-red-400 border border-zinc-800 bg-zinc-950/60 rounded-xl hover:border-zinc-700 transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer sm:px-3.5 shrink-0"
                  title="Delete Active Slide"
                >
                  <Trash2 className="h-4.5 w-4.5" />
                  <span className="inline sm:hidden lg:inline">Delete</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportPDF}
                  disabled={isGeneratingPDF}
                  className="flex justify-center items-center space-x-1.5 px-2.5 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-xs font-bold text-white rounded-xl shadow-md shadow-indigo-500/10 transition-all cursor-pointer disabled:opacity-50 whitespace-nowrap sm:flex-1"
                >
                  {isGeneratingPDF ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin text-white mr-1" />
                      <span>Compiling...</span>
                    </>
                  ) : (
                    <>
                      <Download className="h-3.5 w-3.5 mr-1" />
                      <span>PDF</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleOpenPublishModal}
                  className="flex justify-center items-center space-x-1.5 px-2.5 py-2.5 bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-450 hover:to-rose-450 text-xs font-bold text-white rounded-xl shadow-md shadow-rose-500/10 transition-all cursor-pointer whitespace-nowrap sm:flex-1"
                >
                  <Share2 className="h-3.5 w-3.5" />
                  <span>Publish</span>
                </button>
              </div>
            </div>

            {/* Live Preview Canvas - 2 Cols */}
            <div className="lg:col-span-2 flex flex-col justify-between space-y-6 order-1 lg:order-2">

              {/* Dynamic canvas wrapper based on selected platform aspect ratio */}
              <div className="flex-1 bg-zinc-950/50 backdrop-blur-md border border-zinc-800/80 rounded-3xl p-6 flex items-center justify-center min-h-[490px] relative overflow-hidden shadow-inner shadow-zinc-950/80">

                {/* Dynamic colorful ambient glow behind slide preview (shifts dynamically based on active slide) */}
                {slides.length > 0 && slides[activeSlideIndex] && (
                  <div 
                    className={`absolute h-72 w-72 rounded-full ${
                      slides[activeSlideIndex].bgType === 'solid' || slides[activeSlideIndex].bgType === 'gradient'
                        ? ''
                        : `bg-gradient-to-tr ${slides[activeSlideIndex].gradient}`
                    } opacity-[0.12] blur-[80px] pointer-events-none transition-all duration-700`}
                    style={{
                      background: slides[activeSlideIndex].bgType === 'solid'
                        ? slides[activeSlideIndex].bgSolidColor
                        : slides[activeSlideIndex].bgType === 'gradient'
                          ? `linear-gradient(135deg, ${slides[activeSlideIndex].bgGradientStart}, ${slides[activeSlideIndex].bgGradientVia ? slides[activeSlideIndex].bgGradientVia + ',' : ''} ${slides[activeSlideIndex].bgGradientTo})`
                          : undefined
                    }}
                  />
                )}

                {/* Platform Badge */}
                <div className="absolute top-4 left-4 flex items-center space-x-1.5 px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-lg text-[9px] font-bold text-zinc-400 uppercase tracking-widest select-none">
                  <Smartphone className="h-3 w-3 text-indigo-400" />
                  <span>{platform} preview</span>
                </div>

                <AnimatePresence mode="wait">
                  {slides.length > 0 && slides[activeSlideIndex] && (() => {
                    const activeSlide = slides[activeSlideIndex];
                    const isDarkText = getIsDarkText(activeSlide);
                    const activeLayout = activeSlide.layout || 'standard';

                    return (
                      <div className="relative p-2.5 rounded-[28px] border border-white/5 bg-zinc-950/50 backdrop-blur-xl shadow-2xl z-10 transition-transform duration-500 hover:scale-[1.01]">
                        {/* Bezel frame screen shine */}
                        <div className="absolute inset-0 rounded-[28px] border border-white/10 pointer-events-none z-30" />
                        
                        <motion.div
                          key={activeSlide.id}
                          initial={{ opacity: 0, scale: 0.97 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.97 }}
                          transition={{ duration: 0.2 }}
                          style={{ 
                            fontFamily: fontFamily,
                            background: activeSlide.bgType === 'solid'
                              ? activeSlide.bgSolidColor
                              : activeSlide.bgType === 'gradient'
                                ? `linear-gradient(135deg, ${activeSlide.bgGradientStart}, ${activeSlide.bgGradientVia ? activeSlide.bgGradientVia + ',' : ''} ${activeSlide.bgGradientTo})`
                                : undefined
                          }}
                          className={`w-full ${aspectClass} rounded-2xl ${
                            activeSlide.bgType === 'solid' || activeSlide.bgType === 'gradient'
                              ? ''
                              : `bg-gradient-to-tr ${activeSlide.gradient}`
                          } p-8 sm:p-10 flex flex-col justify-between shadow-2xl relative select-none overflow-hidden ${activeSlide.textClass}`}
                        >
                          {/* Ambient light glow overlay */}
                          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent pointer-events-none z-10" />
                          
                          {/* Background Pattern Texture */}
                          <div 
                            className="absolute inset-0 pointer-events-none z-10" 
                            style={getPatternStyle(bgPattern, patternOpacity, activeSlide.textColor)} 
                          />

                          {/* Header Branding Row */}
                          <div className="flex justify-between items-center relative z-20 text-[10px] sm:text-xs font-bold tracking-wide">
                            {showProfile ? (
                              <div className="flex items-center space-x-2">
                                <div className={`h-7 w-7 rounded-full flex items-center justify-center text-[9px] font-black border shadow-inner ${
                                  isDarkText ? 'bg-zinc-900/10 border-zinc-900/20 text-zinc-900' : 'bg-white/10 border-white/10 text-white'
                                }`}>
                                  {profileInitials || 'TF'}
                                </div>
                                <div className="text-left">
                                  <div className={`text-[9px] font-bold leading-none ${isDarkText ? 'text-zinc-800' : 'text-white'}`}>{profileName}</div>
                                  <div className={`text-[7px] font-semibold leading-none mt-0.5 ${isDarkText ? 'text-zinc-500' : 'text-white/60'}`}>{profileHandle}</div>
                                </div>
                              </div>
                            ) : (
                              <div />
                            )}
                            
                            {brandWatermark && (
                              <span className={`text-[9px] font-bold tracking-widest uppercase opacity-60 ${isDarkText ? 'text-zinc-800' : 'text-white'}`}>
                                {brandWatermark}
                              </span>
                            )}
                          </div>

                          {/* Slide Content layouts */}
                          <div className="relative z-20 flex-1 flex flex-col justify-center py-4">
                            {activeLayout === 'standard' && (
                              <div className="space-y-3 flex flex-col justify-center">
                                <h2 
                                  className="font-extrabold leading-tight text-left"
                                  style={{ 
                                    textAlign: textAlign,
                                    fontSize: `${titleSize * 0.75}rem`,
                                    color: activeSlide.titleColor || activeSlide.textColor
                                  }}
                                >
                                  {activeSlide.title}
                                </h2>
                                {activeSlide.body && (
                                  <p 
                                    className="leading-relaxed opacity-85 text-left font-medium"
                                    style={{ 
                                      textAlign: textAlign,
                                      fontSize: `${bodySize * 0.75}rem`,
                                      color: activeSlide.bodyColor || activeSlide.textColor
                                    }}
                                  >
                                    {activeSlide.body}
                                  </p>
                                )}
                              </div>
                            )}

                            {activeLayout === 'peek' && (
                              <div className="flex flex-col justify-center items-center text-center py-6">
                                <h2 
                                  className="font-black leading-tight tracking-tight max-w-[95%]"
                                  style={{ 
                                    fontSize: `${titleSize * 1.1}rem`,
                                    textAlign: 'center',
                                    color: activeSlide.titleColor || activeSlide.textColor
                                  }}
                                >
                                  {activeSlide.title}
                                </h2>
                              </div>
                            )}

                            {activeLayout === 'split' && (
                              <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 items-center border-l-2 pl-3.5 md:pl-0 md:border-l-0 ${isDarkText ? 'border-zinc-900/10' : 'border-white/20'}`}>
                                <h2 
                                  className="font-extrabold leading-tight text-left"
                                  style={{ 
                                    fontSize: `${titleSize * 0.8}rem`,
                                    color: activeSlide.titleColor || activeSlide.textColor
                                  }}
                                >
                                  {activeSlide.title}
                                </h2>
                                <div className={`border-t pt-3 md:border-t-0 md:border-l md:pt-0 md:pl-4 ${isDarkText ? 'border-zinc-900/10' : 'border-white/10'}`}>
                                  {activeSlide.body && (
                                    <p 
                                      className="leading-relaxed opacity-85 text-left text-xs font-medium"
                                      style={{ 
                                        fontSize: `${bodySize * 0.7}rem`,
                                        color: activeSlide.bodyColor || activeSlide.textColor
                                      }}
                                    >
                                      {activeSlide.body}
                                    </p>
                                  )}
                                </div>
                              </div>
                            )}

                            {activeLayout === 'quote' && (
                              <div className="flex flex-col justify-center items-center px-2">
                                <div className={`w-full p-4 sm:p-5 rounded-2xl border backdrop-blur-md relative ${
                                  isDarkText 
                                    ? 'bg-zinc-900/5 border-zinc-900/10 shadow-sm' 
                                    : 'bg-white/5 border-white/10 shadow-lg'
                                }`}>
                                  <Quote className={`absolute -top-3.5 -left-1.5 h-6 w-6 opacity-25 ${isDarkText ? 'text-zinc-900' : 'text-white'}`} />
                                  <p 
                                    className="italic font-bold leading-normal text-center mb-3"
                                    style={{ 
                                      fontSize: `${titleSize * 0.7}rem`,
                                      color: activeSlide.titleColor || activeSlide.textColor
                                    }}
                                  >
                                    "{activeSlide.title}"
                                  </p>
                                  {activeSlide.body && (
                                    <div className={`flex items-center justify-center border-t pt-2.5 mt-2.5 ${isDarkText ? 'border-zinc-900/10' : 'border-white/10'}`}>
                                      <span 
                                        className="text-[9px] uppercase font-bold tracking-wider opacity-70"
                                        style={{ color: activeSlide.bodyColor || activeSlide.textColor }}
                                      >
                                        — {activeSlide.body}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {activeLayout === 'technical' && (
                              <div className="flex flex-col justify-center space-y-3 text-left">
                                <h2 
                                  className="font-extrabold leading-tight text-left"
                                  style={{ 
                                    fontSize: `${titleSize * 0.75}rem`,
                                    color: activeSlide.titleColor || activeSlide.textColor
                                  }}
                                >
                                  {activeSlide.title}
                                </h2>
                                <div className={`p-3.5 rounded-xl border font-mono text-[10px] sm:text-xs leading-relaxed overflow-x-auto shadow-inner text-left ${
                                  isDarkText 
                                    ? 'bg-zinc-100 border-zinc-200 text-zinc-800' 
                                    : 'bg-zinc-950/60 border-zinc-800 text-indigo-300'
                                }`}>
                                  <div className="flex items-center space-x-1 pb-1.5 mb-1.5 border-b border-white/5 font-sans text-[8px] font-bold opacity-60">
                                    <div className="h-1.5 w-1.5 rounded-full bg-red-500" />
                                    <div className="h-1.5 w-1.5 rounded-full bg-yellow-500" />
                                    <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                                    <span className="pl-1 uppercase tracking-wider">Console Output</span>
                                  </div>
                                  <pre className="whitespace-pre-wrap">{activeSlide.body}</pre>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Swipe instructions footer */}
                          <div className="relative z-20 flex items-center justify-between">
                            {renderFooterPagination(activeSlideIndex, slides.length, isDarkText)}
                          </div>
                        </motion.div>
                      </div>
                    );
                  })()}
                </AnimatePresence>

                {/* Canvas Navigation Arrows */}
                <button
                  type="button"
                  onClick={() => setActiveSlideIndex(Math.max(0, activeSlideIndex - 1))}
                  disabled={activeSlideIndex === 0}
                  className="absolute left-4 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full border border-white/5 bg-zinc-950/60 backdrop-blur-md hover:bg-zinc-900/85 text-zinc-400 hover:text-white flex items-center justify-center disabled:opacity-20 disabled:cursor-not-allowed transition-all cursor-pointer shadow-lg hover:border-indigo-500/50 hover:scale-105 active:scale-95 z-20"
                >
                  <ArrowLeft className="h-4.5 w-4.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSlideIndex(Math.min(slides.length - 1, activeSlideIndex + 1))}
                  disabled={activeSlideIndex === slides.length - 1}
                  className="absolute right-4 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full border border-white/5 bg-zinc-950/60 backdrop-blur-md hover:bg-zinc-900/85 text-zinc-400 hover:text-white flex items-center justify-center disabled:opacity-20 disabled:cursor-not-allowed transition-all cursor-pointer shadow-lg hover:border-indigo-500/50 hover:scale-105 active:scale-95 z-20"
                >
                  <ArrowRight className="h-4.5 w-4.5" />
                </button>
              </div>

              {/* Bottom slide thumbnail timeline selector */}
              <div className="flex items-center space-x-3 overflow-x-auto py-3.5 px-3 bg-zinc-950/30 border border-zinc-900/40 rounded-2xl scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
                {slides.map((s, idx) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setActiveSlideIndex(idx)}
                    className={`flex-shrink-0 w-24 aspect-square rounded-xl ${
                      s.bgType === 'solid' || s.bgType === 'gradient'
                        ? ''
                        : `bg-gradient-to-tr ${s.gradient}`
                    } p-3 text-left border flex flex-col justify-between hover:scale-[1.03] active:scale-[0.97] transition-all cursor-pointer relative overflow-hidden select-none ${activeSlideIndex === idx
                        ? 'border-indigo-500 ring-2 ring-indigo-500/30 scale-[1.03] shadow-lg shadow-indigo-500/10'
                        : 'border-zinc-800/85 hover:border-zinc-700/60'
                      }`}
                    style={{
                      background: s.bgType === 'solid' 
                        ? s.bgSolidColor 
                        : s.bgType === 'gradient'
                          ? `linear-gradient(135deg, ${s.bgGradientStart}, ${s.bgGradientVia ? s.bgGradientVia + ',' : ''} ${s.bgGradientTo})`
                          : undefined
                    }}
                  >
                    {/* Tiny visual text layout mockup representation inside thumbnail */}
                    <div className="absolute inset-0 bg-black/10 opacity-30 pointer-events-none" />
                    <span className="text-[9px] font-bold opacity-60 relative z-10 block tracking-wider uppercase" style={{ color: s.bodyColor || s.textColor }}>Slide {idx + 1}</span>
                    <span className="text-[10px] font-extrabold truncate w-full relative z-10 block mt-auto leading-tight" style={{ color: s.titleColor || s.textColor }}>{s.title || 'Untitled'}</span>
                  </button>
                ))}

                <button
                  type="button"
                  onClick={addEditorSlide}
                  className="flex-shrink-0 w-24 aspect-square rounded-xl bg-zinc-900/10 border border-dashed border-zinc-800 hover:border-indigo-500/50 hover:bg-indigo-950/5 hover:text-indigo-400 flex flex-col items-center justify-center text-zinc-500 transition-all cursor-pointer select-none active:scale-95 shadow-sm"
                >
                  <Plus className="h-5.5 w-5.5 mb-1 text-zinc-550 group-hover:text-indigo-400 animate-pulse" />
                  <span className="text-[9px] font-bold uppercase tracking-wider">Add Slide</span>
                </button>
              </div>
            </div>

            {/* HIDDEN ELEMENT CONTAINER FOR FULL-SCALE HIGH-RESOLUTION PDF COMPILATION */}
            <div style={{ position: 'fixed', top: 0, left: 0, width: '0px', height: '0px', overflow: 'hidden', zIndex: -9999, pointerEvents: 'none' }}>
              {slides.map((slide, idx) => {
                const isDarkText = getIsDarkText(slide);
                const slideLayout = slide.layout || 'standard';
                return (
                  <div
                    key={slide.id}
                    id={`carousel-slide-full-${idx}`}
                    className={
                      slide.bgType === 'solid' || slide.bgType === 'gradient'
                        ? ''
                        : `bg-gradient-to-tr ${slide.gradient}`
                    }
                    style={{
                      width: `${width}px`,
                      height: `${height}px`,
                      fontFamily: fontFamily,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      padding: '80px',
                      position: 'relative',
                      boxSizing: 'border-box',
                      overflow: 'hidden',
                      color: slide.textColor,
                      background: slide.bgType === 'solid'
                        ? slide.bgSolidColor
                        : slide.bgType === 'gradient'
                          ? `linear-gradient(135deg, ${slide.bgGradientStart}, ${slide.bgGradientVia ? slide.bgGradientVia + ',' : ''} ${slide.bgGradientTo})`
                          : undefined
                    }}
                  >
                    {/* Ambient light glow overlay */}
                    <div style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'radial-gradient(ellipse at top, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0) 80%)',
                      pointerEvents: 'none',
                      zIndex: 1
                    }} />

                    {/* Background Pattern Texture */}
                    <div 
                      style={{
                        position: 'absolute',
                        inset: 0,
                        pointerEvents: 'none',
                        zIndex: 1,
                        ...getPatternStyle(bgPattern, patternOpacity, slide.textColor)
                      }} 
                    />

                    {/* Header Branding Row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 2 }}>
                      {showProfile ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                          <div style={{
                            width: '44px',
                            height: '44px',
                            borderRadius: '50%',
                            border: isDarkText ? '1.5px solid rgba(24, 24, 27, 0.2)' : '1.5px solid rgba(255, 255, 255, 0.15)',
                            background: isDarkText ? 'rgba(24, 24, 27, 0.06)' : 'rgba(255, 255, 255, 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '14px',
                            fontWeight: 'bold',
                            color: slide.textColor
                          }}>
                            {profileInitials || 'TF'}
                          </div>
                          <div style={{ textAlign: 'left' }}>
                            <div style={{ fontSize: '15px', fontWeight: 'bold', lineHeight: '1.2', color: slide.textColor }}>{profileName}</div>
                            <div style={{ fontSize: '11px', fontWeight: '600', opacity: 0.6, marginTop: '2px', color: slide.textColor }}>{profileHandle}</div>
                          </div>
                        </div>
                      ) : (
                        <div />
                      )}
                      
                      {brandWatermark && (
                        <span style={{ fontSize: '14px', fontWeight: 'bold', letterSpacing: '2px', opacity: 0.6, textTransform: 'uppercase' }}>
                          {brandWatermark}
                        </span>
                      )}
                    </div>

                    {/* Slide Content layouts */}
                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', flex: 1, position: 'relative', zIndex: 2, padding: '40px 0' }}>
                      {slideLayout === 'standard' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                          <h2 style={{ fontSize: `${width * 0.02 * titleSize}px`, fontWeight: '800', lineHeight: 1.15, textAlign: textAlign, margin: 0, color: slide.titleColor || slide.textColor }}>
                            {slide.title}
                          </h2>
                          {slide.body && (
                            <p style={{ fontSize: `${width * 0.01 * bodySize}px`, lineHeight: 1.6, opacity: 0.85, textAlign: textAlign, fontWeight: '500', margin: 0, color: slide.bodyColor || slide.textColor }}>
                              {slide.body}
                            </p>
                          )}
                        </div>
                      )}

                      {slideLayout === 'peek' && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                          <h2 style={{ fontSize: `${width * 0.028 * titleSize}px`, fontWeight: '900', lineHeight: 1.15, textAlign: 'center', margin: 0, maxWidth: '90%', color: slide.titleColor || slide.textColor }}>
                            {slide.title}
                          </h2>
                        </div>
                      )}

                      {slideLayout === 'split' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '50px', borderLeft: isDarkText ? '4px solid rgba(24, 24, 27, 0.1)' : '4px solid rgba(255, 255, 255, 0.15)', paddingLeft: '40px' }}>
                          <h2 style={{ fontSize: `${width * 0.022 * titleSize}px`, fontWeight: '800', lineHeight: 1.15, textAlign: 'left', margin: 0, color: slide.titleColor || slide.textColor }}>
                            {slide.title}
                          </h2>
                          <div style={{ borderLeft: isDarkText ? '2px solid rgba(24, 24, 27, 0.08)' : '2px solid rgba(255, 255, 255, 0.1)', paddingLeft: '35px' }}>
                            {slide.body && (
                              <p style={{ fontSize: `${width * 0.01 * bodySize}px`, lineHeight: 1.6, opacity: 0.85, textAlign: 'left', fontWeight: '500', margin: 0, color: slide.bodyColor || slide.textColor }}>
                                {slide.body}
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {slideLayout === 'quote' && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                          <div style={{
                            width: '100%',
                            padding: '60px 70px',
                            borderRadius: '32px',
                            border: isDarkText ? '1.5px solid rgba(24, 24, 27, 0.1)' : '1.5px solid rgba(255, 255, 255, 0.15)',
                            background: isDarkText ? 'rgba(24, 24, 27, 0.04)' : 'rgba(255, 255, 255, 0.05)',
                            boxSizing: 'border-box',
                            textAlign: 'center',
                            position: 'relative'
                          }}>
                            <p style={{ fontSize: `${width * 0.018 * titleSize}px`, fontWeight: 'bold', fontStyle: 'italic', margin: '0 0 25px 0', lineHeight: '1.4', color: slide.titleColor || slide.textColor }}>
                              "{slide.title}"
                            </p>
                            {slide.body && (
                              <div style={{ borderTop: isDarkText ? '1.5px solid rgba(24, 24, 27, 0.08)' : '1.5px solid rgba(255, 255, 255, 0.1)', paddingTop: '20px', marginTop: '20px' }}>
                                <span style={{ fontSize: '18px', fontWeight: 'bold', opacity: 0.7, letterSpacing: '1px', color: slide.bodyColor || slide.textColor }}>
                                  — {slide.body}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {slideLayout === 'technical' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '25px', textAlign: 'left' }}>
                          <h2 style={{ fontSize: `${width * 0.02 * titleSize}px`, fontWeight: '800', lineHeight: 1.15, margin: 0, color: slide.titleColor || slide.textColor }}>
                            {slide.title}
                          </h2>
                          <div style={{
                            padding: '35px',
                            borderRadius: '24px',
                            border: isDarkText ? '1px solid rgba(24, 24, 27, 0.12)' : '1px solid rgba(255, 255, 255, 0.1)',
                            background: isDarkText ? 'rgba(24, 24, 27, 0.04)' : 'rgba(0, 0, 0, 0.45)',
                            fontFamily: 'Courier New, monospace',
                            fontSize: '18px',
                            lineHeight: '1.5',
                            boxSizing: 'border-box'
                          }}>
                            <div style={{ display: 'flex', gap: '8px', paddingBottom: '15px', marginBottom: '15px', borderBottom: '1.5px solid rgba(255, 255, 255, 0.06)', fontFamily: 'system-ui' }}>
                              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444' }} />
                              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#eab308' }} />
                              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#22c55e' }} />
                            </div>
                            <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{slide.body}</pre>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Footer pagination */}
                    <div style={{ width: '100%', position: 'relative', zIndex: 2 }}>
                      {renderFooterPaginationHighRes(idx, slides.length, isDarkText)}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Social Publishing Modal */}
      <AnimatePresence>
        {isPublishModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-md"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl relative overflow-y-auto max-h-[90vh] space-y-6 text-left animate-scaleUp scrollbar-thin"
            >
              {/* Decorative glows */}
              <div className="absolute -top-20 -right-20 h-40 w-40 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
              <div className="absolute -bottom-20 -left-20 h-40 w-40 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />

              {/* Modal Header */}
              <div className="flex items-center justify-between pb-4 border-b border-zinc-800/60">
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 bg-amber-500/15 border border-amber-500/20 text-amber-400 rounded-2xl">
                    <Share2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-zinc-100">Publish to Connected Accounts</h2>
                    <p className="text-xs text-zinc-500 mt-0.5">Push your carousel cover and post details directly to your feeds.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPublishModalOpen(false)}
                  className="p-2 text-zinc-400 hover:text-white transition-colors cursor-pointer rounded-xl hover:bg-zinc-805/50"
                >
                  <XCircle className="h-5 w-5" />
                </button>
              </div>

              {publishError && (
                <div className="flex items-center space-x-2.5 bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-2xl text-xs">
                  <AlertCircle className="h-4.5 w-4.5 shrink-0" />
                  <span>{publishError}</span>
                </div>
              )}

              {isLoadingAccounts ? (
                <div className="flex flex-col items-center justify-center py-10 space-y-3">
                  <RefreshCw className="h-8 w-8 text-indigo-500 animate-spin" />
                  <p className="text-xs text-zinc-500">Checking connected social channels...</p>
                </div>
              ) : connectedAccounts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
                  <Globe className="h-12 w-12 text-zinc-600 animate-pulse" />
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-zinc-300">No Connected Channels Found</h4>
                    <p className="text-xs text-zinc-500 max-w-sm">Connect your social accounts first (LinkedIn, Facebook, etc.) to publish directly from the studio.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsPublishModalOpen(false);
                      window.open('/social-accounts', '_blank');
                    }}
                    className="flex items-center space-x-1.5 px-4.5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white rounded-xl shadow transition-all cursor-pointer"
                  >
                    <span>Connect Social Channel</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                  {/* Left Column: Configs */}
                  <div className="space-y-4">
                    {/* Platform Selector */}
                    <div className="space-y-1.5 text-left">
                      <label className="block text-[10px] text-zinc-400 uppercase font-bold tracking-wider">Select Social Channel</label>
                      <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1">
                        {connectedAccounts.map((account) => {
                          const isSelected = selectedAccount?._id === account._id;
                          return (
                            <button
                              key={account._id}
                              type="button"
                              onClick={() => setSelectedAccount(account)}
                              className={`w-full flex items-center justify-between p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-indigo-600/10 border-indigo-500/80 shadow-[0_0_12px_rgba(99,102,241,0.15)]'
                                  : 'bg-zinc-950/40 border-zinc-800 hover:border-zinc-750'
                              }`}
                            >
                              <div className="flex items-center space-x-3">
                                {account.profilePicture ? (
                                  <img
                                    src={account.profilePicture}
                                    alt={account.platformUsername}
                                    className="h-8 w-8 rounded-lg object-cover"
                                  />
                                ) : (
                                  <div className="h-8 w-8 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
                                    <User className="h-4 w-4" />
                                  </div>
                                )}
                                <div>
                                  <h4 className="text-xs font-bold text-zinc-200 capitalize">{account.platform}</h4>
                                  <p className="text-[10px] text-zinc-550">{account.platformUsername}</p>
                                </div>
                              </div>
                              {isSelected && (
                                <div className="h-4.5 w-4.5 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow">
                                  <Check className="h-2.5 w-2.5 text-white" />
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Post Caption */}
                    <div className="space-y-1.5 text-left">
                      <label className="block text-[10px] text-zinc-400 uppercase font-bold tracking-wider">Post Caption</label>
                      <textarea
                        rows={5}
                        value={publishCaption}
                        onChange={(e) => setPublishCaption(e.target.value)}
                        placeholder="Share your thoughts on this carousel..."
                        className="w-full rounded-2xl border border-zinc-800 bg-zinc-950/40 p-3.5 text-xs text-zinc-200 focus:border-indigo-500/80 focus:outline-none focus:ring-1 focus:ring-indigo-500/40 resize-none leading-relaxed"
                      />
                    </div>

                    {/* Publish Option */}
                    <div className="space-y-2 text-left">
                      <label className="block text-[10px] text-zinc-400 uppercase font-bold tracking-wider">Publish Option</label>
                      <div className="grid grid-cols-2 gap-2 bg-zinc-950/40 p-1 rounded-xl border border-zinc-800 shadow-inner">
                        <button
                          type="button"
                          onClick={() => setPublishMode('now')}
                          className={`py-2 px-3 text-xs font-bold rounded-lg cursor-pointer transition-all ${
                            publishMode === 'now'
                              ? 'bg-indigo-600/15 border border-indigo-500/30 text-indigo-400 shadow-sm'
                              : 'bg-transparent border border-transparent text-zinc-550 hover:text-zinc-300'
                          }`}
                        >
                          Publish Now
                        </button>
                        <button
                          type="button"
                          onClick={() => setPublishMode('schedule')}
                          className={`py-2 px-3 text-xs font-bold rounded-lg cursor-pointer transition-all ${
                            publishMode === 'schedule'
                              ? 'bg-indigo-600/15 border border-indigo-500/30 text-indigo-400 shadow-sm'
                              : 'bg-transparent border border-transparent text-zinc-550 hover:text-zinc-300'
                          }`}
                        >
                          Schedule
                        </button>
                      </div>
                    </div>

                    {/* Schedule Date & Time */}
                    {publishMode === 'schedule' && (
                      <div className="grid grid-cols-2 gap-3 text-left animate-fadeIn">
                        <div className="space-y-1">
                          <label className="block text-[8px] text-zinc-500 uppercase font-bold tracking-wider">Publish Date</label>
                          <input
                            type="date"
                            value={scheduledDate}
                            onChange={(e) => setScheduledDate(e.target.value)}
                            className="w-full rounded-xl border border-zinc-800 bg-zinc-950/40 py-2 px-2.5 text-xs text-zinc-200 focus:border-indigo-500/80 focus:outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block text-[8px] text-zinc-500 uppercase font-bold tracking-wider">Publish Time</label>
                          <input
                            type="time"
                            value={scheduledTime}
                            onChange={(e) => setScheduledTime(e.target.value)}
                            className="w-full rounded-xl border border-zinc-800 bg-zinc-950/40 py-2 px-2.5 text-xs text-zinc-200 focus:border-indigo-500/80 focus:outline-none"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Visual Preview */}
                  <div className="space-y-4 flex flex-col items-center">
                    <label className="block text-[10px] text-zinc-400 uppercase font-bold tracking-wider self-start text-left">Cover Image Preview</label>
                    <div className="border border-zinc-800/85 rounded-2xl overflow-hidden aspect-[4/5] bg-zinc-950 flex items-center justify-center p-1 w-full max-w-[190px] shadow-lg relative">
                      {slides.length > 0 && slides[0] && (
                        <div 
                          className={`w-full h-full rounded-xl ${
                            slides[0].bgType === 'solid' || slides[0].bgType === 'gradient'
                              ? ''
                              : `bg-gradient-to-tr ${slides[0].gradient}`
                          } p-4 flex flex-col justify-between relative overflow-hidden select-none`}
                          style={{
                            background: slides[0].bgType === 'solid' 
                              ? slides[0].bgSolidColor 
                              : slides[0].bgType === 'gradient'
                                ? `linear-gradient(135deg, ${slides[0].bgGradientStart}, ${slides[0].bgGradientVia ? slides[0].bgGradientVia + ',' : ''} ${slides[0].bgGradientTo})`
                                : undefined,
                            color: slides[0].titleColor || slides[0].textColor
                          }}
                        >
                          <div className="absolute inset-0 bg-white/5 pointer-events-none" />
                          <div className="flex justify-between items-center text-[7px] font-bold" style={{ color: slides[0].titleColor || slides[0].textColor }}>
                            <span className="truncate max-w-[65px]">{profileName}</span>
                            <span className="truncate max-w-[65px]">{brandWatermark}</span>
                          </div>
                          <h4 className="text-[10px] font-black text-center line-clamp-3 leading-tight" style={{ fontFamily: fontFamily, color: slides[0].titleColor || slides[0].textColor }}>{slides[0].title}</h4>
                          <div className="text-[7px] text-center font-bold opacity-60" style={{ color: slides[0].bodyColor || slides[0].textColor }}>Swipe Left →</div>
                        </div>
                      )}
                    </div>
                    <p className="text-[9px] text-zinc-500 text-center leading-normal max-w-[180px]">Your cover slide will be rasterized and posted as the media attachment.</p>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              {!isLoadingAccounts && connectedAccounts.length > 0 && (
                <div className="flex justify-end space-x-3 pt-4 border-t border-zinc-800/60">
                  <button
                    type="button"
                    onClick={() => setIsPublishModalOpen(false)}
                    className="px-5 py-2.5 bg-zinc-950/60 border border-zinc-800 hover:border-zinc-700 text-xs font-bold text-zinc-405 rounded-xl transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handlePublishToSocial}
                    disabled={isPublishing || !selectedAccount}
                    className="flex items-center space-x-2 px-6 py-2.5 bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-450 hover:to-rose-450 text-xs font-bold text-white rounded-xl shadow-lg shadow-rose-500/15 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isPublishing ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 animate-spin text-white mr-1" />
                        <span>{publishMode === 'schedule' ? 'Scheduling...' : 'Publishing...'}</span>
                      </>
                    ) : (
                      <>
                        <Share2 className="h-3.5 w-3.5 mr-1" />
                        <span>{publishMode === 'schedule' ? 'Schedule Post' : 'Publish Now'}</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default CarouselBuilder;
