import 'dotenv/config';
import dns from 'dns';
import mongoose from 'mongoose';
import Post from '../models/post.model.js';

dns.setServers(['8.8.8.8', '8.8.4.4']);

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected successfully');

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const posts = await Post.find({
      createdAt: { $gte: startOfToday }
    });

    console.log(`Found ${posts.length} posts created today:`);
    posts.forEach(p => {
      console.log(`- ID: ${p._id}`);
      console.log(`  Platform: ${p.platform}`);
      console.log(`  Status: ${p.status}`);
      console.log(`  PlatformPostID: ${p.platformPostId}`);
      console.log(`  Content: ${p.content}`);
      console.log(`  PublishError: ${p.publishError}`);
      console.log('-------------------------');
    });

    await mongoose.connection.close();
  } catch (err) {
    console.error('Error:', err);
    try { await mongoose.connection.close(); } catch (_) {}
  }
};

run();
