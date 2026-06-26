import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Settings, Shield, Bell, Sparkle, Save } from 'lucide-react';
import { useData } from '../context/DataContext';

const SettingsPage = () => {
  const { currentUser } = useData();
  const [profile, setProfile] = useState({
    firstName: '',
    lastName: '',
    email: '',
  });

  useEffect(() => {
    if (currentUser) {
      setProfile({
        firstName: currentUser.firstName || '',
        lastName: currentUser.lastName || '',
        email: currentUser.email || '',
      });
    }
  }, [currentUser]);

  const [password, setPassword] = useState({
    current: '',
    new: '',
    confirm: '',
  });

  const handleProfileSave = (e) => {
    e.preventDefault();
    alert('Profile configurations updated successfully!');
  };

  const handlePasswordSave = (e) => {
    e.preventDefault();
    alert('Security keys updated successfully!');
    setPassword({ current: '', new: '', confirm: '' });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 py-4"
    >
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-700 dark:from-white dark:via-zinc-100 dark:to-zinc-400 bg-clip-text text-transparent flex items-center space-x-3">
          <Settings className="h-8 w-8 text-indigo-400" />
          <span>Global Settings</span>
        </h1>
        <p className="text-zinc-400 text-sm mt-1">
          Adjust profile details, security access tokens, and notifications.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Profile Settings form */}
        <form onSubmit={handleProfileSave} className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-6 space-y-6">
          <h3 className="font-bold text-zinc-900 dark:text-white text-base flex items-center space-x-2">
            <Sparkle className="h-4.5 w-4.5 text-indigo-400" />
            <span>Profile Details</span>
          </h3>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs text-zinc-500 font-bold uppercase tracking-wider mb-2">First Name</label>
              <input
                type="text"
                value={profile.firstName}
                onChange={(e) => setProfile({ ...profile, firstName: e.target.value })}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 py-2.5 px-3 text-sm text-zinc-200 focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 font-bold uppercase tracking-wider mb-2">Last Name</label>
              <input
                type="text"
                value={profile.lastName}
                onChange={(e) => setProfile({ ...profile, lastName: e.target.value })}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 py-2.5 px-3 text-sm text-zinc-200 focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-zinc-500 font-bold uppercase tracking-wider mb-2">Email Address</label>
            <input
              type="email"
              value={profile.email}
              onChange={(e) => setProfile({ ...profile, email: e.target.value })}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 py-2.5 px-3 text-sm text-zinc-200 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            className="flex items-center justify-center space-x-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white rounded-xl shadow cursor-pointer transition-all ml-auto"
          >
            <Save className="h-3.5 w-3.5" />
            <span>Save Changes</span>
          </button>
        </form>

        {/* Security Settings form */}
        <form onSubmit={handlePasswordSave} className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-6 space-y-6">
          <h3 className="font-bold text-zinc-900 dark:text-white text-base flex items-center space-x-2">
            <Shield className="h-4.5 w-4.5 text-indigo-400" />
            <span>Security & Passwords</span>
          </h3>

          <div>
            <label className="block text-xs text-zinc-500 font-bold uppercase tracking-wider mb-2">Current Password</label>
            <input
              type="password"
              value={password.current}
              onChange={(e) => setPassword({ ...password, current: e.target.value })}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 py-2.5 px-3 text-sm text-zinc-200 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs text-zinc-500 font-bold uppercase tracking-wider mb-2">New Password</label>
              <input
                type="password"
                value={password.new}
                onChange={(e) => setPassword({ ...password, new: e.target.value })}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 py-2.5 px-3 text-sm text-zinc-200 focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 font-bold uppercase tracking-wider mb-2">Confirm New Password</label>
              <input
                type="password"
                value={password.confirm}
                onChange={(e) => setPassword({ ...password, confirm: e.target.value })}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 py-2.5 px-3 text-sm text-zinc-200 focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            className="flex items-center justify-center space-x-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white rounded-xl shadow cursor-pointer transition-all ml-auto"
          >
            <Save className="h-3.5 w-3.5" />
            <span>Update Password</span>
          </button>
        </form>
      </div>
    </motion.div>
  );
};

export default SettingsPage;
