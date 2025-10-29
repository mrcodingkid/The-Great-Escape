const socket = io();
const playerList = document.getElementById("playerList");
const pwRole = document.getElementById("pwRole");
const newPassword = document.getElementById("newPassword");
const broadcastMsg = document.getElementById("broadcastMsg");

document.getElementById("resetGame").onclick = () => {
  socket.emit("clientAction", { type: "adminCommand", cmd: "reset" });
};

document.getElementById("refreshPlayers").onclick = () => {
  socket.emit("getPlayers");
};

document.getElementById("sendBroadcast").onclick = () => {
  socket.emit("broadcast", { message: broadcastMsg.value });
  broadcastMsg.value = "";
};

document.getElementById("changePw").onclick = () => {
  socket.emit("changePassword", {
    role: pwRole.value,
    newPass: newPassword.value
  });
  alert("Password updated!");
  newPassword.value = "";
};

document.getElementById("logout").onclick = () => {
  location.href = "/";
};

socket.on("playerList", (players) => {
  playerList.innerHTML = "";
  for (let p of players) {
    const li = document.createElement("li");
    li.textContent = `${p.displayName} (${p.role})`;
    const kickBtn = document.createElement("button");
    kickBtn.textContent = "Kick";
    kickBtn.onclick = () => socket.emit("kickPlayer", { id: p.id });
    li.appendChild(kickBtn);
    playerList.appendChild(li);
  }
});

socket.on("broadcast", (msg) => {
  alert(`📢 Broadcast: ${msg}`);
});
