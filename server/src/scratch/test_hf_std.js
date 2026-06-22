import dotenv from 'dotenv';
dotenv.config();

async function testHuggingFaceStandard() {
  const hfToken = process.env.HF_TOKEN;
  // Let's try stabilityai/stable-diffusion-2-1
  const hfModel = 'stabilityai/stable-diffusion-2-1';
  // Use public endpoint
  const endpoint = `https://api-inference.huggingface.co/models/${hfModel}`;
  
  console.log('Testing Hugging Face standard endpoint with:', hfModel);
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${hfToken}`
      },
      body: JSON.stringify({ inputs: 'A cute cartoon monkey with soft fur and expressive eyes' })
    });
    
    console.log('Response Status:', response.status);
    const contentType = response.headers.get('content-type');
    console.log('Content-Type:', contentType);
    if (response.ok) {
      const buffer = await response.arrayBuffer();
      console.log('Success! Buffer length:', buffer.byteLength);
    } else {
      const text = await response.text();
      console.log('Error Body:', text);
    }
  } catch (err) {
    console.error('Fetch error:', err);
  }
}

testHuggingFaceStandard();
