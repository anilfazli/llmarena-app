/**
 * OpenRouter API Client
 * Unified LLM gateway at https://openrouter.ai/api/v1
 */

const API_BASE = 'https://openrouter.ai/api/v1';
const API_KEY = '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';

/**
 * Available models — curated list requested by user
 */
export const MODELS = [
    {
        id: 'openai/gpt-5.2',
        name: 'ChatGPT 5.2',
        provider: 'OpenAI',
        icon: '🟢',
    },
    {
        id: 'google/gemini-3-pro-preview',
        name: 'Gemini 3 Pro',
        provider: 'Google',
        icon: '🔵',
    },
    {
        id: 'anthropic/claude-opus-4.6',
        name: 'Opus 4.6',
        provider: 'Anthropic',
        icon: '🟠',
    },
    {
        id: 'moonshotai/kimi-k2.5',
        name: 'Kimi K2.5',
        provider: 'Moonshot',
        icon: '🟣',
    },
];

/**
 * Build the chess prompt for an LLM
 */
function buildChessPrompt(color, fen, legalMoves, moveHistory) {
    const colorName = color === 'w' ? 'White' : 'Black';
    const historyStr = moveHistory.length > 0
        ? `\nMove history: ${moveHistory.join(' ')}`
        : '';

    return `You are playing chess as ${colorName}.
Current position (FEN): ${fen}
Legal moves available: ${legalMoves.join(', ')}${historyStr}

Respond with ONLY your chosen move in standard algebraic notation (SAN). No explanation, no extra text, just the move. Example: e4`;
}

/**
 * Request a move from an LLM model
 * @param {string} modelId - The model ID
 * @param {string} color - 'w' or 'b'
 * @param {string} fen - Current FEN string
 * @param {string[]} legalMoves - Array of legal moves in SAN
 * @param {string[]} moveHistory - Array of past moves
 * @returns {Promise<{move: string, raw: string}>}
 */
export async function requestMove(modelId, color, fen, legalMoves, moveHistory) {
    const prompt = buildChessPrompt(color, fen, legalMoves, moveHistory);

    const response = await fetch(`${API_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_KEY}`,
            'HTTP-Referer': 'https://llmarena.app',
            'X-Title': 'LLM Arena Chess',
        },
        body: JSON.stringify({
            model: modelId,
            stream: false,
            messages: [
                {
                    role: 'system',
                    content: 'You are a chess engine. You respond only with a single chess move in standard algebraic notation (SAN). Nothing else.',
                },
                {
                    role: 'user',
                    content: prompt,
                },
            ],
            max_tokens: 4096,
            temperature: 0.3,
            reasoning: { effort: 'low' },
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    console.log('[OpenRouter] Response:', JSON.stringify(data, null, 2));

    const choice = data.choices?.[0];
    let rawContent = '';

    if (choice) {
        const msg = choice.message;

        // 1. Try content field (standard path)
        if (msg) {
            if (typeof msg.content === 'string' && msg.content.trim()) {
                rawContent = msg.content.trim();
            } else if (Array.isArray(msg.content)) {
                const textPart = msg.content.find(p => p.type === 'text');
                rawContent = (textPart?.text || '').trim();
            }
        }

        // 2. If content is empty, try to extract a move from the reasoning text
        if (!rawContent && msg?.reasoning) {
            rawContent = extractMoveFromReasoning(msg.reasoning, legalMoves);
            if (rawContent) {
                console.log('[OpenRouter] Extracted from reasoning:', rawContent);
            }
        }
    }

    console.log('[OpenRouter] Final content:', JSON.stringify(rawContent));

    return {
        move: rawContent,
        raw: rawContent,
        debugKeys: choice
            ? `finish=${choice.finish_reason}, contentType=${typeof choice.message?.content}, hasReasoning=${!!choice.message?.reasoning}`
            : 'no-choices',
    };
}

/**
 * Extract a chess move from reasoning text by matching against legal moves
 */
function extractMoveFromReasoning(reasoning, legalMoves) {
    if (!reasoning || !legalMoves?.length) return '';

    // Sort legal moves longest-first to match "Nf3" before "f3"
    const sorted = [...legalMoves].sort((a, b) => b.length - a.length);

    // Look for quoted moves first: "e4", 'Nf3', `d5`
    for (const move of sorted) {
        const patterns = [`"${move}"`, `'${move}'`, `\`${move}\``];
        if (patterns.some(p => reasoning.includes(p))) {
            return move;
        }
    }

    // Look for "my move is X", "I'll play X", "best move is X" patterns
    const movePatterns = [
        /(?:my move|I(?:'ll| will) play|best move|I choose|move is|play)\s+(\S+)/gi,
        /represented as\s+"?(\S+?)"?[.\s]/gi,
    ];
    for (const pattern of movePatterns) {
        let match;
        while ((match = pattern.exec(reasoning)) !== null) {
            const candidate = match[1].replace(/[^a-zA-Z0-9#+=]/g, '');
            if (legalMoves.includes(candidate)) {
                return candidate;
            }
        }
    }

    // Last resort: scan reasoning backwards (answer tends to be near the end)
    const words = reasoning.split(/\s+/).reverse();
    for (const word of words) {
        const clean = word.replace(/[^a-zA-Z0-9#+=]/g, '');
        if (legalMoves.includes(clean)) {
            return clean;
        }
    }

    return '';
}

