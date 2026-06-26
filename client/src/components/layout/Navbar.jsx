import React from 'react';
import { Menu, Search, Bell, Sparkles, Sun, Moon } from 'lucide-react';
import { useData } from '../../context/DataContext';

const Navbar = ({ setSidebarOpen, theme, toggleTheme }) => {
  const { currentUser } = useData();

  return (
    <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center justify-between border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md px-6">
      {/* Mobile Toggle & Search */}
      <div className="flex flex-1 items-center space-x-4">
        <button
          type="button"
          className="lg:hidden text-zinc-400 hover:text-white focus:outline-none"
          onClick={() => setSidebarOpen(true)}
        >
          <Menu className="h-6 w-6" />
        </button>

        {/* Global Search */}
        <div className="relative w-full max-w-md hidden md:block">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <Search className="h-4 w-4 text-zinc-500" />
          </div>
          <input
            type="text"
            placeholder="Search campaigns, posts, and analytics..."
            className="w-full rounded-xl border border-zinc-800 bg-zinc-900/30 py-2 pl-10 pr-4 text-sm text-zinc-200 placeholder-zinc-500 focus:border-indigo-500 focus:bg-zinc-900/60 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
          />
        </div>
      </div>

      {/* Header Actions */}
      <div className="flex items-center space-x-4">
        {/* Quick AI Trigger Action */}
        <button className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-xs font-semibold text-white shadow shadow-indigo-500/10 hover:shadow-indigo-500/20 transition-all">
          <Sparkles className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Ask AI</span>
        </button>

        {/* Divider */}
        <span className="h-5 w-px bg-zinc-800 hidden sm:block" />

        {/* Theme Toggler */}
        <button
          type="button"
          onClick={toggleTheme}
          className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 transition-colors cursor-pointer"
          title="Toggle Light/Dark Theme"
        >
          {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
        </button>

        {/* Notifications Icon */}
        <button className="relative rounded-lg p-2 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 transition-colors">
          <Bell className="h-5 w-5" />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-indigo-500 ring-2 ring-zinc-950" />
        </button>

        {/* Quick profile info */}
        <div className="flex items-center space-x-2.5 cursor-pointer group">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-violet-500 to-fuchsia-500 flex items-center justify-center font-bold text-white text-xs">
            {currentUser?.firstName ? currentUser.firstName[0].toUpperCase() : 'U'}
          </div>
          <span className="text-sm font-medium text-zinc-300 group-hover:text-zinc-200 hidden sm:block transition-colors">
            {currentUser ? currentUser.firstName : 'User'}
          </span>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
