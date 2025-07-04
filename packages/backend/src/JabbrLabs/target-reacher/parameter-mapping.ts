// [Canonical parameter mapping for Target Reacher. No duplications.]

// Utility to map between camelCase and snake_case for strategy parameters

export function camelToSnake(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key in obj) {
    if (!Object.prototype.hasOwnProperty.call(obj, key)) {continue;}
    const snake = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    out[snake] = obj[key];
  }
  return out;
}

export function snakeToCamel(obj: Record<string, unknown>): Record<string, unknown> {
  if (!obj || typeof obj !== 'object') {return obj;}
  const result: Record<string, unknown> = {};
  for (const key in obj) {
    if (!Object.prototype.hasOwnProperty.call(obj, key)) {continue;}
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    const value = obj[key];
    result[camelKey] = (value && typeof value === 'object' && !Array.isArray(value))
      ? snakeToCamel(value as Record<string, unknown>)
      : value;
  }
  return result;
}
