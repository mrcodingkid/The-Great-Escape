// server/server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const logic = require("./game-logic");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// ---- GAME STATE ----
let state = logic.createInitialState();

// ---- STATIC CLIENT ----
app.use(express.static("../client"));

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  // login or joinRoom (we support both)
  socket.on("joinRoom", (data) => {
    const role = data.role || "player";
    const name = data.displayName || role;

    logic.addPlayer(state, socket.id, role, name);

    socket.emit("authResult", {
      ok: true,
      role,
      state
    });

    io.emit("stateUpdate", state);
  });

  socket.on("login", (data) => {
    const role = data.role || "player";

    logic.addPlayer(state, socket.id, role, role);

    socket.emit("loginSuccess", role);
    io.emit("stateUpdate", state);
  });

  // movement events
  socket.on("move", (dir) => {
    const p = logic.movePlayer(state, socket.id, dir);
    if (p) io.emit("playerMoved", p);
  });

  socket.on("playerMove", (data) => {
    const p = logic.movePlayer(state, socket.id, data.dir);
    if (p) io.emit("playerMoved", p);
  });

  socket.on("clientAction", (data) => {
    if (data.type === "move") {
      const dir = data.dir;
      const p = logic.movePlayer(state, socket.id, dir);
      if (p) io.emit("playerMoved", p);
    }
  });

  socket.on("disconnect", () => {
    logic.removePlayer(state, socket.id);
    io.emit("stateUpdate", state);
    console.log("Disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Server running on", PORT));
