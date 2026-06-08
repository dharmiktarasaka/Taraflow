import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  CreditCard, 
  Check, 
  ShieldCheck, 
  Sparkles, 
  AlertCircle, 
  Loader2, 
  Calendar, 
  ArrowUpRight, 
  Download, 
  CheckCircle2,
  ExternalLink,
  Layers,
  HelpCircle
} from 'lucide-react';
import billingService from '../services/billingService';

const planList = [
  { 
    id: 'free', 
    name: 'Free', 
    price: '$0', 
    period: 'forever',
    description: 'Perfect for exploring Taraflow platform features.',
    features: [
      '1 Workspace Profile', 
      '2 Social Channels', 
      '10 AI Generations / mo',
      'Basic Performance Analytics'
    ],
    color: 'from-zinc-500 to-zinc-700'
  },
  { 
    id: 'starter', 
    name: 'Starter', 
    price: '$29', 
    period: 'month',
    description: 'Grow your personal social presence.',
    features: [
      '2 Workspace Profiles', 
      '5 Social Channels', 
      '100 AI Generations / mo',
      'Advanced Calendar Scheduler',
      'Full Standard Analytics'
    ],
    color: 'from-blue-500 to-indigo-600'
  },
  { 
    id: 'professional', 
    name: 'Professional', 
    price: '$79', 
    period: 'month',
    description: 'Ideal for professionals and growing businesses.',
    features: [
      '5 Workspace Profiles', 
      '15 Social Channels', 
      'Unlimited AI Generations', 
      'Interactive AI Carousel Builder', 
      'Competitor Benchmarking',
      'Priority Email Support'
    ],
    color: 'from-violet-500 to-purple-600',
    popular: true
  },
  { 
    id: 'agency', 
    name: 'Agency', 
    price: '$249', 
    period: 'month',
    description: 'Full enterprise grade toolset for teams and agencies.',
    features: [
      'Unlimited Workspace Profiles', 
      'Unlimited Connected Channels', 
      'Custom Brand Brain Profiles',
      'Dedicated LLM Priority Queue', 
      'White-label PDF Reports',
      '24/7 Priority Support & Setup'
    ],
    color: 'from-rose-500 to-pink-600'
  }
];

const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

const Billing = () => {
  const [profile, setProfile] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [gateway, setGateway] = useState('stripe');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Load profile and invoices
  const loadData = async () => {
    try {
      const [profileData, invoicesData] = await Promise.all([
        billingService.getProfile(),
        billingService.getInvoices()
      ]);
      if (profileData && profileData.success) {
        setProfile(profileData.data.user);
      }
      setInvoices(invoicesData || []);
    } catch (err) {
      console.error('Error fetching billing data:', err);
      setErrorMessage('Failed to fetch subscription profile details.');
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      setErrorMessage('');
      
      // Parse search params for return redirect callbacks
      const params = new URLSearchParams(window.location.search);
      const sessionId = params.get('session_id');
      const isMock = params.get('mock');
      const checkoutPlan = params.get('plan');

      if (sessionId) {
        try {
          if (isMock === 'true') {
            await billingService.verifyMockCheckout(sessionId, checkoutPlan || 'professional');
            setSuccessMessage('Checkout mock payment successful! Subscription updated.');
          } else {
            // Stripe webhook or session callback has handled updating the subscription,
            // we will fetch fresh profile details.
            setSuccessMessage('Checkout session successful! Thank you.');
          }
          // Remove query params from address bar
          window.history.replaceState({}, document.title, window.location.pathname);
        } catch (err) {
          console.error('Failed to verify session:', err);
          setErrorMessage('Failed to verify payment checkout session.');
        }
      }

      await loadData();
      setLoading(false);
    };

    init();
  }, []);

  const handleSubscribe = async (planId) => {
    if (planId === 'free') return; // Cannot purchase free plan
    
    setActionLoading(planId);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const response = await billingService.checkout(planId, gateway);

      if (gateway === 'stripe') {
        if (response.checkoutUrl) {
          // Redirect user to Stripe hosted checkout page
          window.location.href = response.checkoutUrl;
        } else {
          throw new Error('Stripe checkout session initialization failed.');
        }
      } else if (gateway === 'razorpay') {
        const loaded = await loadRazorpayScript();
        if (!loaded) {
          throw new Error('Razorpay SDK failed to load. Please check your network connection.');
        }

        if (response.mock) {
          // Development Mock Mode callback for Razorpay
          const mockPayload = {
            razorpay_payment_id: `pay_mock_${Date.now()}`,
            razorpay_subscription_id: response.subscriptionId,
            razorpay_signature: 'mock_signature',
            plan: planId
          };
          await billingService.verifyRazorpay(mockPayload);
          setSuccessMessage(`Mock subscription to ${planId.toUpperCase()} active!`);
          await loadData();
        } else {
          // Real Razorpay modal configuration
          const options = {
            key: response.keyId,
            subscription_id: response.subscriptionId,
            name: response.name,
            description: response.description,
            prefill: {
              email: response.email
            },
            theme: {
              color: '#6366F1'
            },
            handler: async (paymentResponse) => {
              try {
                setActionLoading(planId);
                await billingService.verifyRazorpay({
                  razorpay_payment_id: paymentResponse.razorpay_payment_id,
                  razorpay_subscription_id: paymentResponse.razorpay_subscription_id,
                  razorpay_signature: paymentResponse.razorpay_signature,
                  plan: planId
                });
                setSuccessMessage(`Successfully subscribed to ${planId.toUpperCase()} plan!`);
                await loadData();
              } catch (err) {
                setErrorMessage(err.response?.data?.message || 'Razorpay payment verification failed.');
              } finally {
                setActionLoading(null);
              }
            },
            modal: {
              ondismiss: () => {
                setActionLoading(null);
              }
            }
          };

          const rzp = new window.Razorpay(options);
          rzp.open();
        }
      }
    } catch (err) {
      console.error('Subscription error:', err);
      setErrorMessage(err.response?.data?.message || err.message || 'Payment checkout initialization failed.');
      setActionLoading(null);
    }
  };

  const getActivePlanName = () => {
    if (!profile || !profile.subscription || profile.subscription.status !== 'active') {
      return 'free';
    }
    return profile.subscription.plan;
  };

  const formatRenewalDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4 text-center">
          <Loader2 className="h-10 w-10 text-indigo-500 animate-spin" />
          <p className="text-zinc-500 dark:text-zinc-400 text-sm font-medium">Loading billing account details...</p>
        </div>
      </div>
    );
  }

  const activePlan = getActivePlanName();
  const subscriptionDetails = profile?.subscription;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-8 py-4 max-w-7xl mx-auto"
    >
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-6">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-700 dark:from-white dark:via-zinc-100 dark:to-zinc-400 bg-clip-text text-transparent flex items-center space-x-3">
            <CreditCard className="h-8 w-8 text-indigo-500 shrink-0" />
            <span>Plans & Subscription</span>
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
            Choose the right plan to amplify your social engagement and manage active billing profiles.
          </p>
        </div>
      </div>

      {/* Alert Notifications */}
      {errorMessage && (
        <div className="flex items-center space-x-3 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 p-4 rounded-xl text-sm">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span className="font-medium">{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="flex items-center space-x-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-450 p-4 rounded-xl text-sm animate-fade-in">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span className="font-medium">{successMessage}</span>
        </div>
      )}

      {/* Active Subscription Summary card */}
      <div className="bg-white dark:bg-zinc-900/40 border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl p-6 shadow-sm overflow-hidden relative">
        <div className="absolute top-0 right-0 h-40 w-40 bg-indigo-500/5 dark:bg-indigo-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <span className="text-xs font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-widest block">
              Current Membership
            </span>
            <div className="flex items-center space-x-3">
              <h2 className="text-2xl font-extrabold text-zinc-950 dark:text-white capitalize">
                {activePlan === 'free' ? 'Taraflow Free Account' : `${activePlan} Subscription`}
              </h2>
              {subscriptionDetails?.status === 'active' && (
                <span className="inline-flex items-center rounded-full bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-0.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  Active
                </span>
              )}
            </div>
            
            <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-xl">
              {activePlan === 'free' && 'You are currently on the free version. Unlock brand builder profiles, interactive calendar auto-posting, and custom layouts by upgrading.'}
              {activePlan === 'starter' && 'Your starter tier is perfect for scaling standard channels. Next release processes automatically.'}
              {activePlan === 'professional' && 'Unrestricted AI writing power, competitor tracking, and carousel exports enabled.'}
              {activePlan === 'agency' && 'Elite enterprise infrastructure setup. You have unlimited workspaces, custom brand brain systems, and prioritized support queue.'}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 shrink-0 bg-zinc-50 dark:bg-zinc-900/60 p-4 rounded-xl border border-zinc-200/60 dark:border-zinc-800/60">
            {activePlan !== 'free' && subscriptionDetails ? (
              <div className="space-y-1">
                <div className="text-[10px] font-bold text-zinc-450 dark:text-zinc-500 uppercase tracking-wider">Renewal Date</div>
                <div className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 flex items-center space-x-1.5">
                  <Calendar className="h-4 w-4 text-indigo-400" />
                  <span>{formatRenewalDate(subscriptionDetails.currentPeriodEnd)}</span>
                </div>
                <div className="text-[10px] text-zinc-450 dark:text-zinc-500 mt-1 capitalize">
                  Paid via: <strong className="text-indigo-400 font-bold">{subscriptionDetails.gateway}</strong>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="text-[10px] font-bold text-zinc-450 dark:text-zinc-500 uppercase tracking-wider">Access Tier</div>
                <div className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Limited AI Features</div>
                <span className="text-[10px] text-zinc-500">Upgrade below for full suite capability</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Gateway Selector Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pt-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-950 dark:text-white flex items-center space-x-2">
            <Layers className="h-5 w-5 text-indigo-400" />
            <span>Select Billing Gateway</span>
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-450 mt-1">
            Choose your preferred payment processor prior to checkout. Both support sandbox testing.
          </p>
        </div>

        {/* Gateway Selector Toggles */}
        <div className="flex p-1 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl">
          <button
            type="button"
            onClick={() => setGateway('stripe')}
            className={`flex items-center space-x-2 px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              gateway === 'stripe'
                ? 'bg-white dark:bg-zinc-800 text-indigo-600 dark:text-white shadow-sm'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
            }`}
          >
            <span>Stripe Checkout</span>
          </button>
          <button
            type="button"
            onClick={() => setGateway('razorpay')}
            className={`flex items-center space-x-2 px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              gateway === 'razorpay'
                ? 'bg-white dark:bg-zinc-800 text-indigo-600 dark:text-white shadow-sm'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
            }`}
          >
            <span>Razorpay Payment</span>
          </button>
        </div>
      </div>

      {/* Plans Pricing Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 pt-2">
        {planList.map((plan) => {
          const isCurrent = activePlan === plan.id;
          const isPurchasable = plan.id !== 'free';

          return (
            <div
              key={plan.id}
              className={`bg-white dark:bg-zinc-900/40 border rounded-2xl p-6 flex flex-col justify-between relative transition-all duration-300 ${
                isCurrent 
                  ? 'border-indigo-500 shadow-lg shadow-indigo-550/5 ring-1 ring-indigo-500/50' 
                  : plan.popular 
                  ? 'border-violet-500/40 dark:border-violet-550/30 hover:border-violet-500/80 shadow-md shadow-violet-550/2'
                  : 'border-zinc-200 dark:border-zinc-800/80 hover:border-zinc-300 dark:hover:border-zinc-700/80'
              }`}
            >
              {/* Special Badges */}
              {isCurrent && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center rounded-full bg-indigo-500 border border-indigo-400 px-3 py-0.5 text-[10px] font-black uppercase text-white tracking-widest shadow-md">
                  Active
                </span>
              )}
              {!isCurrent && plan.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center rounded-full bg-violet-550 dark:bg-violet-600 border border-violet-400 px-3 py-0.5 text-[10px] font-black uppercase text-white tracking-widest shadow-md">
                  Best Value
                </span>
              )}

              <div className="space-y-5">
                <div>
                  <h3 className="font-extrabold text-zinc-900 dark:text-white text-lg flex items-center justify-between">
                    <span>{plan.name}</span>
                    {plan.popular && <Sparkles className="h-4.5 w-4.5 text-violet-450 dark:text-violet-400 animate-pulse" />}
                  </h3>
                  <p className="text-zinc-500 dark:text-zinc-450 text-xs mt-1 min-h-[32px] leading-relaxed">
                    {plan.description}
                  </p>
                  
                  <div className="mt-4 flex items-baseline">
                    <span className="text-4xl font-black text-zinc-900 dark:text-white tracking-tight">{plan.price}</span>
                    <span className="text-zinc-400 dark:text-zinc-500 ml-1 text-xs font-semibold">/{plan.period}</span>
                  </div>
                </div>

                {/* Features List */}
                <ul className="space-y-3 border-t border-zinc-100 dark:border-zinc-800/80 pt-4 text-xs text-zinc-600 dark:text-zinc-400">
                  {plan.features.map((feature, fIdx) => (
                    <li key={fIdx} className="flex items-start space-x-2.5">
                      <Check className="h-4 w-4 text-indigo-500 dark:text-indigo-400 shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Action Button */}
              {isCurrent ? (
                <button
                  type="button"
                  disabled
                  className="w-full mt-6 py-2.5 text-xs font-bold rounded-xl border border-zinc-200 dark:border-zinc-850 bg-zinc-50 dark:bg-zinc-900 text-zinc-400 dark:text-zinc-500 cursor-default flex items-center justify-center space-x-2"
                >
                  <CheckCircle2 className="h-4 w-4 text-emerald-450" />
                  <span>Current Subscription</span>
                </button>
              ) : isPurchasable ? (
                <button
                  type="button"
                  disabled={actionLoading !== null}
                  onClick={() => handleSubscribe(plan.id)}
                  className={`w-full mt-6 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center space-x-2 cursor-pointer shadow-sm ${
                    plan.popular
                      ? 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white border-transparent'
                      : 'bg-zinc-900 dark:bg-zinc-800 hover:bg-zinc-850 dark:hover:bg-zinc-700 text-white dark:text-zinc-100 border border-transparent'
                  } disabled:opacity-50`}
                >
                  {actionLoading === plan.id ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-white" />
                      <span>Securing Checkout...</span>
                    </>
                  ) : (
                    <>
                      <span>Upgrade Plan</span>
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  disabled
                  className="w-full mt-6 py-2.5 text-xs font-bold rounded-xl border border-zinc-200 dark:border-zinc-850 bg-zinc-50 dark:bg-zinc-900 text-zinc-450 dark:text-zinc-500 cursor-not-allowed"
                >
                  Standard Base Plan
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Invoice list */}
      <div className="bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-6 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800/80 pb-4">
          <h3 className="font-bold text-zinc-950 dark:text-white text-lg flex items-center space-x-2">
            <ShieldCheck className="h-5 w-5 text-indigo-500 dark:text-indigo-400 shrink-0" />
            <span>Billing History & Invoices</span>
          </h3>
          <span className="text-xs text-zinc-400 dark:text-zinc-500 font-medium">
            {invoices.length} invoices found
          </span>
        </div>

        {invoices.length === 0 ? (
          <div className="text-center py-12 text-zinc-400 dark:text-zinc-500 space-y-2">
            <HelpCircle className="h-10 w-10 mx-auto text-zinc-350 dark:text-zinc-700" />
            <p className="text-sm font-medium">No billing transactions recorded yet.</p>
            <p className="text-xs text-zinc-400 max-w-md mx-auto">
              Any subscription updates and billing transaction logs processed via Stripe or Razorpay will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-850 text-zinc-400 dark:text-zinc-500 text-xs font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Invoice ID</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Gateway</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-850/80 text-zinc-700 dark:text-zinc-350">
                {invoices.map((inv) => (
                  <tr key={inv._id || inv.invoiceId} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/10 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-zinc-950 dark:text-zinc-100">
                      {inv.invoiceId}
                    </td>
                    <td className="py-3.5 px-4 text-xs">
                      {new Date(inv.date || inv.createdAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="capitalize text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-650 dark:text-zinc-300 px-2 py-0.5 rounded border border-zinc-200/50 dark:border-zinc-700/55">
                        {inv.gateway}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-zinc-900 dark:text-zinc-200">
                      {inv.currency === 'inr' ? '₹' : '$'}{inv.amount.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold border ${
                        inv.status === 'paid'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                          : inv.status === 'failed'
                          ? 'bg-rose-500/10 text-red-650 dark:text-red-400 border-rose-500/20'
                          : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                      }`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {inv.receiptUrl ? (
                        <a
                          href={inv.receiptUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center space-x-1 text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 font-bold transition-all"
                        >
                          <span>Receipt</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="text-xs text-zinc-405 dark:text-zinc-550">Not Available</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default Billing;
