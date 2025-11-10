// client/script.js
// Step E: 3D board, spawn players, spectator camera, movement + socket sync

/* ----------------------------
  Socket & session management
-----------------------------*/
const socket = io(); // same origin

let myId = null;
let myRole = null;
let myName = null;
let isPlayer = false;

// UI refs (from index.html)
const connectBtn = document.getElementById('connectBtn') || document.getElementById('connect');
const roleSelect = document.getElementById('roleSelect') || document.getElementById('role');
const passwordInput = document.getElementById('passwordInput') || document.getElementById('password');
const feedback = document.getElementById('authFeedback') || document.getElementById('status');
const sessionInfo = document.getElementById('sessionInfo');
const currentRoleEl = document.getElementById('currentRole');
const connectionState = document.getElementById('connectionState') || { textContent: '' };
const openAdmin = document.getElementById('openAdmin');
const playerListUI = document.getElementById('playerList');

// Attempt to gather display name if present
function askDisplayName(){
  try {
    const nameInput = document.getElementById('name');
    if(nameInput && nameInput.value && nameInput.value.trim().length) return nameInput.value.trim();
  } catch(e){}
  const maybe = prompt("Display name (optional) — leave empty to use role:");
  return (maybe && maybe.trim().length) ? maybe.trim() : null;
}

// on connect
socket.on('connect', () => {
  console.log('socket connected', socket.id);
  connectionState.textContent = 'connected';
});

// handle server login flows (support both 'login' and 'joinRoom' servers)
function handleLoginSuccess(role, state){
  myRole = role;
  isPlayer = (role === 'player' || role === 'admin' || role === 'mainAdmin'); // admin also counts as player for movement if desired
  sessionInfo?.classList?.remove('hidden');
  if(currentRoleEl) currentRoleEl.textContent = role;
  if(openAdmin && role === 'mainAdmin') openAdmin.classList.remove('hidden');
  feedback && (feedback.textContent = 'Access granted — welcome to the Grid');
  console.log('login success role=', role);
  // If server sends initial state, apply
  if(state) applyServerState(state);
}

// Accept different login events
socket.on('authResult', (res) => {
  if(!res || !res.ok){ feedback && (feedback.textContent = 'Auth failed: ' + (res?.reason||'unknown')); return; }
  handleLoginSuccess(res.role || 'player', res.state || null);
});
socket.on('loginSuccess', (role) => handleLoginSuccess(role));
socket.on('loginFail', (msg) => {
  feedback && (feedback.textContent = (msg === 'BANNED' ? 'BANNED' : 'Login failed'));
});

// When clicking connect - emit both joinRoom and login for compatibility
if(connectBtn){
  connectBtn.addEventListener('click', () => {
    const role = (roleSelect && roleSelect.value) ? roleSelect.value : 'player';
    const pass = (passwordInput && passwordInput.value) ? passwordInput.value : '';
    const displayName = askDisplayName() || role;

    myName = displayName;

    // emit both for compatibility:
    try { socket.emit('joinRoom', { role, password: pass, displayName }); } catch(e){}
    try { socket.emit('login', { role, password: pass }); } catch(e){}
    // older simple servers expect 'join' with role
    try { socket.emit('join', role); } catch(e){}

    // optimistic UI
    feedback && (feedback.textContent = 'Connecting...');
  });
}

/* ----------------------------
  Three.js scene - 8x8 board
-----------------------------*/
const boardSize = 8;
const tileSize = 1;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x00121a);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth/window.innerHeight, 0.1, 1000);
camera.position.set(4, 8, 12);
camera.lookAt(4, 0, 4);

const renderer = new THREE.WebGLRenderer({ antialias:true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

// lights
const hemi = new THREE.HemisphereLight(0xffffff, 0x222233, 0.6);
scene.add(hemi);
const dir = new THREE.DirectionalLight(0xffffff, 0.6);
dir.position.set(5,10,7);
scene.add(dir);

// board group
const boardGroup = new THREE.Group();
const tileGeo = new THREE.BoxGeometry(tileSize, 0.06, tileSize);
for(let y=0;y<boardSize;y++){
  for(let x=0;x<boardSize;x++){
    const mat = new THREE.MeshStandardMaterial({
      color: 0x022b36,
      emissive: 0x002233,
      metalness: 0.1,
      roughness: 0.8
    });
    const m = new THREE.Mesh(tileGeo, mat);
    m.position.set(x, 0, y);
    // subtle rim glow using outline mesh (simple)
    boardGroup.add(m);
  }
}
boardGroup.position.set(- (boardSize-1)/2, 0, - (boardSize-1)/2);
scene.add(boardGroup);

// players group + storage
const playersGroup = new THREE.Group(); scene.add(playersGroup);
const players = {}; // id -> { data, mesh, targetPos }

// helper: create player mesh
function createPlayerMesh(role){
  const color = role === 'player' ? 0xffa24d : (role === 'spectator' ? 0x888888 : 0x55d6ff);
  const geo = new THREE.CylinderGeometry(0.28, 0.28, 0.9, 12);
  const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.08, metalness: 0.2, roughness: 0.3 });
  const m = new THREE.Mesh(geo, mat);
  // small floating effect
  m.position.y = 0.45;
  return m;
}

// apply server state (if server sends full state)
function applyServerState(state){
  if(!state) return;
  const serverPlayers = state.players || state.playersList || state; // defensive
  // serverPlayers may be array or object
  let arr = Array.isArray(serverPlayers) ? serverPlayers : Object.values(serverPlayers || {});
  // remove missing
  const ids = new Set(arr.map(p => p.id));
  for(const id in players){
    if(!ids.has(id)){
      playersGroup.remove(players[id].mesh);
      delete players[id];
    }
  }
  arr.forEach(p => {
    if(!players[p.id]){
      const mesh = createPlayerMesh(p.role || p.team || 'player');
      playersGroup.add(mesh);
      players[p.id] = { data: p, mesh, targetPos: mesh.position.clone() };
    }
    // set target position: server may provide pos (index) or x/y
    const ent = players[p.id];
    ent.data = p;
    let tx = 0, tz = 0;
    if(typeof p.x === 'number' && typeof p.y === 'number'){ tx = p.x; tz = p.y; }
    else if(typeof p.pos === 'number'){ // linear index -> x,y
      const idx = p.pos;
      tx = idx % boardSize;
      tz = Math.floor(idx / boardSize);
    } else {
      tx = (Math.random()* (boardSize-1))|0; tz = (Math.random()*(boardSize-1))|0;
    }
    ent.targetPos = new THREE.Vector3(tx - (boardSize-1)/2, 0.45, tz - (boardSize-1)/2);
  });
}

// handle incremental player moved events
socket.on('playerMoved', (p) => {
  if(!p || !p.id) return;
  if(!players[p.id]){
    const mesh = createPlayerMesh(p.role || 'player');
    playersGroup.add(mesh);
    players[p.id] = { data: p, mesh, targetPos: mesh.position.clone() };
  }
  const ent = players[p.id];
  ent.data = p;
  let tx = 0, tz = 0;
  if(typeof p.x === 'number' && typeof p.y === 'number'){ tx = p.x; tz = p.y; }
  else if(typeof p.pos === 'number'){ tx = p.pos % boardSize; tz = Math.floor(p.pos / boardSize); }
  ent.targetPos = new THREE.Vector3(tx - (boardSize-1)/2, 0.45, tz - (boardSize-1)/2);
});

// full-state events
socket.on('state', (s) => applyServerState(s));
socket.on('stateUpdate', (s) => applyServerState(s));
socket.on('authResult', (r) => { if(r && r.ok){ myId = socket.id; handleLoginSuccess(r.role || r.state?.players?.[socket.id]?.role || 'player', r.state); }});
socket.on('loginSuccess', (role) => { myId = socket.id; handleLoginSuccess(role); });

// player list (for admin UI)
socket.on('playerList', list => {
  if(playerListUI){
    playerListUI.innerHTML = '';
    (list||[]).forEach(p => {
      const li = document.createElement('li');
      li.textContent = `${p.displayName || p.id} (${p.role || 'player'})`;
      const kick = document.createElement('button');
      kick.textContent = 'Kick';
      kick.onclick = () => socket.emit('kickPlayer', p.id);
      li.appendChild(kick);
      playerListUI.appendChild(li);
    });
  }
});

// generic events log
socket.on('event', ev => {
  console.log('server event', ev);
});

/* ----------------------------
  Local movement & networking
-----------------------------*/
let myPosition = { x: 0, y: 0 };
function setMyPosition(x,y){
  myPosition.x = Math.max(0, Math.min(boardSize-1, x));
  myPosition.y = Math.max(0, Math.min(boardSize-1, y));
  // update local mesh visually (if spawned)
  if(players[myId]) players[myId].targetPos = new THREE.Vector3(myPosition.x - (boardSize-1)/2, 0.45, myPosition.y - (boardSize-1)/2);
}

// Helper: emit movement to server in several compatible forms
function emitMove(dir){
  // older simple servers expect 'move' with dir char
  try{ socket.emit('move', dir); } catch(e){}
  // our advanced server expects clientAction {type:'move', spaces: <n>} — but we send 1 step for now
  try{ socket.emit('clientAction', { type:'move', spaces: 1, dir }); } catch(e){}
  // some servers accept playerMove with x,y
  try{ socket.emit('playerMove', { id: socket.id, dir }); } catch(e){}
  // send our desired new coordinates if known
  if(myId && players[myId]){
    socket.emit('positionUpdate', { id: myId, x: myPosition.x, y: myPosition.y });
  }
}

// key handling
window.addEventListener('keydown', (e) => {
  if(!myRole) return;
  const k = e.key.toLowerCase();
  if(!isPlayer) return; // spectators don't move
  let moved = false;
  if(k === 'w' || k === 'arrowup'){ setMyPosition(myPosition.x, myPosition.y - 1); emitMove('up'); moved = true; }
  if(k === 's' || k === 'arrowdown'){ setMyPosition(myPosition.x, myPosition.y + 1); emitMove('down'); moved = true; }
  if(k === 'a' || k === 'arrowleft'){ setMyPosition(myPosition.x - 1, myPosition.y); emitMove('left'); moved = true; }
  if(k === 'd' || k === 'arrowright'){ setMyPosition(myPosition.x + 1, myPosition.y); emitMove('right'); moved = true; }
  if(moved) {
    // optimistic local send - ensure mesh exists
    if(!players[myId]){
      const mesh = createPlayerMesh(myRole);
      playersGroup.add(mesh);
      players[myId] = { data: { id: myId, role: myRole, name: myName }, mesh, targetPos: mesh.position.clone() };
    }
    players[myId].targetPos = new THREE.Vector3(myPosition.x - (boardSize-1)/2, 0.45, myPosition.y - (boardSize-1)/2);
  }
});

/* ----------------------------
  Animation & render loop
-----------------------------*/
const clock = new THREE.Clock();
function animate(){
  requestAnimationFrame(animate);
  const dt = Math.min(0.06, clock.getDelta());

  // lerp meshes to target
  for(const id in players){
    const p = players[id];
    if(!p.mesh || !p.targetPos) continue;
    p.mesh.position.lerp(p.targetPos, 8 * dt); // smooth follow
    // subtle bob
    p.mesh.position.y = 0.45 + Math.sin(Date.now()/500 + (id.length||0)) * 0.03;
  }

  renderer.render(scene, camera);
}
animate();

// handle resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// INITIAL: ask server for current state (if available)
setTimeout(()=>{ try{ socket.emit('getState'); socket.emit('getPlayers'); }catch(e){} }, 600);

// Export applyServerState globally (for debug)
window.__applyServerState = applyServerState;

console.log('3D board ready — use WASD to move if you are Player.');
