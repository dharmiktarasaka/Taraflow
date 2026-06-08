import { encrypt } from '../utils/encryption.js';
import { SocialApiError } from '../utils/errors.util.js';

const getCredentials = (platform) => {
  const prefix = platform.toUpperCase();
  const clientId = process.env[`${prefix}_CLIENT_ID`];
  const clientSecret = process.env[`${prefix}_CLIENT_SECRET`];
  const redirectUri = process.env[`${prefix}_REDIRECT_URI`];

  if (!clientId || !clientSecret || !redirectUri) {
    throw new SocialApiError(
      `Missing OAuth credentials for ${platform}. Set ${prefix}_CLIENT_ID, ${prefix}_CLIENT_SECRET, and ${prefix}_REDIRECT_URI in your .env file.`
    );
  }

  return { clientId, clientSecret, redirectUri };
};

export const getAuthUrl = (platform, state) => {
  const { clientId, redirectUri } = getCredentials(platform);
  const encodedRedirect = encodeURIComponent(redirectUri);

  switch (platform) {
    case 'facebook':
      return `https://www.facebook.com/v19.0/dialog/oauth?client_id=${clientId}&redirect_uri=${encodedRedirect}&scope=pages_read_engagement,pages_manage_posts&state=${state}`;

    case 'instagram':
      return `https://www.facebook.com/v19.0/dialog/oauth?client_id=${clientId}&redirect_uri=${encodedRedirect}&scope=instagram_basic,instagram_content_publish,pages_read_engagement,pages_manage_posts&state=${state}`;

    case 'threads':
      return `https://www.facebook.com/v19.0/dialog/oauth?client_id=${clientId}&redirect_uri=${encodedRedirect}&scope=threads_basic,threads_content_publish&state=${state}`;

    case 'linkedin':
      return `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${clientId}&redirect_uri=${encodedRedirect}&scope=w_member_social%20openid%20profile%20email&state=${state}`;

    case 'pinterest':
      return `https://www.pinterest.com/oauth/?consumer_id=${clientId}&redirect_uri=${encodedRedirect}&response_type=code&scope=boards:read,pins:read,pins:write&state=${state}`;

    case 'google_business':
      return `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${clientId}&redirect_uri=${encodedRedirect}&scope=https://www.googleapis.com/auth/business.manage&state=${state}&access_type=offline&prompt=consent`;

    default:
      throw new SocialApiError(`Unsupported platform: ${platform}`);
  }
};

export const exchangeCodeAndFetchProfile = async (platform, code) => {
  switch (platform) {
    case 'facebook':
      return exchangeFacebookCode(code);
    case 'instagram':
      return exchangeInstagramCode(code);
    case 'threads':
      return exchangeThreadsCode(code);
    case 'linkedin':
      return exchangeLinkedinCode(code);
    case 'pinterest':
      return exchangePinterestCode(code);
    case 'google_business':
      return exchangeGoogleBusinessCode(code);
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

const exchangeFacebookCode = async (code) => {
  const { clientId, clientSecret, redirectUri } = getCredentials('facebook');

  const shortToken = await exchangeCodeForShortToken(code, clientId, clientSecret, redirectUri);
  const userAccessToken = await exchangeShortForLongLivedToken(shortToken, clientId, clientSecret);

  const accountsUrl = `https://graph.facebook.com/v19.0/me/accounts?fields=id,name,access_token,picture&access_token=${userAccessToken}`;
  const accountsResponse = await fetch(accountsUrl).then(res => res.json());
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

const exchangeInstagramCode = async (code) => {
  const { clientId, clientSecret, redirectUri } = getCredentials('instagram');

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

const exchangeThreadsCode = async (code) => {
  const { clientId, clientSecret, redirectUri } = getCredentials('threads');

  const shortToken = await exchangeCodeForShortToken(code, clientId, clientSecret, redirectUri);
  const userAccessToken = await exchangeShortForLongLivedToken(shortToken, clientId, clientSecret);

  const profileUrl = `https://graph.threads.net/v1.0/me?fields=id,username,name,threads_profile_picture_url&access_token=${userAccessToken}`;
  const profile = await fetch(profileUrl).then(res => res.json());
  if (profile.error) throw new SocialApiError(`Failed to fetch Threads profile: ${profile.error.message}`);

  return {
    platformAccountId: profile.id,
    platformUsername: profile.username || profile.name,
    profilePicture: profile.threads_profile_picture_url || '',
    accessToken: encrypt(userAccessToken),
    refreshToken: null,
    expiresAt: null,
    metadata: {},
  };
};

const exchangeLinkedinCode = async (code) => {
  const { clientId, clientSecret, redirectUri } = getCredentials('linkedin');

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
  const profile = await fetch(userinfoUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  }).then(res => res.json());

  return {
    platformAccountId: profile.sub || profile.id,
    platformUsername: `${profile.given_name} ${profile.family_name}`,
    profilePicture: profile.picture || '',
    accessToken: encrypt(accessToken),
    refreshToken: encrypt(refreshToken),
    expiresAt,
    metadata: { urn: profile.sub },
  };
};

const exchangePinterestCode = async (code) => {
  const { clientId, clientSecret, redirectUri } = getCredentials('pinterest');

  const tokenUrl = 'https://api.pinterest.com/v5/oauth/token';
  const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${authHeader}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  }).then(res => res.json());

  if (response.error) throw new SocialApiError(response.message || response.error);

  const accessToken = response.access_token;
  const refreshToken = response.refresh_token;
  const expiresAt = new Date(Date.now() + response.expires_in * 1000);

  const profileUrl = 'https://api.pinterest.com/v5/user_account';
  const profile = await fetch(profileUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  }).then(res => res.json());

  return {
    platformAccountId: profile.username || 'pinterest_user',
    platformUsername: profile.username || 'Pinterest Profile',
    profilePicture: profile.profile_image || '',
    accessToken: encrypt(accessToken),
    refreshToken: encrypt(refreshToken),
    expiresAt,
    metadata: {},
  };
};

const exchangeGoogleBusinessCode = async (code) => {
  const { clientId, clientSecret, redirectUri } = getCredentials('google_business');

  const tokenUrl = 'https://oauth2.googleapis.com/token';
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

  const userinfoUrl = 'https://www.googleapis.com/oauth2/v3/userinfo';
  const profile = await fetch(userinfoUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  }).then(res => res.json());

  return {
    platformAccountId: profile.sub || profile.id,
    platformUsername: profile.name || 'Google Business',
    profilePicture: profile.picture || '',
    accessToken: encrypt(accessToken),
    refreshToken: encrypt(refreshToken),
    expiresAt,
    metadata: { email: profile.email },
  };
};
