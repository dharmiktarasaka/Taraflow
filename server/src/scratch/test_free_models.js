import 'dotenv/config';

async function fetchFreeModels() {
  try {
    console.log('Fetching OpenRouter models list...');
    const response = await fetch('https://openrouter.ai/api/v1/models');
    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.statusText}`);
    }
    const data = await response.json();
    console.log(`Total models found: ${data.data?.length}`);
    const freeModels = data.data?.filter(model => {
      // Check if ID contains :free or pricing is 0
      const isFreeId = model.id?.endsWith(':free');
      const isFreePricing = parseFloat(model.pricing?.prompt) === 0 && parseFloat(model.pricing?.completion) === 0;
      return isFreeId || isFreePricing;
    });

    console.log('Free Models on OpenRouter right now:');
    freeModels.forEach(m => {
      console.log(`- ${m.id} (Name: ${m.name})`);
    });
  } catch (err) {
    console.error('Error fetching models:', err);
  }
}

fetchFreeModels();
