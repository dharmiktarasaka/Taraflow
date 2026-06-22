import 'dotenv/config';
import dns from 'dns';
import mongoose from 'mongoose';
import SocialAccount from '../models/socialAccount.model.js';

dns.setServers(['8.8.8.8', '8.8.4.4']);

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const accounts = await SocialAccount.find({});
    console.log(JSON.stringify(accounts, null, 2));
    await mongoose.connection.close();
  } catch (err) {
    console.error(err);
  }
};
run();
