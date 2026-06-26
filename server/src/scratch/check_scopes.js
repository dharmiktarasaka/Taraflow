import 'dotenv/config';
import dns from 'dns';
import mongoose from 'mongoose';
import SocialAccount from '../models/socialAccount.model.js';
import { decrypt } from '../utils/encryption.js';

dns.setServers(['8.8.8.8', '8.8.4.4']);

const check = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const account = await SocialAccount.findOne({ platform: 'linkedin' });
  if (!account) {
    console.log('No LinkedIn account found.');
  } else {
    console.log('Found LinkedIn account:');
    console.log('platformAccountId:', account.platformAccountId);
    console.log('platformUsername:', account.platformUsername);
    console.log('metadata:', JSON.stringify(account.metadata, null, 2));
    const token = decrypt(account.accessToken);
    console.log('decrypted token:', token);
    
    // Call LinkedIn token inspection endpoint or OpenID userinfo to see scopes if available
    try {
      const response = await fetch('https://api.linkedin.com/v2/userinfo', {
        headers: { Authorization: `Bearer ${token}` }
      }).then(r => r.json());
      console.log('userinfo response:', response);
    } catch (err) {
      console.error('userinfo error:', err.message);
    }
  }
  await mongoose.connection.close();
};

check();
