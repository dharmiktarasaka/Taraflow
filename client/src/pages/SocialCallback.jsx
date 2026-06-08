import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { RefreshCw, AlertTriangle, CheckCircle } from 'lucide-react';
import socialService from '../services/socialService';

const PLATFORM_LABELS = {
  facebook: 'Facebook Page',
  instagram: 'Instagram Business',
  threads: 'Threads',
  linkedin: 'LinkedIn Company',
  pinterest: 'Pinterest Boards',
  google_business: 'Google Business Profile',
};

const SocialCallback = () => {
  const { platform } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [status, setStatus] = useState('processing');
  const [errorMessage, setErrorMessage] = useState('');
  const [errorDetail, setErrorDetail] = useState('');

  useEffect(() => {
    const code = searchParams.get('code');
    const errorParam = searchParams.get('error');
    const errorReason = searchParams.get('error_reason');
    const errorDescription = searchParams.get('error_description');

    if (errorParam) {
      setStatus('error');
      setErrorMessage(`Authorization denied by ${platform}.`);
      setErrorDetail(errorDescription || errorReason || 'The user cancelled or denied the OAuth permission request.');
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
        setErrorDetail('Ensure your Meta App credentials are correct and the redirect URI is whitelisted.');
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
