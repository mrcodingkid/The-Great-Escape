// server/password-manager.js
const fs = require("fs-extra");
const path = require("path");
const bcrypt = require("bcrypt");

// path to the role passwords file
const ROLES_FILE = path.resolve(__dirname, "roles.json");

// default role passwords (Main Admin, Admin, Player, Spectator)
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

  // initialize the manager (loads or creates file)
  async initialize() {
    try {
      if (await fs.pathExists(this.file)) {
        const data = await fs.readJSON(this.file);
        this.hashes = data;
      } else {
        // create a new one with defaults
        const toSave = {};
        for (const [role, plain] of Object.entries(DEFAULTS)) {
          const salt = await bcrypt.genSalt(10);
          toSave[role] = await bcrypt.hash(String(plain), salt);
        }
        this.hashes = toSave;
        await fs.writeJSON(this.file, this.hashes, { spaces: 2 });
      }
      console.log("✅ PasswordManager initialized");
    } catch (err) {
      console.error("⚠️ PasswordManager init error:", err);
      // fallback if file missing
      this.hashes = {};
      for (const key of Object.keys(DEFAULTS)) this.hashes[key] = null;
    }
  }

  // verify a role's password
  async verify(role, plain) {
    if (!this.hashes || !this.hashes[role]) return false;
    try {
      return await bcrypt.compare(String(plain), this.hashes[role]);
    } catch (e) {
      console.error("verify error", e);
      return false;
    }
  }

  // change a password (Main Admin control)
  async setPassword(role, newPlain) {
    try {
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(String(newPlain), salt);
      this.hashes[role] = hash;
      await fs.writeJSON(this.file, this.hashes, { spaces: 2 });
      return true;
    } catch (e) {
      console.error("setPassword error", e);
      return false;
    }
  }
}

module.exports = PasswordManager;

