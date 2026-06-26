import 'dotenv/config';
import dns from 'dns';
import mongoose from 'mongoose';
import Post from '../models/post.model.js';

dns.setServers(['8.8.8.8', '8.8.4.4']);

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected successfully');

    // 1. Restore the user's real post
    const restoreResult = await Post.updateOne(
      { _id: '6a3a4ade870bbd20e169d204' },
      { $set: { status: 'PUBLISHED', publishError: null } }
    );
    console.log('Restore result:', restoreResult);

    // 2. Find any other LinkedIn posts in the database
    const allLinkedinPosts = await Post.find({ platform: 'linkedin' });
    console.log(`\nFound ${allLinkedinPosts.length} total LinkedIn posts in database:`);
    allLinkedinPosts.forEach(p => {
      console.log(`- ID: ${p._id}`);
      console.log(`  Status: ${p.status}`);
      console.log(`  PlatformPostID: ${p.platformPostId}`);
      console.log(`  Content: ${p.content.substring(0, 60)}...`);
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
