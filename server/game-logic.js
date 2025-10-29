// server/game-logic.js
const BOARD_TILES = 64; // 8x8 square board

// Create the starting game state
function createInitialState() {
  const tiles = Array.from({ length: BOARD_TILES }).map((_, i) => ({
    index: i,
    hasTrap: false,
    trapBy: null,
    hasCard: false,
    blocked: false
  }));

  return {
    boardSize: 8,
    tiles,
    players: {},      // socketId -> { id, role, name, pos, team, cards:[] }
    orderedTurns: [],
    turnIndex: 0,
    running: false,
    events: []
  };
}

// Dice rules depend on team and role
function rollDiceForRole(role, team) {
  if (role === "player" && team === "red") {
    const faces = ["1", "2", "3", "4", "5", "TRAP"];
    return faces[Math.floor(Math.random() * faces.length)];
  } else if (role === "player" && team === "orange") {
    const faces = ["WALL", "0", "2", "3", "4", "6"];
    return faces[Math.floor(Math.random() * faces.length)];
  } else {
    // admins/spectators don't roll
    return null;
  }
}

// Move a player forward by N spaces
function movePlayer(state, playerId, spaces) {
  const p = state.players[playerId];
  if (!p) return false;
  const newPos = Math.max(0, Math.min(state.tiles.length - 1, p.pos + Number(spaces)));
  p.pos = newPos;
  state.events.push({ ts: Date.now(), type: "move", actor: playerId, to: newPos });
  return true;
}

// Place a trap on a given tile index
function placeTrap(state, placerId, targetIndex) {
  if (targetIndex < 0 || targetIndex >= state.tiles.length) return false;
  const tile = state.tiles[targetIndex];
  tile.hasTrap = true;
  tile.trapBy = placerId;
  state.events.push({ ts: Date.now(), type: "trapPlaced", by: placerId, index: targetIndex });
  return true;
}

module.exports = {
  createInitialState,
  rollDiceForRole,
  movePlayer,
  placeTrap
};
