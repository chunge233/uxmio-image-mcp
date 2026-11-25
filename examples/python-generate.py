"""
Python example using the official `openai` SDK with api.uxmio.com.
Install: pip install openai
"""

import base64
import os
from pathlib import Path
from openai import OpenAI

client = OpenAI(
    api_key=os.environ.get("UXMIO_API_KEY", "sk-your-key"),
    base_url=os.environ.get("UXMIO_API_BASE_URL", "https://api.uxmio.com/v1"),
)

# Text-to-image (gpt-image-2.5 = ¥0.01 / ~$0.0014 per image)
resp = client.images.generate(
    model="gpt-image-2.5",
    prompt="Editorial studio photo of a ceramic matcha cup on linen cloth, soft morning shadows",
    size="1024x1024",
    response_format="b64_json",
)

b64_data = resp.data[0].b64_json
if b64_data:
    Path("matcha.png").write_bytes(base64.b64decode(b64_data))
    print("Saved matcha.png")
else:
    print("URL:", resp.data[0].url)
