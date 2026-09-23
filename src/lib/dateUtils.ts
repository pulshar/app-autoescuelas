/**
 * Utility functions for date formatting in DD/MM/YYYY format.
 */

/**
 * Formats a date string like '2026-09-25' (or Date object / ISO string) into '25/09/2026'.
 * If the input is null, undefined, or empty, returns empty string.
 */
export function formatDisplayDate(dateStr?: string | null | Date): string {
  if (!dateStr) return '';
  if (dateStr instanceof Date) {
    const day = String(dateStr.getDate()).padStart(2, '0');
    const month = String(dateStr.getMonth() + 1).padStart(2, '0');
    const year = dateStr.getFullYear();
    return `${day}/${month}/${year}`;
  }

  const str = String(dateStr).trim();
  // Check if it matches YYYY-MM-DD
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const [, year, month, day] = match;
    return `${day}/${month}/${year}`;
  }

  // Fallback: check if valid Date
  try {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    }
  } catch {
    // ignore
  }

  return str;
}

/**
 * Replaces any occurrence of YYYY-MM-DD (e.g. 2026-09-25) in arbitrary text with DD/MM/YYYY (25/09/2026).
 */
export function replaceDateInText(text?: string | null): string {
  if (!text) return '';
  return text.replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, (_match, y, m, d) => `${d}/${m}/${y}`);
}
