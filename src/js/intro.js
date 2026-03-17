// ══ INTRO PARTICLES ══
if (window.IS_MOBILE) throw new Error('mobile');
const canvas = document.getElementById('intro-canvas');
const ctx    = canvas.getContext('2d', { alpha: true });
let W, H, particles = [], mouse = { x:-999, y:-999 };
let lastFrame = 0;
const FPS = 30, interval = 1000 / FPS;

function resize() { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; }
resize();
window.addEventListener('resize', resize);
window.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
window.addEventListener('touchmove', e => { mouse.x = e.touches[0].clientX; mouse.y = e.touches[0].clientY; }, { passive:true });

class Particle {
  constructor() { this.reset(true); }
  reset(init=false) {
    this.x = Math.random()*W; this.y = init ? Math.random()*H : H+10;
    this.r = Math.random() < 0.6 ? Math.random()*1.2+0.2 : Math.random()*2.5+1.0;
    this.vy = -(Math.random()*0.7+0.3); this.vx = (Math.random()-0.5)*0.5;
    this.flicker = Math.random()*Math.PI*2;
    this.gold = Math.random()>0.55;
    this.blue = !this.gold && Math.random()>0.85;
    this.baseAlpha = 0;
    this.targetAlpha = Math.random()*0.4+0.35;
    this.fadeDelay = Math.random()*3000;
    this.born = Date.now();
  }
  update() {
    const dx=mouse.x-this.x, dy=mouse.y-this.y, dist=Math.sqrt(dx*dx+dy*dy);
    if (dist<120) { const f=(120-dist)/120*0.007; this.vx+=dx*f; }
    this.vx*=0.96; this.vy=this.vy*0.96+(-(Math.random()*0.7+0.3))*0.04;
    this.x+=this.vx; this.y+=this.vy; this.flicker+=0.04;
    const now=Date.now(), elapsed=now-this.born-this.fadeDelay;
    if (elapsed>0) this.baseAlpha=Math.min(this.targetAlpha, this.baseAlpha+0.004);
    const fadeStart=H*0.55, fadeFactor=this.y<fadeStart?Math.max(0,this.y/fadeStart):1;
    this.alpha=(this.baseAlpha+Math.sin(this.flicker)*0.2)*fadeFactor;
    if (this.y<-10) this.reset();
  }
  draw() {
    ctx.beginPath(); ctx.arc(this.x,this.y,this.r,0,Math.PI*2);
    ctx.fillStyle = this.gold ? `rgba(230,205,150,${this.alpha})`
      : this.blue ? `rgba(160,190,230,${this.alpha*0.6})`
      : `rgba(255,255,255,${this.alpha*0.75})`;
    ctx.fill();
  }
}

for (let i=0; i<220; i++) particles.push(new Particle());

let animating = true;
function loop(ts) {
  if (!animating) return;
  if (ts - lastFrame < interval) { requestAnimationFrame(loop); return; }
  lastFrame = ts;
  ctx.clearRect(0,0,W,H);
  particles.forEach(p => { p.update(); p.draw(); });
  requestAnimationFrame(loop);
}
loop(0);

// Detener breathe del body durante la intro
document.body.classList.add('intro-active');

// Haz base
setTimeout(() => document.getElementById('intro-base-light').classList.add('show'), 300);

// Botón
let ready = false;
setTimeout(() => {
  const hint = document.getElementById('intro-hint');
  hint.style.transition = 'opacity 0.8s ease';
  hint.style.opacity = '1';
  hint.classList.add('attention');
  setTimeout(() => { hint.classList.remove('attention'); hint.classList.add('show'); }, 1300);
  ready = true;
}, 200);

// ══ TRANSICIÓN ══
function proceed() {
  if (!ready) return;
  ready = false;

  // ── Sonido de apertura ──
  const sfxApertura = new Audio('assets/apertura.mp3');
  sfxApertura.volume = 0.3;
  sfxApertura.play().catch(() => {});

  // ── Arranca música con fade in ──
  const music = document.getElementById('bg-music');
  if (music) {
    if (!music.src || music.src === window.location.href) {
      music.src = music.dataset.src;
    }
    console.log('🎵 music src:', music.src);
    music.volume = 0;
    music.play().then(() => {
      let vol = 0;
      const fade = setInterval(() => {
        vol = Math.min(vol + 0.003, 0.08);
        music.volume = vol;
        if (vol >= 0.08) clearInterval(fade);
      }, 80);
    }).catch(e => console.error('🎵 error:', e));
  } else {
    console.error('🎵 no se encontró #bg-music');
  }
  document.getElementById('intro-hint').style.opacity = '0';
  canvas.style.transition = 'opacity 0.8s ease';
  canvas.style.opacity = '0';

  const flash = document.createElement('div');
  flash.style.cssText = `
    position:fixed; inset:0; z-index:1000;
    background:#0a0a08; opacity:0; pointer-events:none;
    transition: opacity 0.8s ease;
  `;
  document.body.appendChild(flash);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    flash.style.opacity = '1';
  }));

  setTimeout(() => {
    const overlay = document.getElementById('intro-overlay');
    overlay.classList.add('hide');
    setTimeout(() => {
      animating = false;
      overlay.remove();
      document.body.classList.remove('intro-active');
      flash.style.transition = 'opacity 2.4s ease';
      flash.style.opacity = '0';
      setTimeout(() => flash.remove(), 2500);
    }, 400);
  }, 1500);
}

document.getElementById('intro-btn').addEventListener('click', e => { e.stopPropagation(); proceed(); });
document.getElementById('intro-btn').addEventListener('touchstart', e => { e.preventDefault(); proceed(); }, { passive:false });