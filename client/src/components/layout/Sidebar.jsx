import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  PenTool,
  Sparkles,
  Columns,
  Calendar,
  BarChart3,
  Link2,
  Users,
  CreditCard,
  Settings,
  LogOut,
  ChevronRight,
  ChevronDown,
  Sparkle
} from 'lucide-react';
import { useData } from '../../context/DataContext';

const navigation = [
  { name: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
  { name: 'Contain Studio', to: '/contain-studio', icon: Sparkles, badge: 'Hot' },
  { name: 'Carousel Builder', to: '/carousel-builder', icon: Columns },
  { name: 'Scheduler', to: '/scheduler', icon: Calendar },
  { name: 'Analytics', to: '/analytics', icon: BarChart3 },
  { name: 'AI Competitor Intel', to: '/competitor-intelligence', icon: Sparkle, badge: 'Premium' },
  { name: 'Social Accounts', to: '/social-accounts', icon: Link2 },
  { name: 'Workspace', to: '/workspace', icon: Users },
  { name: 'Billing', to: '/billing', icon: CreditCard },
  { name: 'Settings', to: '/settings', icon: Settings },
];

const Sidebar = ({ sidebarOpen, setSidebarOpen }) => {
  const { currentUser, fetchUser, workspaces, currentWorkspace, switchWorkspace } = useData();
  const [workspaceDropdownOpen, setWorkspaceDropdownOpen] = useState(false);

  useEffect(() => {
    fetchUser();
  }, []);

  const dynamicNavigation = navigation.filter(item => {
    if (!currentWorkspace) return true;
    if (currentWorkspace.role === 'Owner') return true;

    const permissions = currentWorkspace.permissions || [];
    switch (item.name) {
      case 'Dashboard':
        return true;
      case 'Contain Studio':
        return permissions.includes('Create Posts') || permissions.includes('Approve AI');
      case 'Carousel Builder':
        return permissions.includes('Create Posts');
      case 'Scheduler':
        return permissions.includes('Create Posts');
      case 'Analytics':
        return permissions.includes('Analytics');
      case 'AI Competitor Intel':
        return permissions.includes('Competitor Analysis');
      case 'Social Accounts':
        return true;
      case 'Workspace':
        return true;
      case 'Billing':
        return permissions.includes('Billing');
      case 'Settings':
        return permissions.includes('Workspace Settings');
      default:
        return true;
    }
  });

  return (
    <>
      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-zinc-950/80 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-zinc-950 border-r border-zinc-800/80 transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Branding header */}
        <div className="flex h-16 shrink-0 items-center justify-between px-6 border-b border-zinc-800/80">
          <div className="flex items-center space-x-2.5">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Sparkle className="h-5 w-5 text-white animate-pulse" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-zinc-900 via-zinc-850 to-zinc-700 dark:from-white dark:via-zinc-100 dark:to-zinc-400 bg-clip-text text-transparent">
              Taraflow.ai
            </span>
          </div>
          <button
            type="button"
            className="lg:hidden text-zinc-400 hover:text-white"
            onClick={() => setSidebarOpen(false)}
          >
            <span className="sr-only">Close sidebar</span>
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Workspace select block */}
        <div className="px-4 py-4 border-b border-zinc-800/50 relative">
          <div 
            onClick={() => setWorkspaceDropdownOpen(!workspaceDropdownOpen)}
            className="flex items-center justify-between p-2.5 bg-zinc-900/40 rounded-xl border border-zinc-800/60 hover:bg-zinc-900/60 transition-colors cursor-pointer group"
          >
            <div className="flex items-center space-x-3">
              <div className="h-8 w-8 rounded-lg bg-zinc-800 flex items-center justify-center font-bold text-indigo-400 dark:text-indigo-400 text-sm border border-zinc-700/50">
                {currentWorkspace?.name ? currentWorkspace.name.substring(0, 2).toUpperCase() : 'WS'}
              </div>
              <div className="text-left">
                <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">
                  Active Workspace {currentWorkspace?.role ? `• ${currentWorkspace.role}` : ''}
                </p>
                <p className="text-sm font-semibold text-zinc-850 dark:text-zinc-200 group-hover:text-zinc-950 dark:group-hover:text-white transition-colors truncate w-36">
                  {currentWorkspace?.name || 'Loading...'}
                </p>
              </div>
            </div>
            <ChevronDown className="h-4 w-4 text-zinc-500 group-hover:text-zinc-300 transition-colors" />
          </div>

          <AnimatePresence>
            {workspaceDropdownOpen && (
              <>
                {/* Backdrop to close */}
                <div className="fixed inset-0 z-10" onClick={() => setWorkspaceDropdownOpen(false)} />
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="absolute left-4 right-4 mt-2 p-1.5 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl z-20 space-y-1 max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800"
                >
                  {workspaces.map((ws) => (
                    <button
                      key={ws._id}
                      onClick={() => {
                        switchWorkspace(ws._id);
                        setWorkspaceDropdownOpen(false);
                      }}
                      className={`w-full flex items-center justify-between p-2 rounded-lg text-left text-xs transition-colors hover:bg-zinc-800/60 cursor-pointer ${
                        currentWorkspace?._id === ws._id ? 'text-indigo-400 font-bold bg-zinc-800/30' : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      <span className="truncate pr-2">{ws.name}</span>
                      {currentWorkspace?._id === ws._id && <div className="h-1.5 w-1.5 bg-indigo-500 rounded-full shrink-0" />}
                    </button>
                  ))}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-1.5 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
          {dynamicNavigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-medium transition-all group relative ${
                  isActive
                    ? 'bg-indigo-50 dark:bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/20'
                    : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900/50 hover:text-zinc-900 dark:hover:text-zinc-200 border border-transparent'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className="flex items-center space-x-3.5">
                    <item.icon
                      className={`h-5 w-5 transition-colors ${
                        isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-zinc-200'
                      }`}
                    />
                    <span>{item.name}</span>
                  </div>

                  {item.badge && (
                    <span className="px-2 py-0.5 text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full">
                      {item.badge}
                    </span>
                  )}

                  {isActive && (
                    <motion.div
                      layoutId="activeIndicator"
                      className="absolute left-0 w-1 h-6 bg-indigo-500 rounded-r-full"
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Sidebar Footer User Card */}
        <div className="p-4 border-t border-zinc-800/80 bg-zinc-950/50">
          <div className="flex items-center justify-between p-2 rounded-xl hover:bg-zinc-900/40 transition-colors">
            <div className="flex items-center space-x-3">
              <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-violet-500 to-fuchsia-500 flex items-center justify-center font-bold text-white text-sm shadow">
                {currentUser?.firstName ? currentUser.firstName[0].toUpperCase() : 'D'}
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                  {currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'Dharmik'}
                </p>
                <p className="text-xs text-zinc-550 dark:text-zinc-400 truncate w-32">
                  {currentUser ? currentUser.email : 'dharmik@taraflow.ai'}
                </p>
              </div>
            </div>
            <button className="h-8 w-8 rounded-lg flex items-center justify-center text-zinc-400 hover:bg-zinc-900 hover:text-red-400 transition-colors">
              <LogOut className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
