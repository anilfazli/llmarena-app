/**
 * Leaderboard — Tracks game results and persists to localStorage
 */

const STORAGE_KEY = 'llm-arena-leaderboard';

export class Leaderboard {
    constructor() {
        this.data = this._load();
    }

    /**
     * Record a game result
     * @param {Object} params
     * @param {string} params.white - White model name
     * @param {string} params.black - Black model name
     * @param {string} params.whiteId - White model ID
     * @param {string} params.blackId - Black model ID
     * @param {'white'|'black'|'draw'} params.winner
     * @param {string} params.reason - e.g. "checkmate", "forfeit", "stalemate"
     * @param {number} params.moves - Number of moves played
     * @param {string[]} [params.moveHistory] - Array of SAN moves played
     */
    recordGame({ white, black, whiteId, blackId, winner, reason, moves, moveHistory }) {
        const game = {
            id: Date.now(),
            white, black, whiteId, blackId,
            winner, reason, moves,
            moveHistory: moveHistory || [],
            timestamp: new Date().toISOString(),
        };

        this.data.games.push(game);

        // Update stats for white model
        this._ensureModel(whiteId, white);
        this._ensureModel(blackId, black);

        if (winner === 'white') {
            this.data.models[whiteId].wins++;
            this.data.models[blackId].losses++;
        } else if (winner === 'black') {
            this.data.models[blackId].wins++;
            this.data.models[whiteId].losses++;
        } else {
            this.data.models[whiteId].draws++;
            this.data.models[blackId].draws++;
        }

        this.data.models[whiteId].games++;
        this.data.models[blackId].games++;

        this._save();
    }

    /**
     * Get leaderboard sorted by wins, then win rate
     * Includes winsAsWhite and winsAsBlack calculated from game history
     */
    getStandings() {
        // Calculate color-based stats from game history
        const colorStats = {};
        for (const game of this.data.games) {
            if (!colorStats[game.whiteId]) colorStats[game.whiteId] = { winsAsWhite: 0, winsAsBlack: 0 };
            if (!colorStats[game.blackId]) colorStats[game.blackId] = { winsAsWhite: 0, winsAsBlack: 0 };
            if (game.winner === 'white') {
                colorStats[game.whiteId].winsAsWhite++;
            } else if (game.winner === 'black') {
                colorStats[game.blackId].winsAsBlack++;
            }
        }

        return Object.values(this.data.models)
            .map(m => ({
                ...m,
                winsAsWhite: colorStats[m.id]?.winsAsWhite || 0,
                winsAsBlack: colorStats[m.id]?.winsAsBlack || 0,
                winRate: m.games > 0 ? ((m.wins / m.games) * 100).toFixed(0) : '0',
            }))
            .sort((a, b) => {
                if (b.wins !== a.wins) return b.wins - a.wins;
                return parseFloat(b.winRate) - parseFloat(a.winRate);
            });
    }

    /**
     * Get match history — detailed game-by-game results
     */
    getMatchHistory(limit = 20) {
        return [...this.data.games].reverse().slice(0, limit).map(g => {
            const whiteName = (g.white || '').replace(/\s*\(.*\)/, '');
            const blackName = (g.black || '').replace(/\s*\(.*\)/, '');
            let result, winnerName;
            if (g.winner === 'white') {
                result = '1-0';
                winnerName = whiteName;
            } else if (g.winner === 'black') {
                result = '0-1';
                winnerName = blackName;
            } else {
                result = '½-½';
                winnerName = 'Draw';
            }
            return {
                ...g,
                whiteName,
                blackName,
                result,
                winnerName,
                reason: g.reason || '',
                moves: g.moves || 0,
            };
        });
    }

    /**
     * Get recent game history (raw)
     */
    getRecentGames(limit = 10) {
        return [...this.data.games].reverse().slice(0, limit);
    }

    /**
     * Clear all data
     */
    reset() {
        this.data = { models: {}, games: [] };
        this._save();
    }

    _ensureModel(id, name) {
        if (!this.data.models[id]) {
            this.data.models[id] = {
                id, name,
                wins: 0, losses: 0, draws: 0, games: 0,
            };
        }
        // Always update name in case it changed
        this.data.models[id].name = name;
    }

    _load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed.models && parsed.games) return parsed;
            }
        } catch (e) {
            console.warn('[Leaderboard] Failed to load:', e);
        }
        return { models: {}, games: [] };
    }

    _save() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
        } catch (e) {
            console.warn('[Leaderboard] Failed to save:', e);
        }
    }
}
