import { OAuth2Client } from 'google-auth-library';
import http from 'http';
import url from 'url';
import 'dotenv/config';

const client_id = process.env.GOOGLE_CLIENT_ID;
const client_secret = process.env.GOOGLE_CLIENT_SECRET;
const port = 8080;
const redirect_uri = `http://localhost:${port}/oauth2callback`;

if (!client_id || !client_secret) {
  console.error("Error: Please ensure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are defined in your .env file!");
  process.exit(1);
}

const oAuth2Client = new OAuth2Client(
  client_id,
  client_secret,
  redirect_uri
);

const authorizeUrl = oAuth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent', // Force consent to get refresh token
  scope: [
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/userinfo.email'
  ]
});

console.log('==================================================================');
console.log('GMAIL AUTHENTICATION TOOL');
console.log('==================================================================');
console.log('1. Make sure you enable "Gmail API" for your project:');
console.log('   https://console.cloud.google.com/apis/library/gmail.googleapis.com');
console.log('------------------------------------------------------------------');
console.log('2. In Google Cloud Console, add this exact redirect URI:');
console.log(`   ${redirect_uri}`);
console.log('------------------------------------------------------------------');
console.log('3. Open the link below in your browser, log in, and grant permission:');
console.log('\x1b[36m%s\x1b[0m', authorizeUrl);
console.log('==================================================================');
console.log('\nWaiting for browser callback...');

const server = http.createServer(async (req, res) => {
  try {
    if (req.url.startsWith('/oauth2callback')) {
      const qs = new url.URL(req.url, 'http://localhost:8080').searchParams;
      const code = qs.get('code');
      
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <div style="font-family: sans-serif; text-align: center; margin-top: 50px;">
          <h2 style="color: #4F46E5;">Authentication Successful!</h2>
          <p>You can close this window now. Return to your terminal/VS Code to copy your refresh token.</p>
        </div>
      `);
      server.close();

      const { tokens } = await oAuth2Client.getToken(code);
      console.log('\n======================================================');
      console.log('SUCCESSFULLY GENERATED REFRESH TOKEN!');
      console.log('======================================================');
      console.log('\x1b[32m%s\x1b[0m', `GMAIL_REFRESH_TOKEN=${tokens.refresh_token}`);
      console.log('======================================================\n');
      process.exit(0);
    }
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Authentication failed: ' + e.message);
    console.error(e);
    process.exit(1);
  }
}).listen(port);
