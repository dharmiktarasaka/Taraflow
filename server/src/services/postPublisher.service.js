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
    let assetUrn = null;

    if (hasMedia) {
      try {
        assetUrn = await this.registerAndUploadLinkedinMedia(media[0].url, authorUrn, token);
      } catch (uploadErr) {
        logger.error(`[Publisher] LinkedIn media registration/upload failed: ${uploadErr.message}`);
        throw uploadErr;
      }
    }

    const body = {
      author: `urn:li:person:${authorUrn}`,
      commentary: content,
      visibility: 'PUBLIC',
      lifecycleState: 'PUBLISHED',
      distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [] },
    };

    if (assetUrn) {
      const postImageUrn = assetUrn.replace('urn:li:digitalmediaAsset:', 'urn:li:image:');
      body.content = { media: { title: 'Post Media', id: postImageUrn } };
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

  async registerAndUploadLinkedinMedia(mediaUrl, authorUrn, token) {
    logger.info(`[Publisher] Registering LinkedIn media asset for: ${mediaUrl}`);
    
    // Step 1: Register upload
    const registerResponse = await fetch('https://api.linkedin.com/v2/assets?action=registerUpload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'X-Restli-Protocol-Version': '2.0.0'
      },
      body: JSON.stringify({
        registerUploadRequest: {
          recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
          owner: `urn:li:person:${authorUrn}`,
          serviceRelationships: [
            {
              relationshipType: 'OWNER',
              identifier: 'urn:li:userGeneratedContent'
            }
          ]
        }
      })
    });

    if (!registerResponse.ok) {
      const errText = await registerResponse.text();
      throw new SocialApiError(`LinkedIn registerUpload error: ${errText}`);
    }

    const registerData = await registerResponse.json();
    logger.info(`[Publisher] registerData: ${JSON.stringify(registerData)}`);
    const uploadMechanism = registerData.value?.uploadMechanism?.['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'];
    const uploadUrl = uploadMechanism?.uploadUrl;
    const uploadHeaders = uploadMechanism?.headers || {};
    const assetUrn = registerData.value?.asset;

    if (!uploadUrl || !assetUrn) {
      throw new SocialApiError('Failed to parse LinkedIn media upload details');
    }

    logger.info(`[Publisher] Downloading image binary from: ${mediaUrl}`);
    // Step 2: Download image
    const imageRes = await fetch(mediaUrl);
    if (!imageRes.ok) {
      throw new SocialApiError(`Failed to fetch media from image source: ${imageRes.statusText}`);
    }
    const buffer = await imageRes.arrayBuffer();

    logger.info(`[Publisher] Uploading binary to LinkedIn: ${assetUrn}`);
    // Step 3: Upload binary
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': imageRes.headers.get('content-type') || 'application/octet-stream',
        ...uploadHeaders
      },
      body: Buffer.from(buffer)
    });

    if (!uploadResponse.ok) {
      const errText = await uploadResponse.text();
      throw new SocialApiError(`LinkedIn media upload binary error: ${errText}`);
    }

    logger.info(`[Publisher] LinkedIn media upload successful: ${assetUrn}`);
    return assetUrn;
  }

}

export const postPublisherServiceInstance = new PostPublisherService();
export default postPublisherServiceInstance;
