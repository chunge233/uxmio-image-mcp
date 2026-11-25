import fs from 'node:fs/promises';
import path from 'node:path';
import { DEFAULT_BASE_URL, DEFAULT_MODEL } from './models.mjs';

const MIME_BY_EXT = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

const EXT_BY_MIME = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

export function resolveConfig(env = process.env) {
  const apiKey = (env.UXMIO_API_KEY || env.OPENAI_API_KEY || '').trim();
  const rawBaseUrl = (env.UXMIO_API_BASE_URL || env.OPENAI_BASE_URL || DEFAULT_BASE_URL).trim();
  const baseUrl = rawBaseUrl.replace(/\/+$/, '');
  const defaultModel = (env.UXMIO_DEFAULT_MODEL || DEFAULT_MODEL).trim() || DEFAULT_MODEL;
  const outputDir = (env.UXMIO_OUTPUT_DIR || '').trim() || null;
  const parsedTimeout = Number(env.UXMIO_TIMEOUT_MS);
  const timeoutMs =
    Number.isFinite(parsedTimeout) && parsedTimeout >= 5_000 && parsedTimeout <= 600_000
      ? Math.round(parsedTimeout)
      : 120_000;

  return {
    apiKey,
    baseUrl,
    defaultModel,
    outputDir,
    timeoutMs,
  };
}

export function guessMimeFromPath(filePath) {
  const ext = path.extname(String(filePath || '')).toLowerCase();
  return MIME_BY_EXT[ext] || 'image/png';
}

export function detectImageMimeFromBuffer(buf) {
  if (!buf || buf.length < 4) return 'image/png';
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (
    buf.length >= 12 &&
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  if (buf.subarray(0, 3).toString('ascii') === 'GIF') return 'image/gif';
  return 'image/png';
}

function buildIndexedOutputPath(outputPath, index, total, mimeType) {
  const resolved = path.resolve(outputPath);
  const parsed = path.parse(resolved);
  const ext = parsed.ext || EXT_BY_MIME[mimeType] || '.png';
  const baseName = parsed.ext ? parsed.name : parsed.base;
  if (total <= 1) {
    return path.join(parsed.dir, `${baseName}${ext}`);
  }
  return path.join(parsed.dir, `${baseName}-${index + 1}${ext}`);
}

async function resolveImageBinary(item, fetchImpl, timeoutMs) {
  if (typeof item.b64_json === 'string' && item.b64_json.trim()) {
    const cleanB64 = item.b64_json.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '').trim();
    const buffer = Buffer.from(cleanB64, 'base64');
    return {
      buffer,
      base64: cleanB64,
      mimeType: detectImageMimeFromBuffer(buffer),
    };
  }
  if (typeof item.url === 'string' && /^https?:\/\//i.test(item.url.trim())) {
    const res = await fetchImpl(item.url.trim(), {
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      throw new Error(`Failed to download generated image from URL (HTTP ${res.status})`);
    }
    const arrBuf = await res.arrayBuffer();
    const buffer = Buffer.from(arrBuf);
    const headerMime = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    const mimeType = EXT_BY_MIME[headerMime] ? headerMime : detectImageMimeFromBuffer(buffer);
    return {
      buffer,
      base64: buffer.toString('base64'),
      mimeType,
    };
  }
  return null;
}

async function parseErrorMessage(res) {
  const text = await res.text().catch(() => '');
  if (!text) return `HTTP ${res.status} ${res.statusText}`;
  try {
    const parsed = JSON.parse(text);
    const msg = parsed?.error?.message || parsed?.message || parsed?.error;
    if (typeof msg === 'string' && msg.trim()) {
      return `HTTP ${res.status}: ${msg.trim()}`;
    }
  } catch {
    // plain text error
  }
  return `HTTP ${res.status}: ${text.slice(0, 300)}`;
}

async function normalizeImageResponse(rawJson, { outputPath, outputDir, prefix, fetchImpl, timeoutMs }) {
  const items = Array.isArray(rawJson?.data) ? rawJson.data : [];
  if (items.length === 0) {
    throw new Error('Upstream image API returned an empty data array.');
  }

  const effectiveOutputPath =
    outputPath ||
    (outputDir ? path.join(outputDir, `${prefix}-${Date.now()}.png`) : null);

  const normalized = [];
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i] || {};
    const entry = {
      index: i,
      url: typeof item.url === 'string' ? item.url : null,
      revisedPrompt: typeof item.revised_prompt === 'string' ? item.revised_prompt : null,
      savedPath: null,
      mimeType: null,
      base64: null,
      bytes: null,
    };

    const shouldDecodeBinary = Boolean(effectiveOutputPath) || Boolean(item.b64_json);
    if (shouldDecodeBinary) {
      const bin = await resolveImageBinary(item, fetchImpl, timeoutMs);
      if (bin) {
        entry.mimeType = bin.mimeType;
        entry.base64 = bin.base64;
        entry.bytes = bin.buffer.length;
        if (effectiveOutputPath) {
          const targetPath = buildIndexedOutputPath(
            effectiveOutputPath,
            i,
            items.length,
            bin.mimeType,
          );
          await fs.mkdir(path.dirname(targetPath), { recursive: true });
          await fs.writeFile(targetPath, bin.buffer);
          entry.savedPath = targetPath;
        }
      }
    }
    normalized.push(entry);
  }
  return normalized;
}

export async function generateImage(params, options = {}) {
  const cfg = { ...resolveConfig(options.env), ...options.config };
  const fetchImpl = options.fetch || globalThis.fetch;

  if (!cfg.apiKey) {
    throw new Error(
      'Missing API key. Set UXMIO_API_KEY (or OPENAI_API_KEY). Get a key at https://api.uxmio.com/?utm_source=github_mcp',
    );
  }
  const prompt = String(params?.prompt || '').trim();
  if (!prompt) {
    throw new Error('prompt is required.');
  }

  const model = String(params?.model || cfg.defaultModel).trim() || cfg.defaultModel;
  const n = Math.max(1, Math.min(4, Math.round(Number(params?.n ?? 1) || 1)));
  const responseFormat =
    params?.response_format === 'url' || params?.responseFormat === 'url' ? 'url' : 'b64_json';

  const payload = {
    model,
    prompt,
    n,
    response_format: responseFormat,
  };
  if (typeof params?.size === 'string' && params.size.trim()) {
    payload.size = params.size.trim();
  }
  if (typeof params?.quality === 'string' && params.quality.trim()) {
    payload.quality = params.quality.trim();
  }

  const startedAt = Date.now();
  const res = await fetchImpl(`${cfg.baseUrl}/images/generations`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(cfg.timeoutMs),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res));
  }

  const json = await res.json();
  const images = await normalizeImageResponse(json, {
    outputPath: params?.output_path || params?.outputPath || null,
    outputDir: cfg.outputDir,
    prefix: 'uxmio-gen',
    fetchImpl,
    timeoutMs: cfg.timeoutMs,
  });

  return {
    model,
    endpoint: `${cfg.baseUrl}/images/generations`,
    elapsedMs: Date.now() - startedAt,
    images,
  };
}

export async function editImage(params, options = {}) {
  const cfg = { ...resolveConfig(options.env), ...options.config };
  const fetchImpl = options.fetch || globalThis.fetch;

  if (!cfg.apiKey) {
    throw new Error(
      'Missing API key. Set UXMIO_API_KEY (or OPENAI_API_KEY). Get a key at https://api.uxmio.com/?utm_source=github_mcp',
    );
  }
  const prompt = String(params?.prompt || '').trim();
  if (!prompt) {
    throw new Error('prompt is required.');
  }

  const rawPaths = Array.isArray(params?.image_paths)
    ? params.image_paths
    : Array.isArray(params?.imagePaths)
      ? params.imagePaths
      : params?.image_path || params?.imagePath
        ? [params.image_path || params.imagePath]
        : [];

  const imagePaths = rawPaths.map((p) => String(p || '').trim()).filter(Boolean);
  if (imagePaths.length === 0) {
    throw new Error('At least one local image path (image_paths) is required.');
  }
  if (imagePaths.length > 4) {
    throw new Error('At most 4 reference images are supported per edit call.');
  }

  const model = String(params?.model || cfg.defaultModel).trim() || cfg.defaultModel;
  const n = Math.max(1, Math.min(4, Math.round(Number(params?.n ?? 1) || 1)));
  const responseFormat =
    params?.response_format === 'url' || params?.responseFormat === 'url' ? 'url' : 'b64_json';

  const form = new FormData();
  form.append('model', model);
  form.append('prompt', prompt);
  form.append('n', String(n));
  form.append('response_format', responseFormat);
  if (typeof params?.size === 'string' && params.size.trim()) {
    form.append('size', params.size.trim());
  }
  if (typeof params?.quality === 'string' && params.quality.trim()) {
    form.append('quality', params.quality.trim());
  }

  const fieldName = imagePaths.length > 1 ? 'image[]' : 'image';
  for (const imgPath of imagePaths) {
    const absPath = path.resolve(imgPath);
    const buf = await fs.readFile(absPath);
    const mimeType = guessMimeFromPath(absPath);
    const blob = new Blob([buf], { type: mimeType });
    form.append(fieldName, blob, path.basename(absPath));
  }

  const startedAt = Date.now();
  const res = await fetchImpl(`${cfg.baseUrl}/images/edits`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: form,
    signal: AbortSignal.timeout(cfg.timeoutMs),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res));
  }

  const json = await res.json();
  const images = await normalizeImageResponse(json, {
    outputPath: params?.output_path || params?.outputPath || null,
    outputDir: cfg.outputDir,
    prefix: 'uxmio-edit',
    fetchImpl,
    timeoutMs: cfg.timeoutMs,
  });

  return {
    model,
    endpoint: `${cfg.baseUrl}/images/edits`,
    elapsedMs: Date.now() - startedAt,
    inputImages: imagePaths.map((p) => path.resolve(p)),
    images,
  };
}
