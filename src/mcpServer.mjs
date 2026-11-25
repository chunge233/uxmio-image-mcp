import { createInterface } from 'node:readline';
import { editImage, generateImage, resolveConfig } from './client.mjs';
import { COMMON_QUALITIES, COMMON_SIZES, DEFAULT_MODEL, IMAGE_MODELS } from './models.mjs';

export const SERVER_INFO = {
  name: 'uxmio-image-mcp',
  version: '1.0.0',
};

const MAX_INLINE_IMAGE_BYTES = 4 * 1024 * 1024;

export const MCP_TOOLS = [
  {
    name: 'list_image_models',
    description:
      'List supported AI image generation and editing models, per-image pricing, and recommended use cases.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'generate_image',
    description:
      'Generate an AI image from a text prompt via an OpenAI-compatible /v1/images/generations endpoint (default: api.uxmio.com). Supports saving directly to disk via output_path.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'Detailed text description of the image to generate.',
        },
        model: {
          type: 'string',
          description: `Model ID (default: ${DEFAULT_MODEL}). Options: gpt-image-2, gpt-image-2.5, gpt-image-2.6, gemini-3.1-flash-image, gemini-3-pro-image.`,
        },
        size: {
          type: 'string',
          description: `Optional image size such as ${COMMON_SIZES.join(', ')}.`,
        },
        quality: {
          type: 'string',
          enum: COMMON_QUALITIES,
          description: 'Optional quality level: auto, low, medium, or high.',
        },
        n: {
          type: 'integer',
          minimum: 1,
          maximum: 4,
          description: 'Number of images to generate (1-4, default: 1).',
        },
        response_format: {
          type: 'string',
          enum: ['b64_json', 'url'],
          description: 'Preferred upstream response format (default: b64_json).',
        },
        output_path: {
          type: 'string',
          description:
            'Optional local file path to save the generated image (e.g. ./assets/hero.png). Parent directories are created automatically.',
        },
        include_inline_image: {
          type: 'boolean',
          description:
            'Whether to return an inline MCP image content block when binary data is available (default: true).',
        },
      },
      required: ['prompt'],
      additionalProperties: false,
    },
  },
  {
    name: 'edit_image',
    description:
      'Edit or compose 1-4 local reference images using a text prompt via /v1/images/edits (multipart upload). Great for product photography retouching, background replacement, style transfer, and UI mockups.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'Editing instruction describing how to transform or combine the input image(s).',
        },
        image_paths: {
          type: 'array',
          items: { type: 'string' },
          minItems: 1,
          maxItems: 4,
          description: 'Array of 1 to 4 local file paths (PNG/JPG/WebP) to edit or reference.',
        },
        model: {
          type: 'string',
          description: `Model ID (default: ${DEFAULT_MODEL}). For multi-image reference consistency, gemini-3.1-flash-image or gemini-3-pro-image is recommended.`,
        },
        size: {
          type: 'string',
          description: `Optional output size such as ${COMMON_SIZES.join(', ')}.`,
        },
        quality: {
          type: 'string',
          enum: COMMON_QUALITIES,
          description: 'Optional quality level: auto, low, medium, or high.',
        },
        response_format: {
          type: 'string',
          enum: ['b64_json', 'url'],
          description: 'Preferred upstream response format (default: b64_json).',
        },
        output_path: {
          type: 'string',
          description: 'Optional local file path to save the edited image.',
        },
        include_inline_image: {
          type: 'boolean',
          description:
            'Whether to return an inline MCP image content block when binary data is available (default: true).',
        },
      },
      required: ['prompt', 'image_paths'],
      additionalProperties: false,
    },
  },
];

function buildImageToolContent(result, includeInline) {
  const summaryLines = [
    `Model: ${result.model}`,
    `Endpoint: ${result.endpoint}`,
    `Latency: ${result.elapsedMs}ms`,
    `Images: ${result.images.length}`,
  ];
  for (const img of result.images) {
    const parts = [`#${img.index + 1}`];
    if (img.savedPath) parts.push(`saved=${img.savedPath}`);
    if (img.url) parts.push(`url=${img.url}`);
    if (img.bytes) parts.push(`size=${(img.bytes / 1024).toFixed(1)}KB`);
    if (img.revisedPrompt) parts.push(`revised_prompt=${img.revisedPrompt}`);
    summaryLines.push(parts.join(' | '));
  }

  const content = [{ type: 'text', text: summaryLines.join('\n') }];
  if (includeInline) {
    for (const img of result.images) {
      if (img.base64 && img.mimeType && (img.bytes ?? 0) <= MAX_INLINE_IMAGE_BYTES) {
        content.push({
          type: 'image',
          data: img.base64,
          mimeType: img.mimeType,
        });
      }
    }
  }
  return content;
}

export async function handleJsonRpcMessage(msg, options = {}) {
  if (!msg || typeof msg !== 'object') {
    return {
      jsonrpc: '2.0',
      id: null,
      error: { code: -32600, message: 'Invalid Request' },
    };
  }

  const { id, method, params } = msg;
  const isNotification = id === undefined;

  if (method === 'notifications/initialized' || method === 'notifications/cancelled') {
    return null;
  }

  try {
    if (method === 'initialize') {
      const protocolVersion =
        typeof params?.protocolVersion === 'string' && params.protocolVersion.trim()
          ? params.protocolVersion.trim()
          : '2024-11-05';
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion,
          capabilities: {
            tools: { listChanged: false },
          },
          serverInfo: SERVER_INFO,
        },
      };
    }

    if (method === 'ping') {
      return { jsonrpc: '2.0', id, result: {} };
    }

    if (method === 'tools/list') {
      return {
        jsonrpc: '2.0',
        id,
        result: { tools: MCP_TOOLS },
      };
    }

    if (method === 'resources/list') {
      return { jsonrpc: '2.0', id, result: { resources: [] } };
    }

    if (method === 'prompts/list') {
      return { jsonrpc: '2.0', id, result: { prompts: [] } };
    }

    if (method === 'tools/call') {
      const toolName = String(params?.name || '').trim();
      const args = params?.arguments && typeof params.arguments === 'object' ? params.arguments : {};

      if (toolName === 'list_image_models') {
        const cfg = resolveConfig(options.env);
        const lines = [
          `Active Base URL: ${cfg.baseUrl}`,
          `Default Model: ${cfg.defaultModel}`,
          `API Key Configured: ${cfg.apiKey ? 'yes' : 'no (set UXMIO_API_KEY)'}`,
          '',
          'Supported Models (api.uxmio.com reference pricing):',
          ...IMAGE_MODELS.map(
            (m) =>
              `- ${m.id} (${m.family}): ¥${m.priceCny.toFixed(2)} (~$${m.priceUsdApprox.toFixed(4)}) / image — ${m.bestFor}`,
          ),
          '',
          'API Console: https://api.uxmio.com/?utm_source=github_mcp',
          'Web Studio:  https://image.uxmio.com/?utm_source=github_mcp',
        ];
        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [{ type: 'text', text: lines.join('\n') }],
          },
        };
      }

      if (toolName === 'generate_image') {
        const includeInline = args.include_inline_image !== false;
        const result = await generateImage(args, options);
        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: buildImageToolContent(result, includeInline),
          },
        };
      }

      if (toolName === 'edit_image') {
        const includeInline = args.include_inline_image !== false;
        const result = await editImage(args, options);
        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: buildImageToolContent(result, includeInline),
          },
        };
      }

      return {
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: `Unknown tool: ${toolName}` },
      };
    }

    if (isNotification) return null;
    return {
      jsonrpc: '2.0',
      id,
      error: { code: -32601, message: `Method not found: ${method}` },
    };
  } catch (err) {
    if (isNotification) return null;
    const message = err instanceof Error ? err.message : String(err);
    if (method === 'tools/call') {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          isError: true,
          content: [{ type: 'text', text: `Error: ${message}` }],
        },
      };
    }
    return {
      jsonrpc: '2.0',
      id,
      error: { code: -32000, message },
    };
  }
}

export function startMcpStdioServer(options = {}) {
  const input = options.input || process.stdin;
  const output = options.output || process.stdout;
  const rl = createInterface({ input, crlfDelay: Infinity });

  rl.on('line', async (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let parsed;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      const errResp = {
        jsonrpc: '2.0',
        id: null,
        error: { code: -32700, message: 'Parse error' },
      };
      output.write(`${JSON.stringify(errResp)}\n`);
      return;
    }

    const response = await handleJsonRpcMessage(parsed, options);
    if (response !== null) {
      output.write(`${JSON.stringify(response)}\n`);
    }
  });

  return rl;
}
