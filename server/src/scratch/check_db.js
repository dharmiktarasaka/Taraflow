import 'dotenv/config';
import dns from 'dns';
import mongoose from 'mongoose';
import Post from '../models/post.model.js';
import SocialAccount from '../models/socialAccount.model.js';

// Apply Windows DNS SRV resolution workaround
dns.setServers(['8.8.8.8', '8.8.4.4']);

const checkDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected successfully');

    const accounts = await SocialAccount.find({});
    console.log('\n--- CONNECTED ACCOUNTS ---');
    accounts.forEach(acc => {
      console.log(`- Platform: ${acc.platform}, Username: ${acc.platformUsername}, ID: ${acc.platformAccountId}`);
    });

    const posts = await Post.find({});
    console.log('\n--- ALL DATABASE POSTS ---');
    posts.forEach(post => {
      console.log(`- ID: ${post._id}`);
      console.log(`  Platform: ${post.platform}`);
      console.log(`  Content: ${post.content}`);
      console.log(`  PlatformPostID: ${post.platformPostId}`);
      console.log(`  Likes: ${post.likes}, Comments: ${post.comments}, Shares: ${post.shares}`);
      console.log(`  Reach: ${post.reach}, Impressions: ${post.impressions}, ER: ${post.engagementRate}`);
      console.log('-------------------------');
    });

    await mongoose.connection.close();
  } catch (err) {
    console.error('Check failed:', err);
  }
};

checkDatabase();
