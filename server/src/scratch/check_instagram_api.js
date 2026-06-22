import 'dotenv/config';
import dns from 'dns';
import mongoose from 'mongoose';
import SocialAccount from '../models/socialAccount.model.js';
import { decrypt } from '../utils/encryption.js';

dns.setServers(['8.8.8.8', '8.8.4.4']);

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const igAcc = await SocialAccount.findOne({ platform: 'instagram' });
    if (!igAcc) {
      console.log('No Instagram account found.');
      await mongoose.connection.close();
      return;
    }

    const token = decrypt(igAcc.accessToken);
    console.log(`Instagram platformAccountId: ${igAcc.platformAccountId}`);
    
    // 1. Fetch profile fields
    const profileUrl = `https://graph.facebook.com/v19.0/${igAcc.platformAccountId}?fields=followers_count,username,name&access_token=${token}`;
    console.log(`Fetching profile: ${profileUrl}`);
    const profileRes = await fetch(profileUrl).then(r => r.json());
    console.log('Profile API response:', JSON.stringify(profileRes, null, 2));

    // 2. Fetch daily insights
    const since = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);
    const until = Math.floor(Date.now() / 1000);
    const insightsUrl = `https://graph.facebook.com/v19.0/${igAcc.platformAccountId}/insights?metric=impressions,reach,profile_views,website_clicks,follower_count&period=day&since=${since}&until=${until}&access_token=${token}`;
    console.log(`Fetching insights: ${insightsUrl}`);
    const insightsRes = await fetch(insightsUrl).then(r => r.json());
    console.log('Insights API response (first 2 metrics summary):');
    if (insightsRes.data) {
      insightsRes.data.forEach(metric => {
        console.log(`- Metric: ${metric.name}, Period: ${metric.period}, Values Count: ${metric.values ? metric.values.length : 0}`);
        if (metric.values && metric.values.length > 0) {
          console.log(`  Sample value:`, metric.values[metric.values.length - 1]);
        }
      });
    } else {
      console.log('No data returned or error:', JSON.stringify(insightsRes, null, 2));
    }

    await mongoose.connection.close();
  } catch (err) {
    console.error(err);
  }
};
run();
