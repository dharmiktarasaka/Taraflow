import dotenv from 'dotenv';
dotenv.config();

async function listModels() {
  const apiKey = process.env.QWEN_API_KEY;
  const url = 'https://integrate.api.nvidia.com/v1/models';
  
  console.log('Fetching models from NVIDIA API...');
  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });
    
    console.log('Response Status:', response.status);
    const data = await response.json();
    if (response.ok && data.data) {
      const ids = data.data.map(m => m.id);
      console.log('All model IDs:', JSON.stringify(ids, null, 2));
      const filtered = ids.filter(id => id.includes('image') || id.includes('diffusion') || id.includes('stability') || id.includes('sd') || id.includes('flux'));
      console.log('Filtered model IDs:', filtered);
    } else {
      console.log('Error payload:', data);
    }
  } catch (err) {
    console.error('Fetch error:', err);
  }
}

listModels();
