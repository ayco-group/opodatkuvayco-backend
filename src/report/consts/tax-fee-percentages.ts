// Default values (used as fallback if env variables are not set)
export const DEFAULT_MILITARY_FEE = 0.015;
export const DEFAULT_DEALS_TAX_FEE = 0.18;
export const DEFAULT_DIVIDENDS_TAX_FEE = 0.095;

// Environment variable keys
export const TAX_CONFIG_KEYS = {
  DEALS_TAX_FEE: 'DEALS_TAX_FEE',
  MILITARY_FEE: 'MILITARY_FEE',
  DIVIDENDS_TAX_FEE: 'DIVIDENDS_TAX_FEE',
} as const;
