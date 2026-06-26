import 'dotenv/config';
import dns from 'dns';
import { qwenServiceInstance } from '../services/qwen.service.js';

dns.setServers(['8.8.8.8', '8.8.4.4']);

const run = async () => {
  try {
    console.log('Testing QwenService.generate with type: caption (should route to Gemini 2.5 Flash)...');
    const res = await qwenServiceInstance.generate('caption', {
      topic: 'launching a premium AI social media planner tool',
      platform: 'linkedin',
      tone: 'professional',
      length: 'short',
      emojis: true,
      hashtags: true,
      mediaType: 'none'
    });
    console.log('Result:', res);
  } catch (err) {
    console.error('Error during generation:', err);
  }
};
run();
