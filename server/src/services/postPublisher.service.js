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
          platformPostId = await this.publishToFacebook(post, account.platformAccountId, token);
          break;
        case 'instagram':
          platformPostId = await this.publishToInstagram(post, account.platformAccountId, token);
          break;
        case 'threads':
          platformPostId = await this.publishToThreads(post, account.platformAccountId, token);
          break;
        case 'linkedin':
          platformPostId = await this.publishToLinkedin(post, account.platformAccountId, token);
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

  async publishToFacebook(post, pageId, token) {
    const { content, media } = post;
    const hasMedia = media && media.length > 0 && media[0].url;
    const mediaItem = media && media[0];
    let endpoint;

    if (hasMedia && mediaItem.type === 'image') {
      endpoint = `https://graph.facebook.com/v19.0/${pageId}/photos`;
      const mediaUrl = mediaItem.url;
      let buffer = null;
      let contentType = null;

      if (mediaUrl.startsWith('data:image/')) {
        const matches = mediaUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          contentType = matches[1];
          buffer = Buffer.from(matches[2], 'base64');
          logger.info(`[Facebook Publisher] Decoded base64 image for binary upload`);
        }
      } else {
        try {
          logger.info(`[Facebook Publisher] Fetching remote media: ${mediaUrl}`);
          const imageRes = await fetch(mediaUrl);
          if (imageRes.ok) {
            contentType = imageRes.headers.get('content-type') || 'image/jpeg';
            const arrayBuffer = await imageRes.arrayBuffer();
            buffer = Buffer.from(arrayBuffer);
          }
        } catch (err) {
          logger.error(`[Facebook Publisher] Failed to fetch remote media for binary upload: ${err.message}`);
        }

        // Retry fetch through public media proxy if direct fetch failed and URL is local
        if (!buffer && (mediaUrl.includes('localhost') || mediaUrl.startsWith('/'))) {
          try {
            const hostUrl = process.env.BACKEND_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:5000';
            const proxyUrl = `${hostUrl}/api/v1/content/posts/${post._id}/media`;
            logger.info(`[Facebook Publisher] Retrying binary fetch through proxy: ${proxyUrl}`);
            const proxyRes = await fetch(proxyUrl);
            if (proxyRes.ok) {
              contentType = proxyRes.headers.get('content-type') || 'image/jpeg';
              const arrayBuffer = await proxyRes.arrayBuffer();
              buffer = Buffer.from(arrayBuffer);
            }
          } catch (proxyErr) {
            logger.error(`[Facebook Publisher] Proxy retry also failed: ${proxyErr.message}`);
          }
        }
      }

      if (buffer) {
        try {
          const formData = new FormData();
          formData.append('caption', content || '');
          const blob = new Blob([buffer], { type: contentType || 'image/jpeg' });
          formData.append('source', blob, 'photo.jpg');

          logger.info(`[Facebook Publisher] Uploading binary media via multipart/form-data`);
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`
            },
            body: formData,
          }).then(res => res.json());

          if (response.error) throw new SocialApiError(`Facebook API error: ${response.error.message}`);
          return response.id || response.post_id;
        } catch (err) {
          logger.warn(`[Facebook Publisher] Multipart upload failed, trying URL fallback: ${err.message}`);
        }
      }

      // URL fallback - use public proxy for data URIs or local URLs
      let fallbackUrl = mediaUrl;
      if (fallbackUrl.startsWith('data:') || fallbackUrl.includes('localhost') || fallbackUrl.startsWith('/')) {
        const hostUrl = process.env.BACKEND_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:5000';
        fallbackUrl = `${hostUrl}/api/v1/content/posts/${post._id}/media`;
        logger.info(`[Facebook Publisher] Using media proxy URL for fallback: ${fallbackUrl}`);
      }

      const body = { caption: content, url: fallbackUrl };
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      }).then(res => res.json());

      if (response.error) throw new SocialApiError(`Facebook API error: ${response.error.message}`);
      return response.id || response.post_id;

    } else if (hasMedia && mediaItem.type === 'video') {
      endpoint = `https://graph.facebook.com/v19.0/${pageId}/videos`;
      let videoUrl = mediaItem.url;
      if (videoUrl.startsWith('data:') || videoUrl.includes('localhost') || videoUrl.startsWith('/')) {
        const hostUrl = process.env.BACKEND_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:5000';
        videoUrl = `${hostUrl}/api/v1/content/posts/${post._id}/media`;
        logger.info(`[Facebook Publisher] Using media proxy URL for video: ${videoUrl}`);
      }
      const body = { description: content, file_url: videoUrl };
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      }).then(res => res.json());

      if (response.error) throw new SocialApiError(`Facebook API error: ${response.error.message}`);
      return response.id || response.post_id;
    } else {
      endpoint = `https://graph.facebook.com/v19.0/${pageId}/feed`;
      const body = { message: content };
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      }).then(res => res.json());

      if (response.error) throw new SocialApiError(`Facebook API error: ${response.error.message}`);
      return response.id || response.post_id;
    }
  }

  async waitInstagramContainerReady(containerId, token) {
    const maxRetries = 20; // 20 attempts * 3s = 60 seconds max wait
    const delayMs = 3000;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        const res = await fetch(`https://graph.facebook.com/v19.0/${containerId}?fields=status_code,status&access_token=${token}`).then(r => r.json());
        if (res && res.status_code) {
          const status = res.status_code;
          logger.info(`[Instagram Publisher] Container ${containerId} status: ${status}`);
          if (status === 'FINISHED') {
            return true;
          }
          if (status === 'ERROR') {
            throw new Error(res.status || 'Failed to process container on Instagram');
          }
        }
      } catch (err) {
        logger.warn(`[Instagram Publisher] Error checking container status: ${err.message}`);
      }
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
    throw new Error('Timeout waiting for Instagram media container to finish processing');
  }

  async publishToInstagram(post, igUserId, token) {
    const { content, media } = post;
    const hasMedia = media && media.length > 0 && media[0].url;
    if (!hasMedia) {
      throw new SocialApiError('Instagram requires an image or video to publish.');
    }

    const mediaItem = media[0];
    const isVideo = mediaItem.type === 'video';
    let mediaUrl = mediaItem.url;

    // Use backend public GET media route for data URIs or local assets
    if (mediaUrl.startsWith('data:') || mediaUrl.includes('localhost') || mediaUrl.startsWith('/')) {
      const hostUrl = process.env.BACKEND_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:5000';
      mediaUrl = `${hostUrl}/api/v1/content/posts/${post._id}/media`;
      logger.info(`[Instagram Publisher] Routed media through public media proxy: ${mediaUrl}`);
    }

    const containerBody = {
      image_url: !isVideo ? mediaUrl : undefined,
      video_url: isVideo ? mediaUrl : undefined,
      media_type: isVideo ? 'REELS' : undefined,
      caption: content,
    };

    const containerRes = await fetch(`https://graph.facebook.com/v19.0/${igUserId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(containerBody),
    }).then(res => res.json());

    if (containerRes.error) throw new SocialApiError(`Instagram container error: ${containerRes.error.message}`);

    // Wait for the container to finish processing (critical for reels/videos and high-res images)
    try {
      logger.info(`[Instagram Publisher] Waiting for container ${containerRes.id} to be ready...`);
      await this.waitInstagramContainerReady(containerRes.id, token);
    } catch (waitErr) {
      throw new SocialApiError(`Instagram container processing failed: ${waitErr.message}`);
    }

    const publishRes = await fetch(`https://graph.facebook.com/v19.0/${igUserId}/media_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ creation_id: containerRes.id }),
    }).then(res => res.json());

    if (publishRes.error) throw new SocialApiError(`Instagram publish error: ${publishRes.error.message}`);
    return publishRes.id;
  }

  async publishToThreads(post, threadsUserId, token) {
    const { content, media } = post;
    const hasMedia = media && media.length > 0 && media[0].url;
    const mediaItem = media && media[0];

    let containerBody;
    if (hasMedia && mediaItem.type === 'image') {
      let mediaUrl = mediaItem.url;
      if (mediaUrl.startsWith('data:') || mediaUrl.includes('localhost') || mediaUrl.startsWith('/')) {
        const hostUrl = process.env.BACKEND_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:5000';
        mediaUrl = `${hostUrl}/api/v1/content/posts/${post._id}/media`;
        logger.info(`[Threads Publisher] Routed media through public media proxy: ${mediaUrl}`);
      }
      containerBody = {
        media_type: 'IMAGE',
        image_url: mediaUrl,
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

  async publishToLinkedin(post, authorUrn, token) {
    const { content, media } = post;
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

    let buffer, contentType;
    if (mediaUrl.startsWith('data:image/')) {
      const matches = mediaUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        contentType = matches[1];
        buffer = Buffer.from(matches[2], 'base64');
        logger.info(`[Publisher] Decoded base64 data URI for LinkedIn upload`);
      } else {
        throw new SocialApiError('Invalid base64 data URI format');
      }
    } else {
      logger.info(`[Publisher] Downloading image binary from: ${mediaUrl}`);
      // Step 2: Download image
      const imageRes = await fetch(mediaUrl);
      if (!imageRes.ok) {
        throw new SocialApiError(`Failed to fetch media from image source: ${imageRes.statusText}`);
      }
      contentType = imageRes.headers.get('content-type') || 'application/octet-stream';
      const arrayBuffer = await imageRes.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    }

    logger.info(`[Publisher] Uploading binary to LinkedIn: ${assetUrn}`);
    // Step 3: Upload binary
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': contentType,
        ...uploadHeaders
      },
      body: buffer
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
