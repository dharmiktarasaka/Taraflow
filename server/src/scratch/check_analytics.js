import 'dotenv/config';
import dns from 'dns';
import mongoose from 'mongoose';
import Analytics from '../models/analytics.model.js';
import SocialAccount from '../models/socialAccount.model.js';

dns.setServers(['8.8.8.8', '8.8.4.4']);

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected successfully');

    const socialAccounts = await SocialAccount.find({});
    console.log(`Total social accounts: ${socialAccounts.length}`);
    socialAccounts.forEach(acc => {
      console.log(`Platform: ${acc.platform}, Username: ${acc.platformUsername || acc.platformAccountId}`);
    });

    const analyticsCount = await Analytics.countDocuments({});
    console.log(`Total analytics records: ${analyticsCount}`);

    const sampleAnalytics = await Analytics.find({}).limit(5);
    console.log('Sample analytics records:', JSON.stringify(sampleAnalytics, null, 2));

    await mongoose.connection.close();
  } catch (err) {
    console.error('Failed:', err);
  }
};
run();
