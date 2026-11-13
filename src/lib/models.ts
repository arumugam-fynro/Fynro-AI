export const MODELS = [
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5', note: 'Best balance of speed and quality' },
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5', note: 'Most capable, slower' },
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5', note: 'Fastest and cheapest' },
] as const;
export const DEFAULT_MODEL: string = MODELS[0].id;
