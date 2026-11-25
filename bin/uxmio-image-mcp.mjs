#!/usr/bin/env node
import { editImage, generateImage, resolveConfig } from '../src/client.mjs';
import { IMAGE_MODELS } from '../src/models.mjs';
import { SERVER_INFO, startMcpStdioServer } from '../src/mcpServer.mjs';

function printHelp() {
  const lines = [
    `${SERVER_INFO.name} v${SERVER_INFO.version}`,
    '',
    'Zero-dependency MCP server & CLI for OpenAI-compatible AI image generation & editing.',
    'Default endpoint: https://api.uxmio.com/v1 (GPT Image 2/2.5/2.6, Gemini 3.1 Flash / 3 Pro Image)',
    '',
    'Usage:',
    '  uxmio-image-mcp                      Start MCP server over stdio (default)',
    '  uxmio-image-mcp mcp                  Start MCP server over stdio',
    '  uxmio-image-mcp models               List available image models & reference pricing',
    '  uxmio-image-mcp generate "<prompt>" [options]',
    '  uxmio-image-mcp edit "<prompt>" --image <file> [--image <file2>] [options]',
    '',
    'Options (generate / edit):',
    '  -m, --model <id>         Model ID (default: gpt-image-2.5)',
    '  -s, --size <WxH>         Image size (e.g. 1024x1024, 1536x1024, 1024x1536)',
    '  -q, --quality <level>    Quality: auto | low | medium | high',
    '  -n, --count <1-4>        Number of images (default: 1)',
    '  -o, --out <path>         Save generated image(s) to local path',
    '  -f, --format <fmt>       Response format: b64_json | url (default: b64_json)',
    '  -i, --image <path>       Reference image path for edit (repeatable, up to 4)',
    '  -v, --version            Show version',
    '  -h, --help               Show this help',
    '',
    'Environment Variables:',
    '  UXMIO_API_KEY            API key (fallback: OPENAI_API_KEY)',
    '  UXMIO_API_BASE_URL       Base URL (default: https://api.uxmio.com/v1)',
    '  UXMIO_DEFAULT_MODEL      Default model ID (default: gpt-image-2.5)',
    '  UXMIO_OUTPUT_DIR         Optional default directory to auto-save images',
    '',
    'Get an API key: https://api.uxmio.com/?utm_source=github_mcp',
  ];
  process.stdout.write(`${lines.join('\n')}\n`);
}

function parseFlags(args) {
  const positionals = [];
  const flags = { images: [] };
  for (let i = 0; i < args.length; i += 1) {
    const token = args[i];
    if (token === '-m' || token === '--model') {
      flags.model = args[++i];
    } else if (token === '-s' || token === '--size') {
      flags.size = args[++i];
    } else if (token === '-q' || token === '--quality') {
      flags.quality = args[++i];
    } else if (token === '-n' || token === '--count') {
      flags.n = Number(args[++i]);
    } else if (token === '-o' || token === '--out' || token === '--output') {
      flags.outputPath = args[++i];
    } else if (token === '-f' || token === '--format') {
      flags.responseFormat = args[++i];
    } else if (token === '-i' || token === '--image') {
      const val = args[++i];
      if (val) flags.images.push(val);
    } else if (token === '-h' || token === '--help') {
      flags.help = true;
    } else if (token === '-v' || token === '--version') {
      flags.version = true;
    } else {
      positionals.push(token);
    }
  }
  return { positionals, flags };
}

async function main() {
  const argv = process.argv.slice(2);
  const cmd = argv[0];

  if (!cmd || cmd === 'mcp' || cmd === '--stdio') {
    startMcpStdioServer();
    return;
  }

  if (cmd === '-h' || cmd === '--help' || cmd === 'help') {
    printHelp();
    return;
  }

  if (cmd === '-v' || cmd === '--version' || cmd === 'version') {
    process.stdout.write(`${SERVER_INFO.version}\n`);
    return;
  }

  if (cmd === 'models') {
    const cfg = resolveConfig();
    process.stdout.write(`Endpoint: ${cfg.baseUrl}\n`);
    process.stdout.write(`Default:  ${cfg.defaultModel}\n\n`);
    for (const m of IMAGE_MODELS) {
      const tag = m.recommended ? ' [recommended]' : '';
      process.stdout.write(
        `${m.id.padEnd(24)} ¥${m.priceCny.toFixed(2)} (~$${m.priceUsdApprox.toFixed(4)})  ${m.bestFor}${tag}\n`,
      );
    }
    return;
  }

  if (cmd === 'generate' || cmd === 'gen') {
    const { positionals, flags } = parseFlags(argv.slice(1));
    if (flags.help || positionals.length === 0) {
      printHelp();
      process.exitCode = flags.help ? 0 : 1;
      return;
    }
    const prompt = positionals.join(' ');
    const result = await generateImage({
      prompt,
      model: flags.model,
      size: flags.size,
      quality: flags.quality,
      n: flags.n,
      response_format: flags.responseFormat,
      output_path: flags.outputPath || './generated.png',
    });
    for (const img of result.images) {
      process.stdout.write(
        `OK [${result.model} · ${result.elapsedMs}ms] ${img.savedPath || img.url || 'done'}\n`,
      );
    }
    return;
  }

  if (cmd === 'edit') {
    const { positionals, flags } = parseFlags(argv.slice(1));
    if (flags.help || positionals.length === 0 || flags.images.length === 0) {
      printHelp();
      process.exitCode = flags.help ? 0 : 1;
      return;
    }
    const prompt = positionals.join(' ');
    const result = await editImage({
      prompt,
      image_paths: flags.images,
      model: flags.model,
      size: flags.size,
      quality: flags.quality,
      n: flags.n,
      response_format: flags.responseFormat,
      output_path: flags.outputPath || './edited.png',
    });
    for (const img of result.images) {
      process.stdout.write(
        `OK [${result.model} · ${result.elapsedMs}ms] ${img.savedPath || img.url || 'done'}\n`,
      );
    }
    return;
  }

  process.stderr.write(`Unknown command: ${cmd}\nRun "uxmio-image-mcp --help" for usage.\n`);
  process.exitCode = 1;
}

main().catch((err) => {
  process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exitCode = 1;
});
