import 'dotenv/config';
import dns from 'dns';
import mongoose from 'mongoose';
import SocialAccount from '../models/socialAccount.model.js';
import Post from '../models/post.model.js';
import { analyticsControllerInstance } from '../controllers/analytics.controller.js';

dns.setServers(['8.8.8.8', '8.8.4.4']);

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected successfully');

    // Find or create test account
    let testAccount = await SocialAccount.findOne({});
    let createdAccount = false;
    if (!testAccount) {
      testAccount = await SocialAccount.create({
        user: new mongoose.Types.ObjectId(),
        platform: 'linkedin',
        platformAccountId: 'test_li_acc_id',
        platformUsername: 'Test LinkedIn User',
        accessToken: 'dummy_access_token'
      });
      createdAccount = true;
    }

    const userId = testAccount.user;

    // Create a post that is "published" in the DB
    const testPost = await Post.create({
      createdBy: userId,
      platform: 'linkedin',
      status: 'PUBLISHED',
      platformPostId: 'test_deleted_post_123',
      content: 'This post is deleted on the platform',
      publishedAt: new Date()
    });

    // Create a placeholder post that should be cleaned up immediately
    const placeholderPost = await Post.create({
      createdBy: userId,
      platform: 'linkedin',
      status: 'PUBLISHED',
      platformPostId: 'linkedin_published',
      content: 'This is a placeholder linkedin post',
      publishedAt: new Date()
    });

    console.log('Created test posts in database:', testPost._id, placeholderPost._id);

    // Mock fetchLinkedInFeed to return a feed containing a DIFFERENT post
    // published BEFORE the test post
    const originalFetch = analyticsControllerInstance.fetchLinkedInFeed;
    analyticsControllerInstance.fetchLinkedInFeed = async (platformAccountId, token) => {
      console.log('Intercepted fetchLinkedInFeed');
      return [
        {
          id: 'test_other_post_456',
          content: 'This post is active on the platform',
          platform: 'linkedin',
          publishedAt: new Date(Date.now() - 3600 * 1000), // 1 hour ago
          likes: 5,
          comments: 2,
          shares: 0
        }
      ];
    };

    // Construct mock request for getTopPosts
    const req = {
      user: { id: userId.toString() },
      query: { platform: 'linkedin' }
    };
    const res = {
      status: (code) => ({
        json: (data) => {
          console.log(`getTopPosts responded with status ${code}`);
        }
      })
    };

    console.log('Running getTopPosts...');
    await analyticsControllerInstance.getTopPosts(req, res, (err) => {
      if (err) console.error('getTopPosts middleware error:', err);
    });

    // Check if the post status is updated to FAILED in the DB
    const updatedPost = await Post.findById(testPost._id);
    const updatedPlaceholder = await Post.findById(placeholderPost._id);
    console.log('Updated post status:', updatedPost.status);
    console.log('Updated placeholder status:', updatedPlaceholder.status);

    if (updatedPost.status === 'FAILED' && updatedPlaceholder.status === 'FAILED') {
      console.log('✅ SUCCESS: Both posts successfully updated to FAILED.');
    } else {
      console.log('❌ FAILURE: Statuses are', updatedPost.status, 'and', updatedPlaceholder.status);
    }

    // Clean up
    await Post.deleteMany({ _id: { $in: [testPost._id, placeholderPost._id] } });
    if (createdAccount) {
      await SocialAccount.deleteOne({ _id: testAccount._id });
    }

    // Restore original method
    analyticsControllerInstance.fetchLinkedInFeed = originalFetch;

    await mongoose.connection.close();
    console.log('Test run completed.');
  } catch (err) {
    console.error('Error during test execution:', err);
    try { await mongoose.connection.close(); } catch (_) {}
  }
};

run();
