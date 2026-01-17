
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';

// Read .env.local manually
const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');

let apiKey = '';
const match = envContent.match(/ANTHROPIC_API_KEY=(.+)/);
if (match) {
  apiKey = match[1].trim();
}

console.log('Using API Key:', apiKey ? apiKey.substring(0, 10) + '...' : 'NONE');

const anthropic = new Anthropic({
  apiKey: apiKey,
});

async function listModels() {
  try {
    const page = await anthropic.models.list();
    console.log("Available Models:");
    for (const model of page.data) {
      console.log(`- ${model.id} (${model.display_name})`);
    }
  } catch (error) {
    console.error("Error listing models:", error);
  }
}

listModels();
