import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

async function testSDXL() {
  const hfToken = process.env.HF_TOKEN;
  const hfModel = 'stable-diffusion-v1-5/stable-diffusion-v1-5';
  const endpoint = `https://router.huggingface.co/hf-inference/models/${hfModel}`;
  const prompt = 'Modern marketing workspace with graphs, realistic';
  
  console.log('Testing SDXL at:', endpoint);
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${hfToken}`
      },
      body: JSON.stringify({ inputs: prompt })
    });
    
    console.log('Response Status:', response.status);
    const contentType = response.headers.get('content-type');
    console.log('Content-Type:', contentType);
    
    if (response.ok) {
      const buffer = await response.arrayBuffer();
      console.log('Successfully generated image, size:', buffer.byteLength, 'bytes');
    } else {
      const text = await response.text();
      console.log('Error Response:', text);
    }
  } catch (err) {
    console.error('Fetch error:', err);
  }
}

testSDXL();
