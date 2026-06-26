import 'dotenv/config';
import dns from 'dns';
import mongoose from 'mongoose';
import Post from '../models/post.model.js';

dns.setServers(['8.8.8.8', '8.8.4.4']);

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected successfully');

    const result = await Post.updateMany(
      {
        status: 'PUBLISHED',
        platformPostId: 'linkedin_published'
      },
      {
        $set: {
          status: 'FAILED',
          publishError: 'This post does not have a valid social media platform ID.'
        }
      }
    );

    console.log(`Successfully updated ${result.modifiedCount} placeholder posts to FAILED status.`);

    await mongoose.connection.close();
    console.log('Done.');
  } catch (err) {
    console.error('Error during cleanup:', err);
    try { await mongoose.connection.close(); } catch (_) {}
  }
};

run();
