import SocialAccount from '../models/socialAccount.model.js';
import { decrypt } from '../utils/encryption.js';
import { SocialApiError } from '../utils/errors.util.js';
import logger from '../utils/logger.util.js';

class PostPublisherService {
  async publish(post) {
    const { platform, content, media, createdBy } = post;

    const account = await SocialAccount.findOne({
      user: createdBy,
      platform,
    });

    if (!account) {
      throw new SocialApiError(`No connected ${platform} account found. Connect one in Social Accounts first.`);
    }

    const token = decrypt(account.accessToken);
    if (!token) {
      throw new SocialApiError(`Failed to decrypt access token for ${platform}. Reconnect your account.`);
    }

    logger.info(`[Publisher] Publishing post ${post._id} to ${platform} (${account.platformUsername})`);

    try {
      let platformPostId;

      switch (platform) {
        case 'facebook':
          platformPostId = await this.publishToFacebook(content, media, account.platformAccountId, token);
          break;
        case 'instagram':
          platformPostId = await this.publishToInstagram(content, media, account.platformAccountId, token);
          break;
        case 'threads':
          platformPostId = await this.publishToThreads(content, media, account.platformAccountId, token);
          break;
        case 'linkedin':
          platformPostId = await this.publishToLinkedin(content, media, account.platformAccountId, token);
          break;
        case 'pinterest':
          platformPostId = await this.publishToPinterest(content, media, account.platformAccountId, token);
          break;
        case 'google_business':
          platformPostId = await this.publishToGoogleBusiness(content, media, account.platformAccountId, token);
          break;
        default:
          throw new SocialApiError(`Unsupported platform publisher: ${platform}`);
      }

      return { success: true, platformPostId };
    } catch (err) {
      logger.error(`[Publisher] Failed to publish post ${post._id} to ${platform}: ${err.message}`);
      throw err;
    }
  }

  async publishToFacebook(content, media, pageId, token) {
    const hasMedia = media && media.length > 0 && media[0].url;
    const mediaItem = media && media[0];
    let endpoint, body;

    if (hasMedia && mediaItem.type === 'image') {
      endpoint = `https://graph.facebook.com/v19.0/${pageId}/photos`;
      body = { caption: content, url: mediaItem.url };
    } else if (hasMedia && mediaItem.type === 'video') {
      endpoint = `https://graph.facebook.com/v19.0/${pageId}/videos`;
      body = { description: content, file_url: mediaItem.url };
    } else {
      endpoint = `https://graph.facebook.com/v19.0/${pageId}/feed`;
      body = { message: content };
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    }).then(res => res.json());

    if (response.error) throw new SocialApiError(`Facebook API error: ${response.error.message}`);
    return response.id || response.post_id;
  }

  async publishToInstagram(content, media, igUserId, token) {
    const hasMedia = media && media.length > 0 && media[0].url;
    if (!hasMedia) {
      throw new SocialApiError('Instagram requires an image or video to publish.');
    }

    const mediaItem = media[0];
    const isVideo = mediaItem.type === 'video';

    const containerBody = {
      image_url: !isVideo ? mediaItem.url : undefined,
      video_url: isVideo ? mediaItem.url : undefined,
      media_type: isVideo ? 'REELS' : undefined,
      caption: content,
    };

    const containerRes = await fetch(`https://graph.facebook.com/v19.0/${igUserId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(containerBody),
    }).then(res => res.json());

    if (containerRes.error) throw new SocialApiError(`Instagram container error: ${containerRes.error.message}`);

    const publishRes = await fetch(`https://graph.facebook.com/v19.0/${igUserId}/media_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ creation_id: containerRes.id }),
    }).then(res => res.json());

    if (publishRes.error) throw new SocialApiError(`Instagram publish error: ${publishRes.error.message}`);
    return publishRes.id;
  }

  async publishToThreads(content, media, threadsUserId, token) {
    const hasMedia = media && media.length > 0 && media[0].url;
    const mediaItem = media && media[0];

    let containerBody;
    if (hasMedia && mediaItem.type === 'image') {
      containerBody = {
        media_type: 'IMAGE',
        image_url: mediaItem.url,
        text: content,
      };
    } else {
      containerBody = {
        media_type: 'TEXT',
        text: content,
      };
    }

    const containerRes = await fetch(`https://graph.threads.net/v1.0/${threadsUserId}/threads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(containerBody),
    }).then(res => res.json());

    if (containerRes.error) throw new SocialApiError(`Threads container error: ${containerRes.error.message}`);

    const publishRes = await fetch(`https://graph.threads.net/v1.0/${threadsUserId}/threads_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ creation_id: containerRes.id }),
    }).then(res => res.json());

    if (publishRes.error) throw new SocialApiError(`Threads publish error: ${publishRes.error.message}`);
    return publishRes.id;
  }

  async publishToLinkedin(content, media, authorUrn, token) {
    const hasMedia = media && media.length > 0 && media[0].url;

    const body = {
      author: `urn:li:person:${authorUrn}`,
      commentary: content,
      visibility: 'PUBLIC',
      distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [] },
    };

    if (hasMedia) {
      body.content = { media: { title: 'Post Media', id: media[0].url } };
    }

    const response = await fetch('https://api.linkedin.com/v2/posts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new SocialApiError(`LinkedIn API error: ${errText}`);
    }

    return response.headers.get('x-linkedin-id') || 'linkedin_published';
  }

  async publishToPinterest(content, media, boardId, token) {
    const hasMedia = media && media.length > 0 && media[0].url;
    if (!hasMedia) {
      throw new SocialApiError('Pinterest requires an image or video URL.');
    }

    const body = {
      title: content.substring(0, 100),
      description: content,
      media_source: { source_type: 'image_url', url: media[0].url },
      board_id: boardId,
    };

    const response = await fetch('https://api.pinterest.com/v5/pins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    }).then(res => res.json());

    if (response.error) throw new SocialApiError(`Pinterest API error: ${response.message || response.error}`);
    return response.id;
  }

  async publishToGoogleBusiness(content, media, locationId, token) {
    const hasMedia = media && media.length > 0 && media[0].url;
    const body = { summary: content };

    if (hasMedia) {
      body.media = [{ mediaFormat: 'PHOTO', sourceUrl: media[0].url }];
    }

    const response = await fetch(
      `https://mybusiness.googleapis.com/v4/accounts/me/locations/${locationId}/localPosts`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      }
    ).then(res => res.json());

    if (response.error) throw new SocialApiError(`Google Business API error: ${response.error.message}`);
    return response.name;
  }
}

export const postPublisherServiceInstance = new PostPublisherService();
export default postPublisherServiceInstance;
