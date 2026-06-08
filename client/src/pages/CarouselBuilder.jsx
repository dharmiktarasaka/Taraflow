import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Layers, Plus, Trash2, ArrowLeft, ArrowRight, Palette, 
  Type, Layout, Sparkles, Download, Check, RefreshCw, 
  HelpCircle, AlignLeft, AlignCenter, AlignRight, FileText, 
  Smartphone, Monitor, ChevronRight
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import aiService from '../services/aiService';

const themes = [
  { name: 'Indigo Cyber', class: 'from-violet-600 via-indigo-700 to-indigo-900', textColor: '#ffffff', textClass: 'text-white' },
  { name: 'Sunset Glow', class: 'from-orange-500 via-rose-500 to-rose-600', textColor: '#ffffff', textClass: 'text-white' },
  { name: 'Midnight Emerald', class: 'from-emerald-500 via-teal-600 to-cyan-600', textColor: '#ffffff', textClass: 'text-white' },
  { name: 'Dark Void', class: 'from-zinc-900 via-zinc-950 to-black', textColor: '#ffffff', textClass: 'text-white border border-zinc-800/80' },
  { name: 'Soft Clean Light', class: 'from-zinc-50 via-zinc-100 to-zinc-200', textColor: '#18181b', textClass: 'text-zinc-900 border border-zinc-300' },
];

const fonts = [
  { name: 'Inter (Sans)', value: 'Inter, system-ui, sans-serif' },
  { name: 'Outfit (Modern)', value: 'Outfit, system-ui, sans-serif' },
  { name: 'Playfair (Serif)', value: 'Playfair Display, Georgia, serif' },
  { name: 'Space Grotesk', value: 'Space Grotesk, monospace' }
];

const CarouselBuilder = () => {
  // Navigation: 'setup' | 'outline' | 'editor'
  const [step, setStep] = useState('setup');
  
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
          textColor: selectedTheme.textColor
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
        textColor: selectedTheme.textColor
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
      textColor: selectedTheme.textColor
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
    setSlides((prev) =>
      prev.map((slide) => ({
        ...slide,
        gradient: theme.class,
        textClass: theme.textClass,
        textColor: theme.textColor
      }))
    );
  };

  // Dimensions of export canvas based on platform
  const getDimensions = () => {
    // Standard LinkedIn/Instagram portrait is 4:5 (1080x1350)
    // Facebook landscape is 1.91:1 (1200x630)
    // Default square is 1:1 (1080x1080)
    if (platform === 'linkedin' || platform === 'instagram') {
      return { width: 1080, height: 1350, aspectClass: 'aspect-[4/5] max-w-[360px]' };
    }
    if (platform === 'facebook') {
      return { width: 1200, height: 630, aspectClass: 'aspect-[1.91/1] max-w-[480px]' };
    }
    return { width: 1080, height: 1080, aspectClass: 'aspect-square max-w-[380px]' };
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
            className={`fixed top-4 right-4 z-50 flex items-center space-x-2.5 px-4.5 py-3 rounded-xl border shadow-xl backdrop-blur-xl ${
              toast.type === 'error' 
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
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 border-b border-zinc-800/40 pb-6">
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
        <div className="flex items-center space-x-2.5 bg-zinc-950/60 border border-zinc-800/80 rounded-2xl p-2 shrink-0">
          <button 
            onClick={() => step !== 'setup' && setStep('setup')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              step === 'setup' 
                ? 'bg-indigo-600/10 border border-indigo-500/30 text-indigo-400' 
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            1. Setup
          </button>
          <ChevronRight className="h-3 w-3 text-zinc-600" />
          <button 
            onClick={() => outline.length > 0 && setStep('outline')}
            disabled={outline.length === 0}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              step === 'outline' 
                ? 'bg-indigo-600/10 border border-indigo-500/30 text-indigo-400' 
                : 'text-zinc-500 disabled:opacity-40 disabled:cursor-not-allowed hover:text-zinc-300'
            }`}
          >
            2. Outline
          </button>
          <ChevronRight className="h-3 w-3 text-zinc-600" />
          <button 
            onClick={() => slides.length > 0 && setStep('editor')}
            disabled={slides.length === 0}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              step === 'editor' 
                ? 'bg-indigo-600/10 border border-indigo-500/30 text-indigo-400' 
                : 'text-zinc-500 disabled:opacity-40 disabled:cursor-not-allowed hover:text-zinc-300'
            }`}
          >
            3. Design
          </button>
        </div>
      </div>

      {/* Screen step transitions */}
      <AnimatePresence mode="wait">
        
        {/* STEP 1: SETUP FORM */}
        {step === 'setup' && (
          <motion.div
            key="setup-screen"
            initial={{ opacity: 0, x: -15 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 15 }}
            transition={{ duration: 0.2 }}
            className="max-w-2xl mx-auto bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-8 space-y-6 shadow-xl"
          >
            <div className="flex items-center space-x-3 pb-3 border-b border-zinc-850">
              <Sparkles className="h-5 w-5 text-indigo-400" />
              <h2 className="text-lg font-bold text-zinc-100">Setup Carousel Details</h2>
            </div>

            <div className="space-y-5">
              {/* Topic input */}
              <div>
                <label className="block text-xs text-zinc-400 uppercase font-semibold tracking-wider mb-2">Topic or Concept</label>
                <textarea
                  rows={3}
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. 5 Node.js Scaling Bottlenecks and how to resolve them with Redis and BullMQ"
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-200 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none placeholder-zinc-650"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Target Platform */}
                <div>
                  <label className="block text-xs text-zinc-400 uppercase font-semibold tracking-wider mb-2">Social Platform</label>
                  <select
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value)}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 py-2.5 px-3 text-sm text-zinc-200 focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="linkedin">LinkedIn (Portrait 4:5 PDF)</option>
                    <option value="instagram">Instagram (Portrait 4:5 / Square)</option>
                    <option value="facebook">Facebook (Landscape / Square)</option>
                  </select>
                </div>

                {/* Slide Count */}
                <div>
                  <label className="block text-xs text-zinc-400 uppercase font-semibold tracking-wider mb-2">Number of Slides</label>
                  <select
                    value={slideCount}
                    onChange={(e) => setSlideCount(parseInt(e.target.value, 10))}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 py-2.5 px-3 text-sm text-zinc-200 focus:border-indigo-500 focus:outline-none"
                  >
                    {[3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                      <option key={num} value={num}>{num} Slides</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Theme Selector */}
              <div>
                <label className="block text-xs text-zinc-400 uppercase font-semibold tracking-wider mb-2">Initial Visual Theme</label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {themes.map((t) => (
                    <button
                      key={t.name}
                      type="button"
                      onClick={() => applyThemeToAll(t)}
                      className={`h-14 rounded-xl bg-gradient-to-tr ${t.class} border-2 hover:scale-[1.03] transition-all flex flex-col justify-end p-2 cursor-pointer ${
                        selectedTheme.name === t.name ? 'border-white ring-2 ring-indigo-500/40' : 'border-transparent'
                      }`}
                    >
                      <span className={`text-[8px] font-bold truncate w-full ${t.textClass}`}>{t.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Brand Brain Switch */}
              <div className="flex items-center justify-between p-3.5 bg-zinc-950/40 border border-zinc-800/80 rounded-xl">
                <div className="flex items-center space-x-3">
                  <span className="text-xl">🧠</span>
                  <div>
                    <h4 className="text-xs font-bold text-zinc-200">Use Brand Brain Profile</h4>
                    <p className="text-[10px] text-zinc-500 mt-0.5">Adapt visual tone and writing keywords to your brand settings.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setUseBrandBrain(!useBrandBrain)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border border-zinc-700 transition-colors duration-200 ease-in-out focus:outline-none ${
                    useBrandBrain ? 'bg-indigo-600 border-indigo-600' : 'bg-zinc-800'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
                      useBrandBrain ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-zinc-850">
              <button
                onClick={handleGenerateOutline}
                disabled={isGeneratingOutline}
                className="flex items-center space-x-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold text-white rounded-xl shadow-lg shadow-indigo-500/15 transition-all cursor-pointer disabled:opacity-50"
              >
                {isGeneratingOutline ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
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
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -15 }}
            transition={{ duration: 0.2 }}
            className="max-w-3xl mx-auto space-y-6"
          >
            <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-850">
                <div className="flex items-center space-x-3">
                  <FileText className="h-5 w-5 text-indigo-400" />
                  <div>
                    <h2 className="text-lg font-bold text-zinc-100">Review Slide Outline</h2>
                    <p className="text-xs text-zinc-400 mt-0.5">Customize titles and visuals before drafting full details.</p>
                  </div>
                </div>
                <button
                  onClick={addOutlineItem}
                  className="flex items-center space-x-1.5 px-3.5 py-2 bg-zinc-950 border border-zinc-800 hover:border-zinc-700 text-xs font-semibold text-zinc-300 rounded-xl transition-all cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Slide</span>
                </button>
              </div>

              {/* Outline Deck Items */}
              <div className="space-y-3.5">
                {outline.map((item, idx) => (
                  <div 
                    key={idx}
                    className="flex items-start gap-4 p-4 bg-zinc-950/60 border border-zinc-800/80 rounded-xl hover:border-zinc-750 transition-all"
                  >
                    <div className="bg-zinc-900 border border-zinc-850 px-3 py-1.5 rounded-lg text-xs font-bold text-indigo-400 shrink-0">
                      {idx + 1}
                    </div>

                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-1">Slide Title</label>
                        <input
                          type="text"
                          value={item.title}
                          onChange={(e) => updateOutlineItem(idx, 'title', e.target.value)}
                          className="w-full rounded-lg border border-zinc-800 bg-zinc-950 py-1.5 px-2.5 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-1">Visual Concept</label>
                        <input
                          type="text"
                          value={item.concept}
                          onChange={(e) => updateOutlineItem(idx, 'concept', e.target.value)}
                          className="w-full rounded-lg border border-zinc-800 bg-zinc-950 py-1.5 px-2.5 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <button
                      onClick={() => deleteOutlineItem(idx)}
                      disabled={outline.length <= 1}
                      className="p-2 text-zinc-500 hover:text-red-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                      title="Delete Slide"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex justify-between items-center pt-4 border-t border-zinc-850">
                <button
                  onClick={() => setStep('setup')}
                  className="flex items-center space-x-1.5 px-4.5 py-2.5 bg-zinc-950 border border-zinc-800 hover:border-zinc-700 text-xs font-semibold text-zinc-400 hover:text-zinc-200 rounded-xl transition-all cursor-pointer"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>Back to Setup</span>
                </button>

                <button
                  onClick={handleGenerateSlides}
                  disabled={isGeneratingSlides}
                  className="flex items-center space-x-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white rounded-xl shadow-lg shadow-indigo-500/15 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isGeneratingSlides ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>Generating Copy...</span>
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
            <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-6 space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-850">
                <h3 className="font-bold text-zinc-100 flex items-center space-x-2 text-sm">
                  <Palette className="h-4 w-4 text-indigo-400" />
                  <span>Design Panel</span>
                </h3>
                <button
                  onClick={addEditorSlide}
                  className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  + Add Slide
                </button>
              </div>

              {/* Visual Layout Settings */}
              <div className="space-y-4 text-left">
                {/* Visual Theme */}
                <div>
                  <label className="block text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-2">Background Style</label>
                  <div className="grid grid-cols-2 gap-2">
                    {themes.map((t) => (
                      <button
                        key={t.name}
                        type="button"
                        onClick={() => applyThemeToAll(t)}
                        className={`h-10 rounded-xl bg-gradient-to-tr ${t.class} border-2 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer ${
                          selectedTheme.name === t.name ? 'border-white' : 'border-transparent'
                        }`}
                        title={t.name}
                      />
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  {/* Font Selection */}
                  <div>
                    <label className="block text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-1.5">Typography</label>
                    <select
                      value={fontFamily}
                      onChange={(e) => setFontFamily(e.target.value)}
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-950 py-2 px-2.5 text-xs text-zinc-200 focus:outline-none"
                    >
                      {fonts.map((f) => (
                        <option key={f.name} value={f.value}>{f.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Alignment */}
                  <div>
                    <label className="block text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-1.5">Alignment</label>
                    <div className="flex space-x-1.5 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
                      {[
                        { value: 'left', icon: AlignLeft },
                        { value: 'center', icon: AlignCenter },
                        { value: 'right', icon: AlignRight }
                      ].map((align) => {
                        const Icon = align.icon;
                        return (
                          <button
                            key={align.value}
                            onClick={() => setTextAlign(align.value)}
                            className={`flex-1 flex justify-center py-1 rounded-lg text-zinc-400 hover:text-white transition-all cursor-pointer ${
                              textAlign === align.value ? 'bg-zinc-850 text-indigo-400' : ''
                            }`}
                          >
                            <Icon className="h-3.5 w-3.5" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Branding watermark */}
                <div>
                  <label className="block text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-1.5">Branding Watermark</label>
                  <input
                    type="text"
                    value={brandWatermark}
                    onChange={(e) => setBrandWatermark(e.target.value)}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 py-2 px-3 text-xs text-zinc-200 focus:outline-none"
                  />
                </div>

                {/* Active Slide customizer */}
                {slides.length > 0 && slides[activeSlideIndex] && (
                  <div className="border-t border-zinc-850 pt-4 space-y-3.5">
                    <div>
                      <label className="block text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-1.5 flex items-center space-x-1">
                        <Type className="h-3.5 w-3.5 text-indigo-400" />
                        <span>Active Slide Title</span>
                      </label>
                      <input
                        type="text"
                        value={slides[activeSlideIndex].title}
                        onChange={(e) => updateActiveSlide('title', e.target.value)}
                        className="w-full rounded-xl border border-zinc-800 bg-zinc-950 py-2 px-3 text-xs text-zinc-200 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-1.5 flex items-center space-x-1">
                        <Layout className="h-3.5 w-3.5 text-indigo-400" />
                        <span>Slide Content Body</span>
                      </label>
                      <textarea
                        rows={4}
                        value={slides[activeSlideIndex].body}
                        onChange={(e) => updateActiveSlide('body', e.target.value)}
                        className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-2.5 text-xs text-zinc-200 focus:outline-none resize-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Deck Action buttons */}
              <div className="border-t border-zinc-850 pt-4 flex gap-3">
                <button
                  onClick={() => setStep('outline')}
                  className="flex-1 flex justify-center items-center space-x-1.5 px-3 py-2 bg-zinc-950 border border-zinc-800 hover:border-zinc-700 text-xs font-semibold text-zinc-400 hover:text-zinc-200 rounded-xl transition-all cursor-pointer"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Outline</span>
                </button>

                <button
                  onClick={() => deleteEditorSlide(activeSlideIndex)}
                  disabled={slides.length <= 1}
                  className="px-3 py-2 text-zinc-500 hover:text-red-400 border border-zinc-800 bg-zinc-950 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  title="Delete Active Slide"
                >
                  <Trash2 className="h-4 w-4" />
                </button>

                <button
                  onClick={handleExportPDF}
                  disabled={isGeneratingPDF}
                  className="flex-2 flex justify-center items-center space-x-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50"
                >
                  {isGeneratingPDF ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>Compiling...</span>
                    </>
                  ) : (
                    <>
                      <Download className="h-3.5 w-3.5" />
                      <span>Download PDF</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Live Preview Canvas - 2 Cols */}
            <div className="lg:col-span-2 flex flex-col justify-between space-y-6">
              
              {/* Dynamic canvas wrapper based on selected platform aspect ratio */}
              <div className="flex-1 bg-zinc-950/80 border border-zinc-800/80 rounded-2xl p-6 flex items-center justify-center min-h-[460px] relative overflow-hidden shadow-2xl">
                
                {/* Platform Badge */}
                <div className="absolute top-4 left-4 flex items-center space-x-1.5 px-2.5 py-1 bg-zinc-900 border border-zinc-800 rounded-lg text-[9px] font-bold text-zinc-400 uppercase tracking-widest">
                  <Smartphone className="h-3 w-3" />
                  <span>{platform} preview</span>
                </div>

                <AnimatePresence mode="wait">
                  {slides.length > 0 && slides[activeSlideIndex] && (
                    <motion.div
                      key={slides[activeSlideIndex].id}
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      transition={{ duration: 0.2 }}
                      style={{ fontFamily: fontFamily }}
                      className={`w-full ${aspectClass} rounded-2xl bg-gradient-to-tr ${slides[activeSlideIndex].gradient} p-8 sm:p-10 flex flex-col justify-between shadow-2xl relative select-none overflow-hidden ${slides[activeSlideIndex].textClass}`}
                    >
                      {/* Ambient light glow overlay */}
                      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent pointer-events-none" />
                      <div className="absolute inset-0 bg-grid-pattern opacity-[0.03] pointer-events-none" />

                      {/* Header Watermark */}
                      <div className="text-[10px] sm:text-xs font-bold tracking-widest opacity-60 uppercase flex justify-between items-center">
                        <span>{brandWatermark || 'taraflow.ai'}</span>
                        <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
                      </div>

                      {/* Headline and Copy */}
                      <div className="my-auto space-y-4">
                        <h2 
                          className="text-2xl sm:text-3xl font-extrabold leading-tight text-left"
                          style={{ textAlign: textAlign }}
                        >
                          {slides[activeSlideIndex].title}
                        </h2>
                        {slides[activeSlideIndex].body && (
                          <p 
                            className="text-xs sm:text-sm leading-relaxed opacity-85 text-left font-medium"
                            style={{ textAlign: textAlign }}
                          >
                            {slides[activeSlideIndex].body}
                          </p>
                        )}
                      </div>

                      {/* Swipe instructions footer */}
                      <div className="flex justify-between items-center text-[10px] sm:text-xs font-bold opacity-50">
                        <span>Swipe Left</span>
                        <span>{activeSlideIndex + 1} / {slides.length}</span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Canvas Navigation Arrows */}
                <button
                  onClick={() => setActiveSlideIndex(Math.max(0, activeSlideIndex - 1))}
                  disabled={activeSlideIndex === 0}
                  className="absolute left-4 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full border border-zinc-800 bg-zinc-950/80 hover:bg-zinc-900 text-zinc-400 hover:text-white flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                >
                  <ArrowLeft className="h-4.5 w-4.5" />
                </button>
                <button
                  onClick={() => setActiveSlideIndex(Math.min(slides.length - 1, activeSlideIndex + 1))}
                  disabled={activeSlideIndex === slides.length - 1}
                  className="absolute right-4 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full border border-zinc-800 bg-zinc-950/80 hover:bg-zinc-900 text-zinc-400 hover:text-white flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                >
                  <ArrowRight className="h-4.5 w-4.5" />
                </button>
              </div>

              {/* Bottom slide thumbnail timeline selector */}
              <div className="flex items-center space-x-3 overflow-x-auto py-2 px-1 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
                {slides.map((s, idx) => (
                  <button
                    key={s.id}
                    onClick={() => setActiveSlideIndex(idx)}
                    className={`flex-shrink-0 w-24 aspect-square rounded-xl bg-gradient-to-tr ${s.gradient} p-2.5 text-left border flex flex-col justify-between hover:scale-[1.03] active:scale-[0.97] transition-all cursor-pointer ${
                      activeSlideIndex === idx ? 'border-indigo-500 ring-2 ring-indigo-500/20 scale-[1.02]' : 'border-zinc-800'
                    }`}
                  >
                    <span className="text-[9px] font-bold text-white/40">Slide {idx + 1}</span>
                    <span className="text-[10px] font-extrabold text-white truncate w-full">{s.title || 'Untitled'}</span>
                  </button>
                ))}
                
                <button
                  onClick={addEditorSlide}
                  className="flex-shrink-0 w-24 aspect-square rounded-xl bg-zinc-900/30 border border-dashed border-zinc-850 hover:border-zinc-800 flex flex-col items-center justify-center text-zinc-500 hover:text-zinc-300 transition-all cursor-pointer"
                >
                  <Plus className="h-5 w-5 mb-1" />
                  <span className="text-[10px] font-semibold">Add Slide</span>
                </button>
              </div>
            </div>
            
            {/* HIDDEN ELEMENT CONTAINER FOR FULL-SCALE HIGH-RESOLUTION PDF COMPILATION */}
            <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
              {slides.map((slide, idx) => (
                <div
                  key={slide.id}
                  id={`carousel-slide-full-${idx}`}
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
                    background: slide.gradient.includes('via') 
                      ? `linear-gradient(135deg, ${slide.gradient.split(' ').map(c => c.replace('from-', '').replace('via-', '').replace('to-', '')).join(', ')})`
                      : `linear-gradient(135deg, ${slide.gradient.split(' ').filter(c => c.startsWith('from-') || c.startsWith('to-')).map(c => c.replace('from-', '').replace('to-', '')).join(', ')})`,
                    color: slide.textColor
                  }}
                >
                  {/* Subtle overlays */}
                  <div 
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'radial-gradient(ellipse at top, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0) 80%)',
                      pointerEvents: 'none'
                    }} 
                  />

                  {/* Header brand details */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '20px', fontWeight: 'bold', letterSpacing: '2px', opacity: 0.7, textTransform: 'uppercase' }}>
                    <span>{brandWatermark || 'taraflow.ai'}</span>
                    <span style={{ fontSize: '14px', fontWeight: '600', opacity: 0.8 }}>{platform} Carousel</span>
                  </div>

                  {/* Slide Main Content */}
                  <div style={{ margin: 'auto 0', display: 'flex', flexDirection: 'column', gap: '30px' }}>
                    <h2 
                      style={{ 
                        fontSize: `${width * 0.055}px`, 
                        fontWeight: '800', 
                        lineHeight: 1.15,
                        textAlign: textAlign,
                        margin: 0
                      }}
                    >
                      {slide.title}
                    </h2>
                    {slide.body && (
                      <p 
                        style={{ 
                          fontSize: `${width * 0.025}px`, 
                          lineHeight: 1.6, 
                          opacity: 0.85,
                          textAlign: textAlign,
                          fontWeight: '500',
                          margin: 0
                        }}
                      >
                        {slide.body}
                      </p>
                    )}
                  </div>

                  {/* Footer details */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '18px', fontWeight: 'bold', opacity: 0.6 }}>
                    <span>Swipe Left</span>
                    <span>{idx + 1} / {slides.length}</span>
                  </div>
                </div>
              ))}
            </div>

          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default CarouselBuilder;
