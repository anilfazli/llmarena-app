/**
 * LLM Arena — Main Entry Point
 */

import './style.css';
import { GameController } from './game/controller.js';
import { MODELS } from './api/openrouter.js';
import { Leaderboard } from './game/leaderboard.js';

// --- DOM Elements ---
const whiteSelect = document.getElementById('white-model');
const blackSelect = document.getElementById('black-model');
const btnFight = document.getElementById('btn-fight');
const btnStop = document.getElementById('btn-stop');
const btnNew = document.getElementById('btn-new');
const speedSlider = document.getElementById('speed');
const speedLabel = document.getElementById('speed-label');
const moveCount = document.getElementById('move-count');
const currentTurn = document.getElementById('current-turn');
const gameStatus = document.getElementById('game-status');
const moveList = document.getElementById('move-list');
const gameLog = document.getElementById('game-log');
const whiteStatus = document.getElementById('white-status');
const blackStatus = document.getElementById('black-status');
const gameResult = document.getElementById('game-result');
const resultText = document.getElementById('result-text');
const leaderboardBody = document.getElementById('leaderboard-body');
const matchHistoryEl = document.getElementById('match-history');
const btnResetLb = document.getElementById('btn-reset-lb');
const thinkingWhite = document.getElementById('thinking-white');
const thinkingBlack = document.getElementById('thinking-black');
const thinkingWhiteName = document.getElementById('thinking-white-name');
const thinkingBlackName = document.getElementById('thinking-black-name');

// --- Initialize Game Controller & Leaderboard ---
const game = new GameController();
const leaderboard = new Leaderboard();

// --- Leaderboard Rendering ---
function renderLeaderboard() {
  const standings = leaderboard.getStandings();
  if (standings.length === 0) {
    leaderboardBody.innerHTML = '<tr><td colspan="8" class="lb-empty">No games yet</td></tr>';
    matchHistoryEl.innerHTML = '<div class="lb-empty">No matches played yet</div>';
    return;
  }
  leaderboardBody.innerHTML = standings.map((m, i) => {
    const rankClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`;
    const shortName = m.name.replace(/\s*\(.*\)/, '').substring(0, 14);
    return `<tr>
            <td class="lb-rank ${rankClass}">${medal}</td>
            <td title="${m.name}">${shortName}</td>
            <td class="lb-wins">${m.wins}</td>
            <td class="lb-losses">${m.losses}</td>
            <td class="lb-draws">${m.draws}</td>
            <td class="lb-color-w" title="Wins as White">♔${m.winsAsWhite}</td>
            <td class="lb-color-b" title="Wins as Black">♚${m.winsAsBlack}</td>
            <td class="lb-winrate">${m.winRate}%</td>
        </tr>`;
  }).join('');

  // Render match history
  const matches = leaderboard.getMatchHistory();
  if (matches.length === 0) {
    matchHistoryEl.innerHTML = '<div class="lb-empty">No matches played yet</div>';
    return;
  }
  matchHistoryEl.innerHTML = matches.map((g, i) => {
    const resultClass = g.winner === 'white' ? 'result-white' : g.winner === 'black' ? 'result-black' : 'result-draw';
    const movesStr = (g.moveHistory || []).length > 0
      ? g.moveHistory.map((m, idx) => idx % 2 === 0 ? `${Math.floor(idx / 2) + 1}. ${m}` : m).join(' ')
      : `${g.moves} moves`;
    const hasExpand = (g.moveHistory || []).length > 0;
    return `<div class="match-card" data-idx="${i}">
      <div class="match-summary" ${hasExpand ? 'onclick="this.parentElement.classList.toggle(\'expanded\')"' : ''}>
        <span class="match-players">
          <span class="match-white" title="White">♔ ${g.whiteName}</span>
          <span class="match-result ${resultClass}">${g.result}</span>
          <span class="match-black" title="Black">♚ ${g.blackName}</span>
        </span>
        <span class="match-meta">
          <span class="match-reason">${g.reason}</span>
          <span class="match-moves">${g.moves} moves</span>
          ${hasExpand ? '<span class="match-expand-icon">▶</span>' : ''}
        </span>
      </div>
      ${hasExpand ? `<div class="match-detail"><div class="match-pgn">${movesStr}</div></div>` : ''}
    </div>`;
  }).join('');
}

renderLeaderboard();

// --- Populate Model Selects ---
function populateModelSelects() {
  MODELS.forEach(model => {
    const option = document.createElement('option');
    option.value = model.id;
    option.textContent = `${model.icon} ${model.name} (${model.provider})`;
    whiteSelect.appendChild(option.cloneNode(true));
    blackSelect.appendChild(option);
  });
}

populateModelSelects();

// --- Model Selection ---
function checkReady() {
  const ready = whiteSelect.value && blackSelect.value;
  btnFight.disabled = !ready;
}

whiteSelect.addEventListener('change', checkReady);
blackSelect.addEventListener('change', checkReady);

// --- Speed Control ---
speedSlider.addEventListener('input', () => {
  const val = parseInt(speedSlider.value);
  speedLabel.textContent = `${(val / 1000).toFixed(1)}s`;
  game.setDelay(val);
});

// --- Fight Button ---
btnFight.addEventListener('click', () => {
  game.setModels(whiteSelect.value, blackSelect.value);

  // Clear UI
  moveList.innerHTML = '';
  gameLog.innerHTML = '';
  moveCount.textContent = '0';
  currentTurn.textContent = '—';
  gameResult.style.display = 'none';
  whiteStatus.textContent = 'Ready';
  whiteStatus.className = 'fighter-status';
  blackStatus.textContent = 'Ready';
  blackStatus.className = 'fighter-status';

  // Toggle buttons
  btnFight.style.display = 'none';
  btnStop.style.display = '';
  btnNew.style.display = 'none';

  // Disable selects
  whiteSelect.disabled = true;
  blackSelect.disabled = true;

  game.start();

  // Set thinking panel names
  const wModel = MODELS.find(m => m.id === whiteSelect.value);
  const bModel = MODELS.find(m => m.id === blackSelect.value);
  thinkingWhiteName.textContent = wModel?.name || 'White';
  thinkingBlackName.textContent = bModel?.name || 'Black';
  thinkingWhite.textContent = '🤔 Thinking...';
  thinkingBlack.textContent = 'Waiting for turn...';
});

// --- Stop Button ---
btnStop.addEventListener('click', () => {
  game.stop();
  btnStop.style.display = 'none';
  btnNew.style.display = '';
  whiteStatus.textContent = 'Stopped';
  whiteStatus.className = 'fighter-status';
  blackStatus.textContent = 'Stopped';
  blackStatus.className = 'fighter-status';
});

// --- New Game Button ---
btnNew.addEventListener('click', () => {
  game.reset();
  btnNew.style.display = 'none';
  btnFight.style.display = '';
  btnFight.disabled = false;
  whiteSelect.disabled = false;
  blackSelect.disabled = false;
  moveList.innerHTML = '';
  gameLog.innerHTML = '';
  moveCount.textContent = '0';
  currentTurn.textContent = '—';
  gameStatus.textContent = 'Idle';
  gameResult.style.display = 'none';
  whiteStatus.textContent = 'Waiting';
  whiteStatus.className = 'fighter-status';
  blackStatus.textContent = 'Waiting';
  blackStatus.className = 'fighter-status';
  thinkingWhite.textContent = 'Waiting for game to start...';
  thinkingBlack.textContent = 'Waiting for game to start...';
  thinkingWhiteName.textContent = 'White';
  thinkingBlackName.textContent = 'Black';
});

// --- Game Callbacks ---

// Move complete
game.onMoveComplete = (moveResult, turn, model) => {
  const moveNum = game.engine.getMoveNumber();
  const history = game.engine.getHistory();

  // Update info panel
  moveCount.textContent = history.length;
  currentTurn.textContent = game.engine.getTurn() === 'w' ? 'White' : 'Black';

  // Update move history
  if (turn === 'w') {
    // New row for white's move
    const row = document.createElement('div');
    row.className = 'move-row current';
    row.innerHTML = `
      <span class="move-num">${moveNum}.</span>
      <span class="move-white">${moveResult.san}</span>
      <span class="move-black"></span>
    `;
    // Remove current highlight from previous row
    const prevCurrent = moveList.querySelector('.current');
    if (prevCurrent) prevCurrent.classList.remove('current');
    moveList.appendChild(row);
  } else {
    // Add black's move to last row
    const lastRow = moveList.lastElementChild;
    if (lastRow) {
      const blackCell = lastRow.querySelector('.move-black');
      if (blackCell) blackCell.textContent = moveResult.san;
      // Move current highlight
      const prevCurrent = moveList.querySelector('.current');
      if (prevCurrent) prevCurrent.classList.remove('current');
      lastRow.classList.add('current');
    }
  }

  // Auto-scroll move list
  moveList.scrollTop = moveList.scrollHeight;

  // Reset status
  whiteStatus.textContent = turn === 'w' ? `Played: ${moveResult.san}` : whiteStatus.textContent;
  whiteStatus.className = 'fighter-status';
  blackStatus.textContent = turn === 'b' ? `Played: ${moveResult.san}` : blackStatus.textContent;
  blackStatus.className = 'fighter-status';
};

// Thinking
game.onThinking = (turn, modelName) => {
  if (turn === 'w') {
    whiteStatus.textContent = `🤔 Thinking...`;
    whiteStatus.className = 'fighter-status thinking';
    blackStatus.className = 'fighter-status';
  } else {
    blackStatus.textContent = `🤔 Thinking...`;
    blackStatus.className = 'fighter-status thinking';
    whiteStatus.className = 'fighter-status';
  }
  currentTurn.textContent = turn === 'w' ? 'White' : 'Black';
};

// Move Response (reasoning/thinking)
game.onMoveResponse = (turn, model, response) => {
  const el = turn === 'w' ? thinkingWhite : thinkingBlack;
  const reasoning = response.reasoning;
  const content = typeof response.content === 'string' ? response.content : '';

  if (reasoning) {
    el.textContent = reasoning;
  } else if (content) {
    el.textContent = content;
  } else {
    el.textContent = `Played: ${response.move || '(no response)'}`;
  }

  // Auto-scroll to bottom so user can follow the thinking
  el.scrollTop = el.scrollHeight;
};

// Game Over
game.onGameOver = (result) => {
  gameStatus.textContent = 'Game Over';
  resultText.textContent = result.text;
  gameResult.style.display = 'flex';

  btnStop.style.display = 'none';
  btnNew.style.display = '';

  whiteStatus.textContent = 'Game Over';
  whiteStatus.className = 'fighter-status';
  blackStatus.textContent = 'Game Over';
  blackStatus.className = 'fighter-status';

  // Record to leaderboard
  if (result.winner || result.draw) {
    const history = game.engine.getHistory();
    leaderboard.recordGame({
      white: game.whiteModel.name,
      black: game.blackModel.name,
      whiteId: game.whiteModel.id,
      blackId: game.blackModel.id,
      winner: result.draw ? 'draw' : result.winner,
      reason: result.reason,
      moves: history.length,
      moveHistory: history.map(h => h.san || h),
    });
    renderLeaderboard();
  }
};

// Status Change
game.onStatusChange = (status) => {
  gameStatus.textContent = status;
};

// Log
game.onLog = (type, message) => {
  const entry = document.createElement('div');
  const time = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  entry.className = `log-entry log-${type}`;
  entry.innerHTML = `<span class="log-time">[${time}]</span> ${escapeHtml(message)}`;
  gameLog.appendChild(entry);
  gameLog.scrollTop = gameLog.scrollHeight;
};

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// --- Reset Leaderboard ---
btnResetLb.addEventListener('click', () => {
  if (confirm('Reset all leaderboard data?')) {
    leaderboard.reset();
    renderLeaderboard();
  }
});

// --- Done! ---
console.log('⚔️ LLM Arena loaded');
