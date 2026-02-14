import { Chess } from 'chess.js';

/**
 * Chess Engine — Wrapper around chess.js
 */
export class ChessEngine {
    constructor() {
        this.game = new Chess();
    }

    reset() {
        this.game.reset();
    }

    getFEN() {
        return this.game.fen();
    }

    getPGN() {
        return this.game.pgn();
    }

    getTurn() {
        return this.game.turn(); // 'w' or 'b'
    }

    getMoveNumber() {
        return this.game.moveNumber();
    }

    getLegalMoves() {
        return this.game.moves();
    }

    getLegalMovesVerbose() {
        return this.game.moves({ verbose: true });
    }

    makeMove(san) {
        try {
            const result = this.game.move(san);
            return result;
        } catch (e) {
            return null;
        }
    }

    makeMoveUCI(from, to, promotion) {
        try {
            const result = this.game.move({ from, to, promotion: promotion || undefined });
            return result;
        } catch (e) {
            return null;
        }
    }

    isGameOver() {
        return this.game.isGameOver();
    }

    isCheckmate() {
        return this.game.isCheckmate();
    }

    isStalemate() {
        return this.game.isStalemate();
    }

    isDraw() {
        return this.game.isDraw();
    }

    isCheck() {
        return this.game.isCheck();
    }

    isThreefoldRepetition() {
        return this.game.isThreefoldRepetition();
    }

    isInsufficientMaterial() {
        return this.game.isInsufficientMaterial();
    }

    getBoard() {
        return this.game.board();
    }

    getHistory() {
        return this.game.history();
    }

    getHistoryVerbose() {
        return this.game.history({ verbose: true });
    }

    getResult() {
        if (!this.isGameOver()) return null;
        if (this.isCheckmate()) {
            return this.getTurn() === 'w' ? 'Black wins by checkmate!' : 'White wins by checkmate!';
        }
        if (this.isStalemate()) return 'Draw by stalemate';
        if (this.isThreefoldRepetition()) return 'Draw by threefold repetition';
        if (this.isInsufficientMaterial()) return 'Draw by insufficient material';
        return 'Draw';
    }

    undoMove() {
        return this.game.undo();
    }
}
