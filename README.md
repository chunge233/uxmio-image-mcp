# uxmio-image-mcp

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js >= 18.17](https://img.shields.io/badge/node-%3E%3D18.17-brightgreen.svg)](https://nodejs.org)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-0-success.svg)](package.json)

[中文文档 (README.zh-CN.md)](./README.zh-CN.md) | [API Console (api.uxmio.com)](https://api.uxmio.com/?utm_source=github_mcp) | [Web Studio (image.uxmio.com)](https://image.uxmio.com/?utm_source=github_mcp)

A **zero-dependency** Model Context Protocol (**MCP**) server and CLI that lets **Claude Code, Cursor, Windsurf, Cline, Cherry Studio**, and any MCP client generate and edit images directly into your workspace via standard OpenAI-compatible `/v1/images/generations` and `/v1/images/edits` endpoints.

Works out of the box with **[api.uxmio.com](https://api.uxmio.com/?utm_source=github_mcp)** (pay-as-you-go per image from **¥0.01 / ~$0.0014**, no monthly subscription) — or point `UXMIO_API_BASE_URL` to **any** OpenAI-compatible image provider (OpenAI, NewAPI, OneAPI, self-hosted relays).

---

## Highlights

- **Zero runtime dependencies**: pure Node.js 18+ ESM (`fetch`, `FormData`, `Blob`), starts in milliseconds via `npx`.
- **Generate & Multi-Image Edit**: supports both text-to-image (`generate_image`) and 1–4 reference image editing (`edit_image`).
- **Workspace-friendly**: pass `output_path` to save PNG/JPG/WebP assets straight into `./public/`, `./assets/`, or any project folder, while also returning inline MCP image previews.
- **Dual Mode (MCP + CLI)**: run as an MCP stdio server for AI coding assistants, or invoke directly from shell scripts and CI pipelines.
- **Provider-agnostic**: defaults to `https://api.uxmio.com/v1`, fully compatible with any standard `/v1/images/*` endpoint.

---

## Supported Models & Reference Pricing (`api.uxmio.com`)

| Model ID | Family | Price (CNY) | Approx. USD | Recommended Use Case |
| :--- | :--- | :---: | :---: | :--- |
| `gpt-image-2` | GPT Image | ¥0.01 / img | ~$0.0014 | Fast drafts, icons, placeholders, high-volume batch runs |
| **`gpt-image-2.5`** *(default)* | GPT Image | **¥0.01 / img** | **~$0.0014** | Best cost-performance default for general generation & edits |
| `gpt-image-2.6` | GPT Image | ¥0.03 / img | ~$0.0041 | Richer lighting, sharper textures, complex scenes |
| `gemini-3.1-flash-image` | Nano Banana 2 | ¥0.06 / img | ~$0.0082 | Accurate CJK/English typography, posters, e-commerce product edits |
| `gemini-3-pro-image` | Nano Banana Pro | ¥0.09 / img | ~$0.0123 | Flagship studio photography & strict multi-reference consistency |

> Need a key? Register at [api.uxmio.com](https://api.uxmio.com/?utm_source=github_mcp) (pay-as-you-go, balance shared with the [image.uxmio.com](https://image.uxmio.com/?utm_source=github_mcp) web workbench).

---

## Quick Start (MCP Clients)

### 1. Claude Code

```bash
claude mcp add uxmio-image \
  -e UXMIO_API_KEY=sk-your-api-key \
  -- npx -y github:chunge233/uxmio-image-mcp
```

### 2. Cursor / Windsurf / Cline / Cherry Studio

Add to your MCP config (`~/.cursor/mcp.json`, Claude Desktop `claude_desktop_config.json`, or client MCP settings):

```json
{
  "mcpServers": {
    "uxmio-image": {
      "command": "npx",
      "args": ["-y", "github:chunge233/uxmio-image-mcp"],
      "env": {
        "UXMIO_API_KEY": "sk-your-api-key",
        "UXMIO_API_BASE_URL": "https://api.uxmio.com/v1",
        "UXMIO_DEFAULT_MODEL": "gpt-image-2.5"
      }
    }
  }
}
```

### 3. Local Clone (Zero Network Startup)

```bash
git clone https://github.com/chunge233/uxmio-image-mcp.git
```

Then configure `"command": "node"` and `"args": ["/absolute/path/to/uxmio-image-mcp/bin/uxmio-image-mcp.mjs"]`.

---

## Exposed MCP Tools

| Tool | Description | Key Parameters |
| :--- | :--- | :--- |
| `list_image_models` | Lists available models, pricing, active endpoint, and recommended use cases | *(none)* |
| `generate_image` | Generates 1–4 images from a text prompt and optionally writes them to disk | `prompt` *(required)*, `model`, `size`, `quality`, `n`, `response_format`, `output_path` |
| `edit_image` | Edits or combines 1–4 local images (`PNG`/`JPG`/`WebP`) using a text instruction | `prompt` *(required)*, `image_paths` *(required)*, `model`, `size`, `quality`, `output_path` |

### Example Prompts Inside Cursor / Claude Code

- *"Generate a 1536x1024 dark-mode SaaS hero illustration with `gpt-image-2.5` and save it to `public/images/hero.png`."*
- *"Use `edit_image` with `gemini-3.1-flash-image` on `assets/bottle.png` to place it on a sunlit marble counter with soft shadows and save to `assets/bottle-studio.png`."*

---

## CLI Usage

```bash
# List models & pricing
npx -y github:chunge233/uxmio-image-mcp models

# Text-to-image
UXMIO_API_KEY=sk-your-key npx -y github:chunge233/uxmio-image-mcp generate \
  "Minimalist ceramic coffee cup on oak desk, studio lighting" \
  --model gpt-image-2.5 --size 1024x1024 --out ./coffee.png

# Multi-image reference editing
UXMIO_API_KEY=sk-your-key npx -y github:chunge233/uxmio-image-mcp edit \
  "Change the background to a warm Scandinavian studio, preserve product label" \
  --image ./raw-product.png --model gemini-3.1-flash-image --out ./studio-product.png
```

---

## Environment Variables

| Variable | Default | Description |
| :--- | :--- | :--- |
| `UXMIO_API_KEY` | *(required)* | API key (falls back to `OPENAI_API_KEY`) |
| `UXMIO_API_BASE_URL` | `https://api.uxmio.com/v1` | OpenAI-compatible base URL (falls back to `OPENAI_BASE_URL`) |
| `UXMIO_DEFAULT_MODEL` | `gpt-image-2.5` | Default model when `model` is omitted |
| `UXMIO_OUTPUT_DIR` | *(none)* | Optional default directory to auto-save images when `output_path` is omitted |
| `UXMIO_TIMEOUT_MS` | `120000` | Request timeout in milliseconds (`5000`–`600000`) |

---

## SDK & Workflow Examples

Ready-to-run snippets are included in [`examples/`](./examples):

- [`examples/curl.sh`](./examples/curl.sh) — cURL text-to-image & multipart image editing
- [`examples/node-generate.mjs`](./examples/node-generate.mjs) — Zero-dependency Node.js 18+ `fetch`
- [`examples/python-generate.py`](./examples/python-generate.py) — Official Python `openai` SDK
- [`examples/n8n-http-node.json`](./examples/n8n-http-node.json) — Importable n8n HTTP Request node
- [`examples/mcp-clients.json`](./examples/mcp-clients.json) — Drop-in MCP client config

---

## Development & Tests

```bash
npm test
```

All tests run with Node's built-in `node:test` runner against an in-process mock HTTP server — no external network or API key required.

## License

[MIT](./LICENSE)
