import dotenv from 'dotenv';
import path from 'path';

// Load .env
dotenv.config();

console.log('QWEN_API_KEY:', process.env.QWEN_API_KEY ? 'Present' : 'Missing');
console.log('HF_TOKEN:', process.env.HF_TOKEN ? 'Present' : 'Missing');
console.log('GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? 'Present' : 'Missing');

async function testGemini() {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const geminiModel = process.env.GEMINI_IMAGE_MODEL || 'gemini-3.1-flash-image';
  if (!geminiApiKey) return console.log('Gemini: skipped (no key)');

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiApiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'a red apple' }] }],
        generationConfig: { responseModalities: ['IMAGE'] }
      })
    });
    console.log('Gemini Status:', response.status);
    const text = await response.text();
    console.log('Gemini Response:', text.substring(0, 500));
  } catch (err) {
    console.error('Gemini Error:', err.message);
  }
}

async function testHF() {
  const hfToken = process.env.HF_TOKEN;
  const hfModel = process.env.HF_IMAGE_MODEL || 'black-forest-labs/FLUX.1-schnell';
  if (!hfToken) return console.log('HF: skipped (no token)');

  try {
    const endpoint = `https://router.huggingface.co/hf-inference/models/${hfModel}`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${hfToken}`
      },
      body: JSON.stringify({ inputs: 'a red apple' })
    });
    console.log('HF Status:', response.status);
    const text = await response.text();
    console.log('HF Response:', text.substring(0, 500));
  } catch (err) {
    console.error('HF Error:', err.message);
  }
}

async function testQwen() {
  const apiKey = process.env.QWEN_API_KEY;
  if (!apiKey) return console.log('Qwen: skipped (no key)');
  try {
    const endpoint = 'https://integrate.api.nvidia.com/v1/chat/completions';
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'qwen/qwen3-next-80b-a3b-instruct',
        messages: [{ role: 'user', content: 'say hello' }],
        max_tokens: 10
      })
    });
    console.log('Qwen Status:', response.status);
    const text = await response.text();
    console.log('Qwen Response:', text.substring(0, 500));
  } catch (err) {
    console.error('Qwen Error:', err.message);
  }
}

async function run() {
  await testGemini();
  await testHF();
  await testQwen();
}
run();
