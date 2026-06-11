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

    // Find test user ID
    const testAccount = await SocialAccount.findOne({});
    if (!testAccount) {
      console.log('No social accounts found to run test');
      await mongoose.connection.close();
      return;
    }
    const userId = testAccount.user.toString();
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

    console.log('\n--- Seeding metrics first to generate snapshots ---');
    await analyticsControllerInstance.seedMetrics(req, res, (err) => {
      if (err) console.error('Seed metrics error:', err);
    });

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
