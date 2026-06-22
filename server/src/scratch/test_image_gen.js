import { qwenServiceInstance } from '../services/qwen.service.js';
import dotenv from 'dotenv';

dotenv.config();

async function run() {
  console.log('Testing image generation...');
  const prompt = 'A cute cartoon monkey with soft fur and expressive eyes stands centered on a clean white background, looking playfully upward. Above its head, a tiny, rounded cartoon speech bubble in bold white sans-serif font radiates a subtle glow, displaying the word “HII” in vibrant coral pink. Soft volumetric lighting creates a gentle highlight on the monkey’s face, enhancing its friendly expression. Minimalist, modern aesthetic with zero clutter, premium digital illustration style, perfect for Instagram social posts.';
  try {
    const result = await qwenServiceInstance.generateImage(prompt, {
      skipEnhance: true,
      width: 1080,
      height: 1080
    });
    console.log('Generation Result URL:', result);
  } catch (err) {
    console.error('Error during generation:', err);
  }
}

run();
