import dotenv from 'dotenv';
dotenv.config();

async function testNvidiaImage() {
  const apiKey = process.env.QWEN_API_KEY;
  const url = 'https://integrate.api.nvidia.com/v1/images/generations';
  
  console.log('Testing NVIDIA NIM Image Gen...');
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        prompt: 'Modern marketing workspace with graphs, realistic',
        model: 'stabilityai/stable-diffusion-xl',
        size: '1024x1024',
        response_format: 'b64_json',
        n: 1
      })
    });
    
    console.log('Response Status:', response.status);
    const text = await response.text();
    console.log('Response body:', text);
  } catch (err) {
    console.error('Fetch error:', err);
  }
}

testNvidiaImage();
