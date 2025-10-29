// server/server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const fs = require("fs-extra");

const PasswordManager = require("./password-manager");
const logic = require("./game-logic");

const DATA_DIR = path.resolve(__dirname, "../data");
const SAVE_PATH = path.join(DATA_DIR, "save-state.json");
const LOGS_DIR = path.join(DATA_DIR, "logs");

fs.ensureDirSync(DATA_DIR);
fs.ensureDirSync(LOGS_DIR);

const app = express();
// Serve static client if desired (optional). If you host frontend on GitHub Pages, you can disable.
app.use(express.static(path.resolve(__dirname, "../client")));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

let state = null;
if (fs.existsSync(SAVE_PATH)) {
  try {
    state = fs.readJSONSync(SAVE_PATH);
    console.log("Loaded saved state.");
  } catch (e) {
    console.error("Failed to read saved state:", e);
    state = logic.createInitialState();
  }
} else {
  state = logic.createInitialState();
}

const passwordManager = new PasswordManager();

(async () => {
  await passwordManager.initialize();
})();

// helper save
function saveState() {
  try {
    fs.writeJSONSync(SAVE_PATH, state, { spaces: 2 });
  } catch (e) {
    console.error("saveState error", e);
  }
}

function logAdmin(action) {
  const line = `[${new Date().toISOString()}] ${action}\n`;
  fs.appendFileSync(path.join(LOGS_DIR, "admin-actions.log"), line);
}

// single permanent room
const ROOM = "THE-GREAT-ESCAPE";

io.on("connection", (socket) => {
  console.log("Socket connect:", socket.id);

  // client attempts to join room
  socket.on("joinRoom", async ({ role, password, displayName }) => {
    try {
      if (!role || !password) {
        socket.emit("authResult", { ok: false, reason: "missing" });
        return;
      }
      const ok = await passwordManager.verify(role, password);
      if (!ok) {
        socket.emit("authResult", { ok: false, reason: "invalid_password" });
        return;
      }

      // Add to state.players
      const shortName = displayName || role;
      socket.join(ROOM);
      state.players[socket.id] = {
        id: socket.id,
        role,
        name: shortName,
        pos: 0,
        team: role === "player" ? assignTeam() : null,
        cards: []
      };

      // send success + full state
      socket.emit("authResult", { ok: true, state });
      io.to(ROOM).emit("stateUpdate", state);
      logAdmin(`JOIN ${socket.id} as ${role}`);
      saveState();
    } catch (e) {
      console.error("joinRoom error", e);
      socket.emit("authResult", { ok: false, reason: "server_error" });
    }
  });

  socket.on("clientAction", (payload) => {
    try {
      const actor = state.players[socket.id];
      if (!actor) return;
      // handle types
      if (payload.type === "rollDice") {
        const result = logic.rollDiceForRole(actor.role, actor.team);
        const ev = { ts: Date.now(), type: "rollResult", actor: socket.id, result };
        state.events.push(ev);
        io.to(ROOM).emit("event", ev);
        saveState();
      } else if (payload.type === "move") {
        const ok = logic.movePlayer(state, socket.id, payload.spaces);
        if (ok) {
          io.to(ROOM).emit("stateUpdate", state);
          saveState();
        }
      } else if (payload.type === "placeTrap") {
        // permission: only mainAdmin or admins or red players (depends)
        if (actor.role === "mainAdmin" || actor.role === "admin" || (actor.role === "player" && actor.team === "red")) {
          const ok = logic.placeTrap(state, socket.id, payload.index);
          if (ok) {
            io.to(ROOM).emit("stateUpdate", state);
            saveState();
          }
        }
      } else if (payload.type === "adminCommand") {
        // only mainAdmin or admin allowed
        if (actor.role === "mainAdmin" || actor.role === "admin") {
          const cmd = payload.cmd;
          if (cmd === "reset") {
            state = logic.createInitialState();
            io.to(ROOM).emit("stateUpdate", state);
            logAdmin(`ADMIN ${socket.id} reset game`);
            saveState();
          } else if (cmd === "changePassword" && actor.role === "mainAdmin") {
            // payload: { roleKey, newPassword }
            passwordManager.setPassword(payload.roleKey, payload.newPassword).then(() => {
              io.to(socket.id).emit("passwordChanged", { roleKey: payload.roleKey });
            });
            logAdmin(`MAIN ADMIN changed password for ${payload.roleKey}`);
          } else if (cmd === "kick") {
            const target = payload.target;
            if (state.players[target]) {
              io.to(target).emit("kicked", { by: socket.id });
              io.sockets.sockets.get(target)?.disconnect(true);
              delete state.players[target];
              io.to(ROOM).emit("stateUpdate", state);
              logAdmin(`ADMIN ${socket.id} kicked ${target}`);
              saveState();
            }
          }
        }
      }
    } catch (e) {
      console.error("clientAction handling error", e);
    }
  });

  socket.on("disconnect", () => {
    // remove player
    if (state.players && state.players[socket.id]) {
      logAdmin(`DISCONNECT ${socket.id} (${state.players[socket.id].role})`);
      delete state.players[socket.id];
      io.to(ROOM).emit("stateUpdate", state);
      saveState();
    }
    console.log("Socket disconnect:", socket.id);
  });
});

function assignTeam() {
  // simple assignment: count players who have team 'orange' and 'red' then balance
  const vals = Object.values(state.players || {});
  const orangeCount = vals.filter(p => p.team === "orange").length;
  const redCount = vals.filter(p => p.team === "red").length;
  return orangeCount <= redCount ? "orange" : "red";
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Server listening on port", PORT);
});
