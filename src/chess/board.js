/**
 * Chessboard Renderer — Pure DOM-based with Unicode pieces
 */

const PIECE_UNICODE = {
    wp: '♙', wn: '♘', wb: '♗', wr: '♖', wq: '♕', wk: '♔',
    bp: '♟', bn: '♞', bb: '♝', br: '♜', bq: '♛', bk: '♚',
};

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];

export class ChessBoard {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.squares = {};
        this.lastMove = null;
        this.checkSquare = null;
        this._buildBoard();
    }

    _buildBoard() {
        this.container.innerHTML = '';
        for (let r = 0; r < 8; r++) {
            for (let f = 0; f < 8; f++) {
                const square = document.createElement('div');
                const sqName = FILES[f] + RANKS[r];
                const isLight = (r + f) % 2 === 0;
                square.className = `square ${isLight ? 'light' : 'dark'}`;
                square.dataset.square = sqName;

                // File labels on bottom row
                if (r === 7) {
                    const fileLabel = document.createElement('span');
                    fileLabel.className = 'file-label';
                    fileLabel.textContent = FILES[f];
                    square.appendChild(fileLabel);
                }
                // Rank labels on left column
                if (f === 0) {
                    const rankLabel = document.createElement('span');
                    rankLabel.className = 'rank-label';
                    rankLabel.textContent = RANKS[r];
                    square.appendChild(rankLabel);
                }

                this.squares[sqName] = square;
                this.container.appendChild(square);
            }
        }
    }

    /**
     * Update the board from a chess.js board array
     * @param {Array} board - 8x8 array from chess.js .board()
     * @param {Object} lastMove - { from, to } of last move
     * @param {boolean} inCheck - is current player in check
     * @param {string} turn - 'w' or 'b'
     */
    update(board, lastMove = null, inCheck = false, turn = 'w') {
        // Clear highlights
        this._clearHighlights();

        // Update pieces
        for (let r = 0; r < 8; r++) {
            for (let f = 0; f < 8; f++) {
                const sqName = FILES[f] + RANKS[r];
                const square = this.squares[sqName];
                const piece = board[r][f];

                // Remove existing piece
                const existingPiece = square.querySelector('.piece');
                if (existingPiece) existingPiece.remove();

                if (piece) {
                    const pieceEl = document.createElement('span');
                    pieceEl.className = `piece ${piece.color === 'w' ? 'piece-white' : 'piece-black'}`;
                    const key = piece.color + piece.type;
                    pieceEl.textContent = PIECE_UNICODE[key] || '';
                    square.appendChild(pieceEl);

                    // Check highlight on king
                    if (inCheck && piece.type === 'k' && piece.color === turn) {
                        square.classList.add('check');
                    }
                }
            }
        }

        // Highlight last move
        if (lastMove) {
            this.lastMove = lastMove;
            if (this.squares[lastMove.from]) {
                this.squares[lastMove.from].classList.add('highlight-from');
            }
            if (this.squares[lastMove.to]) {
                this.squares[lastMove.to].classList.add('highlight-to');
            }
        }
    }

    _clearHighlights() {
        Object.values(this.squares).forEach(sq => {
            sq.classList.remove('highlight-from', 'highlight-to', 'check');
        });
    }
}
