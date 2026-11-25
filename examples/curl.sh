#!/usr/bin/env bash
set -euo pipefail

# Standard OpenAI-compatible image generation via api.uxmio.com
# Pricing starts at ¥0.01 (~$0.0014) / image for gpt-image-2.5

export UXMIO_API_KEY="${UXMIO_API_KEY:-sk-your-key}"
export UXMIO_API_BASE_URL="${UXMIO_API_BASE_URL:-https://api.uxmio.com/v1}"

# 1) Text-to-image (returns URL or b64_json)
curl -sS "${UXMIO_API_BASE_URL}/images/generations" \
  -H "Authorization: Bearer ${UXMIO_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-image-2.5",
    "prompt": "Minimalist studio product photography of a matte black wireless headphone on warm stone, soft natural daylight, 85mm lens",
    "size": "1024x1024",
    "response_format": "url"
  }'

echo ""

# 2) Image-to-image editing (multipart/form-data)
# curl -sS "${UXMIO_API_BASE_URL}/images/edits" \
#   -H "Authorization: Bearer ${UXMIO_API_KEY}" \
#   -F "model=gemini-3.1-flash-image" \
#   -F "prompt=Replace background with a sunlit Scandinavian wooden desk, keep product identical" \
#   -F "image=@./product.png"
