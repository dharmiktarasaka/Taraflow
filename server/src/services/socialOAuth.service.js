import { encrypt } from '../utils/encryption.js';
import { SocialApiError } from '../utils/errors.util.js';

const buildAllowedOrigins = () => {
  const origins = new Set([
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ]);

  const clientUrl = process.env.CLIENT_URL?.trim().replace(/\/$/, '');
  if (clientUrl) {
    try {
      origins.add(new URL(clientUrl).origin);
    } catch {
      origins.add(clientUrl);
    }
  }

  const extra = process.env.ALLOWED_OAUTH_ORIGINS?.split(',').map((s) => s.trim().replace(/\/$/, '')).filter(Boolean);
  if (extra) {
    for (const item of extra) {
      try {
        origins.add(new URL(item).origin);
      } catch {
        origins.add(item);
      }
    }
  }

  return origins;
};

const validateRedirectUri = (platform, redirectUri) => {
  if (!redirectUri || typeof redirectUri !== 'string') {
    throw new SocialApiError('Redirect URI is required for OAuth.');
  }

  let parsed;
  try {
    parsed = new URL(redirectUri);
  } catch {
    throw new SocialApiError('Invalid redirect URI format.');
  }

  const expectedPath = `/social/callback/${platform}`;
  if (parsed.pathname !== expectedPath) {
    throw new SocialApiError(`Redirect URI path must be ${expectedPath}`);
  }

  const allowed = buildAllowedOrigins();
  const isDev = process.env.NODE_ENV !== 'production';
  const isLocalNetwork =
    isDev
    && (
      /^192\.168\.\d{1,3}\.\d{1,3}$/.test(parsed.hostname)
      || /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(parsed.hostname)
    );

  if (!allowed.has(parsed.origin) && !isLocalNetwork) {
    throw new SocialApiError(
      `Redirect URI origin "${parsed.origin}" is not allowed. Register it in ALLOWED_OAUTH_ORIGINS on the server.`
    );
  }

  return redirectUri;
};

const resolveRedirectUri = (platform, override) => {
  if (override) {
    return validateRedirectUri(platform, override);
  }

  let redirectUri = process.env[`${platform.toUpperCase()}_REDIRECT_URI`];
  if (!redirectUri) {
    throw new SocialApiError(`Missing ${platform.toUpperCase()}_REDIRECT_URI environment variable.`);
  }

  if (redirectUri.startsWith('/')) {
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    redirectUri = `${clientUrl.replace(/\/$/, '')}${redirectUri}`;
  }

  return redirectUri;
};

const getCredentials = (platform, redirectUriOverride) => {
  // Instagram shares the same Meta App credentials as Facebook.
  // Threads uses its own distinct App ID and Secret.
  const credentialPlatform = platform === 'instagram' ? 'facebook' : platform;
  const prefix = credentialPlatform.toUpperCase();
  const clientId = process.env[`${prefix}_CLIENT_ID`];
  const clientSecret = process.env[`${prefix}_CLIENT_SECRET`];
  const redirectUri = resolveRedirectUri(platform, redirectUriOverride);

  if (!clientId || !clientSecret) {
    throw new SocialApiError(
      `Missing OAuth credentials for ${platform}. Set ${prefix}_CLIENT_ID and ${prefix}_CLIENT_SECRET in your .env file.`
    );
  }

  return { clientId, clientSecret, redirectUri };
};

// LinkedIn deprecated r_member_social; posting uses w_member_social + OpenID scopes.
const DEPRECATED_LINKEDIN_SCOPES = new Set([
  'r_member_social',
  'r_liteprofile',
  'r_emailaddress',
  'r_basicprofile',
]);

const REQUIRED_LINKEDIN_SCOPES = ['w_member_social', 'openid', 'profile', 'email'];

export const getLinkedinScopes = () => {
  const configured = process.env.LINKEDIN_OAUTH_SCOPE?.trim();
  const rawScopes = configured
    ? configured.split(/[\s,]+/).filter(Boolean)
    : [...REQUIRED_LINKEDIN_SCOPES];

  const scopes = [];
  for (const scope of rawScopes) {
    if (DEPRECATED_LINKEDIN_SCOPES.has(scope)) continue;
    if (!scopes.includes(scope)) scopes.push(scope);
  }

  for (const required of REQUIRED_LINKEDIN_SCOPES) {
    if (!scopes.includes(required)) scopes.push(required);
  }

  return scopes.join(' ');
};

const normalizeLinkedinPersonId = (sub) => {
  if (!sub) return sub;
  const prefix = 'urn:li:person:';
  return sub.startsWith(prefix) ? sub.slice(prefix.length) : sub;
};

export const getAuthUrl = (platform, state, redirectUriOverride) => {
  const { clientId, redirectUri } = getCredentials(platform, redirectUriOverride);
  const encodedRedirect = encodeURIComponent(redirectUri);

  switch (platform) {
    case 'facebook':
      return `https://www.facebook.com/v19.0/dialog/oauth?client_id=${clientId}&redirect_uri=${encodedRedirect}&scope=pages_show_list,pages_read_engagement,pages_manage_posts,business_management,read_insights&state=${state}&auth_type=rerequest`;

    case 'instagram':
      return `https://www.facebook.com/v19.0/dialog/oauth?client_id=${clientId}&redirect_uri=${encodedRedirect}&scope=instagram_basic,instagram_content_publish,instagram_manage_insights,pages_show_list,pages_read_engagement,pages_manage_posts,business_management,read_insights&state=${state}&auth_type=rerequest`;

    case 'threads':
      return `https://www.threads.net/oauth/authorize?client_id=${clientId}&redirect_uri=${encodedRedirect}&scope=threads_basic,threads_content_publish,threads_manage_insights&response_type=code&state=${state}`;

    case 'linkedin':
      const linkedinScope = encodeURIComponent(getLinkedinScopes());
      return `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${clientId}&redirect_uri=${encodedRedirect}&scope=${linkedinScope}&state=${state}`;

    default:
      throw new SocialApiError(`Unsupported platform: ${platform}`);
  }
};

export const exchangeCodeAndFetchProfile = async (platform, code, redirectUriOverride) => {
  switch (platform) {
    case 'facebook':
      return exchangeFacebookCode(code, redirectUriOverride);
    case 'instagram':
      return exchangeInstagramCode(code, redirectUriOverride);
    case 'threads':
      return exchangeThreadsCode(code, redirectUriOverride);
    case 'linkedin':
      return exchangeLinkedinCode(code, redirectUriOverride);
    default:
      throw new SocialApiError(`Unsupported platform: ${platform}`);
  }
};

const exchangeShortForLongLivedToken = async (shortToken, clientId, clientSecret) => {
  const longTokenUrl = `https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${clientId}&client_secret=${clientSecret}&fb_exchange_token=${shortToken}`;
  const longResponse = await fetch(longTokenUrl).then(res => res.json());
  if (longResponse.error) throw new SocialApiError(`Token exchange failed: ${longResponse.error.message}`);
  return longResponse.access_token;
};

const exchangeCodeForShortToken = async (code, clientId, clientSecret, redirectUri) => {
  const tokenUrl = `https://graph.facebook.com/v19.0/oauth/access_token?client_id=${clientId}&client_secret=${clientSecret}&redirect_uri=${encodeURIComponent(redirectUri)}&code=${code}`;
  const response = await fetch(tokenUrl).then(res => res.json());
  if (response.error) throw new SocialApiError(`OAuth code exchange failed: ${response.error.message}`);
  return response.access_token;
};

const exchangeFacebookCode = async (code, redirectUriOverride) => {
  const { clientId, clientSecret, redirectUri } = getCredentials('facebook', redirectUriOverride);

  const shortToken = await exchangeCodeForShortToken(code, clientId, clientSecret, redirectUri);
  const userAccessToken = await exchangeShortForLongLivedToken(shortToken, clientId, clientSecret);

  const accountsUrl = `https://graph.facebook.com/v19.0/me/accounts?fields=id,name,access_token,picture&access_token=${userAccessToken}`;
  const accountsResponse = await fetch(accountsUrl).then(res => res.json());
  console.log('[Facebook OAuth Debug] accountsResponse:', JSON.stringify(accountsResponse));
  if (accountsResponse.error) throw new SocialApiError(`Failed to fetch Facebook Pages: ${accountsResponse.error.message}`);

  const pages = accountsResponse.data || [];
  if (pages.length === 0) {
    throw new SocialApiError('No Facebook Pages found. You must have a Facebook Page to connect.');
  }

  const page = pages[0];

  return {
    platformAccountId: page.id,
    platformUsername: page.name,
    profilePicture: page.picture?.data?.url || '',
    accessToken: encrypt(page.access_token),
    refreshToken: null,
    expiresAt: null,
    metadata: {
      facebookPageId: page.id,
      userAccessToken: encrypt(userAccessToken),
    },
  };
};

const exchangeInstagramCode = async (code, redirectUriOverride) => {
  const { clientId, clientSecret, redirectUri } = getCredentials('instagram', redirectUriOverride);

  const shortToken = await exchangeCodeForShortToken(code, clientId, clientSecret, redirectUri);
  const userAccessToken = await exchangeShortForLongLivedToken(shortToken, clientId, clientSecret);

  const accountsUrl = `https://graph.facebook.com/v19.0/me/accounts?fields=id,name,access_token,instagram_business_account{id,username,name,profile_picture_url}&access_token=${userAccessToken}`;
  const accountsResponse = await fetch(accountsUrl).then(res => res.json());
  if (accountsResponse.error) throw new SocialApiError(`Failed to fetch Facebook Pages: ${accountsResponse.error.message}`);

  const pages = accountsResponse.data || [];
  const pageWithInstagram = pages.find(p => p.instagram_business_account);

  if (!pageWithInstagram) {
    throw new SocialApiError('No Instagram Business Account found. Link an Instagram Business Account to your Facebook Page first.');
  }

  const igAccount = pageWithInstagram.instagram_business_account;

  return {
    platformAccountId: igAccount.id,
    platformUsername: igAccount.username || igAccount.name,
    profilePicture: igAccount.profile_picture_url || '',
    accessToken: encrypt(pageWithInstagram.access_token),
    refreshToken: null,
    expiresAt: null,
    metadata: {
      facebookPageId: pageWithInstagram.id,
      userAccessToken: encrypt(userAccessToken),
    },
  };
};

const exchangeThreadsCode = async (code, redirectUriOverride) => {
  const { clientId, clientSecret, redirectUri } = getCredentials('threads', redirectUriOverride);

  // Exchange code for short-lived token
  const shortTokenUrl = 'https://graph.threads.net/oauth/access_token';
  const shortTokenBody = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
    code,
  });

  const shortResponse = await fetch(shortTokenUrl, {
    method: 'POST',
    body: shortTokenBody,
  }).then(res => res.json());

  if (shortResponse.error) {
    throw new SocialApiError(`Threads code exchange failed: ${shortResponse.error_message || shortResponse.error.message}`);
  }

  const shortToken = shortResponse.access_token;

  // Exchange short-lived token for long-lived token
  const longTokenUrl = `https://graph.threads.net/access_token?grant_type=th_exchange_token&client_secret=${clientSecret}&access_token=${shortToken}`;
  const longResponse = await fetch(longTokenUrl).then(res => res.json());

  if (longResponse.error) {
    throw new SocialApiError(`Threads long-lived token exchange failed: ${longResponse.error_message || longResponse.error.message}`);
  }

  const userAccessToken = longResponse.access_token;
  // Threads long-lived tokens expire in 60 days
  const expiresAt = new Date(Date.now() + (longResponse.expires_in || 60 * 24 * 60 * 60) * 1000);

  const profileUrl = `https://graph.threads.net/v1.0/me?fields=id,username,name,threads_profile_picture_url&access_token=${userAccessToken}`;
  const profile = await fetch(profileUrl).then(res => res.json());
  if (profile.error) throw new SocialApiError(`Failed to fetch Threads profile: ${profile.error.message}`);

  return {
    platformAccountId: profile.id,
    platformUsername: profile.username || profile.name,
    profilePicture: profile.threads_profile_picture_url || '',
    accessToken: encrypt(userAccessToken),
    refreshToken: null,
    expiresAt,
    metadata: {},
  };
};

const exchangeLinkedinCode = async (code, redirectUriOverride) => {
  const { clientId, clientSecret, redirectUri } = getCredentials('linkedin', redirectUriOverride);

  const tokenUrl = 'https://www.linkedin.com/oauth/v2/accessToken';
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  }).then(res => res.json());

  if (response.error) throw new SocialApiError(response.error_description || response.error);

  const accessToken = response.access_token;
  const refreshToken = response.refresh_token;
  const expiresAt = new Date(Date.now() + response.expires_in * 1000);

  const userinfoUrl = 'https://api.linkedin.com/v2/userinfo';
  const profileResponse = await fetch(userinfoUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const profile = await profileResponse.json();

  if (!profileResponse.ok || profile.error) {
    throw new SocialApiError(
      profile.error_description || profile.message || 'Failed to fetch LinkedIn profile after authorization.'
    );
  }

  const personId = normalizeLinkedinPersonId(profile.sub || profile.id);
  const displayName = [profile.given_name, profile.family_name].filter(Boolean).join(' ').trim()
    || profile.name
    || 'LinkedIn User';

  return {
    platformAccountId: personId,
    platformUsername: displayName,
    profilePicture: profile.picture || '',
    accessToken: encrypt(accessToken),
    refreshToken: refreshToken ? encrypt(refreshToken) : null,
    expiresAt,
    metadata: { urn: personId.startsWith('urn:') ? personId : `urn:li:person:${personId}` },
  };
};

