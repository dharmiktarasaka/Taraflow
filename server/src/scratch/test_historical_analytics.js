import 'dotenv/config';
import dns from 'dns';
import mongoose from 'mongoose';
import SocialAccount from '../models/socialAccount.model.js';
import HistoricalAnalytics from '../models/historicalAnalytics.model.js';
import { analyticsControllerInstance } from '../controllers/analytics.controller.js';

dns.setServers(['8.8.8.8', '8.8.4.4']);

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
    console.log(`Using test userId: ${userId}, accountId: ${testAccount._id}`);

    // Clean previous test entries
    await HistoricalAnalytics.deleteMany({ accountId: testAccount._id });

    // Seed mock data for verification
    const now = new Date();
    const records = [];
    
    // Simulate 3 days of followers metric
    // connectionDate is today, so:
    // i=2 (2 days ago) -> isHistorical: true, isAfterConnection: false
    // i=1 (1 day ago) -> isHistorical: true, isAfterConnection: false
    // i=0 (today) -> isHistorical: false, isAfterConnection: true
    for (let i = 2; i >= 0; i--) {
      const metricDate = new Date(now);
      metricDate.setDate(metricDate.getDate() - i);
      metricDate.setHours(12, 0, 0, 0);

      records.push({
        userId: testAccount.user,
        accountId: testAccount._id,
        platform: testAccount.platform,
        metricName: 'followers',
        metricValue: 1000 - i * 10, // 980, 990, 1000
        metricDate,
        source: 'platform_api',
        isHistorical: i > 0,
        isAfterConnection: i === 0,
        rawApiResponse: { test: true }
      });
    }

    for (const r of records) {
      await HistoricalAnalytics.findOneAndUpdate(
        { accountId: r.accountId, metricName: r.metricName, metricDate: r.metricDate },
        { $set: r },
        { upsert: true, new: true }
      );
    }
    console.log('Successfully seeded test records.');

    // Query history endpoint handler
    const req = {
      user: { id: userId, role: 'USER' },
      query: {
        platform: testAccount.platform,
        accountId: testAccount._id.toString(),
        metricName: 'followers'
      }
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

    await analyticsControllerInstance.getHistory(req, res, (err) => {
      if (err) console.error('getHistory error:', err);
    });

    console.log('\n--- API Output ---');
    console.log('Success:', responseData?.success);
    console.log('Connection Date:', responseData?.connectionDate);
    console.log('Timeline Count:', responseData?.data?.length);
    if (responseData?.data) {
      responseData.data.forEach((item, index) => {
        console.log(`[${index}] Date: ${item.metricDate}, Value: ${item.metricValue}, isHistorical: ${item.isHistorical}, isAfterConnection: ${item.isAfterConnection}`);
      });
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
