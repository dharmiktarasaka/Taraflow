import fs from 'fs';

async function testPollinations() {
  const prompt = 'A cute cartoon monkey with soft fur and expressive eyes, white background';
  const seed = Math.floor(Math.random() * 1000000);
  const url = `https://image.pollinations.ai/p/${encodeURIComponent(prompt)}?width=1080&height=1080&nologo=true&seed=${seed}`;
  console.log('Fetching Pollinations AI at:', url);
  try {
    const response = await fetch(url);
    console.log('Response status:', response.status);
    console.log('Headers:', [...response.headers.entries()]);
    if (response.ok) {
      const buffer = await response.arrayBuffer();
      console.log('Fetched successfully! Size:', buffer.byteLength);
    } else {
      const text = await response.text();
      console.log('Error body:', text);
    }
  } catch (err) {
    console.error('Fetch error:', err);
  }
}

testPollinations();
