// server/save-manager.js
const fs = require("fs-extra");
const path = require("path");

const SAVE_DIR = path.resolve(__dirname, "../data");
const SAVE_PATH = path.join(SAVE_DIR, "save-state.json");
const BACKUP_PATH = path.join(SAVE_DIR, "save-backup.json");

class SaveManager {
  constructor() {
    this.path = SAVE_PATH;
    this.backup = BACKUP_PATH;
  }

  async ensureDir() {
    await fs.ensureDir(SAVE_DIR);
  }

  async save(state) {
    try {
      await this.ensureDir();
      // create backup first
      if (await fs.pathExists(this.path)) {
        await fs.copy(this.path, this.backup);
      }
      await fs.writeJSON(this.path, state, { spaces: 2 });
      console.log("✅ Game state saved.");
    } catch (e) {
      console.error("❌ Save failed:", e);
    }
  }

  async load(logic) {
    await this.ensureDir();
    try {
      if (await fs.pathExists(this.path)) {
        const state = await fs.readJSON(this.path);
        console.log("💾 Loaded saved state from disk.");
        return state;
      } else {
        console.log("📦 No save found, creating new state...");
        return logic.createInitialState();
      }
    } catch (e) {
      console.error("❌ Load failed, using fresh state:", e);
      return logic.createInitialState();
    }
  }
}

module.exports = SaveManager;
