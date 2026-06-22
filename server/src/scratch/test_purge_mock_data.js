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

    // Find or create test user and account
    let testAccount = await SocialAccount.findOne({});
    let createdTempAccount = false;
    let userId;

    if (!testAccount) {
      console.log('Creating a temporary user and Instagram account for self-contained testing...');
      const tempUserId = new mongoose.Types.ObjectId();
      userId = tempUserId.toString();
      testAccount = await SocialAccount.create({
        user: tempUserId,
        platform: 'instagram',
        platformAccountId: '17841446039543927',
        platformUsername: 'temp.test.user',
        accessToken: '5686a200dfca6d3a83b9aad7fff40803:71aab9bdcec8647bb3916ab8f179e3c4' // dummy encrypted token
      });
      createdTempAccount = true;
    } else {
      userId = testAccount.user.toString();
    }
    console.log(`Using test userId: ${userId}`);

    const req = {
      user: { id: userId },
      query: {}
    };

    let responseData = null;
    const res = {
      status: (code) => {
        return {
          json: (data) => {
            responseData = data;
          }
        };
      }
    };

    console.log('\n--- Running seedMetrics (Manual Sync) ---');
    await analyticsControllerInstance.seedMetrics(req, res, (err) => {
      if (err) console.error('seedMetrics error:', err);
    });

    // Wait 5 seconds to let async sync operations complete
    await new Promise((resolve) => setTimeout(resolve, 5000));

    console.log('\n--- Database Audit ---');

    // 1. Check for mock posts
    const mockPostsCount = await Post.countDocuments({
      createdBy: userId,
      platformPostId: { $regex: /^mock_post_/ }
    });
    console.log(`Mock posts count in database: ${mockPostsCount}`);

    // 2. Check total posts count for user
    const totalPostsCount = await Post.countDocuments({ createdBy: userId });
    console.log(`Total posts count in database: ${totalPostsCount}`);

    // 3. Check for real/mock analytics records
    const analyticsRecordsCount = await Analytics.countDocuments({ userId });
    console.log(`Analytics snapshot records in database: ${analyticsRecordsCount}`);

    if (mockPostsCount === 0) {
      console.log('✅ SUCCESS: 0 mock/dummy posts found in database.');
    } else {
      console.log('❌ ERROR: Dummy/mock posts are still present in database!');
    }

    if (responseData && responseData.success) {
      console.log('✅ SUCCESS: seedMetrics returned success code and message:', responseData.message);
    } else {
      console.log('❌ ERROR: seedMetrics response failed:', responseData);
    }

    if (createdTempAccount) {
      console.log('Cleaning up temporary test user, account, and created analytics records...');
      await SocialAccount.deleteMany({ user: userId });
      await mongoose.model('Analytics').deleteMany({ userId });
    }

    await mongoose.connection.close();
    console.log('\nAudit completed.');
  } catch (err) {
    console.error('Error during audit:', err);
    try {
      await mongoose.connection.close();
    } catch (_) {}
  }
};

run();
