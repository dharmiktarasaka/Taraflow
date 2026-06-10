import 'dotenv/config';
import dns from 'dns';
import mongoose from 'mongoose';
import SocialAccount from '../models/socialAccount.model.js';
import { analyticsControllerInstance } from '../controllers/analytics.controller.js';
import { decrypt } from '../utils/encryption.js';

dns.setServers(['8.8.8.8', '8.8.4.4']);

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const acc = await SocialAccount.findOne({ platform: 'threads' });
    if (!acc) {
      console.log('No threads account connected');
      await mongoose.connection.close();
      return;
    }
    const token = decrypt(acc.accessToken);
    console.log(`Fetching feed for threads user: ${acc.platformAccountId}`);
    const feed = await analyticsControllerInstance.fetchThreadsFeed(acc.platformAccountId, token);
    console.log('Returned Feed:', feed);
    await mongoose.connection.close();
  } catch (err) {
    console.error(err);
  }
};
run();
