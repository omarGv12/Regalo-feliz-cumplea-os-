// ══════════════════════════════════════════════
// particulas.js — sistema de partículas estrella
// Se activa/desactiva desde scripts.js
// ══════════════════════════════════════════════

let canvas, ctx;
let W, H;
let running  = false;
let alphaMax = 0;

const rain = [];

function rand(a, b) { return a + Math.random() * (b - a); }

function spawnStar() {
  if (rain.length > 220) return;
  const roll = Math.random();
  rain.push({
    x:     rand(0, W),
    y:     rand(-60, -10),
    vx:    rand(-0.15, 0.15),
    vy:    rand(0.15, 0.45),
    r:     rand(0.8, 2.4),
    a:     rand(0.65, 1.0),
    color: roll < 0.60 ? 'white' : roll < 0.85 ? 'blue' : 'yellow',
    rot:   rand(0, Math.PI * 2),
    spin:  rand(-0.008, 0.008),
    trail: [],
  });
}

function drawStar(x, y, r, rotation, color) {
  const outer = r;
  const inner = r * 0.32;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const angle  = (i * Math.PI) / 4;
    const radius = i % 2 === 0 ? outer : inner;
    if (i === 0) ctx.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
    else         ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

let heroRect = null;
export function setHeroRect(rect) {
  heroRect = rect;
}

function tick() {
  if (running && Math.random() < 0.55) spawnStar();

  const target = running ? 1 : 0;
  alphaMax += (target - alphaMax) * 0.025;

  ctx.clearRect(0, 0, W, H);

  if (alphaMax < 0.005) {
    rain.length = 0;
    requestAnimationFrame(tick);
    return;
  }

  const FLOOR = H * 0.98;

  for (let i = rain.length - 1; i >= 0; i--) {
    const p = rain[i];
    p.trail.push({ x: p.x, y: p.y });
    if (p.trail.length > 5) p.trail.shift();
    p.x  += p.vx;
    p.y  += p.vy;
    p.vy += 0.004;
    p.vx *= 0.998;
    if (p.y >= FLOOR || p.x < -10 || p.x > W + 10) {
      rain.splice(i, 1);
    }
  }

  rain.forEach(p => {
    // fade zona carta — solo las que pasan por el ancho de la carta
    let cardFade = 1;
    if (heroRect) {
      const inCardX = p.x > heroRect.left && p.x < heroRect.right;
      if (inCardX) {
        const range = 120;
        if (p.y > heroRect.top - range && p.y < heroRect.top) {
          cardFade = (heroRect.top - p.y) / range;
        } else if (p.y >= heroRect.top) {
          cardFade = 0;
        }
      }
    }

    // fade suelo
    const distFloor = FLOOR - p.y;
    const floorFade = distFloor < 20 ? distFloor / 20 : 1;

    const fade = Math.min(cardFade, floorFade) * alphaMax;

    // trail
    for (let i = 0; i < p.trail.length; i++) {
      const tr = p.trail[i];
      const ta = (i / p.trail.length) * p.a * 0.3 * fade;
      const col = p.color === 'blue'
        ? `rgba(160,200,255,${ta * 0.95})`
        : p.color === 'yellow'
        ? `rgba(255,220,100,${ta * 0.65})`
        : `rgba(255,252,240,${ta})`;
      drawStar(tr.x, tr.y, p.r * 0.45, p.rot, col);
    }

    // estrella
    const col = p.color === 'blue'
      ? `rgba(160,200,255,${p.a * 0.95 * fade})`
      : p.color === 'yellow'
      ? `rgba(255,220,100,${p.a * 0.65 * fade})`
      : `rgba(255,252,240,${p.a * fade})`;
    drawStar(p.x, p.y, p.r * 2.8, p.rot, col);

    p.rot += p.spin;
  });

  requestAnimationFrame(tick);
}

export function initParticulas() {
  canvas = document.createElement('canvas');
  canvas.id = 'particulas-canvas';
  canvas.style.cssText = 'position:fixed;inset:0;pointer-events:none;';

  // Antes del canvas de Three.js — queda detrás por orden DOM
  const threeCanvas = document.getElementById('three-canvas');
  if (threeCanvas) {
    document.body.insertBefore(canvas, threeCanvas);
  } else {
    document.body.appendChild(canvas);
  }

  ctx = canvas.getContext('2d');

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  requestAnimationFrame(tick);
}

export function particulasStart() { running = true; }
export function particulasStop()  { running = false; }