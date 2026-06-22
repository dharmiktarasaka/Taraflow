import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar as CalendarIcon,
  Plus,
  Instagram,
  Linkedin,
  Twitter,
  Facebook,
  Globe,
  Pin,
  AtSign,
  RefreshCw,
  Trash2,
  Play,
  AlertCircle,
  X,
  PlusCircle,
  Sparkles,
  Edit2
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import contentService from '../services/contentService';
import { useData } from '../context/DataContext';

const PLATFORM_ICONS = {
  facebook: { icon: Facebook, color: 'text-blue-400 bg-blue-500/10 border-blue-500/25 text-blue-500' },
  instagram: { icon: Instagram, color: 'text-pink-400 bg-pink-500/10 border-pink-500/25 text-pink-500' },
  threads: { icon: AtSign, color: 'text-zinc-300 bg-zinc-700/10 border-zinc-600/25 text-zinc-300' },
  linkedin: { icon: Linkedin, color: 'text-sky-400 bg-sky-500/10 border-sky-500/25 text-sky-500' }
};

const Scheduler = () => {
  const {
    posts,
    fetchPosts,
    loading: globalLoading,
    errors: globalErrors
  } = useData();
  const [error, setError] = useState('');
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const calendarRef = useRef(null);

  // Track viewport width for responsive overrides
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = windowWidth < 768;

  // Modal / Drawer States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' | 'edit'
  const [modalData, setModalData] = useState({
    id: null,
    content: '',
    platform: 'linkedin',
    scheduledAtDate: '',
    scheduledAtTime: '12:00',
    status: 'DRAFT',
    media: []
  });
  const [actionLoading, setActionLoading] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    fetchPosts();
    if (location.state?.prefilledPost) {
      const prefilled = location.state.prefilledPost;
      setModalMode('create');
      setModalData({
        id: null,
        content: prefilled.content || '',
        platform: prefilled.platform || 'linkedin',
        scheduledAtDate: prefilled.scheduledAtDate || new Date().toISOString().split('T')[0],
        scheduledAtTime: '12:00',
        status: 'SCHEDULED',
        media: prefilled.mediaUrl ? [{ url: prefilled.mediaUrl, type: 'image' }] : []
      });
      setIsModalOpen(true);
      // Clean up Router state so reloading doesn't prompt modal again
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const loading = globalLoading.posts;

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  };

  // Convert posts to FullCalendar events schema
  const getCalendarEvents = () => {
    return posts
      .filter(post => post.scheduledAt)
      .map(post => {
        const meta = PLATFORM_ICONS[post.platform] || { color: 'bg-zinc-800' };
        return {
          id: post._id,
          title: post.content,
          start: post.scheduledAt,
          allDay: false,
          extendedProps: post,
          // CSS variables / styling triggers
          backgroundColor: 'transparent',
          borderColor: 'transparent'
        };
      });
  };

  // Render visual event cards directly inside FullCalendar slots
  const renderEventContent = (eventInfo) => {
    const post = eventInfo.event.extendedProps;
    const meta = PLATFORM_ICONS[post.platform] || { icon: Globe, color: 'text-zinc-400 bg-zinc-800 border-zinc-700/50' };
    const PlatformIcon = meta.icon;
    const timeStr = eventInfo.timeText;

    return (
      <div 
        className={`w-full px-2 py-1 rounded-lg text-[10px] font-semibold border flex items-center space-x-1.5 truncate transition-all hover:brightness-110 shadow-sm ${meta.color} ${
          post.status === 'PUBLISHED' ? 'opacity-60' : post.status === 'FAILED' ? 'border-red-500/40 bg-red-500/10 text-red-400' : ''
        }`}
        title={`${timeStr} - ${post.content}`}
      >
        <PlatformIcon className="h-3 w-3 shrink-0" />
        <span className="opacity-80 font-bold shrink-0">{timeStr}</span>
        <span className="truncate">{post.content}</span>
      </div>
    );
  };

  // Handle Drag-and-Drop Drop callback
  const handleEventDrop = async (dropInfo) => {
    const post = dropInfo.event.extendedProps;
    const newDate = dropInfo.event.start;

    // Validation: Block scheduling in the past
    if (newDate < new Date()) {
      showToast('Cannot schedule posts in the past!', 'error');
      dropInfo.revert();
      return;
    }

    try {
      showToast('Updating post schedule...');
      await contentService.updatePost(post._id, {
        scheduledAt: newDate.toISOString(),
        status: post.status === 'FAILED' ? 'SCHEDULED' : post.status,
        publishError: post.status === 'FAILED' ? null : post.publishError
      });
      showToast('Post rescheduled successfully!');
      fetchPosts(true);
    } catch (err) {
      showToast('Failed to reschedule post.', 'error');
      dropInfo.revert();
    }
  };

  // Open modal in Edit mode when clicking an event card
  const handleEventClick = (clickInfo) => {
    const post = clickInfo.event.extendedProps;
    const dateObj = new Date(post.scheduledAt);
    
    // Format YYYY-MM-DD
    const dateString = dateObj.toISOString().split('T')[0];
    // Format HH:MM
    const timeString = dateObj.toTimeString().substring(0, 5);

    setModalMode('edit');
    setModalData({
      id: post._id,
      content: post.content,
      platform: post.platform,
      scheduledAtDate: dateString,
      scheduledAtTime: timeString,
      status: post.status,
      media: post.media || [],
      isCarousel: post.isCarousel || false
    });
    setIsModalOpen(true);
  };

  // Open modal in Create mode when clicking a date cell
  const handleDateSelect = (selectInfo) => {
    const dateString = selectInfo.startStr.split('T')[0];
    const timeString = selectInfo.startStr.includes('T') 
      ? selectInfo.startStr.split('T')[1].substring(0, 5)
      : '12:00';

    // Check if selected date is in the past
    const selectDate = new Date(selectInfo.start);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (selectDate < today) {
      showToast('Cannot schedule posts in the past!', 'error');
      return;
    }

    setModalMode('create');
    setModalData({
      id: null,
      content: '',
      platform: 'linkedin',
      scheduledAtDate: dateString,
      scheduledAtTime: timeString,
      status: 'SCHEDULED',
      media: []
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  // Create or Update schedule post
  const handleSavePost = async (e) => {
    e.preventDefault();
    if (!modalData.content.trim()) {
      showToast('Post content cannot be empty!', 'error');
      return;
    }

    const scheduledDate = new Date(`${modalData.scheduledAtDate}T${modalData.scheduledAtTime}`);
    if (scheduledDate < new Date()) {
      showToast('Scheduled date must be in the future!', 'error');
      return;
    }

    setActionLoading(true);
    try {
      const payload = {
        content: modalData.content,
        platform: modalData.platform,
        scheduledAt: scheduledDate.toISOString(),
        status: 'SCHEDULED',
        media: modalData.media || [],
        isCarousel: modalData.isCarousel || false
      };

      if (modalMode === 'create') {
        await contentService.createPost(payload);
        showToast('Post scheduled successfully!');
      } else {
        await contentService.updatePost(modalData.id, {
          ...payload,
          publishError: null // Reset error log on update
        });
        showToast('Post schedule updated!');
      }
      setIsModalOpen(false);
      fetchPosts(true);
    } catch (err) {
      showToast('Failed to save post.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Delete post
  const handleDeletePost = async () => {
    if (!modalData.id) return;
    if (!window.confirm('Are you sure you want to unschedule and delete this post?')) return;

    setActionLoading(true);
    try {
      await contentService.deletePost(modalData.id);
      showToast('Post deleted successfully!');
      setIsModalOpen(false);
      fetchPosts(true);
    } catch (err) {
      showToast('Failed to delete post.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Publish immediately
  const handlePublishNow = async () => {
    if (!modalData.id) return;
    setActionLoading(true);
    try {
      await contentService.publishPostNow(modalData.id);
      showToast('Post published successfully!');
      setIsModalOpen(false);
      fetchPosts(true);
    } catch (err) {
      showToast('Failed to publish post.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Redirect helper for full layout editing
  const handleEditDetails = () => {
    let scheduledAt = null;
    if (modalData.scheduledAtDate && modalData.scheduledAtTime) {
      const d = new Date(`${modalData.scheduledAtDate}T${modalData.scheduledAtTime}`);
      if (!isNaN(d.getTime())) {
        scheduledAt = d.toISOString();
      }
    }
    const retryState = { 
      retryPost: { 
        _id: modalData.id, 
        content: modalData.content, 
        platform: modalData.platform,
        media: modalData.media,
        scheduledAt
      } 
    };
    if (modalData.isCarousel) {
      navigate('/carousel-builder', { state: retryState });
    } else {
      navigate('/contain-studio', { state: retryState });
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
                : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
            }`}
          >
            <span className="text-sm font-semibold">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scheduler Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-700 dark:from-white dark:via-zinc-100 dark:to-zinc-400 bg-clip-text text-transparent flex items-center space-x-3">
            <CalendarIcon className="h-8 w-8 text-indigo-400 animate-pulse" />
            <span>Content Calendar</span>
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1.5">
            Plan, drag-and-drop, and preview your automatic publishing schedule.
          </p>
        </div>

        <button 
          onClick={() => {
            setModalMode('create');
            setModalData({
              id: null,
              content: '',
              platform: 'linkedin',
              scheduledAtDate: new Date().toISOString().split('T')[0],
              scheduledAtTime: '12:00',
              status: 'SCHEDULED',
              media: []
            });
            setIsModalOpen(true);
          }}
          className="flex items-center space-x-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold text-white rounded-xl shadow-lg shadow-indigo-500/20 transition-all cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>Schedule Post</span>
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-xl text-sm flex items-center space-x-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* FullCalendar Grid Container */}
      <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl md:rounded-3xl p-3 md:p-6 shadow-xl relative backdrop-blur-md">
        {loading && posts.length === 0 ? (
          <div className="min-h-[450px] flex items-center justify-center">
            <div className="flex flex-col items-center space-y-4 text-center">
              <RefreshCw className="h-8 w-8 text-indigo-500 animate-spin" />
              <p className="text-zinc-500 dark:text-zinc-400 text-sm font-medium">Loading content schedule...</p>
            </div>
          </div>
        ) : (
          <FullCalendar
            key={isMobile ? 'mobile' : 'desktop'}
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView={isMobile ? "timeGridWeek" : "dayGridMonth"}
            headerToolbar={isMobile ? {
              left: 'prev,next',
              center: 'title',
              right: 'today'
            } : {
              left: 'prev,next today',
              center: 'title',
              right: 'dayGridMonth,timeGridWeek'
            }}
            editable={true}
            selectable={true}
            selectMirror={true}
            dayMaxEvents={true}
            events={getCalendarEvents()}
            eventContent={renderEventContent}
            eventDrop={handleEventDrop}
            eventClick={handleEventClick}
            select={handleDateSelect}
            eventTimeFormat={{
              hour: '2-digit',
              minute: '2-digit',
              meridiem: 'short',
              hour12: true
            }}
            height="auto"
          />
        )}
      </div>

      {/* Schedule / Edit Post Dialog Drawer Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-zinc-950 border border-zinc-800 rounded-3xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl relative text-left overflow-hidden"
            >
              {/* Header Container */}
              <div className="p-6 pb-4 border-b border-zinc-800/80 flex items-center justify-between shrink-0">
                <div className="flex items-center space-x-3.5">
                  <div className="h-10 w-10 rounded-xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                    {modalMode === 'create' ? <PlusCircle className="h-5.5 w-5.5" /> : <Edit2 className="h-5.5 w-5.5" />}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-zinc-900 dark:text-white capitalize leading-none">
                      {modalMode === 'create' ? 'Schedule New Post' : 'Edit Scheduled Post'}
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5">
                      {modalMode === 'create' ? 'Define content and pick a target platform.' : `Status: ${modalData.status}`}
                    </p>
                  </div>
                </div>
                
                {/* Close Button */}
                <button
                  onClick={handleCloseModal}
                  className="p-2 hover:bg-zinc-900 rounded-xl text-zinc-400 hover:text-white transition-colors cursor-pointer shrink-0"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Form Input fields with fixed footer */}
              <form onSubmit={handleSavePost} className="flex flex-col min-h-0 flex-1">
                {/* Scrollable Body */}
                <div className="p-6 space-y-5 overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
                  {/* Platform select */}
                  <div>
                    <label className="block text-[10px] text-zinc-500 dark:text-zinc-400 uppercase font-bold tracking-wider mb-2">Target Platform</label>
                    <select
                      value={modalData.platform}
                      onChange={(e) => setModalData({ ...modalData, platform: e.target.value })}
                      className="w-full rounded-xl border border-zinc-200 dark:border-zinc-850 bg-white dark:bg-zinc-900/50 py-2.5 px-3.5 text-sm text-zinc-800 dark:text-zinc-200 focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="linkedin">LinkedIn</option>
                      <option value="instagram">Instagram</option>
                      <option value="facebook">Facebook</option>
                      <option value="threads">Threads</option>
                    </select>
                  </div>

                  {/* Content Textarea */}
                  <div>
                    <label className="block text-[10px] text-zinc-500 dark:text-zinc-400 uppercase font-bold tracking-wider mb-2">Post Copy Content</label>
                    <textarea
                      rows={5}
                      value={modalData.content}
                      onChange={(e) => setModalData({ ...modalData, content: e.target.value })}
                      placeholder="Enter your scheduled post description copy..."
                      className="w-full rounded-xl border border-zinc-200 dark:border-zinc-850 bg-white dark:bg-zinc-900/50 p-3 text-sm text-zinc-800 dark:text-zinc-200 focus:border-indigo-500 focus:outline-none resize-none placeholder-zinc-400 dark:placeholder-zinc-650"
                    />
                    <div className="text-[10px] text-zinc-400 dark:text-zinc-500 text-right mt-1.5 font-semibold">
                      {modalData.content.length} characters
                    </div>
                  </div>

                  {/* Media Attachment Preview */}
                  {modalData.media && modalData.media.length > 0 && modalData.media[0]?.url && (
                    <div className="p-3 bg-zinc-950/40 border border-zinc-800/80 rounded-xl flex items-center justify-between animate-fadeIn">
                      <div className="flex items-center space-x-4">
                        <img 
                          src={modalData.media[0].url} 
                          alt="Attached media" 
                          className="w-16 h-16 object-cover rounded-lg border border-zinc-800 bg-zinc-950" 
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = `https://picsum.photos/1080/1080?random=${Math.floor(Math.random() * 1000)}`;
                          }}
                        />
                        <div className="text-xs text-zinc-400">
                          <span className="font-semibold text-indigo-400 block">Attached Visual</span>
                          Image will be auto-posted with this caption.
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setModalData({ ...modalData, media: [] })}
                        className="p-2 bg-red-950/20 border border-red-900/30 hover:border-red-500/20 hover:bg-red-500/10 text-red-400 rounded-xl transition-all cursor-pointer"
                        title="Remove Attachment"
                      >
                        <Trash2 className="h-4.5 w-4.5" />
                      </button>
                    </div>
                  )}

                  {/* Date & Time Selector */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] text-zinc-500 dark:text-zinc-400 uppercase font-bold tracking-wider mb-2">Publish Date</label>
                      <input
                        type="date"
                        value={modalData.scheduledAtDate}
                        onChange={(e) => setModalData({ ...modalData, scheduledAtDate: e.target.value })}
                        className="w-full rounded-xl border border-zinc-200 dark:border-zinc-850 bg-white dark:bg-zinc-900/50 py-2 px-3 text-sm text-zinc-800 dark:text-zinc-200 focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-zinc-500 dark:text-zinc-400 uppercase font-bold tracking-wider mb-2">Publish Time</label>
                      <input
                        type="time"
                        value={modalData.scheduledAtTime}
                        onChange={(e) => setModalData({ ...modalData, scheduledAtTime: e.target.value })}
                        className="w-full rounded-xl border border-zinc-200 dark:border-zinc-850 bg-white dark:bg-zinc-900/50 py-2 px-3 text-sm text-zinc-800 dark:text-zinc-200 focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Submit / Actions Footer (Sticky) */}
                <div className="p-6 pt-4 border-t border-zinc-800/80 bg-zinc-950/90 backdrop-blur-md flex flex-wrap items-center justify-between gap-3 shrink-0">
                  <div className="flex space-x-2">
                    {modalMode === 'edit' && (
                      <button
                        type="button"
                        onClick={handleDeletePost}
                        disabled={actionLoading}
                        className="p-2 border border-zinc-200 dark:border-zinc-800 hover:border-rose-500/20 hover:bg-rose-500/10 text-zinc-500 dark:text-zinc-450 hover:text-rose-500 rounded-xl transition-all cursor-pointer"
                        title="Delete Post"
                      >
                        <Trash2 className="h-4.5 w-4.5" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center space-x-2">
                    {modalMode === 'edit' && modalData.status === 'SCHEDULED' && (
                      <button
                        type="button"
                        onClick={handlePublishNow}
                        disabled={actionLoading}
                        className="flex items-center space-x-1.5 px-4 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white rounded-xl text-xs font-bold border border-zinc-200 dark:border-zinc-800 transition-all cursor-pointer"
                      >
                        <Play className="h-3.5 w-3.5" />
                        <span>Publish Now</span>
                      </button>
                    )}

                    {modalMode === 'edit' && (
                      <button
                        type="button"
                        onClick={handleEditDetails}
                        disabled={actionLoading}
                        className="flex items-center space-x-1.5 px-4 py-2 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:text-indigo-850 dark:hover:text-indigo-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
                      >
                        <Sparkles className="h-3.5 w-3.5 animate-pulse" />
                        <span>AI Studio</span>
                      </button>
                    )}

                    <button
                      type="submit"
                      disabled={actionLoading}
                      className="flex items-center space-x-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-500/15 transition-all cursor-pointer"
                    >
                      {actionLoading ? (
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <span>{modalMode === 'create' ? 'Schedule Post' : 'Save Changes'}</span>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default Scheduler;
