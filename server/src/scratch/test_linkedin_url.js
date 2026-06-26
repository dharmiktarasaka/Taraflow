import 'dotenv/config';
import { getAuthUrl } from '../services/socialOAuth.service.js';

try {
  const url = getAuthUrl('linkedin', 'test_verification_state');
  console.log('Generated LinkedIn Auth URL:');
  console.log(url);
  
  if (url.includes('r_member_social')) {
    console.log('❌ FAIL: URL still contains deprecated r_member_social scope');
  } else if (url.includes('w_member_social') && url.includes('openid') && url.includes('profile') && url.includes('email')) {
    console.log('✅ SUCCESS: URL contains correct LinkedIn scopes (w_member_social, openid, profile, email)');
  } else {
    console.log('❌ FAIL: Scopes are not formatted as expected:', url);
  }
} catch (err) {
  console.error('Error getting auth URL:', err.message);
}
