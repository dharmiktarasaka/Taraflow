import dotenv from 'dotenv';
dotenv.config();

async function testHFToken() {
  const token = process.env.HF_TOKEN;
  console.log('Testing HF token validity...');
  try {
    const response = await fetch('https://huggingface.co/api/whoami-v2', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    console.log('Status:', response.status);
    const data = await response.json();
    console.log('Data:', data);
  } catch (err) {
    console.error('Fetch error:', err);
  }
}

testHFToken();
