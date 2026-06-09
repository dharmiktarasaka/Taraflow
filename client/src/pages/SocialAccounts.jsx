import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Link2, Instagram, Linkedin, Facebook, Globe, Pin, RefreshCw, AlertCircle,
  CheckCircle2, XCircle, User, ExternalLink, Clock, AtSign
} from 'lucide-react';
import socialService from '../services/socialService';

const PLATFORM_METADATA = [
  { name: 'Facebook Page', key: 'facebook', icon: Facebook, color: 'from-blue-600 to-indigo-500', bgLight: 'bg-blue-500/10' },
  { name: 'Instagram Business', key: 'instagram', icon: Instagram, color: 'from-pink-600 to-rose-500', bgLight: 'bg-pink-500/10' },
  { name: 'Threads', key: 'threads', icon: AtSign, color: 'from-zinc-700 to-zinc-500', bgLight: 'bg-zinc-500/10' },
  { name: 'LinkedIn Company', key: 'linkedin', icon: Linkedin, color: 'from-blue-600 to-indigo-500', bgLight: 'bg-blue-500/10' },
  { name: 'Google Business Profile', key: 'google_business', icon: Globe, color: 'from-emerald-600 to-teal-500', bgLight: 'bg-emerald-500/10' },
  { name: 'Pinterest Boards', key: 'pinterest', icon: Pin, color: 'from-red-600 to-rose-500', bgLight: 'bg-red-500/10' },
];

const TOKEN_REFRESHABLE = ['linkedin', 'pinterest', 'google_business'];

const SocialAccounts = () => {
  const [connectedAccounts, setConnectedAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [connectingPlatform, setConnectingPlatform] = useState(null);
  const [confirmingDisconnectId, setConfirmingDisconnectId] = useState(null);
  const [disconnectingId, setDisconnectingId] = useState(null);

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await socialService.getAccounts();
      setConnectedAccounts(response.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch connected social accounts.');
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (platformKey) => {
    setConnectingPlatform(platformKey);
    setError('');
    try {
      const response = await socialService.getConnectUrl(platformKey);
      if (response.success && response.data?.authUrl) {
        window.location.href = response.data.authUrl;
      } else {
        throw new Error('OAuth URL was not generated.');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || `Failed to connect ${platformKey}.`);
      setConnectingPlatform(null);
    }
  };

  const handleReconnect = async (platformKey) => {
    setConnectingPlatform(platformKey);
    setError('');
    try {
      const response = await socialService.reconnectAccount(platformKey);
      if (response.success && response.data?.authUrl) {
        window.location.href = response.data.authUrl;
      } else {
        throw new Error('Reconnect URL was not generated.');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || `Failed to reconnect ${platformKey}.`);
      setConnectingPlatform(null);
    }
  };

  const handleDisconnectClick = (accountId) => {
    if (confirmingDisconnectId === accountId) {
      executeDisconnect(accountId);
    } else {
      setConfirmingDisconnectId(accountId);
      setTimeout(() => {
        setConfirmingDisconnectId((currentId) => (currentId === accountId ? null : currentId));
      }, 3000);
    }
  };

  const executeDisconnect = async (accountId) => {
    setError('');
    setConfirmingDisconnectId(null);
    setDisconnectingId(accountId);
    try {
      await socialService.disconnectAccount(accountId);
      await fetchAccounts();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to disconnect.');
    } finally {
      setDisconnectingId(null);
    }
  };

  const formatExpiry = (dateStr) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    const now = new Date();
    const daysLeft = Math.ceil((date - now) / (1000 * 60 * 60 * 24));
    if (daysLeft < 0) return 'Expired';
    if (daysLeft === 0) return 'Expires today';
    if (daysLeft === 1) return 'Expires tomorrow';
    return `Expires in ${daysLeft} days`;
  };

  if (loading && connectedAccounts.length === 0) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4 text-center">
          <RefreshCw className="h-8 w-8 text-indigo-500 animate-spin" />
          <p className="text-zinc-500 dark:text-zinc-400 text-sm font-medium">Loading connected channels...</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 py-4"
    >
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-700 dark:from-white dark:via-zinc-100 dark:to-zinc-400 bg-clip-text text-transparent flex items-center space-x-3">
          <Link2 className="h-8 w-8 text-indigo-400" />
          <span>Connected Channels</span>
        </h1>
        <p className="text-zinc-400 text-sm mt-1">
          Link your social accounts to enable auto-publishing and campaign scheduling.
        </p>
      </div>

      {error && (
        <div className="flex items-center space-x-2.5 bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-xl text-sm">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {PLATFORM_METADATA.map((platform) => {
          const connected = connectedAccounts.find((acc) => acc.platform === platform.key);
          const isConnecting = connectingPlatform === platform.key;
          const isExpired = connected?.status === 'expired';
          const canRefresh = TOKEN_REFRESHABLE.includes(platform.key);
          const isActive = connected && !isExpired;

          return (
            <div
              key={platform.key}
              className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-6 flex flex-col justify-between hover:border-zinc-700/65 hover:bg-zinc-900/45 transition-all min-h-[220px]"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-4">
                  {connected?.profilePicture ? (
                    <div className="h-11 w-11 rounded-xl overflow-hidden shrink-0 border border-zinc-700/50">
                      <img
                        src={connected.profilePicture}
                        alt={connected.platformUsername}
                        className="h-full w-full object-cover"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    </div>
                  ) : (
                    <div className={`h-11 w-11 rounded-xl bg-gradient-to-tr ${platform.color} flex items-center justify-center shadow-lg shadow-indigo-500/5 shrink-0`}>
                      <platform.icon className="h-5 w-5 text-white" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <h3 className="font-bold text-zinc-900 dark:text-white text-base">
                      {platform.name}
                    </h3>
                    {connected ? (
                      <div className="space-y-0.5 mt-0.5">
                        <p className="text-xs text-indigo-400 font-semibold truncate max-w-[160px] flex items-center space-x-1">
                          <User className="h-3 w-3 shrink-0" />
                          <span>{connected.platformUsername}</span>
                        </p>
                        {connected.expiresAt && (
                          <p className={`text-[10px] font-medium flex items-center space-x-1 ${
                            isExpired ? 'text-red-400' : 'text-zinc-500'
                          }`}>
                            <Clock className="h-3 w-3 shrink-0" />
                            <span>{formatExpiry(connected.expiresAt)}</span>
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-zinc-500 mt-0.5">Not connected</p>
                    )}
                  </div>
                </div>

                <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold border shrink-0 ${
                  isActive
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : isExpired
                    ? 'bg-red-500/10 text-red-400 border-red-500/20'
                    : 'bg-zinc-950 text-zinc-500 border-zinc-800'
                }`}>
                  <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${
                    isActive ? 'bg-emerald-400 animate-pulse' :
                    isExpired ? 'bg-red-400' : 'bg-zinc-600'
                  }`} />
                  {isActive ? 'Active' : isExpired ? 'Expired' : 'Offline'}
                </span>
              </div>

              <div className="mt-6 flex justify-between items-center border-t border-zinc-800/50 pt-4">
                <span className="text-xs text-zinc-500 font-bold capitalize">
                  {isActive ? `${platform.key} integrated` : 'not connected'}
                </span>

                <div className="flex items-center space-x-2">
                  {connected ? (
                    <>
                      {isExpired && (
                        <button
                          type="button"
                          disabled={isConnecting}
                          onClick={() => handleReconnect(platform.key)}
                          className="flex items-center space-x-1 px-3 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-500/10 transition-all cursor-pointer disabled:opacity-50"
                        >
                          {isConnecting ? <RefreshCw className="h-3 w-3 animate-spin" /> : <ExternalLink className="h-3 w-3" />}
                          <span>Reconnect</span>
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={disconnectingId === connected._id}
                        onClick={() => handleDisconnectClick(connected._id)}
                        className={`px-3.5 py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                          confirmingDisconnectId === connected._id
                            ? 'border-rose-500/40 bg-rose-500/20 text-rose-400 hover:bg-rose-500/30'
                            : 'border-zinc-800 hover:border-rose-500/35 bg-zinc-950/40 hover:bg-rose-500/10 text-rose-500 dark:text-rose-400'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {disconnectingId === connected._id ? (
                          <span className="flex items-center space-x-1">
                            <RefreshCw className="h-3 w-3 animate-spin mr-1" />
                            <span>Disconnecting...</span>
                          </span>
                        ) : confirmingDisconnectId === connected._id ? (
                          'Confirm?'
                        ) : (
                          'Disconnect'
                        )}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      disabled={isConnecting}
                      onClick={() => handleConnect(platform.key)}
                      className="flex items-center space-x-1 px-3.5 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-500/10 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isConnecting && <RefreshCw className="h-3 w-3 animate-spin mr-1" />}
                      <span>Connect</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
};

export default SocialAccounts;
