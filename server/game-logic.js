// server/game-logic.js
// Minimal logic for 3D grid movement (8x8 board)

const BOARD_SIZE = 8;

function createInitialState() {
  return {
    players: {},     // id -> { id, role, name, x, y }
    events: []
  };
}

function addPlayer(state, id, role, name) {
  // spawn all players at center
  state.players[id] = {
    id,
    role,
    name,
    x: 3,
    y: 3
  };
}

function removePlayer(state, id) {
  delete state.players[id];
}

function movePlayer(state, id, dir) {
  const p = state.players[id];
  if (!p) return;

  if (dir === "up")    p.y -= 1;
  if (dir === "down")  p.y += 1;
  if (dir === "left")  p.x -= 1;
  if (dir === "right") p.x += 1;

  // clamp to board
  p.x = Math.max(0, Math.min(BOARD_SIZE - 1, p.x));
  p.y = Math.max(0, Math.min(BOARD_SIZE - 1, p.y));

  state.events.push({
    type: "move",
    id,
    x: p.x,
    y: p.y,
    ts: Date.now()
  });

  return p;
}

module.exports = {
  createInitialState,
  addPlayer,
  removePlayer,
  movePlayer,
  BOARD_SIZE
};
