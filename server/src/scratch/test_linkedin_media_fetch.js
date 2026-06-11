import 'dotenv/config';
import dns from 'dns';
import mongoose from 'mongoose';
import SocialAccount from '../models/socialAccount.model.js';
import Post from '../models/post.model.js';
import { analyticsControllerInstance } from '../controllers/analytics.controller.js';
import { decrypt } from '../utils/encryption.js';

dns.setServers(['8.8.8.8', '8.8.4.4']);

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected successfully');

    // Always run unit test for the resolver first
    console.log('\nRunning unit test with mocked fetchJson for fetchLinkedInMediaUrl...');
    const originalFetchJson = analyticsControllerInstance.fetchJson;
    analyticsControllerInstance.fetchJson = async (url, options) => {
      console.log(`Mocked fetchJson called for: ${url}`);
      if (url.includes('/v2/images/C560DAQG')) {
        return {
          id: 'urn:li:image:C560DAQG',
          status: 'AVAILABLE',
          downloadUrl: 'https://media.licdn-ei.com/dms/image/mock_resolved_image_url.png'
        };
      }
      return {};
    };

    const mockToken = 'mock_token_xyz';
    const resolvedUrl = await analyticsControllerInstance.fetchLinkedInMediaUrl('urn:li:image:C560DAQG', mockToken);
    console.log(`Resolved URL: ${resolvedUrl}`);
    
    if (resolvedUrl === 'https://media.licdn-ei.com/dms/image/mock_resolved_image_url.png') {
      console.log('✅ SUCCESS: fetchLinkedInMediaUrl resolved the image URN correctly.');
    } else {
      console.log('❌ ERROR: fetchLinkedInMediaUrl failed to resolve correctly.');
    }

    // Restore original fetchJson
    analyticsControllerInstance.fetchJson = originalFetchJson;

    // Find a LinkedIn account if any exists
    const account = await SocialAccount.findOne({ platform: 'linkedin' });
    if (!account) {
      console.log('\nNo LinkedIn accounts connected to test live fetch.');
    } else {
      console.log(`\nFound LinkedIn account for user: ${account.user}. Platform ID: ${account.platformAccountId}`);
      const token = decrypt(account.accessToken);

      console.log('Fetching LinkedIn Feed...');
      const feed = await analyticsControllerInstance.fetchLinkedInFeed(account.platformAccountId, token);
      console.log(`Returned posts count: ${feed.length}`);
      
      feed.forEach(post => {
        console.log(`\n- Post ID: ${post.id}`);
        console.log(`  Caption: ${post.content.substring(0, 50)}...`);
        console.log(`  Media URL: ${post.mediaUrl || 'None'}`);
        console.log(`  Permalink: ${post.permalink}`);
        console.log(`  Likes: ${post.likes}, Comments: ${post.comments}, Shares: ${post.shares}`);
      });
    }

    await mongoose.connection.close();
    console.log('\nTest completed.');
  } catch (err) {
    console.error('Test failed with error:', err);
    try {
      await mongoose.connection.close();
    } catch (_) {}
  }
};

run();
