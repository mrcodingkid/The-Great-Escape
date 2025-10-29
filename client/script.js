// client/script.js
const socket = io(); // auto connects to same origin

const loginScreen = document.getElementById("login-screen");
const gameScreen = document.getElementById("game-screen");
const joinBtn = document.getElementById("joinBtn");
const statusMsg = document.getElementById("statusMsg");
const roleLabel = document.getElementById("roleLabel");
const log = document.getElementById("log");

let playerRole = null;

joinBtn.onclick = () => {
  const role = document.getElementById("role").value;
  const password = document.getElementById("password").value;
  const displayName = document.getElementById("displayName").value;
  statusMsg.textContent = "Connecting...";

  socket.emit("joinRoom", { role, password, displayName });
};

socket.on("authResult", (res) => {
  if (res.ok) {
    playerRole = document.getElementById("role").value;
    statusMsg.textContent = "✅ Joined!";
    loginScreen.classList.add("hidden");
    gameScreen.classList.remove("hidden");
    roleLabel.textContent = `Logged in as: ${playerRole}`;
    renderBoard(res.state);
  } else {
    statusMsg.textContent = "❌ Login failed: " + res.reason;
  }
});

socket.on("stateUpdate", (state) => {
  renderBoard(state);
});

socket.on("event", (ev) => {
  addLog(JSON.stringify(ev));
});

socket.on("kicked", (info) => {
  alert("You were kicked by admin.");
  location.reload();
});

function addLog(msg) {
  log.textContent += msg + "\n";
  log.scrollTop = log.scrollHeight;
}

function renderBoard(state) {
  const board = document.getElementById("board");
  board.innerHTML = "";
  for (let t of state.tiles) {
    const div = document.createElement("div");
    div.className = "tile";
    if (t.hasTrap) div.style.background = "#aa0000";
    div.textContent = t.index;
    board.appendChild(div);
  }
}

// Controls
document.getElementById("rollBtn").onclick = () => {
  socket.emit("clientAction", { type: "rollDice" });
};
document.getElementById("moveBtn").onclick = () => {
  socket.emit("clientAction", { type: "move", spaces: 2 });
};
document.getElementById("trapBtn").onclick = () => {
  socket.emit("clientAction", { type: "placeTrap", index: Math.floor(Math.random() * 64) });
};
document.getElementById("resetBtn").onclick = () => {
  if (playerRole === "mainAdmin" || playerRole === "admin") {
    socket.emit("clientAction", { type: "adminCommand", cmd: "reset" });
  }
};
