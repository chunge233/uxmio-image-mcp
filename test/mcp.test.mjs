import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import test from 'node:test';
import { handleJsonRpcMessage } from '../src/mcpServer.mjs';

const execFileAsync = promisify(execFile);

// Minimal valid 1x1 transparent PNG
const SAMPLE_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

async function startMockImageServer() {
  const received = [];
  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const bodyBuf = Buffer.concat(chunks);
      received.push({
        method: req.method,
        url: req.url,
        auth: req.headers.authorization,
        contentType: req.headers['content-type'] || '',
        bodyText: bodyBuf.toString('utf8'),
      });

      if (req.url === '/v1/images/generations' || req.url === '/v1/images/edits') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            created: Math.floor(Date.now() / 1000),
            data: [
              {
                b64_json: SAMPLE_PNG_BASE64,
                revised_prompt: 'mock revised prompt',
              },
            ],
          }),
        );
        return;
      }

      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: 'not found' } }));
    });
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  return {
    baseUrl: `http://127.0.0.1:${addr.port}/v1`,
    received,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

test('MCP initialize, tools/list, list_image_models, generate_image, edit_image', async () => {
  const mock = await startMockImageServer();
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'uxmio-mcp-test-'));

  try {
    const env = {
      UXMIO_API_KEY: 'sk-test-token',
      UXMIO_API_BASE_URL: mock.baseUrl,
    };

    // 1. initialize
    const initRes = await handleJsonRpcMessage(
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: { protocolVersion: '2025-03-26', clientInfo: { name: 'test', version: '1.0' } },
      },
      { env },
    );
    assert.equal(initRes.result.protocolVersion, '2025-03-26');
    assert.equal(initRes.result.serverInfo.name, 'uxmio-image-mcp');

    // 2. tools/list
    const listRes = await handleJsonRpcMessage(
      { jsonrpc: '2.0', id: 2, method: 'tools/list' },
      { env },
    );
    const toolNames = listRes.result.tools.map((t) => t.name);
    assert.deepEqual(toolNames, ['list_image_models', 'generate_image', 'edit_image']);

    // 3. list_image_models
    const modelsRes = await handleJsonRpcMessage(
      {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: { name: 'list_image_models', arguments: {} },
      },
      { env },
    );
    assert.match(modelsRes.result.content[0].text, /gpt-image-2\.5/);
    assert.match(modelsRes.result.content[0].text, /gemini-3-pro-image/);

    // 4. generate_image saves PNG to disk and returns inline image block
    const genOut = path.join(tmpDir, 'nested', 'hero.png');
    const genRes = await handleJsonRpcMessage(
      {
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: {
          name: 'generate_image',
          arguments: {
            prompt: 'Minimalist studio cup',
            model: 'gpt-image-2.5',
            size: '1024x1024',
            output_path: genOut,
          },
        },
      },
      { env },
    );
    assert.equal(genRes.result.isError, undefined);
    assert.equal(genRes.result.content[0].type, 'text');
    assert.match(genRes.result.content[0].text, /hero\.png/);
    assert.equal(genRes.result.content[1].type, 'image');
    assert.equal(genRes.result.content[1].mimeType, 'image/png');
    const savedBuf = await fs.readFile(genOut);
    assert.equal(savedBuf[0], 0x89);
    assert.equal(savedBuf[1], 0x50);

    // 5. edit_image sends multipart form-data and saves edited PNG
    const editOut = path.join(tmpDir, 'edited.png');
    const editRes = await handleJsonRpcMessage(
      {
        jsonrpc: '2.0',
        id: 5,
        method: 'tools/call',
        params: {
          name: 'edit_image',
          arguments: {
            prompt: 'Make background sunlit stone',
            image_paths: [genOut],
            model: 'gemini-3.1-flash-image',
            output_path: editOut,
          },
        },
      },
      { env },
    );
    assert.equal(editRes.result.isError, undefined);
    assert.match(editRes.result.content[0].text, /edited\.png/);
    const editReq = mock.received.find((r) => r.url === '/v1/images/edits');
    assert.ok(editReq);
    assert.equal(editReq.auth, 'Bearer sk-test-token');
    assert.match(editReq.contentType, /multipart\/form-data/i);
    const editedStat = await fs.stat(editOut);
    assert.ok(editedStat.size > 0);
  } finally {
    await mock.close();
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test('CLI models and --version work cleanly', async () => {
  const binPath = path.resolve(import.meta.dirname, '..', 'bin', 'uxmio-image-mcp.mjs');
  const { stdout: ver } = await execFileAsync(process.execPath, [binPath, '--version']);
  assert.equal(ver.trim(), '1.0.0');

  const { stdout: modelsOut } = await execFileAsync(process.execPath, [binPath, 'models']);
  assert.match(modelsOut, /gpt-image-2\.5/);
  assert.match(modelsOut, /gemini-3\.1-flash-image/);
});
