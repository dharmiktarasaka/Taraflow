import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import Navbar from './Navbar';

const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState(() => {
    // Default to 'light'
    return localStorage.getItem('theme') || 'light';
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex relative overflow-hidden transition-colors duration-250">
      {/* Dynamic Ambient Background Glows */}
      <div className="absolute top-[-10%] left-[-5%] w-[45%] h-[45%] bg-indigo-500/12 rounded-full blur-[130px] pointer-events-none dark:block hidden float-glow-left" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[45%] h-[45%] bg-fuchsia-500/12 rounded-full blur-[130px] pointer-events-none dark:block hidden float-glow-right" />

      {/* Sidebar navigation */}
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      {/* Main content grid */}
      <div className="flex-1 flex flex-col lg:pl-72 min-h-screen">
        {/* Top Navbar */}
        <Navbar setSidebarOpen={setSidebarOpen} theme={theme} toggleTheme={toggleTheme} />

        {/* Dashboard page view wrapper */}
        <main className="flex-1 p-6 md:p-8 overflow-y-auto bg-zinc-950">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
