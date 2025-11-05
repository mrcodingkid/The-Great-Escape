// script.js — LIVE LOGIN CONNECTION

const socket = io(); // connects automatically to your Replit server

const roleSelect = document.getElementById("roleSelect");
const passwordInput = document.getElementById("passwordInput");
const connectBtn = document.getElementById("connectBtn");
const feedback = document.getElementById("authFeedback");
const sessionInfo = document.getElementById("sessionInfo");
const currentRole = document.getElementById("currentRole");
const openAdmin = document.getElementById("openAdmin");
const connectionState = document.getElementById("connectionState");

// Disable autofill
passwordInput.setAttribute("autocomplete", "new-password");

connectBtn.addEventListener("click", () => {
    const role = roleSelect.value;
    const pass = passwordInput.value.trim();

    if (!pass) {
        feedback.textContent = "Enter password";
        feedback.style.color = "#ff8c8c";
        return;
    }

    socket.emit("login", { role, password: pass });
    passwordInput.value = "";
});

// Server -> Login success
socket.on("loginSuccess", role => {document.getElementById("openAdminPanel").onclick = () => {
    document.getElementById("adminDeck").classList.remove("hidden");
};

    feedback.textContent = "Access Granted — Welcome to the Grid";
    feedback.style.color = "#5cffc8";

    sessionInfo.classList.remove("hidden");
    currentRole.textContent = role;

    if (role === "mainAdmin") {
        openAdmin.classList.remove("hidden");
    }

    connectionState.textContent = "Connected";
});

// Server -> Login failed
socket.on("loginFail", msg => {
    feedback.textContent = msg === "BANNED" ? 
        "ACCESS BLOCKED — YOU ARE BANNED" :
        "Wrong password — Try again";
    feedback.style.color = "#ff8c8c";
});

// Live player list update (for admin panel later)
socket.on("playerList", list => {
    console.log("Online players:", list);
});
// Admin controls
const refreshBtn = document.getElementById("refreshPlayers");
const playerList = document.getElementById("playerList");
const sendBroadcast = document.getElementById("sendBroadcast");
const broadcastMsg = document.getElementById("broadcastMsg");
const changePassBtn = document.getElementById("changePassBtn");

refreshBtn.onclick = () => socket.emit("getPlayers");

sendBroadcast.onclick = () => {
  socket.emit("broadcast", { message: broadcastMsg.value });
  broadcastMsg.value = "";
};

changePassBtn.onclick = () => {
  socket.emit("changePassword", {
    role: document.getElementById("changeRole").value,
    newPass: document.getElementById("newPass").value
  });
};

// Server returns player list
socket.on("playerList", list => {
  playerList.innerHTML = "";
  list.forEach(p => {
    const li = document.createElement("li");
    li.innerHTML = `
      ${p.displayName} (${p.role})
      <button onclick="socket.emit('kickPlayer',{id:'${p.id}'})">Kick</button>
    `;
    playerList.appendChild(li);
  });
});
