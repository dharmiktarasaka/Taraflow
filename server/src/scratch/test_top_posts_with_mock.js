import 'dotenv/config';
import dns from 'dns';
import mongoose from 'mongoose';
import SocialAccount from '../models/socialAccount.model.js';
import Post from '../models/post.model.js';
import { analyticsControllerInstance } from '../controllers/analytics.controller.js';

dns.setServers(['8.8.8.8', '8.8.4.4']);

const testPlatform = async (userId, platformName) => {
  const req = {
    user: { id: userId },
    query: { limit: 10, sortBy: 'engagementRate', platform: platformName }
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

  await analyticsControllerInstance.getTopPosts(req, res, (err) => {
    if (err) console.error('Next error:', err);
  });

  return new Promise((resolve) => {
    setTimeout(() => {
      console.log(`\n--- API RESPONSE FOR platform=${platformName} ---`);
      if (responseData && responseData.posts) {
        console.log(`Returned posts count: ${responseData.posts.length}`);
        let hasMixed = false;
        responseData.posts.forEach(p => {
          console.log(`  - Post ID: ${p.id}, Platform: ${p.platform}, Content: ${p.content.substring(0, 40)}...`);
          if (p.platform !== platformName) {
            hasMixed = true;
          }
        });
        if (hasMixed) {
          console.log(`❌ ERROR: Mixed platform content detected for ${platformName}!`);
        } else {
          console.log(`✅ SUCCESS: Only ${platformName} posts returned.`);
        }
      } else {
        console.log('No posts or error returned:', responseData);
      }
      resolve();
    }, 1000);
  });
};

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected successfully');

    // Find test user ID
    const testAccount = await SocialAccount.findOne({});
    if (!testAccount) {
      console.log('No social accounts found to run test');
      await mongoose.connection.close();
      return;
    }
    const userId = testAccount.user.toString();
    console.log(`Using test userId: ${userId}`);

    // Test each platform in sequence
    await testPlatform(userId, 'instagram');
    await testPlatform(userId, 'facebook');
    await testPlatform(userId, 'threads');
    await testPlatform(userId, 'linkedin');

    await mongoose.connection.close();
    console.log('\nAll tests completed.');
  } catch (err) {
    console.error(err);
  }
};
run();
