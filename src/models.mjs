export const DEFAULT_BASE_URL = 'https://api.uxmio.com/v1';
export const DEFAULT_MODEL = 'gpt-image-2.5';

export const IMAGE_MODELS = [
  {
    id: 'gpt-image-2',
    family: 'GPT Image',
    priceCny: 0.01,
    priceUsdApprox: 0.0014,
    supportsGenerate: true,
    supportsEdit: true,
    bestFor: 'Fast drafts, UI placeholders, icons, and high-volume batch generation',
    bestForZh: '高速草图、图标素材、大批量低成本出图',
  },
  {
    id: 'gpt-image-2.5',
    family: 'GPT Image',
    priceCny: 0.01,
    priceUsdApprox: 0.0014,
    supportsGenerate: true,
    supportsEdit: true,
    recommended: true,
    bestFor: 'Best default price-to-quality ratio for general text-to-image and image editing',
    bestForZh: '默认首选，极致性价比，适合日常文生图与批量修图',
  },
  {
    id: 'gpt-image-2.6',
    family: 'GPT Image',
    priceCny: 0.03,
    priceUsdApprox: 0.0041,
    supportsGenerate: true,
    supportsEdit: true,
    bestFor: 'Richer lighting, sharper texture detail, and complex multi-subject prompts',
    bestForZh: '光影质感与复杂构图更稳，适合营销配图与精细场景',
  },
  {
    id: 'gemini-3.1-flash-image',
    aliases: ['gemini-3.1-flash-image-preview'],
    family: 'Gemini Image (Nano Banana 2)',
    priceCny: 0.06,
    priceUsdApprox: 0.0082,
    supportsGenerate: true,
    supportsEdit: true,
    bestFor: 'Accurate multilingual/CJK typography, posters, e-commerce product shots, multi-ref edits',
    bestForZh: '中英文海报排版、电商产品主图、多图参考编辑',
  },
  {
    id: 'gemini-3-pro-image',
    aliases: ['gemini-3-pro-image-preview'],
    family: 'Gemini Image (Nano Banana Pro)',
    priceCny: 0.09,
    priceUsdApprox: 0.0123,
    supportsGenerate: true,
    supportsEdit: true,
    bestFor: 'Flagship studio photography, high-fidelity brand visuals, strict reference consistency',
    bestForZh: '旗舰商业摄影质感、细节保真与严格多图一致性',
  },
];

export const COMMON_SIZES = [
  '1024x1024',
  '1024x1536',
  '1536x1024',
  '1024x1792',
  '1792x1024',
  'auto',
];

export const COMMON_QUALITIES = ['auto', 'low', 'medium', 'high'];
