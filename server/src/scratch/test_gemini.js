import dotenv from 'dotenv';
dotenv.config();

async function testGemini() {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const geminiModel = process.env.GEMINI_IMAGE_MODEL || 'gemini-3.1-flash-image';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiApiKey}`;
  const prompt = 'Modern marketing workspace with graphs, realistic';
  
  console.log('Testing Gemini at:', url);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          responseModalities: ['IMAGE']
        }
      })
    });
    
    console.log('Response Status:', response.status);
    const text = await response.text();
    console.log('Response Body:', text.substring(0, 1000));
  } catch (err) {
    console.error('Fetch error:', err);
  }
}

testGemini();
