import dotenv from 'dotenv';
import path from 'path';
import competitorIntelligenceServiceInstance from '../services/competitorIntelligence.service.js';

// Load env
dotenv.config({ path: path.resolve('.env') });

async function run() {
  console.log('Testing website scraper on https://example.com...');
  try {
    const res = await competitorIntelligenceServiceInstance.scrapeWebsiteMetadata('https://example.com');
    console.log('Scraper Response:', JSON.stringify(res, null, 2));
    if (res.status === 'online' && res.loadTimeMs > 0 && res.title) {
      console.log('SUCCESS: Website scraper functions correctly.');
    } else {
      console.log('WARNING: Scraper returned incomplete results:', res);
    }
  } catch (err) {
    console.error('Scraper test failed:', err);
  }
}

run();
