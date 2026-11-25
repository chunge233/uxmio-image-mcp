// Zero-dependency Node.js 18+ example (works with OpenAI SDK too)
import fs from 'node:fs/promises';

const apiKey = process.env.UXMIO_API_KEY;
const baseUrl = (process.env.UXMIO_API_BASE_URL || 'https://api.uxmio.com/v1').replace(/\/+$/, '');

if (!apiKey) {
  console.error('Please set UXMIO_API_KEY first (get one at https://api.uxmio.com/?utm_source=github_mcp)');
  process.exit(1);
}

const res = await fetch(`${baseUrl}/images/generations`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'gpt-image-2.5',
    prompt: 'Clean flat vector illustration of a developer desk with dual monitors and warm lamp light',
    size: '1536x1024',
    response_format: 'b64_json',
  }),
});

if (!res.ok) {
  throw new Error(`HTTP ${res.status}: ${await res.text()}`);
}

const json = await res.json();
const b64 = json.data?.[0]?.b64_json;
if (b64) {
  await fs.writeFile('output.png', Buffer.from(b64, 'base64'));
  console.log('Saved output.png');
} else {
  console.log('Image URL:', json.data?.[0]?.url);
}
