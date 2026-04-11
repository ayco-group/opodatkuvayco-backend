// Default values (used as fallback if env variables are not set)
export const DEFAULT_DEALS_TAX_FEE = 0.18;
export const DEFAULT_DEALS_MILITARY_FEE = 0.05;
export const DEFAULT_DIVIDENDS_TAX_FEE = 0.095;
export const DEFAULT_DIVIDENDS_MILITARY_FEE = 0.05;

// Environment variable keys
export const TAX_CONFIG_KEYS = {
  DEALS_TAX_FEE: 'DEALS_TAX_FEE',
  DEALS_MILITARY_FEE: 'DEALS_MILITARY_FEE',
  DIVIDENDS_TAX_FEE: 'DIVIDENDS_TAX_FEE',
  DIVIDENDS_MILITARY_FEE: 'DIVIDENDS_MILITARY_FEE',
} as const;
