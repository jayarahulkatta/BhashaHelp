import { SarvamSpeechProvider } from '../src/lib/speech/sarvam';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function main() {
  console.log('Testing Sarvam API key and integration...');
  const provider = new SarvamSpeechProvider();
  
  try {
    const res = await provider.synthesize('hello world', 'en');
    console.log('Success! Synthesize works. Audio length:', res.audioBase64.length);
  } catch (err) {
    console.error('Synthesize Failed:', err);
  }
}
main();
