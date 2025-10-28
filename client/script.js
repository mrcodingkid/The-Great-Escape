// script.js - Step 1 (Professional login, NO autofill, NO saving)
// This is a secure-by-design placeholder: passwords are checked client-side for now.
// Later we will replace this with secure server verification (Socket.IO).

(function(){

  // Role -> password constants (server will manage these in production)
  const ROLE_PASSWORDS = {
    mainAdmin: "TheGEAdmin",
    admin: "Admin",
    player: "Player",
    spectator: "Watch"
  };

  // UI references
  const roleSelect = document.getElementById("roleSelect");
  const passwordInput = document.getElementById("passwordInput");
  const connectBtn = document.getElementById("connectBtn");
  const infoBtn = document.getElementById("infoBtn");
  const feedback = document.getElementById("authFeedback");
  const sessionInfo = document.getElementById("sessionInfo");
  const currentRole = document.getElementById("currentRole");
  const connectionState = document.getElementById("connectionState");
  const openAdmin = document.getElementById("openAdmin");
  const openAdminPanel = document.getElementById("openAdminPanel");

  // Board elements
  const boardImage = document.getElementById("boardImage");
  const boardOverlay = document.getElementById("boardOverlay");
  const overlayCtx = boardOverlay.getContext ? boardOverlay.getContext("2d") : null;

  // Disable any browser autofill or saving hints on the password field
  passwordInput.setAttribute("autocomplete", "new-password");
  passwordInput.setAttribute("autocorrect", "off");
  passwordInput.setAttribute("autocapitalize", "off");

  // small sound generator for hover/click (no external assets)
  function makeClickSound() {
    try {
      const ac = window.audioContext || (window.audioContext = new (window.AudioContext || window.webkitAudioContext)());
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = "sine";
      o.frequency.value = 750;
      g.gain.value = 0.0001;
      o.connect(g);
      g.connect(ac.destination);
      o.start();
      g.gain.exponentialRampToValueAtTime(0.12, ac.currentTime + 0.005);
      g.gain.exponentialRampToValueAtTime(0.00001, ac.currentTime + 0.16);
      o.stop(ac.currentTime + 0.18);
    } catch(e){ /* audio not available; silently fail */ }
  }

  // small subtle hover effect
  [connectBtn, infoBtn].forEach(btn => {
    btn.addEventListener("mouseenter", () => { gsap.to(btn, {scale:1.03, duration:0.12}); makeClickSound(); });
    btn.addEventListener("mouseleave", () => gsap.to(btn, {scale:1, duration:0.12}));
  });

  // board overlay sizing
  function fitOverlay() {
    boardOverlay.width = boardImage.clientWidth;
    boardOverlay.height = boardImage.clientHeight;
  }
  window.addEventListener("resize", fitOverlay);
  window.addEventListener("load", fitOverlay);

  // simple parallax: mouse movement slightly shifts board image and exposes glow
  document.getElementById("boardFrame").addEventListener("mousemove", (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width/2;
    const cy = rect.top + rect.height/2;
    const dx = (e.clientX - cx) / rect.width;
    const dy = (e.clientY - cy) / rect.height;
    gsap.to(boardImage, {x: dx * 12, y: dy * 8, scale:1.01, duration:0.6, ease:"power3.out"});
  });
  document.getElementById("boardFrame").addEventListener("mouseleave", () => {
    gsap.to(boardImage, {x:0, y:0, scale:1, duration:0.8, ease:"power3.out"});
  });

  // starfield background (canvas)
  (function starfield(){
    const canvas = document.getElementById("starfield");
    const ctx = canvas.getContext("2d");
    let w=canvas.width=innerWidth, h=canvas.height=innerHeight;
    const stars = [];
    for(let i=0;i<120;i++){
      stars.push({x:Math.random()*w, y:Math.random()*h, z:Math.random()*1.2+0.2, r:Math.random()*1.1+0.2});
    }
    function resize(){ w=canvas.width=innerWidth; h=canvas.height=innerHeight; }
    addEventListener("resize", resize);
    function frame(){
      ctx.clearRect(0,0,w,h);
      // subtle gradient
      const g = ctx.createLinearGradient(0,0,0,h);
      g.addColorStop(0,"rgba(2,6,23,0.7)");
      g.addColorStop(1,"rgba(0,8,22,0.9)");
      ctx.fillStyle = g; ctx.fillRect(0,0,w,h);

      for(const s of stars){
        s.x += (s.z*0.25);
        s.y += Math.sin((Date.now()/7000)+s.x*0.0007)*0.15;
        if(s.x > w+50){ s.x = -30; s.y = Math.random()*h; }
        ctx.fillStyle = `rgba(160,220,255,${0.15 + s.r*0.08})`;
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r * (1 + s.z*0.6), 0, Math.PI*2); ctx.fill();
      }
      requestAnimationFrame(frame);
    }
    frame();
  })();

  // Authenticate button behavior (client-side check for Step 1)
  connectBtn.addEventListener("click", () => {
    feedback.textContent = "";
    const role = roleSelect.value;
    const pass = passwordInput.value;

    if(!pass || pass.trim().length === 0) {
      feedback.style.color = "#ffdcdc";
      feedback.textContent = "Please type the password for your chosen role.";
      return;
    }

    // check against constants (later replaced by secure server check)
    if(pass === ROLE_PASSWORDS[role]) {
      // success animation
      feedback.style.color = "#affff7";
      feedback.textContent = "Password verified. Entering the grid...";

      // show session info
      sessionInfo.classList.remove("hidden");
      currentRole.textContent = (role === "mainAdmin" ? "Main Admin" : role.charAt(0).toUpperCase() + role.slice(1));
      connectionState.textContent = "local";

      // show admin open button only for main admin
      if(role === "mainAdmin") {
        openAdmin.classList.remove("hidden");
        // create admin panel button only once
        if(!document.getElementById("controlPanel")) {
          openAdminPanel.addEventListener("click", () => {
            alert("Control Deck will appear here in the next step. It will be visual, not command line.");
          });
        }
      } else {
        openAdmin.classList.add("hidden");
      }

      // reveal some in-world HUD (pulsing entry)
      gsap.fromTo("#boardFrame", {scale:0.98, filter:"blur(3px)"}, {scale:1, filter:"blur(0px)", duration:0.9, ease:"power3.out"});
      gsap.to("#boardFrame", {boxShadow:"0 26px 80px rgba(0,208,255,0.12)", duration:0.9});
      // clear password field (do not store)
      passwordInput.value = "";
    } else {
      feedback.style.color = "#ff9a9a";
      feedback.textContent = "Password is incorrect for this role. Check and try again.";
      passwordInput.value = "";
      // subtle shake
      gsap.fromTo("#panel", {x:-6}, {x:0, duration:0.45, ease:"elastic.out(1,0.6)"});
    }
  });

  // Info button
  infoBtn.addEventListener("click", () => {
    feedback.style.color = "#bfefff";
    feedback.textContent = "This is the professional login screen. Server verification will be enabled next.";
  });

  // ensure overlay canvas matches image size
  function resizeOverlay(){
    const img = boardImage;
    boardOverlay.width = img.clientWidth;
    boardOverlay.height = img.clientHeight;
    // optional: draw subtle grid highlight
    if(overlayCtx){
      overlayCtx.clearRect(0,0,boardOverlay.width, boardOverlay.height);
      overlayCtx.strokeStyle = "rgba(0,208,255,0.03)";
      overlayCtx.lineWidth = 1;
      const step = Math.max(40, Math.floor(boardOverlay.width/16));
      for(let x=0;x<boardOverlay.width;x+=step){
        overlayCtx.beginPath(); overlayCtx.moveTo(x,0); overlayCtx.lineTo(x,boardOverlay.height); overlayCtx.stroke();
      }
      for(let y=0;y<boardOverlay.height;y+=step){
        overlayCtx.beginPath(); overlayCtx.moveTo(0,y); overlayCtx.lineTo(boardOverlay.width,y); overlayCtx.stroke();
      }
    }
  }
  window.addEventListener("load", resizeOverlay);
  window.addEventListener("resize", resizeOverlay);
})();
