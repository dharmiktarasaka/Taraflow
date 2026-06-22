import dotenv from 'dotenv';
dotenv.config();

async function testHFTokenDetails() {
  const token = process.env.HF_TOKEN;
  try {
    const response = await fetch('https://huggingface.co/api/whoami-v2', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    const data = await response.json();
    console.log('Token fineGrained details:', JSON.stringify(data.auth?.accessToken?.fineGrained, null, 2));
  } catch (err) {
    console.error('Fetch error:', err);
  }
}

testHFTokenDetails();
