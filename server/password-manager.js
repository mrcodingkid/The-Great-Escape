// server/password-manager.js
const fs = require('fs-extra');
const path = require('path');
const bcrypt = require('bcrypt');
const ROLES_FILE = path.resolve(__dirname, 'roles.json');
const DEFAULTS = { mainAdmin: 'THEGEADMIN', admin: 'Admin', player: 'Player', spectator: 'Watch' };
class PasswordManager {
  constructor(){ this.hashes = {}; this.file = ROLES_FILE; this.lockouts = {}; }
  async initialize(){
    try{
      if(await fs.pathExists(this.file)){ this.hashes = await fs.readJSON(this.file); }
      else{
        const toSave = {};
        for(const [k,v] of Object.entries(DEFAULTS)){ const salt = await bcrypt.genSalt(10); toSave[k]=await bcrypt.hash(String(v),salt); }
        this.hashes = toSave;
        await fs.writeJSON(this.file,this.hashes,{spaces:2});
      }
      console.log('PasswordManager initialized');
    }catch(e){ console.error('password init error',e); }
  }
  async verify(role, plain, clientId){ const id = clientId||'global'; if(!this.lockouts[id]) this.lockouts[id]={attempts:0,lockedUntil:0}; const lo=this.lockouts[id]; const now=Date.now(); if(lo.lockedUntil&&now<lo.lockedUntil) return {ok:false,reason:'locked'}; if(!this.hashes||!this.hashes[role]) return {ok:false,reason:'no_role'}; try{ const match = await bcrypt.compare(String(plain), this.hashes[role]); if(match){ lo.attempts=0; return {ok:true}; } else { lo.attempts+=1; if(lo.attempts>=5){ lo.lockedUntil=Date.now() + (15*60*1000); return {ok:false,reason:'locked'} } return {ok:false,reason:'invalid'} } }catch(e){ console.error('verify error',e); return {ok:false,reason:'error'} } }
  async setPassword(role,newPlain){ try{ const salt = await bcrypt.genSalt(10); const hash = await bcrypt.hash(String(newPlain),salt); this.hashes[role]=hash; await fs.writeJSON(this.file,this.hashes,{spaces:2}); return true; }catch(e){ console.error('setPassword error',e); return false; } }
}
module.exports = PasswordManager;
