import 'dotenv/config';
import dns from 'dns';
import mongoose from 'mongoose';
import SocialAccount from '../models/socialAccount.model.js';
import Analytics from '../models/analytics.model.js';
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

    // Mock Request & Response for seedMetrics
    const seedReq = {
      user: { id: userId }
    };
    let seedResponseData = null;
    const seedRes = {
      status: (code) => ({
        json: (data) => {
          seedResponseData = data;
        }
      })
    };

    console.log('Running seedMetrics...');
    await analyticsControllerInstance.seedMetrics(seedReq, seedRes, (err) => {
      if (err) console.error('Seed next error:', err);
    });

    console.log('Waiting for seed completion...');
    await new Promise((resolve) => setTimeout(resolve, 3000));

    console.log('Seed response:', JSON.stringify(seedResponseData, null, 2));

    const analyticsCount = await Analytics.countDocuments({ userId });
    console.log(`Total daily analytics records generated for user: ${analyticsCount}`);

    // Fetch the overview
    const overviewReq = {
      user: { id: userId },
      query: { platform: 'all', days: 30 }
    };
    let overviewResponseData = null;
    const overviewRes = {
      status: (code) => ({
        json: (data) => {
          overviewResponseData = data;
        }
      })
    };

    console.log('Running getOverview...');
    await analyticsControllerInstance.getOverview(overviewReq, overviewRes, (err) => {
      if (err) console.error('Overview next error:', err);
    });

    await new Promise((resolve) => setTimeout(resolve, 1000));

    if (overviewResponseData) {
      console.log('\n--- OVERVIEW SUMMARY ---');
      console.log(JSON.stringify(overviewResponseData.summary, null, 2));

      console.log('\n--- TIMELINE SAMPLES (First 5 days) ---');
      console.log(JSON.stringify(overviewResponseData.timeline.slice(0, 5), null, 2));

      console.log('\n--- TIMELINE SAMPLES (Last 5 days) ---');
      console.log(JSON.stringify(overviewResponseData.timeline.slice(-5), null, 2));
    } else {
      console.log('No overview response data returned.');
    }

    await mongoose.connection.close();
  } catch (err) {
    console.error(err);
  }
};
run();
