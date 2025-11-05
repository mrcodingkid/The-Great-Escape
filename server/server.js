// server/server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs-extra');

const PasswordManager = require('./password-manager');
const logic = require('./game-logic');
const SaveManager = require('./save-manager');

const DATA_DIR = path.resolve(__dirname, '../data');
fs.ensureDirSync(DATA_DIR);

const app = express();
app.use(express.static(path.resolve(__dirname, '../client')));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const saveManager = new SaveManager();
const passwordManager = new PasswordManager();

let state = null;
(async () => {
  await passwordManager.initialize();
  state = await saveManager.load(logic);
})();

function saveState() { saveManager.save(state).catch(e => console.error(e)); }
function logAdmin(action) {
  const LOGS_DIR = path.join(DATA_DIR, 'logs');
  fs.ensureDirSync(LOGS_DIR);
  const line = `[${new Date().toISOString()}] ${action}\n`;
  fs.appendFileSync(path.join(LOGS_DIR, 'admin-actions.log'), line);
}

const ROOM = "THE-GREAT-ESCAPE";

io.on('connection', socket => {
  console.log('connect', socket.id);

  socket.on('joinRoom', async ({ role, password, displayName }) => {
    if (!role) return socket.emit('authResult', { ok: false, reason: 'missing_role' });
    // Spectator allowed without password
    if (role === 'spectator') {
      const shortName = displayName || 'Spectator';
      socket.join(ROOM);
      if (!state) state = logic.createInitialState();
      state.players[socket.id] = { id: socket.id, role, name: shortName, pos: 0, team: null, cards: [] };
      socket.emit('authResult', { ok: true, state });
      io.to(ROOM).emit('stateUpdate', state);
      saveState();
      return;
    }

    if (!password) return socket.emit('authResult', { ok: false, reason: 'missing_password' });

    try {
      const res = await passwordManager.verify(role, password, socket.id);
      if (!res.ok) return socket.emit('authResult', { ok: false, reason: res.reason || 'invalid' });

      const shortName = displayName || role;
      socket.join(ROOM);
      if (!state) state = logic.createInitialState();
      state.players[socket.id] = { id: socket.id, role, name: shortName, pos: 0, team: role === 'player' ? assignTeam() : null, cards: [] };
      socket.emit('authResult', { ok: true, state });
      io.to(ROOM).emit('stateUpdate', state);
      logAdmin(`JOIN ${socket.id} as ${role}`);
      saveState();
    } catch (e) {
      console.error('joinRoom error', e);
      socket.emit('authResult', { ok: false, reason: 'server_error' });
    }
  });

  socket.on('clientAction', payload => {
    try {
      const actor = state.players[socket.id];
      if (!actor) return;
      if (payload.type === 'rollDice') {
        const result = logic.rollDiceForRole(actor.role, actor.team);
        const ev = { ts: Date.now(), type: 'rollResult', actor: socket.id, result };
        state.events.push(ev);
        io.to(ROOM).emit('event', ev);
        saveState();
      } else if (payload.type === 'move') {
        const ok = logic.movePlayer(state, socket.id, payload.spaces);
        if (ok) { io.to(ROOM).emit('stateUpdate', state); saveState(); }
      } else if (payload.type === 'placeTrap') {
        if (actor.role === 'mainAdmin' || actor.role === 'admin' || (actor.role === 'player' && actor.team === 'red')) {
          const ok = logic.placeTrap(state, socket.id, payload.index);
          if (ok) { io.to(ROOM).emit('stateUpdate', state); saveState(); }
        }
      } else if (payload.type === 'adminCommand') {
        if (actor.role === 'mainAdmin' || actor.role === 'admin') {
          const cmd = payload.cmd;
          if (cmd === 'reset') {
            state = logic.createInitialState();
            io.to(ROOM).emit('stateUpdate', state);
            logAdmin(`ADMIN ${socket.id} reset game`);
            saveState();
          } else if (cmd === 'changePassword' && actor.role === 'mainAdmin') {
            passwordManager.setPassword(payload.roleKey, payload.newPassword).then(() => {
              io.to(socket.id).emit('passwordChanged', { roleKey: payload.roleKey });
            });
            logAdmin(`MAIN ADMIN changed password for ${payload.roleKey}`);
          } else if (cmd === 'kick') {
            const target = payload.target;
            if (state.players[target]) {
              io.to(target).emit('kicked', { by: socket.id });
              io.sockets.sockets.get(target)?.disconnect(true);
              delete state.players[target];
              io.to(ROOM).emit('stateUpdate', state);
              logAdmin(`ADMIN ${socket.id} kicked ${target}`);
              saveState();
            }
          }
        }
      }
    } catch (e) { console.error('clientAction handling error', e); }
  });

  socket.on('disconnect', () => {
    if (state && state.players && state.players[socket.id]) {
      logAdmin(`DISCONNECT ${socket.id} (${state.players[socket.id].role})`);
      delete state.players[socket.id];
      io.to(ROOM).emit('stateUpdate', state);
      saveState();
    }
    console.log('Socket disconnect:', socket.id);
  });

  // admin helpers
  socket.on('changePassword', async data => {
    const user = state.players[socket.id];
    if (!user || user.role !== 'mainAdmin') return;
    const ok = await passwordManager.setPassword(data.role, data.newPass);
    if (ok) {
      io.emit('event', { type: 'pwChange', by: user.name, role: data.role });
      socket.emit('passwordChanged', { role: data.role });
      logAdmin(`MAINADMIN ${user.name} changed password for ${data.role}`);
    }
  });

  socket.on('getPlayers', () => {
    const user = state.players[socket.id];
    if (!user || (user.role !== 'admin' && user.role !== 'mainAdmin')) return;
    const list = Object.values(state.players).map(p => ({ id: p.id, displayName: p.name, role: p.role }));
    socket.emit('playerList', list);
  });

  socket.on('kickPlayer', targetId => {
    const user = state.players[socket.id];
    if (!user || (user.role !== 'admin' && user.role !== 'mainAdmin')) return;
    const targetSocket = io.sockets.sockets.get(targetId);
    if (targetSocket) {
      targetSocket.emit('kicked', { by: user.name });
      targetSocket.disconnect(true);
      delete state.players[targetId];
      io.to(ROOM).emit('stateUpdate', state);
      saveState();
    }
  });

  socket.on('broadcast', data => {
    const user = state.players[socket.id];
    if (!user || (user.role !== 'admin' && user.role !== 'mainAdmin')) return;
    io.emit('broadcast', { message: data.message, by: user.name });
  });

});

function assignTeam() {
  const vals = Object.values(state.players || {});
  const orange = vals.filter(p => p.team === 'orange').length;
  const red = vals.filter(p => p.team === 'red').length;
  return orange <= red ? 'orange' : 'red';
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('Server listening on port', PORT);
  setInterval(() => { saveManager.save(state); }, 60000);
});
