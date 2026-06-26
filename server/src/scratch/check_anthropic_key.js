import 'dotenv/config';
console.log('ANTHROPIC_API_KEY present:', !!process.env.ANTHROPIC_API_KEY);
if (process.env.ANTHROPIC_API_KEY) {
  console.log('Key starts with:', process.env.ANTHROPIC_API_KEY.substring(0, 7));
}
