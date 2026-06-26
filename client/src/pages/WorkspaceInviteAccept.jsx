import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Shield, Sparkles, KeyRound, Mail, User, Lock, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import workspaceService from '../services/workspaceService';

const WorkspaceInviteAccept = () => {
  const { token } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  
  const [inviteDetails, setInviteDetails] = useState(null);
  const [isNewUser, setIsNewUser] = useState(true);

  // Form Fields
  const [otp, setOtp] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    fetchInviteDetails();
  }, [token]);

  const fetchInviteDetails = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await workspaceService.getInvitation(token);
      if (res && res.success) {
        setInviteDetails(res.invitation);
      } else {
        setError('Invalid or expired invitation token.');
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to verify invitation. It may have expired or been locked.');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (e) => {
    e.preventDefault();
    if (!otp || otp.length !== 6 || isNaN(Number(otp))) {
      setError('Please enter a valid 6-digit OTP verification code.');
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      const payload = { otp };
      if (isNewUser) {
        if (!firstName.trim() || !lastName.trim() || !password) {
          setError('First name, last name, and password are required for new accounts.');
          setSubmitting(false);
          return;
        }
        payload.firstName = firstName.trim();
        payload.lastName = lastName.trim();
        payload.password = password;
      } else {
        if (!password) {
          setError('Please enter your account password to authenticate.');
          setSubmitting(false);
          return;
        }
        payload.password = password;
      }

      const res = await workspaceService.acceptInvitation(token, payload);
      if (res && res.success) {
        setSuccess(true);
        
        // Save token and workspace context
        if (res.tokens?.accessToken) {
          localStorage.setItem('accessToken', res.tokens.accessToken);
        }
        
        if (inviteDetails?.workspaceId) {
          localStorage.setItem('activeWorkspaceId', inviteDetails.workspaceId);
        } else if (res.workspaceId) {
          localStorage.setItem('activeWorkspaceId', res.workspaceId);
        }

        // Redirect to dashboard after a brief delay
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 2000);
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to join workspace. Verify your OTP and password.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-100">
        <div className="text-center space-y-4">
          <Loader2 className="h-10 w-10 text-indigo-500 animate-spin mx-auto" />
          <p className="text-sm text-zinc-400">Verifying secure invitation token...</p>
        </div>
      </div>
    );
  }

  if (error && !inviteDetails) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-100 px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center space-y-6 shadow-xl"
        >
          <div className="h-12 w-12 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl flex items-center justify-center mx-auto">
            <AlertCircle className="h-6 w-6" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-bold text-white">Invitation Verification Failed</h3>
            <p className="text-sm text-zinc-400">{error}</p>
          </div>
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full py-2.5 bg-zinc-850 hover:bg-zinc-800 text-xs font-bold text-zinc-300 rounded-xl border border-zinc-800 transition-colors"
          >
            Go to Home
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-100 px-4 py-12 relative overflow-hidden">
      {/* Ambient background glows */}
      <div className="absolute top-[-10%] left-[-5%] w-[45%] h-[45%] bg-indigo-500/10 rounded-full blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[45%] h-[45%] bg-fuchsia-500/10 rounded-full blur-[130px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg bg-zinc-900/60 border border-zinc-800/80 rounded-3xl p-8 shadow-2xl relative z-10 backdrop-blur-md space-y-6"
      >
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-500/10 text-indigo-400 font-bold text-[10px] uppercase tracking-wider rounded-full border border-indigo-500/25 mb-2">
            <Shield className="h-3.5 w-3.5" /> Secure Team Portal
          </div>
          <h2 className="text-2xl font-black text-white">Join Workspace Collaboration</h2>
          <p className="text-sm text-zinc-405">
            You've been invited by <span className="font-semibold text-zinc-200">{inviteDetails?.inviterName}</span> to join the workspace <span className="font-bold text-indigo-400">{inviteDetails?.workspaceName}</span> as a <span className="font-semibold text-zinc-200">{inviteDetails?.role}</span>.
          </p>
        </div>

        {success ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="p-6 bg-emerald-500/10 border border-emerald-500/25 rounded-2xl text-center space-y-3"
          >
            <CheckCircle className="h-10 w-10 text-emerald-400 animate-bounce mx-auto" />
            <h4 className="font-bold text-white">Invitation Accepted!</h4>
            <p className="text-xs text-zinc-400">Welcome to your team space. Redirecting to dashboard...</p>
          </motion.div>
        ) : (
          <form onSubmit={handleAccept} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Email field (read-only) */}
            <div>
              <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Invited Email Address</label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Mail className="h-4 w-4 text-zinc-650" />
                </div>
                <input
                  type="email"
                  disabled
                  value={inviteDetails?.inviteeEmail || ''}
                  className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl py-2.5 pl-10 pr-4 text-xs text-zinc-500 cursor-not-allowed"
                />
              </div>
            </div>

            {/* User Type Selector */}
            <div className="grid grid-cols-2 gap-2 bg-zinc-950 p-1.5 rounded-xl border border-zinc-850">
              <button
                type="button"
                onClick={() => setIsNewUser(true)}
                className={`py-2 text-xs font-bold rounded-lg transition-all ${isNewUser ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'text-zinc-500'}`}
              >
                Create New Account
              </button>
              <button
                type="button"
                onClick={() => setIsNewUser(false)}
                className={`py-2 text-xs font-bold rounded-lg transition-all ${!isNewUser ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'text-zinc-500'}`}
              >
                Login to Existing
              </button>
            </div>

            {/* New User Fields */}
            {isNewUser && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">First Name</label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <User className="h-4 w-4 text-zinc-600" />
                    </div>
                    <input
                      type="text"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="John"
                      className="w-full bg-zinc-955 border border-zinc-800 rounded-xl py-2 pl-9 pr-4 text-xs text-zinc-200 placeholder-zinc-650 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Last Name</label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <User className="h-4 w-4 text-zinc-600" />
                    </div>
                    <input
                      type="text"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Doe"
                      className="w-full bg-zinc-955 border border-zinc-800 rounded-xl py-2 pl-9 pr-4 text-xs text-zinc-200 placeholder-zinc-650 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Password */}
            <div>
              <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                {isNewUser ? 'Create Password' : 'Enter Password'}
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Lock className="h-4 w-4 text-zinc-600" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-zinc-955 border border-zinc-800 rounded-xl py-2.5 pl-10 pr-4 text-xs text-zinc-200 placeholder-zinc-650 focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            {/* OTP Secure verification */}
            <div>
              <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Secure Verification Code (6-digit OTP)</label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <KeyRound className="h-4 w-4 text-zinc-600" />
                </div>
                <input
                  type="text"
                  maxLength={6}
                  required
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="123456"
                  className="w-full bg-zinc-955 border border-zinc-800 rounded-xl py-2.5 pl-10 pr-4 text-sm font-semibold tracking-wider text-zinc-200 placeholder-zinc-650 focus:border-indigo-500 focus:outline-none text-center"
                />
              </div>
              <p className="text-[9px] text-zinc-500 mt-1">Please enter the 6-digit OTP code sent to your email.</p>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-indigo-600 to-violet-500 hover:from-indigo-500 hover:to-violet-400 text-sm font-semibold text-white rounded-xl shadow-lg shadow-indigo-550/15 cursor-pointer disabled:opacity-50 transition-all"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Joining Workspace...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>Verify OTP & Accept Invite</span>
                </>
              )}
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
};

export default WorkspaceInviteAccept;
