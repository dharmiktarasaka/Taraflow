import 'dotenv/config';
import dns from 'dns';
import mongoose from 'mongoose';
import SocialAccount from '../models/socialAccount.model.js';
import Post from '../models/post.model.js';
import Analytics from '../models/analytics.model.js';
import { analyticsControllerInstance } from '../controllers/analytics.controller.js';

dns.setServers(['8.8.8.8', '8.8.4.4']);

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected successfully');

    // 1. Locate test user
    const testAccount = await SocialAccount.findOne({});
    if (!testAccount) {
      console.log('No social accounts found to run test');
      await mongoose.connection.close();
      return;
    }
    const userId = testAccount.user.toString();
    const connectedPlatform = testAccount.platform;
    const disconnectedPlatform = connectedPlatform === 'linkedin' ? 'facebook' : 'linkedin';
    
    console.log(`Test user: ${userId}`);
    console.log(`Connected platform: ${connectedPlatform}`);
    console.log(`Disconnected platform to mock: ${disconnectedPlatform}`);

    // 2. Create dummy Analytics snapshot for the DISCONNECTED platform
    const mockSnapshot = await Analytics.create({
      userId,
      platform: disconnectedPlatform,
      date: new Date(),
      impressions: 999999,
      reach: 888888,
      followers: 777777,
      likes: 66666,
      comments: 5555,
      shares: 444,
      clicks: 33,
      saves: 2,
      videoViews: 1,
      engagementRate: 10
    });
    console.log(`Created mock snapshot for disconnected platform: ${mockSnapshot._id}`);

    // 3. Create dummy published Post for the DISCONNECTED platform
    const mockPost = await Post.create({
      createdBy: userId,
      platform: disconnectedPlatform,
      status: 'PUBLISHED',
      platformPostId: 'mock_strict_mode_disconnected_123',
      content: 'This post is on a disconnected platform and should be ignored.',
      publishedAt: new Date()
    });
    console.log(`Created mock post for disconnected platform: ${mockPost._id}`);

    // 4. Test getOverview
    const reqOverview = {
      user: { id: userId, role: 'USER' },
      query: { platform: 'all', days: 30 }
    };
    let overviewTimeline = [];
    const resOverview = {
      status: (code) => ({
        json: (data) => {
          if (data && data.success) {
            overviewTimeline = data.timeline || [];
            console.log(`getOverview timeline length: ${overviewTimeline.length}`);
            const latest = overviewTimeline[overviewTimeline.length - 1] || {};
            console.log('Latest overview snapshot aggregates:', {
              impressions: latest.impressions,
              reach: latest.reach,
              followers: latest.followers
            });
          }
        }
      })
    };
    console.log('\nRunning getOverview...');
    await analyticsControllerInstance.getOverview(reqOverview, resOverview, (err) => {
      if (err) console.error(err);
    });

    const hasDisconnectedImpressions = overviewTimeline.some(t => t.impressions >= 999999);

    // 5. Test getTopPosts
    const reqTopPosts = {
      user: { id: userId, role: 'USER' },
      query: { platform: 'all', limit: 10 }
    };
    let topPostsList = [];
    const resTopPosts = {
      status: (code) => ({
        json: (data) => {
          if (data && data.success) {
            topPostsList = data.posts || [];
            console.log(`getTopPosts list count: ${topPostsList.length}`);
          }
        }
      })
    };
    console.log('\nRunning getTopPosts...');
    await analyticsControllerInstance.getTopPosts(reqTopPosts, resTopPosts, (err) => {
      if (err) console.error(err);
    });

    const containsDisconnectedPost = topPostsList.some(p => p.id === 'mock_strict_mode_disconnected_123');

    console.log('\n--- VERIFICATION RESULTS ---');
    if (!hasDisconnectedImpressions) {
      console.log('✅ SUCCESS: Graph overview excluded the disconnected platform\'s mock snapshots.');
    } else {
      console.log('❌ FAILURE: Graph overview included the disconnected platform\'s mock snapshots.');
    }

    if (!containsDisconnectedPost) {
      console.log('✅ SUCCESS: Top Performing Content excluded the disconnected platform\'s post.');
    } else {
      console.log('❌ FAILURE: Top Performing Content included the disconnected platform\'s post.');
    }

    // 6. Clean up
    await Analytics.deleteOne({ _id: mockSnapshot._id });
    await Post.deleteOne({ _id: mockPost._id });
    console.log('\nCleaned up mock data.');

    await mongoose.connection.close();
    console.log('Done.');
  } catch (err) {
    console.error('Test run failed:', err);
    try { await mongoose.connection.close(); } catch (_) {}
  }
};

run();
