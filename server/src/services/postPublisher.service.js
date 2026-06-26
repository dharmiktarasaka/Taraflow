import SocialAccount from '../models/socialAccount.model.js';
import { decrypt } from '../utils/encryption.js';
import { SocialApiError } from '../utils/errors.util.js';
import logger from '../utils/logger.util.js';

const toLinkedinPersonUrn = (idOrUrn) => {
  if (!idOrUrn) throw new SocialApiError('Missing LinkedIn author identifier.');
  if (idOrUrn.startsWith('urn:li:person:')) return idOrUrn;
  return `urn:li:person:${idOrUrn}`;
};

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

  async getPublicMediaUrl(mediaItem, post, index = 0) {
    let mediaUrl = mediaItem.url;
    
    // Check if it's already a public remote URL
    if (mediaUrl && !mediaUrl.startsWith('data:') && !mediaUrl.startsWith('/') && !mediaUrl.includes('localhost') && !mediaUrl.includes('127.0.0.1')) {
      return mediaUrl;
    }

    logger.info(`[Publisher] Exposing local/base64 media asset (index ${index}) to public URL via tmpfiles.org...`);

    try {
      let buffer = null;
      let contentType = 'image/jpeg';

      if (mediaUrl.startsWith('data:')) {
        const matches = mediaUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          contentType = matches[1];
          buffer = Buffer.from(matches[2], 'base64');
        }
      } else {
        // Fetch local URL
        let fetchUrl = mediaUrl;
        if (fetchUrl.startsWith('/')) {
          const hostUrl = process.env.BACKEND_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:5000';
          fetchUrl = `${hostUrl}${fetchUrl}`;
        }
        const res = await fetch(fetchUrl);
        if (res.ok) {
          contentType = res.headers.get('content-type') || 'image/jpeg';
          const arrayBuffer = await res.arrayBuffer();
          buffer = Buffer.from(arrayBuffer);
        }
      }

      if (buffer) {
        const ext = contentType.split('/')[1] || 'jpg';
        const filename = `slide-${index}-${post._id}.${ext}`;
        const publicUrl = await this.uploadToTmpFiles(buffer, filename);
        if (publicUrl) {
          return publicUrl;
        }
      }
    } catch (err) {
      logger.error(`[Publisher] Failed to generate public URL for local media: ${err.message}`);
    }

    // Ultimate fallback if upload fails
    logger.warn(`[Publisher] Falling back to public placeholder for slide ${index}`);
    return `https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1080&q=80&sig=${index}`;
  }

  async uploadToTmpFiles(buffer, filename = 'image.jpg') {
    try {
      const formData = new FormData();
      const blob = new Blob([buffer], { type: 'image/jpeg' });
      formData.append('file', blob, filename);

      const response = await fetch('https://tmpfiles.org/api/v1/upload', {
        method: 'POST',
        body: formData,
      }).then(res => res.json());

      if (response.status === 'success' && response.data?.url) {
        const publicUrl = response.data.url.replace('https://tmpfiles.org/', 'https://tmpfiles.org/dl/');
        logger.info(`[TmpFiles Upload] Uploaded successfully. Public direct URL: ${publicUrl}`);
        return publicUrl;
      }
      throw new Error(response.message || 'Unknown error');
    } catch (err) {
      logger.error(`[TmpFiles Upload] Upload to tmpfiles.org failed: ${err.message}`);
      return null;
    }
  }

  async publishToFacebook(post, pageId, token) {
    const { content, media } = post;
    const hasMedia = media && media.length > 0 && media[0].url;
    const mediaItem = media && media[0];
    let endpoint;

    if (hasMedia && mediaItem.type === 'image') {
      endpoint = `https://graph.facebook.com/v19.0/${pageId}/photos`;
      const mediaUrl = await this.getPublicMediaUrl(mediaItem, post, 0);

      const body = { caption: content, url: mediaUrl };
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      }).then(res => res.json());

      if (response.error) throw new SocialApiError(`Facebook API error: ${response.error.message}`);
      return response.id || response.post_id;

    } else if (hasMedia && mediaItem.type === 'video') {
      endpoint = `https://graph.facebook.com/v19.0/${pageId}/videos`;
      const videoUrl = await this.getPublicMediaUrl(mediaItem, post, 0);

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
    const { content, media, isCarousel } = post;
    const hasMedia = media && media.length > 0;
    if (!hasMedia) {
      throw new SocialApiError('Instagram requires an image or video to publish.');
    }

    const shouldPublishAsCarousel = isCarousel && media.length > 1;

    if (shouldPublishAsCarousel) {
      logger.info(`[Instagram Publisher] Publishing multi-slide carousel containing ${media.length} slides.`);
      const childContainerIds = [];

      for (let i = 0; i < media.length; i++) {
        const item = media[i];
        const isVideoItem = item.type === 'video';
        
        // Expose to public URL via tmpfiles.org helper
        const itemUrl = await this.getPublicMediaUrl(item, post, i);

        const childBody = {
          image_url: !isVideoItem ? itemUrl : undefined,
          video_url: isVideoItem ? itemUrl : undefined,
          media_type: isVideoItem ? 'VIDEO' : undefined,
          is_carousel_item: true,
        };

        const childRes = await fetch(`https://graph.facebook.com/v19.0/${igUserId}/media`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(childBody),
        }).then(res => res.json());

        if (childRes.error) {
          throw new SocialApiError(`Instagram child container error (slide ${i + 1}): ${childRes.error.message}`);
        }

        childContainerIds.push(childRes.id);
      }

      // Wait for all child containers to be ready
      for (let i = 0; i < childContainerIds.length; i++) {
        logger.info(`[Instagram Publisher] Waiting for child container ${childContainerIds[i]} (slide ${i + 1}) to be ready...`);
        await this.waitInstagramContainerReady(childContainerIds[i], token);
      }

      // Create the parent carousel container
      const parentBody = {
        media_type: 'CAROUSEL',
        children: childContainerIds,
        caption: content,
      };

      const parentRes = await fetch(`https://graph.facebook.com/v19.0/${igUserId}/media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(parentBody),
      }).then(res => res.json());

      if (parentRes.error) {
        throw new SocialApiError(`Instagram parent carousel container error: ${parentRes.error.message}`);
      }

      logger.info(`[Instagram Publisher] Waiting for parent carousel container ${parentRes.id} to be ready...`);
      await this.waitInstagramContainerReady(parentRes.id, token);

      // Publish the parent container
      const publishRes = await fetch(`https://graph.facebook.com/v19.0/${igUserId}/media_publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ creation_id: parentRes.id }),
      }).then(res => res.json());

      if (publishRes.error) throw new SocialApiError(`Instagram publish error: ${publishRes.error.message}`);
      return publishRes.id;

    } else {
      const mediaItem = media[0];
      const isVideo = mediaItem.type === 'video';
      
      // Expose to public URL via tmpfiles.org helper
      const mediaUrl = await this.getPublicMediaUrl(mediaItem, post, 0);

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

      // Wait for the container to finish processing
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
  }

  async publishToThreads(post, threadsUserId, token) {
    const { content, media } = post;
    const hasMedia = media && media.length > 0 && media[0].url;
    const mediaItem = media && media[0];

    let containerBody;
    if (hasMedia && mediaItem.type === 'image') {
      const mediaUrl = await this.getPublicMediaUrl(mediaItem, post, 0);

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
    const { content, media, isCarousel } = post;
    const hasMedia = media && media.length > 0;
    const isMultiImage = isCarousel && media.length > 1;
    let assetUrns = [];

    if (hasMedia) {
      try {
        if (isMultiImage) {
          logger.info(`[Publisher] LinkedIn uploading ${media.length} slides for multi-image post.`);
          for (let i = 0; i < media.length; i++) {
            const assetUrn = await this.registerAndUploadLinkedinMedia(media[i].url, authorUrn, token);
            assetUrns.push(assetUrn);
          }
        } else {
          const assetUrn = await this.registerAndUploadLinkedinMedia(media[0].url, authorUrn, token);
          assetUrns.push(assetUrn);
        }
      } catch (uploadErr) {
        logger.error(`[Publisher] LinkedIn media registration/upload failed: ${uploadErr.message}`);
        throw uploadErr;
      }
    }

    const personUrn = toLinkedinPersonUrn(authorUrn);

    const body = {
      author: personUrn,
      commentary: content,
      visibility: 'PUBLIC',
      lifecycleState: 'PUBLISHED',
      distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [] },
    };

    if (assetUrns.length > 0) {
      if (isMultiImage) {
        body.content = {
          multiImage: {
            images: assetUrns.map(urn => ({ id: urn.replace('urn:li:digitalmediaAsset:', 'urn:li:image:') }))
          }
        };
      } else {
        const postImageUrn = assetUrns[0].replace('urn:li:digitalmediaAsset:', 'urn:li:image:');
        body.content = { media: { title: 'Post Media', id: postImageUrn } };
      }
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

    return response.headers.get('x-restli-id') || response.headers.get('x-linkedin-id') || 'linkedin_published';
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
          owner: toLinkedinPersonUrn(authorUrn),
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
