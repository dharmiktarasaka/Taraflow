import dotenv from 'dotenv';
dotenv.config();

async function testDiffusionGemma() {
  const apiKey = process.env.QWEN_API_KEY;
  // Let's check the base url, which is: https://integrate.api.nvidia.com/v1
  // OpenAI compatible chat completions endpoint is usually /chat/completions.
  // Wait, is there a custom endpoint for diffusiongemma?
  // Let's try calling chat completions for diffusiongemma to see if it generates images, or maybe a dedicated completions/generations endpoint.
  const url = 'https://integrate.api.nvidia.com/v1/chat/completions';
  
  console.log('Testing DiffusionGemma via chat completions...');
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'google/diffusiongemma-26b-a4b-it',
        messages: [
          {
            role: 'user',
            content: 'Generate an image of a cute cartoon monkey on a white background.'
          }
        ],
        max_tokens: 50
      })
    });
    
    console.log('Response Status:', response.status);
    const text = await response.text();
    console.log('Response body:', text);
  } catch (err) {
    console.error('Fetch error:', err);
  }
}

testDiffusionGemma();
