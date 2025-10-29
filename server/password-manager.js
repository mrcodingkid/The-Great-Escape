// server/password-manager.js
const fs = require("fs-extra");
const path = require("path");
const bcrypt = require("bcrypt");

const ROLES_FILE = path.resolve(__dirname, "roles.json");

const DEFAULTS = {
  mainAdmin: process.env.MAIN_ADMIN_PASSWORD || "TheGEAdmin",
  admin: "Admin",
  player: "Player",
  spectator: "Watch"
};

class PasswordManager {
  constructor() {
    this.hashes = {};
    this.file = ROLES_FILE;
  }

  async initialize() {
    try {
      if (await fs.pathExists(this.file)) {
        const j = await fs.readJSON(this.file);
        this.hashes = j;
      } else {
        // create initial hashed file
        const toSave = {};
        for (const [k, v] of Object.entries(DEFAULTS)) {
          const salt = await bcrypt.genSalt(10);
          toSave[k] = await bcrypt.hash(String(v), salt);
        }
        this.hashes = toSave;
        await fs.writeJSON(this.file, this.hashes, { spaces: 2 });
      }
      console.log("PasswordManager initialized");
    } catch (err) {
      console.error("PasswordManager init error:", err);
      // fallback to defaults (not hashed) - not ideal, but avoids crash
      this.hashes = {};
      for (const k of Object.keys(DEFAULTS)) this.hashes[k] = null;
    }
  }

  async verify(role, plain) {
    if (!this.hashes || !this.hashes[role]) return false;
    try {
      return await bcrypt.compare(String(plain), this.hashes[role]);
    } catch (e) {
      console.error("verify error", e);
      return false;
    }
  }

  async setPassword(role, newPlain) {
    try {
      const salt = await bcrypt.genSalt(10);
      const h = await bcrypt.hash(String(newPlain), salt);
      this.hashes[role] = h;
      await fs.writeJSON(this.file, this.hashes, { spaces: 2 });
      return true;
    } catch (e) {
      console.error("setPassword error", e);
      return false;
    }
  }
}

module.exports = PasswordManager;
