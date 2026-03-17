// ══════════════════════════════════════════════
// celebracion.js — efectos de celebración
// Se activa desde scripts.js via window.dispararCelebracion()
// ══════════════════════════════════════════════

(function () {
  const canvas = document.getElementById('cel-canvas');
  const ctx    = canvas.getContext('2d');
  let W, H;

  function resize() { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; }
  window.addEventListener('resize', resize);
  resize();

  function rand(a, b) { return a + Math.random() * (b - a); }
  function pick(arr)  { return arr[Math.floor(Math.random() * arr.length)]; }

  // ── Confeti ────────────────────────────────────────────────────
  const CONFETTI_COLORS = [
    { r:212, g:168, b:84  }, { r:225, g:185, b:100 }, { r:255, g:252, b:240 },
    { r:245, g:238, b:218 }, { r:235, g:228, b:205 }, { r:156, g:175, b:136 },
  ];
  const SHAPES = ['rect','rect','rect','ribbon','diamond','dot','square'];
  const cBack = [], cMid = [], cFront = [];

  function spawnConfetti() {
    const col = pick(CONFETTI_COLORS), shape = pick(SHAPES), roll = Math.random();
    let arr, scale, alpha, blur;
    if      (roll < 0.33) { arr=cBack;  scale=rand(0.4,0.65); alpha=rand(0.25,0.45); blur=rand(1.5,2.5); }
    else if (roll < 0.66) { arr=cMid;   scale=rand(0.75,1.0); alpha=rand(0.55,0.80); blur=0; }
    else                  { arr=cFront; scale=rand(1.1,1.5);  alpha=rand(0.80,1.0);  blur=0; }
    arr.push({
      x:rand(0,W), y:rand(-60,-5),
      vx:rand(-1.0,1.0)*scale, vy:rand(0.3,1.6)*scale,
      s:rand(5,12)*scale, shape, col, alpha, blur,
      flipAngle:rand(0,Math.PI*2), flipSpeed:rand(0.02,0.055)*(arr===cFront?1.4:0.8),
      rot:rand(0,Math.PI*2), spin:rand(-0.015,0.015),
      sway:rand(0,Math.PI*2), swaySpeed:rand(0.02,0.045), swayAmp:rand(0.5,1.4)*scale,
    });
  }

  function drawShape(shape, s) {
    switch(shape) {
      case 'rect':    ctx.fillRect(-s*0.9,-s*0.35,s*1.8,s*0.7); break;
      case 'ribbon':  ctx.fillRect(-s*1.4,-s*0.2,s*2.8,s*0.4); break;
      case 'diamond':
        ctx.beginPath(); ctx.moveTo(0,-s*0.8); ctx.lineTo(s*0.55,0);
        ctx.lineTo(0,s*0.8); ctx.lineTo(-s*0.55,0); ctx.closePath(); ctx.fill(); break;
      case 'dot':
        ctx.beginPath(); ctx.arc(0,0,s*0.55,0,Math.PI*2); ctx.fill(); break;
      case 'square':  ctx.fillRect(-s*0.55,-s*0.55,s*1.1,s*1.1); break;
    }
  }

  function tickLayer(arr) {
    for (let i=arr.length-1; i>=0; i--) {
      const p = arr[i];
      p.vy += 0.06; p.vx *= 0.980; p.vy *= 0.985;
      p.sway += p.swaySpeed;
      p.vx += Math.sin(p.sway)*p.swayAmp*0.08;
      p.x += p.vx; p.y += p.vy;
      p.rot += p.spin; p.flipAngle += p.flipSpeed;
      if (p.y > H+20 || p.x < -30 || p.x > W+30) { arr.splice(i,1); continue; }
      const { r, g, b } = p.col;
      ctx.save();
      if (p.blur > 0) ctx.filter = `blur(${p.blur}px)`;
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.scale(Math.cos(p.flipAngle), 1);
      drawShape(p.shape, p.s);
      if (p.blur > 0) ctx.filter = 'none';
      ctx.restore();
    }
  }

  function tickConfetti() { tickLayer(cBack); tickLayer(cMid); tickLayer(cFront); }

  // ── Globos ─────────────────────────────────────────────────────
  const BALLOON_COLORS = [
    { body:'rgba(212,168,84,A)',  shine:'rgba(245,220,140,A)', weight:3 },
    { body:'rgba(200,155,70,A)',  shine:'rgba(235,205,120,A)', weight:2 },
    { body:'rgba(228,198,110,A)', shine:'rgba(250,230,160,A)', weight:2 },
    { body:'rgba(245,238,220,A)', shine:'rgba(255,252,240,A)', weight:1 },
    { body:'rgba(235,225,200,A)', shine:'rgba(250,245,230,A)', weight:1 },
  ];

  function pickBalloonsColors(count) {
    const colors=[], used={}, keys=BALLOON_COLORS.map((_,i)=>i);
    while (colors.length < count) {
      const available = keys.filter(k => (used[k]||0) < 2);
      if (!available.length) break;
      const k = available[Math.floor(Math.random()*available.length)];
      colors.push(BALLOON_COLORS[k]); used[k] = (used[k]||0)+1;
    }
    return colors;
  }

  const balloons = [];
  const celMouse = { x:-999, y:-999 };
  window.addEventListener('mousemove', e => { celMouse.x=e.clientX; celMouse.y=e.clientY; });

  function spawnBalloons(count, roundOffset=0) {
    const slotW = W/(count*2), colores = pickBalloonsColors(count);
    for (let i=0; i<count; i++) {
      const slotIdx = i*2+roundOffset;
      const px = slotW*slotIdx + slotW*0.5 + rand(-slotW*0.25, slotW*0.25);
      const col = colores[i] || pick(BALLOON_COLORS);
      const r = rand(22,38), vy = rand(-4.5,-3.2), repelR = r*5;
      balloons.push({
        x:px, y:H+r+rand(0,50), vy, vyBase:vy,
        vx:rand(-0.15,0.15), wobble:rand(0,Math.PI*2), wobbleSpeed:rand(0.018,0.032),
        r, repelR, repelRSq:repelR*repelR,
        bodyRgb:  col.body.match(/\d+/g).slice(0,3).join(','),
        shineRgb: col.shine.match(/\d+/g).slice(0,3).join(','),
        alpha:1, fadeIn:0, delay:i*40+rand(0,15)|0,
      });
    }
  }

  function drawBalloon(b) {
    const x=b.x+Math.sin(b.wobble)*4, y=b.y, r=b.r, a=b.alpha;
    const a1=(a*0.9).toFixed(2), a2=(a*0.85).toFixed(2), a3=(a*0.5).toFixed(2);
    const grad = ctx.createRadialGradient(x-r*0.3,y-r*0.3,r*0.05,x,y,r);
    grad.addColorStop(0,`rgba(${b.shineRgb},${a1})`);
    grad.addColorStop(1,`rgba(${b.bodyRgb},${a2})`);
    ctx.beginPath(); ctx.ellipse(x,y,r,r*1.15,0,0,Math.PI*2);
    ctx.fillStyle=grad; ctx.fill();
    ctx.beginPath(); ctx.moveTo(x,y+r*1.15);
    ctx.lineTo(x-3,y+r*1.15+6); ctx.lineTo(x+3,y+r*1.15+6); ctx.closePath();
    ctx.fillStyle=`rgba(${b.bodyRgb},${a1})`; ctx.fill();
    ctx.beginPath();
    const hiloLen=r*4;
    for (let t=0; t<=1; t+=0.1) {
      const hx=x+Math.sin(t*Math.PI*2+b.wobble)*6, hy=y+r*1.15+6+t*hiloLen;
      t===0 ? ctx.moveTo(hx,hy) : ctx.lineTo(hx,hy);
    }
    ctx.strokeStyle=`rgba(${b.bodyRgb},${a3})`; ctx.lineWidth=1; ctx.stroke();
  }

  function tickBalloons() {
    for (let i=balloons.length-1; i>=0; i--) {
      const b=balloons[i];
      if (b.delay>0) { b.delay--; continue; }
      const dx=b.x-celMouse.x, dy=b.y-celMouse.y, dist2=dx*dx+dy*dy;
      if (dist2 < b.repelRSq && dist2 > 0) {
        const dist=Math.sqrt(dist2), force=(1-dist/b.repelR)*0.55;
        b.vx+=(dx/dist)*force;
        if (dy<0) b.vy+=(dy/dist)*force*0.3;
      }
      b.vx*=0.97;
      if (b.vy>b.vyBase) b.vy=b.vyBase;
      if (b.x-b.r<0) { b.x=b.r;   b.vx=Math.abs(b.vx)*0.7; }
      if (b.x+b.r>W) { b.x=W-b.r; b.vx=-Math.abs(b.vx)*0.7; }
      b.x+=b.vx; b.y+=b.vy; b.wobble+=b.wobbleSpeed;
      b.alpha=Math.min(b.alpha+b.fadeIn, 1.0);
      if (b.y < -b.r*2) { balloons.splice(i,1); continue; }
      drawBalloon(b);
    }
  }

  // ── Estrellas ──────────────────────────────────────────────────
  const STARS = [];
  let starsTodasActivas = false;

  function initStars() {
    const positions = [
      [0.06,0.12],[0.94,0.10],[0.08,0.72],[0.93,0.68],[0.50,0.06],
      [0.18,0.40],[0.82,0.38],[0.30,0.88],[0.70,0.85],
    ];
    positions.forEach(([fx,fy]) => {
      STARS.push({ x:fx*W, y:fy*H, r:rand(4,7), phase:rand(0,Math.PI*2), speed:rand(0.012,0.022), alpha:0, activa:false });
    });
  }

  const STAR_ANGLES = Array.from({length:8}, (_,i) => (i*Math.PI)/4 - Math.PI/2);
  const STAR_COS    = STAR_ANGLES.map(a => Math.cos(a));
  const STAR_SIN    = STAR_ANGLES.map(a => Math.sin(a));

  function drawStar4(x, y, r, alpha) {
    const outer=r, inner=r*0.38;
    ctx.save(); ctx.translate(x,y); ctx.globalAlpha=alpha;
    const grd=ctx.createRadialGradient(0,0,0,0,0,outer*3);
    grd.addColorStop(0,`rgba(255,230,120,${(alpha*0.6).toFixed(2)})`);
    grd.addColorStop(1,'rgba(255,220,100,0)');
    ctx.fillStyle=grd; ctx.beginPath(); ctx.arc(0,0,outer*3,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=`rgba(255,225,90,${alpha.toFixed(2)})`;
    ctx.beginPath();
    for (let i=0; i<8; i++) {
      const rad=i%2===0?outer:inner;
      i===0?ctx.moveTo(STAR_COS[i]*rad,STAR_SIN[i]*rad):ctx.lineTo(STAR_COS[i]*rad,STAR_SIN[i]*rad);
    }
    ctx.closePath(); ctx.fill(); ctx.globalAlpha=1; ctx.restore();
  }

  function tickStars() {
    if (starsTodasActivas && STARS.every(s=>s.alpha<0.01)) return;
    if (!starsTodasActivas && STARS.every(s=>!s.activa)) return;
    const t=Date.now()*0.001;
    STARS.forEach(s => {
      const target=s.activa?Math.max(0,(Math.sin(t*s.speed*60+s.phase)+1)/2):0;
      s.alpha+=(target-s.alpha)*0.04;
      if (s.alpha>0.01) drawStar4(s.x, s.y, s.r, s.alpha);
    });
  }

  // ── Loop ───────────────────────────────────────────────────────
  let celebracionActiva = false;

  function loop() {
    ctx.clearRect(0,0,W,H);
    if (celebracionActiva && Math.random()<0.35) spawnConfetti();
    tickConfetti(); tickStars(); tickBalloons();
    requestAnimationFrame(loop);
  }
  loop();
  initStars();

  // ── API pública ────────────────────────────────────────────────
  window.dispararCelebracion = function () {
    if (celebracionActiva) return;
    celebracionActiva = true;

    canvas.classList.add('activo');

    // Título + estrellas
    setTimeout(() => {
      document.getElementById('cel-titulo').classList.add('visible');

      // Sonido celebración título
      const sfxCel = new Audio('assets/celebracion_titulo.mp3');
      sfxCel.volume = 0.35;
      sfxCel.play().catch(() => {});

      STARS.forEach((s,i) => setTimeout(() => {
        s.activa = true;
        if (i === STARS.length-1) starsTodasActivas = true;
      }, 1400+i*180));
    }, 600);

    // Globos
    setTimeout(() => spawnBalloons(5, 0), 1200);
    setTimeout(() => spawnBalloons(4, 1), 5500);

    // Flores aparecen cuando globos están a mitad de pantalla (~3.5s)
    setTimeout(() => {
      document.getElementById('flores-izq').classList.add('visible');
      document.getElementById('flores-der').classList.add('visible');

      // Sonido flores
      const sfxFlores = new Audio('assets/flores.mp3');
      sfxFlores.volume = 0.28;
      sfxFlores.play().catch(() => {});
    }, 3500);

    // Fin confeti
    setTimeout(() => {
      celebracionActiva = false;
    }, 14000);

    // Transición a página final — 16s
    setTimeout(() => {
      // Fade out música
      const music = document.getElementById('bg-music');
      if (music && !music.paused) {
        const startVol = music.volume;
        const steps = 40;
        let step = 0;
        const fadeMusic = setInterval(() => {
          step++;
          music.volume = Math.max(0, startVol * (1 - step / steps));
          if (step >= steps) { clearInterval(fadeMusic); music.pause(); }
        }, 2000 / steps);
      }

      // Fade a negro
      const fade = document.createElement('div');
      fade.style.cssText = `
        position:fixed; inset:0; z-index:9999;
        background:#0E0E0E; opacity:0; pointer-events:none;
        transition: opacity 2s ease;
      `;
      document.body.appendChild(fade);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        fade.style.opacity = '1';
      }));

      // Cargar página final después del fade
      setTimeout(() => {
        if (typeof window.mostrarPantallaFinal === 'function') {
          window.mostrarPantallaFinal();
        }
      }, 2100);

    }, 16000);
  };
})();