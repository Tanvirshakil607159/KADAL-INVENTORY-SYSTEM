/**
 * Buyer Name Normalizer
 * 
 * Provides a canonical mapping of buyer names and a normalization function
 * to prevent duplicate buyer entries caused by inconsistent casing during
 * bulk data uploads.
 * 
 * Usage:
 *   const { normalizeBuyerName } = require('./buyer-normalizer');
 *   const name = normalizeBuyerName('regatta');  // Returns 'REGATTA'
 *   const name2 = normalizeBuyerName('INTERSPORTS SS27');  // Returns 'INTERSPORTS'
 */

// Canonical buyer names — the "correct" format for each known buyer
const CANONICAL_BUYERS = [
  'REGATTA',
  'INTERSPORTS',
  'REEBOK',
  'UMBRO',
  'SPORTISIMO',
  'TEXTISS SAS',
  'MEXICO DC',
  'DARE2B',
  'RAW GROUP',
  'PWT BRANDS',
  'XCEL BASPOKED LTD',
];

// Known typos/aliases that map to canonical names
const BUYER_ALIASES = {
  'SPROTISIMO': 'SPORTISIMO',
};

/**
 * Normalize a buyer name to its canonical format.
 * 
 * Matching priority:
 * 1. Exact match (case-insensitive) against canonical list
 * 2. Known typo/alias correction (e.g., "SPROTISIMO" → "SPORTISIMO")
 * 3. Input starts with a canonical name (e.g., "INTERSPORTS SS27" → "INTERSPORTS")
 * 4. If no match found, convert to UPPERCASE for consistency
 * 
 * @param {string} input - The buyer name to normalize
 * @returns {string} The normalized buyer name
 */
function normalizeBuyerName(input) {
  if (!input || typeof input !== 'string') return input;
  
  const trimmed = input.trim();
  if (!trimmed) return trimmed;
  
  const upper = trimmed.toUpperCase();
  
  // 1. Exact match (case-insensitive)
  const exactMatch = CANONICAL_BUYERS.find(b => b === upper);
  if (exactMatch) return exactMatch;
  
  // 2. Known typo/alias correction
  if (BUYER_ALIASES[upper]) return BUYER_ALIASES[upper];
  
  // 3. Input starts with a canonical name (handles cases like "INTERSPORTS SS27")
  //    Sort by length descending so longer canonical names match first
  const sortedBuyers = [...CANONICAL_BUYERS].sort((a, b) => b.length - a.length);
  for (const canonical of sortedBuyers) {
    if (upper.startsWith(canonical + ' ') || upper.startsWith(canonical + '-')) {
      return canonical;
    }
  }
  
  // 4. No match — default to UPPERCASE for consistent formatting
  return upper;
}

module.exports = { normalizeBuyerName, CANONICAL_BUYERS };
