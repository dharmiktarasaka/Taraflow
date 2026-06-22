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

    // Stub the daily insights API methods on the controller instance
    const originalFetchInstagramDailyInsights = analyticsControllerInstance.fetchInstagramDailyInsights;
    const originalFetchFacebookDailyInsights = analyticsControllerInstance.fetchFacebookDailyInsights;

    analyticsControllerInstance.fetchInstagramDailyInsights = async (igUserId, token, since, until) => {
      const mockData = [
        { name: 'impressions', period: 'day', values: [] },
        { name: 'reach', period: 'day', values: [] },
        { name: 'follower_count', period: 'day', values: [] }
      ];
      const now = new Date();
      for (let i = 30; i >= 1; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const isoString = date.toISOString();
        mockData[0].values.push({ value: 100 + i * 5, end_time: isoString });
        mockData[1].values.push({ value: 80 + i * 4, end_time: isoString });
        const change = i % 2 === 0 ? 10 : -15;
        mockData[2].values.push({ value: change, end_time: isoString });
      }
      return mockData;
    };

    analyticsControllerInstance.fetchFacebookDailyInsights = async (pageId, token, since, until) => {
      const mockData = [
        { name: 'page_impressions', period: 'day', values: [] },
        { name: 'page_reach', period: 'day', values: [] },
        { name: 'page_fans', period: 'day', values: [] }
      ];
      const now = new Date();
      for (let i = 30; i >= 1; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const isoString = date.toISOString();
        mockData[0].values.push({ value: 120 + i * 6, end_time: isoString });
        mockData[1].values.push({ value: 90 + i * 5, end_time: isoString });
        const fans = 500 + Math.floor(Math.cos(i * 1.5) * 20);
        mockData[2].values.push({ value: fans, end_time: isoString });
      }
      return mockData;
    };

    console.log('\n--- Seeding metrics first to generate snapshots ---');
    await analyticsControllerInstance.seedMetrics(req, res, (err) => {
      if (err) console.error('Seed metrics error:', err);
    });

    // Restore original controller methods
    analyticsControllerInstance.fetchInstagramDailyInsights = originalFetchInstagramDailyInsights;
    analyticsControllerInstance.fetchFacebookDailyInsights = originalFetchFacebookDailyInsights;

    // Wait a brief moment to ensure seed resolves
    await new Promise((resolve) => setTimeout(resolve, 2000));

    console.log('\n--- Fetching overview analytics ---');
    req.query = { platform: 'instagram', days: 2 };
    await analyticsControllerInstance.getOverview(req, res, (err) => {
      if (err) console.error('getOverview error:', err);
    });

    await new Promise((resolve) => setTimeout(resolve, 2000));

    if (responseData && responseData.timeline) {
      console.log(`\nReturned timeline count for 2 days: ${responseData.timeline.length}`);
      console.log('Sample timeline entries:');
      
      let lastFollowers = null;
      let hasFluctuations = false;
      let ups = 0;
      let downs = 0;

      responseData.timeline.forEach((item, index) => {
        console.log(`  [${index}] Date: ${item.date}, Followers: ${item.followers}, Impressions: ${item.impressions}, Reach: ${item.reach}`);
        
        if (lastFollowers !== null) {
          if (item.followers > lastFollowers) {
            ups++;
          } else if (item.followers < lastFollowers) {
            downs++;
            hasFluctuations = true;
          }
        }
        lastFollowers = item.followers;
      });

      console.log(`\nAnalysis results:`);
      console.log(`  - Total increases: ${ups}`);
      console.log(`  - Total decreases: ${downs}`);

      if (hasFluctuations) {
        console.log(`✅ SUCCESS: Real fluctuations (up AND down movements) detected in historical follower metrics!`);
      } else {
        console.log(`❌ ERROR: No decreases detected in follower metrics. Trend is only monotonic.`);
      }
    } else {
      console.log('No timeline or overview response returned:', responseData);
    }

    if (createdTempAccount) {
      console.log('Cleaning up temporary test user, account, and created analytics records...');
      await SocialAccount.deleteMany({ user: userId });
      await mongoose.model('Analytics').deleteMany({ userId });
    }

    await mongoose.connection.close();
    console.log('\nTesting completed.');
  } catch (err) {
    console.error('Error during testing:', err);
    try {
      await mongoose.connection.close();
    } catch (_) {}
  }
};

run();
