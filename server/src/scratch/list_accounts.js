import 'dotenv/config';
import dns from 'dns';
import mongoose from 'mongoose';
import SocialAccount from '../models/socialAccount.model.js';

dns.setServers(['8.8.8.8', '8.8.4.4']);

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const accounts = await SocialAccount.find({});
    console.log(accounts.map(a => ({ platform: a.platform, username: a.platformUsername, id: a.platformAccountId })));
    await mongoose.connection.close();
  } catch (err) {
    console.error(err);
  }
};
run();
