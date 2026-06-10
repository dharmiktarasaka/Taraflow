import 'dotenv/config';
import dns from 'dns';
import mongoose from 'mongoose';
import Post from '../models/post.model.js';
import Analytics from '../models/analytics.model.js';
import PostAnalyticsSnapshot from '../models/postAnalyticsSnapshot.model.js';

dns.setServers(['8.8.8.8', '8.8.4.4']);

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected successfully');

    // Delete all posts (both mock posts and legacy posts with mock metrics)
    const postRes = await Post.deleteMany({});
    console.log(`Deleted ${postRes.deletedCount} posts.`);

    // Delete all daily analytics trend records
    const analyticsRes = await Analytics.deleteMany({});
    console.log(`Deleted ${analyticsRes.deletedCount} daily analytics records.`);

    // Delete all post snapshots
    const snapshotRes = await PostAnalyticsSnapshot.deleteMany({});
    console.log(`Deleted ${snapshotRes.deletedCount} post snapshots.`);

    await mongoose.connection.close();
    console.log('Database cleanup completed successfully.');
  } catch (err) {
    console.error('Cleanup failed:', err);
  }
};
run();
