# uxmio-image-mcp（中文文档）

[English README](./README.md) | [API 控制台 (api.uxmio.com)](https://api.uxmio.com/?utm_source=github_mcp) | [Web 生图工作台 (image.uxmio.com)](https://image.uxmio.com/?utm_source=github_mcp)

**零外部依赖**的 AI 生图 & 多图参考编辑 **MCP Server + CLI 工具**。  
接入 **Claude Code / Cursor / Windsurf / Cline / Cherry Studio** 后，AI 写代码或写文档时可以直接调用生图/修图接口，并把生成的图片保存到项目指定目录。

- 默认对接 **[api.uxmio.com](https://api.uxmio.com/?utm_source=github_mcp)**（标准 OpenAI `/v1/images/generations` & `/v1/images/edits` 协议，按张计费，**¥0.01/张起**，无月费）。
- 同时**完全兼容任何 OpenAI 格式图片 API**（通过 `UXMIO_API_BASE_URL` 自定义中转站或官方接口）。

---

## 支持模型与参考价格（`api.uxmio.com`）

| 模型 ID | 所属系列 | 单张参考价 | 适用场景 |
| :--- | :--- | :---: | :--- |
| `gpt-image-2` | GPT Image | **¥0.01 / 张** | 快速草图、图标素材、大批量自动化出图 |
| **`gpt-image-2.5`**（默认） | GPT Image | **¥0.01 / 张** | 日常文生图与修图首选，性价比最高 |
| `gpt-image-2.6` | GPT Image | **¥0.03 / 张** | 细节质感更锐利、光影与复杂构图更稳 |
| `gemini-3.1-flash-image` | Nano Banana 2 | **¥0.06 / 张** | 中英文精准排版海报、电商产品主图、多图参考编辑 |
| `gemini-3-pro-image` | Nano Banana Pro | **¥0.09 / 张** | 旗舰商业摄影质感、高保真品牌视觉、严格参考一致性 |

> 在 [api.uxmio.com](https://api.uxmio.com/?utm_source=github_mcp) 注册即可创建 API Key，余额与 [image.uxmio.com](https://image.uxmio.com/?utm_source=github_mcp) 网页工作台完全互通。

---

## 一分钟接入 MCP

### Claude Code

```bash
claude mcp add uxmio-image \
  -e UXMIO_API_KEY=sk-你的密钥 \
  -- npx -y github:chunge233/uxmio-image-mcp
```

### Cursor / Windsurf / Cline / Cherry Studio

在客户端的 MCP 配置文件中加入：

```json
{
  "mcpServers": {
    "uxmio-image": {
      "command": "npx",
      "args": ["-y", "github:chunge233/uxmio-image-mcp"],
      "env": {
        "UXMIO_API_KEY": "sk-你的密钥",
        "UXMIO_API_BASE_URL": "https://api.uxmio.com/v1",
        "UXMIO_DEFAULT_MODEL": "gpt-image-2.5"
      }
    }
  }
}
```

接入后，直接在对话里说：
> 「帮我用 `gpt-image-2.5` 生成一张 1536x1024 的深色科技感 SaaS 首页配图，直接保存到 `public/hero.png`。」
> 「用 `gemini-3.1-flash-image` 把 `assets/bottle.png` 的背景换成自然光大理石桌面，保留瓶身文字不变，输出到 `assets/bottle-new.png`。」

---

## 命令行（CLI）模式

除了 MCP，也可以在终端或脚本里直接当生图命令行使用：

```bash
# 查看模型与单价
npx -y github:chunge233/uxmio-image-mcp models

# 文生图并保存到本地
UXMIO_API_KEY=sk-你的密钥 npx -y github:chunge233/uxmio-image-mcp generate \
  "极简北欧风白瓷咖啡杯放在原木桌面上，自然窗光，商业静物摄影" \
  --model gpt-image-2.5 --size 1024x1024 --out ./coffee.png

# 参考图编辑（支持 1~4 张本地图片）
UXMIO_API_KEY=sk-你的密钥 npx -y github:chunge233/uxmio-image-mcp edit \
  "保持产品主体与标签文字不变，更换为柔和阳光下的浅灰石材台面" \
  --image ./raw.png --model gemini-3.1-flash-image --out ./edited.png
```

---

## 代码示例与工作流模板

详见 [`examples/`](./examples) 目录：
- [`curl.sh`](./examples/curl.sh) — cURL 文生图与多图编辑
- [`node-generate.mjs`](./examples/node-generate.mjs) — Node.js 18+ 原生 `fetch`（零依赖）
- [`python-generate.py`](./examples/python-generate.py) — Python 官方 `openai` SDK 调用示例
- [`n8n-http-node.json`](./examples/n8n-http-node.json) — n8n 可直接导入的生图 HTTP 节点

## 本地测试

```bash
npm test
```

## 开源协议

[MIT](./LICENSE)
