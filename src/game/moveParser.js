/**
 * Move Parser — Extract a valid chess move from LLM response
 */

/**
 * Parse an LLM response and extract a valid chess move
 * @param {string} response - Raw LLM response text
 * @param {string[]} legalMoves - Array of legal SAN moves
 * @returns {{ move: string|null, method: string }}
 */
export function parseMove(response, legalMoves) {
    if (!response || !legalMoves.length) {
        return { move: null, method: 'empty' };
    }

    const cleaned = response.trim();

    // 1. Direct match — the response IS a legal move
    if (legalMoves.includes(cleaned)) {
        return { move: cleaned, method: 'direct' };
    }

    // 2. Try to find a legal move in the response (exact word match)
    // Sort by length descending to match longer moves first (e.g. "Nxe5+" before "e5")
    const sortedMoves = [...legalMoves].sort((a, b) => b.length - a.length);

    for (const move of sortedMoves) {
        // Escape special regex characters in move notation
        const escaped = move.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b${escaped}\\b`);
        if (regex.test(cleaned)) {
            return { move, method: 'regex' };
        }
    }

    // 3. Try without word boundaries (for moves like "O-O" or "O-O-O")
    for (const move of sortedMoves) {
        if (cleaned.includes(move)) {
            return { move, method: 'includes' };
        }
    }

    // 4. UCI notation fallback (e.g. "e2e4" or "e7e8q")
    const uciMatch = cleaned.match(/\b([a-h][1-8])([a-h][1-8])([qrbn])?\b/i);
    if (uciMatch) {
        const [, from, to, promo] = uciMatch;
        // Find matching SAN move from legal moves
        // We can't directly convert UCI to SAN without the engine, but we can try
        // to find a legal move that matches the from-to squares
        return { move: null, method: 'uci', uci: { from, to, promotion: promo?.toLowerCase() } };
    }

    // 5. No valid move found
    return { move: null, method: 'failed' };
}
