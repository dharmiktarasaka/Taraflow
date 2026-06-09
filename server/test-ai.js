import dotenv from 'dotenv';
import { qwenServiceInstance } from './src/services/qwen.service.js';

dotenv.config();

process.env.QWEN_API_KEY = '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';
process.env.QWEN_MODEL = 'qwen/qwen3-next-80b-a3b-instruct';
console.log('API Key:', process.env.QWEN_API_KEY);
console.log('Model:', process.env.QWEN_MODEL);
console.log('Resolved Service API Base:', qwenServiceInstance.resolveApiBase());

try {
  console.log('Testing generate keypoints...');
  const res = await qwenServiceInstance.generate('keypoints', {
    topic: 'Tailwind CSS Tips',
    platform: 'linkedin',
    isImage: true
  });
  console.log('Success response:', JSON.stringify(res, null, 2));
} catch (err) {
  console.error('Failed with error:', err.message);
  if (err.stack) {
    console.error(err.stack);
  }
}
