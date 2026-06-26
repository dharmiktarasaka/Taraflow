import React, { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { RefreshCw, AlertTriangle, CheckCircle } from 'lucide-react';
import socialService from '../services/socialService';

const PLATFORM_LABELS = {
  facebook: 'Facebook Page',
  instagram: 'Instagram Business',
  threads: 'Threads',
  linkedin: 'LinkedIn',
};

const decodeOAuthError = (text) => {
  if (!text) return '';
  let decoded = text;
  try {
    decoded = decodeURIComponent(text.replace(/\+/g, ' '));
  } catch {
    decoded = text;
  }
  return decoded
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
};

const getPlatformErrorDetail = (platform, rawDetail) => {
  const detail = decodeOAuthError(rawDetail);
  const redirectUri = `${window.location.origin}/social/callback/${platform}`;

  if (platform === 'linkedin') {
    if (
      detail.includes('r_member_social')
      || detail.includes('not authorized')
      || detail.includes('unauthorized_scope')
      || detail.includes('Invalid scope')
    ) {
      return `LinkedIn rejected a requested permission. In the LinkedIn Developer Portal, open your app → Products and add "Share on LinkedIn" and "Sign In with LinkedIn using OpenID Connect". Under Auth, add this redirect URI exactly: ${redirectUri}`;
    }
    if (
      detail.includes('redirect uri')
      || detail.includes('redirect_uri')
      || detail.includes('authorization code')
      || detail.includes('code verifier')
    ) {
      return `OAuth redirect mismatch. In your LinkedIn app Auth tab, add this redirect URI exactly: ${redirectUri}. Then disconnect and connect again (do not refresh this page).`;
    }
    return detail || `Add ${redirectUri} to your LinkedIn app redirect URLs and ensure "Share on LinkedIn" is enabled.`;
  }

  return detail || 'Ensure your app credentials are correct and the redirect URI is whitelisted.';
};

const SocialCallback = () => {
  const { platform } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [status, setStatus] = useState('processing');
  const [errorMessage, setErrorMessage] = useState('');
  const [errorDetail, setErrorDetail] = useState('');
  const processedRef = useRef(false);

  useEffect(() => {
    if (processedRef.current) return;
    processedRef.current = true;

    const code = searchParams.get('code');
    const errorParam = searchParams.get('error');
    const errorReason = searchParams.get('error_reason');
    const errorDescription = searchParams.get('error_description');

    if (errorParam) {
      setStatus('error');
      setErrorMessage(`Authorization denied by ${platform}.`);
      setErrorDetail(getPlatformErrorDetail(platform, errorDescription || errorReason));
      return;
    }

    if (!code) {
      setStatus('error');
      setErrorMessage('Authorization code not returned.');
      setErrorDetail('The social platform did not return an authorization code. Please try connecting again.');
      return;
    }

    const verifyCallback = async () => {
      try {
        await socialService.callback(platform, code);
        setStatus('success');
        setTimeout(() => {
          navigate('/social-accounts');
        }, 2000);
      } catch (err) {
        setStatus('error');
        const msg = err.response?.data?.message || 'Failed to complete OAuth verification.';
        setErrorMessage(msg);
        setErrorDetail(getPlatformErrorDetail(platform, err.response?.data?.message));
      }
    };

    verifyCallback();
  }, [platform, searchParams, navigate]);

  const platformLabel = PLATFORM_LABELS[platform] || platform;

  return (
    <div className="min-h-[400px] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-zinc-900/40 border border-zinc-800/80 p-8 rounded-2xl text-center">
        {status === 'processing' && (
          <div className="space-y-4">
            <RefreshCw className="h-12 w-12 text-indigo-500 animate-spin mx-auto" />
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-white capitalize">
              Connecting {platformLabel}
            </h2>
            <p className="text-zinc-400 text-sm">
              Exchanging authorization code for access tokens...
            </p>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-4">
            <CheckCircle className="h-12 w-12 text-emerald-400 mx-auto" />
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">
              Connected!
            </h2>
            <p className="text-zinc-400 text-sm">
              {platformLabel} linked to your workspace. Redirecting...
            </p>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-6">
            <AlertTriangle className="h-12 w-12 text-rose-500 mx-auto" />
            <div>
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-white capitalize">
                Connection Failed
              </h2>
              <p className="text-rose-400/80 text-sm mt-2">{errorMessage}</p>
              {errorDetail && (
                <p className="text-zinc-500 text-xs mt-2 max-w-sm mx-auto">{errorDetail}</p>
              )}
            </div>
            <button
              onClick={() => navigate('/social-accounts')}
              className="w-full py-2.5 bg-zinc-950 border border-zinc-800 hover:border-zinc-700 text-zinc-300 rounded-xl text-sm font-semibold transition-all cursor-pointer"
            >
              Back to Channels
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SocialCallback;
