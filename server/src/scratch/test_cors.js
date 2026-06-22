async function checkCors() {
  const url = 'https://image.pollinations.ai/p/beautiful_landscape?width=256&height=256&seed=123';
  console.log('Fetching Pollinations AI with CORS options...');
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Origin': 'http://localhost:5173'
      }
    });
    console.log('Status:', response.status);
    console.log('Access-Control-Allow-Origin:', response.headers.get('access-control-allow-origin'));
    const text = await response.text();
    console.log('Body length:', text.length);
    if (response.status !== 200) {
      console.log('Body:', text);
    }
  } catch (err) {
    console.error('Fetch error:', err);
  }
}

checkCors();
