const socket = io(); // automatically connects to same host

const loginScreen = document.getElementById("login-screen");
const gameScreen = document.getElementById("game-screen");
const loginBtn = document.getElementById("loginBtn");
const loginStatus = document.getElementById("loginStatus");

const board = document.getElementById("board");
const rollBtn = document.getElementById("rollDiceBtn");
const moveBtn = document.getElementById("moveBtn");
const trapBtn = document.getElementById("trapBtn");

const playerInfo = document.getElementById("player-info");
const adminPanel = document.getElementById("admin-panel");

const chatInput = document.getElementById("chatInput");
const sendBtn = document.getElementById("sendBtn");
const messages = document.getElementById("messages");

let myRole = null;
let myName = null;
let currentState = null;

loginBtn.onclick = () => {
  const role = document.getElementById("role").value;
  const password = document.getElementById("password").value;
  const displayName = document.getElementById("displayName").value || role;

  if (!password) {
    loginStatus.textContent = "Password required.";
    return;
  }

  socket.emit("joinRoom", { role, password, displayName });
  loginStatus.textContent = "Connecting...";
};

socket.on("authResult", (res) => {
  if (!res.ok) {
    loginStatus.textContent = "Login failed: " + (res.reason || "unknown");
    return;
  }

  myRole = document.getElementById("role").value;
  myName = document.getElementById("displayName").value;
  loginScreen.classList.remove("active");
  gameScreen.classList.add("active");
  if (myRole === "mainAdmin" || myRole === "admin") adminPanel.classList.remove("hidden");

  currentState = res.state;
  renderBoard();
  playerInfo.textContent = `${myName} (${myRole})`;
});

socket.on("stateUpdate", (state) => {
  currentState = state;
  renderBoard();
});

socket.on("event", (ev) => {
  const msg = `[${new Date(ev.ts).toLocaleTimeString()}] ${ev.type}`;
  addMsg(msg);
});

socket.on("broadcast", (msg) => addMsg(`📢 ${msg}`));

sendBtn.onclick = () => {
  const txt = chatInput.value.trim();
  if (txt) {
    socket.emit("broadcast", { message: txt });
    chatInput.value = "";
  }
};

function addMsg(text) {
  const p = document.createElement("p");
  p.textContent = text;
  messages.appendChild(p);
  messages.scrollTop = messages.scrollHeight;
}

rollBtn.onclick = () => {
  socket.emit("clientAction", { type: "rollDice" });
};

moveBtn.onclick = () => {
  const spaces = prompt("Move how many spaces?");
  if (spaces) socket.emit("clientAction", { type: "move", spaces });
};

trapBtn.onclick = () => {
  const index = prompt("Place trap at tile index?");
  if (index) socket.emit("clientAction", { type: "placeTrap", index: Number(index) });
};

function renderBoard() {
  if (!currentState) return;
  board.innerHTML = "";
  for (let i = 0; i < currentState.tiles.length; i++) {
    const tile = document.createElement("div");
    tile.className = "tile";
    if (currentState.tiles[i].hasTrap) tile.classList.add("trap");
    for (const id in currentState.players) {
      const p = currentState.players[id];
      if (p.pos === i) {
        tile.classList.add("player");
        tile.textContent = p.name[0].toUpperCase();
      }
    }
    board.appendChild(tile);
  }
}

// Admin-only actions
document.getElementById("changePassBtn").onclick = () => {
  const roleKey = document.getElementById("newPassRole").value;
  const newPass = document.getElementById("newPass").value;
  if (roleKey && newPass) {
    socket.emit("clientAction", { type: "adminCommand", cmd: "changePassword", roleKey, newPassword: newPass });
  }
};

document.getElementById("resetBtn").onclick = () => {
  socket.emit("clientAction", { type: "adminCommand", cmd: "reset" });
};

document.getElementById("getPlayersBtn").onclick = () => {
  socket.emit("getPlayers");
};

socket.on("playerList", (list) => {
  const div = document.getElementById("playerList");
  div.innerHTML = "<h4>Players:</h4>";
  list.forEach((p) => {
    const btn = document.createElement("button");
    btn.textContent = `Kick ${p.displayName} (${p.role})`;
    btn.onclick = () => socket.emit("kickPlayer", { id: p.id });
    div.appendChild(btn);
  });
});
