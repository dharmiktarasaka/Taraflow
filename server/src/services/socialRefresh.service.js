import SocialAccount from '../models/socialAccount.model.js';
import { decrypt, encrypt } from '../utils/encryption.js';
import { SocialApiError } from '../utils/errors.util.js';
import logger from '../utils/logger.util.js';

const TOKEN_REFRESHABLE_PLATFORMS = ['linkedin', 'pinterest', 'google_business'];

export const refreshExpiringTokens = async () => {
  try {
    const threshold = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const expiringAccounts = await SocialAccount.find({
      platform: { $in: TOKEN_REFRESHABLE_PLATFORMS },
      expiresAt: { $lte: threshold },
    });

    if (expiringAccounts.length === 0) return;

    logger.info(`[Token Refresh] Found ${expiringAccounts.length} accounts near expiration.`);

    for (const account of expiringAccounts) {
      await refreshAccountTokens(account);
    }
  } catch (error) {
    logger.error('[Token Refresh Worker] Failed:', error);
  }
};

export const refreshAccountTokens = async (account) => {
  try {
    const refreshToken = decrypt(account.refreshToken);
    if (!refreshToken) {
      logger.warn(`[Token Refresh] No refresh token for ${account.platform} (${account.platformUsername})`);
      return;
    }

    const prefix = account.platform.toUpperCase();
    const clientId = process.env[`${prefix}_CLIENT_ID`];
    const clientSecret = process.env[`${prefix}_CLIENT_SECRET`];

    if (!clientId || !clientSecret) {
      logger.warn(`[Token Refresh] Missing credentials for ${account.platform}`);
      return;
    }

    let newAccessToken, newRefreshToken, expiresIn;

    if (account.platform === 'google_business') {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: clientId,
          client_secret: clientSecret,
        }),
      }).then(res => res.json());

      if (response.error) throw new SocialApiError(response.error_description || response.error);
      newAccessToken = response.access_token;
      newRefreshToken = response.refresh_token || refreshToken;
      expiresIn = response.expires_in;
    } else if (account.platform === 'linkedin') {
      const response = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: clientId,
          client_secret: clientSecret,
        }),
      }).then(res => res.json());

      if (response.error) throw new SocialApiError(response.error_description || response.error);
      newAccessToken = response.access_token;
      newRefreshToken = response.refresh_token || refreshToken;
      expiresIn = response.expires_in;
    } else if (account.platform === 'pinterest') {
      const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
      const response = await fetch('https://api.pinterest.com/v5/oauth/token', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${authHeader}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }),
      }).then(res => res.json());

      if (response.error) throw new SocialApiError(response.message || response.error);
      newAccessToken = response.access_token;
      newRefreshToken = response.refresh_token || refreshToken;
      expiresIn = response.expires_in;
    }

    account.accessToken = encrypt(newAccessToken);
    if (newRefreshToken) {
      account.refreshToken = encrypt(newRefreshToken);
    }
    account.expiresAt = new Date(Date.now() + expiresIn * 1000);
    await account.save();

    logger.info(`[Token Refresh] Refreshed ${account.platform} (${account.platformUsername})`);
  } catch (err) {
    logger.error(`[Token Refresh] Failed ${account.platform} (${account.platformUsername}): ${err.message}`);
  }
};
