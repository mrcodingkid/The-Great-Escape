// client/script.js
const socket = io(); // same origin on Replit

const connectBtn = document.getElementById('connect');
const roleEl = document.getElementById('role');
const passEl = document.getElementById('password');
const nameEl = document.getElementById('name');
const status = document.getElementById('status');

connectBtn.addEventListener('click', () => {
  const role = roleEl.value;
  const pw = passEl.value;
  const displayName = nameEl.value || role;

  socket.emit('joinRoom', { role, password: pw, displayName });
});

socket.on('authResult', (res) => {
  if (!res.ok) {
    status.textContent = 'Auth failed: ' + (res.reason || 'unknown');
    return;
  }
  document.getElementById('login').classList.add('hidden');
  document.getElementById('game').classList.remove('hidden');
  status.textContent = '';
  // initial state
  if (res.state) {
    document.getElementById('log').textContent = JSON.stringify(res.state, null, 2);
  }
});

socket.on('stateUpdate', (state) => {
  document.getElementById('log').textContent = JSON.stringify(state, null, 2);
});

socket.on('event', (ev) => {
  const log = document.getElementById('log');
  log.textContent = (ev.type + ' ' + JSON.stringify(ev) + '\n') + log.textContent;
});
