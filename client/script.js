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
socket.on("loginSuccess", role => {
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
