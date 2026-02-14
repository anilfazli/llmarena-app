/**
 * Game Controller — Manages the game loop between two LLM players
 */

import { ChessEngine } from '../chess/engine.js';
import { ChessBoard } from '../chess/board.js';
import { requestMove, MODELS } from '../api/openrouter.js';
import { parseMove } from './moveParser.js';

const MAX_RETRIES = 3;
const MAX_CONSECUTIVE_FAILURES = 5;

export class GameController {
    constructor() {
        this.engine = new ChessEngine();
        this.board = new ChessBoard('chessboard');
        this.state = 'IDLE'; // IDLE | PLAYING | GAME_OVER
        this.whiteModel = null;
        this.blackModel = null;
        this.delay = 1000;
        this.abortController = null;
        this.consecutiveFailures = { w: 0, b: 0 };

        // Callbacks
        this.onMoveComplete = null;
        this.onGameOver = null;
        this.onLog = null;
        this.onStatusChange = null;
        this.onThinking = null;

        // Initial board render
        this.board.update(this.engine.getBoard());
    }

    setDelay(ms) {
        this.delay = ms;
    }

    setModels(whiteModelId, blackModelId) {
        this.whiteModel = MODELS.find(m => m.id === whiteModelId);
        this.blackModel = MODELS.find(m => m.id === blackModelId);
    }

    async start() {
        if (this.state === 'PLAYING') return;
        if (!this.whiteModel || !this.blackModel) {
            this._log('error', 'Select both models first!');
            return;
        }

        this.engine.reset();
        this.board.update(this.engine.getBoard());
        this.state = 'PLAYING';
        this.consecutiveFailures = { w: 0, b: 0 };
        this.abortController = new AbortController();

        this._log('info', `⚔️ Game started: ${this.whiteModel.name} vs ${this.blackModel.name}`);
        this.onStatusChange?.('Playing');

        this._gameLoop();
    }

    stop() {
        if (this.state !== 'PLAYING') return;
        this.state = 'IDLE';
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
        this._log('info', '🛑 Game stopped by user');
        this.onStatusChange?.('Stopped');
    }

    reset() {
        this.stop();
        this.engine.reset();
        this.board.update(this.engine.getBoard());
        this.state = 'IDLE';
        this.onStatusChange?.('Idle');
    }

    async _gameLoop() {
        while (this.state === 'PLAYING' && !this.engine.isGameOver()) {
            const turn = this.engine.getTurn();
            const model = turn === 'w' ? this.whiteModel : this.blackModel;
            const fen = this.engine.getFEN();
            const legalMoves = this.engine.getLegalMoves();
            const history = this.engine.getHistory();

            // Notify UI that model is thinking
            this.onThinking?.(turn, model.name);

            let moveResult = null;
            let success = false;

            for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
                if (this.state !== 'PLAYING') return;

                try {
                    this._log('info', `${model.icon} ${model.name} is thinking... (attempt ${attempt})`);

                    const response = await requestMove(model.id, turn, fen, legalMoves, history);

                    this._log('info', `${model.icon} ${model.name} responded: "${response.raw}" [keys: ${response.debugKeys}]`);

                    // Parse the response
                    const parsed = parseMove(response.raw, legalMoves);

                    if (parsed.move) {
                        // Valid SAN move found
                        moveResult = this.engine.makeMove(parsed.move);
                        if (moveResult) {
                            success = true;
                            this.consecutiveFailures[turn] = 0;
                            this._log('success', `${model.icon} ${model.name} plays: ${parsed.move} (${parsed.method})`);
                            break;
                        }
                    } else if (parsed.method === 'uci' && parsed.uci) {
                        // Try UCI move
                        moveResult = this.engine.makeMoveUCI(parsed.uci.from, parsed.uci.to, parsed.uci.promotion);
                        if (moveResult) {
                            success = true;
                            this.consecutiveFailures[turn] = 0;
                            this._log('success', `${model.icon} ${model.name} plays: ${moveResult.san} (UCI: ${parsed.uci.from}${parsed.uci.to})`);
                            break;
                        }
                    }

                    // Parse failed
                    this._log('error', `${model.icon} Failed to parse move from "${response.raw}" (attempt ${attempt}/${MAX_RETRIES})`);
                } catch (err) {
                    this._log('error', `${model.icon} API error: ${err.message} (attempt ${attempt}/${MAX_RETRIES})`);
                }
            }

            if (!success) {
                this.consecutiveFailures[turn]++;
                this._log('error', `${model.icon} ${model.name} failed all ${MAX_RETRIES} attempts (${this.consecutiveFailures[turn]} consecutive failures)`);

                if (this.consecutiveFailures[turn] >= MAX_CONSECUTIVE_FAILURES) {
                    // Model has failed too many times — forfeit
                    const winnerColor = turn === 'w' ? 'black' : 'white';
                    const winnerName = turn === 'w' ? this.blackModel.name : this.whiteModel.name;
                    this.state = 'GAME_OVER';
                    this._log('error', `🏳️ ${model.name} forfeits due to ${MAX_CONSECUTIVE_FAILURES} consecutive failures! ${winnerName} wins!`);
                    this.onGameOver?.({
                        text: `${model.name} forfeits!\n${winnerName} wins!`,
                        winner: winnerColor,
                        reason: 'forfeit',
                        draw: false,
                    });
                    return;
                }

                // Skip this turn with a random legal move as penalty
                const fallbackMove = legalMoves[Math.floor(Math.random() * legalMoves.length)];
                moveResult = this.engine.makeMove(fallbackMove);
                if (moveResult) {
                    this._log('info', `⚠️ Random fallback move for ${model.name}: ${fallbackMove}`);
                }
            }

            if (moveResult) {
                // Update board
                this.board.update(
                    this.engine.getBoard(),
                    { from: moveResult.from, to: moveResult.to },
                    this.engine.isCheck(),
                    this.engine.getTurn()
                );

                // Notify UI
                this.onMoveComplete?.(moveResult, turn, model);
            }

            // Check game over
            if (this.engine.isGameOver()) {
                this.state = 'GAME_OVER';
                const result = this.engine.getResult();
                this._log('success', `🏆 ${result}`);

                // Determine winner
                let winner = null;
                let draw = false;
                let reason = 'unknown';

                if (this.engine.isCheckmate()) {
                    // The side whose turn it is lost (they're checkmated)
                    winner = this.engine.getTurn() === 'w' ? 'black' : 'white';
                    reason = 'checkmate';
                } else if (this.engine.isDraw()) {
                    draw = true;
                    reason = this.engine.isStalemate() ? 'stalemate' :
                        this.engine.isThreefoldRepetition() ? 'repetition' :
                            this.engine.isInsufficientMaterial() ? 'insufficient' : 'fifty-move';
                }

                this.onGameOver?.({ text: result, winner, reason, draw });
                return;
            }

            // Delay between moves
            await this._sleep(this.delay);
        }
    }

    _sleep(ms) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(resolve, ms);
            // Allow abort
            if (this.abortController) {
                this.abortController.signal.addEventListener('abort', () => {
                    clearTimeout(timer);
                    resolve();
                });
            }
        });
    }

    _log(type, message) {
        this.onLog?.(type, message);
    }
}
