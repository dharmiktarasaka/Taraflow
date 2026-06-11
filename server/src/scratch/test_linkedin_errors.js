import 'dotenv/config';
import dns from 'dns';
import mongoose from 'mongoose';
import SocialAccount from '../models/socialAccount.model.js';
import Post from '../models/post.model.js';
import { analyticsControllerInstance } from '../controllers/analytics.controller.js';
import { aiSuggestionsControllerInstance } from '../controllers/aiSuggestions.controller.js';

dns.setServers(['8.8.8.8', '8.8.4.4']);

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected successfully');

    // Find test user ID
    const testAccount = await SocialAccount.findOne({});
    if (!testAccount) {
      console.log('No social accounts found to run test');
      await mongoose.connection.close();
      return;
    }
    const userId = testAccount.user.toString();
    console.log(`Using test userId: ${userId}`);

    const req = {
      user: { id: userId },
      query: { platform: 'linkedin' },
      params: { id: 'linkedin_post_id' }
    };

    const res = {
      status: (code) => {
        return {
          json: (data) => {
            console.log(`Response status ${code}:`, data);
          }
        };
      }
    };

    console.log('\n--- Testing getOverview with platform=linkedin ---');
    try {
      await analyticsControllerInstance.getOverview(req, res, (err) => {
        if (err) {
          console.log('✅ getOverview threw expected error:', err.message, `(status: ${err.statusCode})`);
        } else {
          console.log('❌ getOverview did not throw error');
        }
      });
    } catch (e) {
      console.log('✅ getOverview threw expected error:', e.message, `(status: ${e.statusCode})`);
    }

    console.log('\n--- Testing getTopPosts with platform=linkedin ---');
    try {
      await analyticsControllerInstance.getTopPosts(req, res, (err) => {
        if (err) {
          console.log('✅ getTopPosts threw expected error:', err.message, `(status: ${err.statusCode})`);
        } else {
          console.log('❌ getTopPosts did not throw error');
        }
      });
    } catch (e) {
      console.log('✅ getTopPosts threw expected error:', e.message, `(status: ${e.statusCode})`);
    }

    console.log('\n--- Testing getPostAnalysis for a LinkedIn post ---');
    try {
      await analyticsControllerInstance.getPostAnalysis(req, res, (err) => {
        if (err) {
          console.log('✅ getPostAnalysis threw expected error:', err.message, `(status: ${err.statusCode})`);
        } else {
          console.log('❌ getPostAnalysis did not throw error');
        }
      });
    } catch (e) {
      console.log('✅ getPostAnalysis threw expected error:', e.message, `(status: ${e.statusCode})`);
    }

    console.log('\n--- Testing getSuggestions with platform=linkedin ---');
    try {
      await aiSuggestionsControllerInstance.getSuggestions(req, res, (err) => {
        if (err) {
          console.log('✅ getSuggestions threw expected error:', err.message, `(status: ${err.statusCode})`);
        } else {
          console.log('❌ getSuggestions did not throw error');
        }
      });
    } catch (e) {
      console.log('✅ getSuggestions threw expected error:', e.message, `(status: ${e.statusCode})`);
    }

    await mongoose.connection.close();
    console.log('\nTesting completed.');
  } catch (err) {
    console.error('Error during testing:', err);
    try {
      await mongoose.connection.close();
    } catch (_) {}
  }
};

run();
