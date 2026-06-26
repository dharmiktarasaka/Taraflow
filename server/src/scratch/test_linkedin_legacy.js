import 'dotenv/config';
import dns from 'dns';
import mongoose from 'mongoose';
import SocialAccount from '../models/socialAccount.model.js';
import { decrypt } from '../utils/encryption.js';

dns.setServers(['8.8.8.8', '8.8.4.4']);

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const account = await SocialAccount.findOne({ platform: 'linkedin' });
  if (!account) {
    console.log('No LinkedIn account found.');
    await mongoose.connection.close();
    return;
  }

  const token = decrypt(account.accessToken);
  const author = `urn:li:person:${account.platformAccountId}`;
  
  console.log(`Testing with author: ${author}`);

  // Test 1: v2/shares
  try {
    const url = `https://api.linkedin.com/v2/shares?q=owners&owners=${encodeURIComponent(author)}&count=50`;
    console.log(`\nCalling Test 1 URL: ${url}`);
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Restli-Protocol-Version': '2.0.0'
      }
    });
    const data = await res.json();
    if (res.ok && !data.error) {
      console.log('✅ Test 1 Success! Shares fetched:', data.elements?.length || 0);
      if (data.elements && data.elements.length > 0) {
        console.log('First share sample:', JSON.stringify(data.elements[0], null, 2));
      }
    } else {
      console.log('❌ Test 1 Failed:', data.message || data.error?.message || res.statusText);
    }
  } catch (err) {
    console.error('Test 1 error:', err.message);
  }

  // Test 2: v2/ugcPosts
  try {
    const url = `https://api.linkedin.com/v2/ugcPosts?q=authors&authors=List(${encodeURIComponent(author)})&count=50`;
    console.log(`\nCalling Test 2 URL: ${url}`);
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Restli-Protocol-Version': '2.0.0'
      }
    });
    const data = await res.json();
    if (res.ok && !data.error) {
      console.log('✅ Test 2 Success! UGC Posts fetched:', data.elements?.length || 0);
      if (data.elements && data.elements.length > 0) {
        console.log('First UGC post sample:', JSON.stringify(data.elements[0], null, 2));
      }
    } else {
      console.log('❌ Test 2 Failed:', data.message || data.error?.message || res.statusText);
    }
  } catch (err) {
    console.error('Test 2 error:', err.message);
  }

  await mongoose.connection.close();
};

run();
