/**
 * Parses a numeric string from an IBKR CSV report.
 * Handles:
 *  - thousands separators: "1,234,567.89" → 1234567.89
 *  - accounting negatives: "(12.34)" → -12.34
 */
export function parseIbkrNumber(value: string): number {
  const normalized = value.trim();
  const isNegative = normalized.startsWith('(') && normalized.endsWith(')');
  const unsigned = isNegative ? normalized.slice(1, -1) : normalized;
  const parsed = parseFloat(unsigned.replace(/,/g, ''));
  return isNegative ? -parsed : parsed;
}
