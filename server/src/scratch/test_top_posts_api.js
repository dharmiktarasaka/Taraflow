import 'dotenv/config';
import dns from 'dns';
import mongoose from 'mongoose';
import SocialAccount from '../models/socialAccount.model.js';
import { analyticsControllerInstance } from '../controllers/analytics.controller.js';

dns.setServers(['8.8.8.8', '8.8.4.4']);

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected successfully');

    // Find a test user ID from SocialAccounts
    const testAccount = await SocialAccount.findOne({});
    if (!testAccount) {
      console.log('No social accounts found to run test');
      await mongoose.connection.close();
      return;
    }
    const userId = testAccount.user.toString();
    console.log(`Using test userId: ${userId}`);

    // Mock Request & Response for platform='linkedin'
    const req = {
      user: { id: userId },
      query: { limit: 5, sortBy: 'engagementRate', platform: 'linkedin' }
    };

    let responseData = null;
    const res = {
      status: (code) => {
        console.log(`Response status code: ${code}`);
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

    // Wait a brief moment for async controller tasks to complete if any
    setTimeout(async () => {
      console.log('\n--- API RESPONSE FOR platform=linkedin ---');
      console.log(JSON.stringify(responseData, null, 2));
      await mongoose.connection.close();
    }, 2000);

  } catch (err) {
    console.error(err);
  }
};
run();
