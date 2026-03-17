import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { cargarTexturas } from './cartas.js';
import { initParticulas, particulasStart, particulasStop, setHeroRect } from './particulas.js';

if (window.IS_MOBILE) throw new Error('mobile');

let shadowScale = 1;
let targetShadowScale = 1;
let shadowOpacity = 0.08;
let targetShadowOpacity = 0.08;
let idleTime = 0;
let idleIntensity = 1;
let isPreparing = false;
let preparationOffset = 0;
let preparationTarget = 0;
let preparationPhase = 0;
let pendingCelebracion = false;
let celebracionEnCurso = false;

let floatOffset = 0;
let baseModelY = 0;
let boxHoverLift = 0;

let innerGlowIntensity = 0;
let targetInnerGlow = 0;

// ── Fondo interpolado ─────────────────────────────────────────
let bgT = 0, bgTarget = 0;
function lerpColor(a, b, t) {
  const ah = a.replace('#',''), bh = b.replace('#','');
  const ar = parseInt(ah.slice(0,2),16), ag = parseInt(ah.slice(2,4),16), ab = parseInt(ah.slice(4,6),16);
  const br = parseInt(bh.slice(0,2),16), bg = parseInt(bh.slice(2,4),16), bb = parseInt(bh.slice(4,6),16);
  const r = Math.round(ar+(br-ar)*t), g = Math.round(ag+(bg-ag)*t), b2 = Math.round(ab+(bb-ab)*t);
  return `rgb(${r},${g},${b2})`;
}

// ── Sistema de cartas ──────────────────────────────────────────
let cardMeshes = [];
let cardCurrent = 0;
let cardBusy = false;
let cardStarted = false;

// ── Luz dinámica con mouse ─────────────────────────────────────
let mouseNorm = { x: 0, y: 0 };        // suavizado (-1..1)
let mouseNormTarget = { x: 0, y: 0 };  // valor crudo

// ── Hover tapa ─────────────────────────────────────────────────
let lidHovered = false;
const RIM_BASE = 0.55;

// ── Tilt carta hero ────────────────────────────────────────────
let cardTiltX = 0, cardTiltY = 0;

const CARD_HERO = new THREE.Vector3(0, 0.95, 1.5);
const CARD_HERO_QUAT = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 1.65, 0, 0));

//////////////////////////
// RENDERER
//////////////////////////

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x000000, 0);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.45;

renderer.domElement.id = 'three-canvas';
document.body.appendChild(renderer.domElement);

// Inicializar sistema de partículas
initParticulas();

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

//////////////////////////
// SCENE + CAMERA
//////////////////////////

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  38,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

camera.position.set(0, 1.541, 2.306);
camera.lookAt(0, 0, 0);

const CAM_INIT_POS    = new THREE.Vector3(0, 1.541, 2.306);
const CAM_INIT_TARGET = new THREE.Vector3(0, 0, 0);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.enableZoom = false;
controls.enablePan = false;
controls.minAzimuthAngle = -Math.PI / 18;
controls.maxAzimuthAngle = Math.PI / 18;
controls.minPolarAngle = Math.PI / 3.2;
controls.maxPolarAngle = Math.PI / 2.4;

//////////////////////////
// LUCES
//////////////////////////

const ambientLight = new THREE.AmbientLight(0xffffff, 0.55);
scene.add(ambientLight);

const keyLight = new THREE.DirectionalLight(0xffffff, 0.9);
keyLight.position.set(5, 6, 2);
keyLight.castShadow = true;
keyLight.shadow.mapSize.width = 1024;
keyLight.shadow.mapSize.height = 1024;
keyLight.shadow.radius = 6;
keyLight.shadow.camera.near = 0.5;
keyLight.shadow.camera.far = 50;
keyLight.shadow.camera.left = -8;
keyLight.shadow.camera.right = 8;
keyLight.shadow.camera.top = 8;
keyLight.shadow.camera.bottom = -8;
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0xffffff, 0.45);
fillLight.position.set(-4, 3, 4);
scene.add(fillLight);

const rimLight = new THREE.DirectionalLight(0xffffff, RIM_BASE);
rimLight.position.set(0, 5, -6);
scene.add(rimLight);

const engravingLight = new THREE.DirectionalLight(0xfff4d6, 0.35);
engravingLight.position.set(-3, 2, 4);
scene.add(engravingLight);

const goldLight = new THREE.SpotLight(0xfff5d6, 1.8, 5, Math.PI / 10, 0.4);

const innerLight = new THREE.PointLight(0xffe6b8, 0, 1.2);
innerLight.decay = 2.5;
innerLight.distance = 0.9;
scene.add(innerLight);

//////////////////////////
// TEXTURA PROCEDURAL
//////////////////////////

function createFabricTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 4000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = Math.random() * 1.2;
    const alpha = Math.random() * 0.12 + 0.04;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(0,0,0,${alpha})`;
    ctx.fill();
  }

  const imgH = ctx.createImageData(size, size);
  for (let y = 0; y < size; y += 3) {
    const alpha = Math.floor((Math.random() * 0.05 + 0.02) * 255);
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      imgH.data[idx] = 0; imgH.data[idx+1] = 0; imgH.data[idx+2] = 0;
      imgH.data[idx+3] = alpha;
    }
  }
  ctx.putImageData(imgH, 0, 0);

  for (let i = 0; i < 10; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const radius = Math.random() * 60 + 20;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
    grad.addColorStop(0, `rgba(255,255,255,${Math.random() * 0.06})`);
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 5);
  return texture;
}

//////////////////////////
// SOMBRA DE CONTACTO
//////////////////////////

const shadowGeometry = new THREE.CircleGeometry(0.85, 64);
const shadowMaterial = new THREE.MeshBasicMaterial({
  color: 0x000000,
  transparent: true,
  opacity: 0.08,
});
const contactShadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
contactShadow.rotation.x = -Math.PI / 2;
contactShadow.position.y = -0.09;
scene.add(contactShadow);

//////////////////////////
// VARIABLES ANIMACIÓN
//////////////////////////

let boxLid;
let modelRoot;
let isOpen = false;

let baseRotation = 0;
let currentRotation = 0;
let targetRotation = 0;
let velocity = 0;

//////////////////////////
// CARGAR MODELO
//////////////////////////

const loader = new GLTFLoader();

loader.load('./assets/caja_hecha.glb', function (gltf) {

  modelRoot = gltf.scene;
  modelRoot.scale.set(0.5, 0.5, 0.5);
  scene.add(modelRoot);

  modelRoot.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  const fabricTexture = createFabricTexture();

  modelRoot.traverse((child) => {
    if (child.isMesh) {
      if (child.name === 'Box_Lid' || child.name === 'Box_Base') {
        child.material = child.material.clone();
        child.material.roughnessMap = fabricTexture;
        child.material.aoMap = fabricTexture;
        child.material.aoMapIntensity = 0.75;
        child.material.bumpMap = fabricTexture;
        child.material.bumpScale = 0.008;
        child.material.roughness = 0.88;
        child.material.metalness = 0.0;
        child.material.needsUpdate = true;

        if (child.name === 'Box_Lid') {
          child.material.color.multiplyScalar(0.82);
        }
      }
    }
  });

  contactShadow.position.x = modelRoot.position.x;
  contactShadow.position.z = modelRoot.position.z;

  baseModelY = modelRoot.position.y;

  boxLid = modelRoot.getObjectByName('Box_Lid');

  if (!boxLid) {
    console.error("No se encontró 'Box_Lid' en el modelo");
    return;
  }

  baseRotation = boxLid.rotation.x - THREE.MathUtils.degToRad(-42);
  boxLid.rotation.x = baseRotation;
  currentRotation = baseRotation;
  targetRotation = baseRotation;

  keyLight.target = modelRoot;
  goldLight.target.position.set(0, 0.5, 0);
  scene.add(goldLight.target);

  innerLight.position.set(
    modelRoot.position.x,
    modelRoot.position.y - 0.1,
    modelRoot.position.z
  );

  // ── Cargar texturas de cartas ──────────────────────────────
  cargarTexturas().then(texturas => {
    const nombres = ['carta8','carta7','carta6','carta5','carta4','carta3','carta2','carta1'];
    nombres.forEach((nombre, i) => {
      const child = modelRoot.getObjectByName(nombre);
      if (!child || !texturas[nombre]) return;

      const tex = texturas[nombre];
      tex.colorSpace = THREE.SRGBColorSpace;
      child.material = new THREE.MeshBasicMaterial({
        map: tex,
        side: THREE.DoubleSide,
      });
      child.material.needsUpdate = true;

      const wPos  = new THREE.Vector3();
      const wQuat = new THREE.Quaternion();
      child.getWorldPosition(wPos);
      child.getWorldQuaternion(wQuat);

      scene.attach(child);

      child.userData.homePos   = wPos.clone();
      child.userData.homeQuat  = wQuat.clone();
      child.userData.cardIdx   = i;
      child.userData.cardState = 'home';
      child.userData.cardAnim  = null;

      cardMeshes[i] = child;
    });
  });

});

//////////////////////////
// INTERACCIÓN
//////////////////////////

let mouseDirty = false;
window.addEventListener('mousemove', (event) => {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  // también alimenta la luz dinámica
  mouseNormTarget.x = mouse.x;
  mouseNormTarget.y = mouse.y;
  mouseDirty = true;
});

// ── Música de fondo ──────────────────────────────────────────
let musicStarted = false;
function startMusic() {
  if (musicStarted) return;
  musicStarted = true;
  const music = document.getElementById('bg-music');
  if (!music) return;
  music.volume = 0;
  music.play().catch(() => {});
  // Fade in suave en 3 segundos
  let vol = 0;
  const fade = setInterval(() => {
    vol = Math.min(vol + 0.01, 0.25);
    music.volume = vol;
    if (vol >= 0.25) clearInterval(fade);
  }, 60);
}

window.addEventListener('click', () => {
  if (document.getElementById('intro-overlay')) return;
  if (celebracionEnCurso) return;

  raycaster.setFromCamera(mouse, camera);

  // 1. Cartas activas → click en carta hero
  if (cardStarted) {
    const hero = cardMeshes.find(c => c && c.userData.cardState === 'hero');
    if (hero && !cardBusy) {
      const hit = raycaster.intersectObject(hero, true);
      if (hit.length > 0) {
        // Sonido click tarjeta
        const sfxClick = new Audio('assets/click_tarjeta.mp3');
        sfxClick.volume = 0.25;
        sfxClick.play().catch(() => {});
        cardBusy = true;
        if (cardCurrent < cardMeshes.length - 1) {
          cardReturn(cardCurrent, () => {
            cardCurrent++;
            cardRise(cardCurrent);
            setTimeout(() => { cardBusy = false; }, 1400);
          });
        } else {
          // Última carta → regresa y cierra → celebración
          cardReturn(cardCurrent, () => {
            setTimeout(() => {
              isPreparing       = true;
              preparationPhase  = 0;
              preparationTarget = 0.055;
              cardStarted       = false;
              cardCurrent       = 0;
              particulasStop();
              // bgTarget se queda en 1 (fondo oscuro para la celebración)
              // Marcar que esperamos el cierre de la caja para disparar
              pendingCelebracion = true;
              celebracionEnCurso = true;
            }, 200);
            setTimeout(() => { cardBusy = false; }, 1400);
          });
        }
      }
    }
    return;
  }

  // 2. Caja abierta → click en una carta inicia presentación
  if (isOpen && !isPreparing && cardMeshes.length > 0) {
    const homeCards = cardMeshes.filter(c => c && c.userData.cardState === 'home');
    const hits = raycaster.intersectObjects(homeCards, true);
    if (hits.length === 0) return; // click fuera de las cartas — ignorar

    document.getElementById('hint').classList.add('hidden');
    cardStarted = true;
    cardBusy    = true;
    particulasStart();
    const fromPos    = camera.position.clone();
    const fromTarget = controls.target.clone();
    const dur = 700, t0 = performance.now();
    (function resetCam() {
      const t = Math.min((performance.now() - t0) / dur, 1);
      const e = 1 - Math.pow(1 - t, 3);
      camera.position.lerpVectors(fromPos, CAM_INIT_POS, e);
      controls.target.lerpVectors(fromTarget, CAM_INIT_TARGET, e);
      controls.update();
      if (t < 1) requestAnimationFrame(resetCam);
      else { cardRise(0); setTimeout(() => { cardBusy = false; }, 1400); }
    })();
    return;
  }

  // 3. Click en tapa — solo si no hay cartas activas
  if (!boxLid || isPreparing || cardStarted) return;
  const intersects = raycaster.intersectObject(boxLid, true);
  if (intersects.length > 0) {
    isPreparing       = true;
    preparationPhase  = 0;
    preparationTarget = 0.055;

    // Sonido de caja al abrir
    const sfx = new Audio('assets/caja.mp3');
    sfx.volume = 0.2;
    sfx.play().catch(() => {});
  }

});

// ── Funciones de animación de cartas ──────────────────────────

function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
function easeInOut(t)    { return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2; }

function cardRise(idx) {
  const c = cardMeshes[idx];
  if (!c) return;

  // Sonido animación tarjeta
  const sfxRise = new Audio('assets/animacion_tarjeta.mp3');
  sfxRise.volume = 0.22;
  sfxRise.play().catch(() => {});

  c.userData.cardState = 'rising';
  c.userData.cardAnim  = {
    type: 'rise', p: 0,
    fromPos:  c.userData.homePos.clone(),
    fromQuat: c.userData.homeQuat.clone(),
  };
}

function cardReturn(idx, onDone) {
  const c = cardMeshes[idx];
  if (!c) return;
  c.userData.cardState = 'returning';
  c.userData.cardAnim  = {
    type: 'return', p: 0, onDone,
    fromPos:  c.position.clone(),   // posición real actual (incluye tilt float)
    fromQuat: c.quaternion.clone(),  // rotación real actual
    toQuat:   c.userData.homeQuat.clone(),
  };
  document.body.classList.remove('card-focus');
}

const cardClock = new THREE.Timer();

function tickCards() {
  cardClock.update();
  const dt = Math.min(cardClock.getDelta(), 0.05);

  cardMeshes.forEach(card => {
    if (!card) return;
    const a = card.userData.cardAnim;

    // Float + tilt manejados en animate() cuando está en hero
    if (!a && card.userData.cardState === 'hero') return;
    if (!a) return;

    a.p += dt * 0.75;
    const p = Math.min(a.p, 1);
    const q = 1 - p;
    const eo = easeOutCubic(p);

    if (a.type === 'rise') {
      const p0 = a.fromPos;
      const p3 = CARD_HERO;
      const p1 = new THREE.Vector3(p0.x, p0.y + 0.08, p0.z);
      const p2 = new THREE.Vector3(p3.x, p3.y + 0.04, p3.z);

      card.position.set(
        q*q*q*p0.x + 3*q*q*p*p1.x + 3*q*p*p*p2.x + p*p*p*p3.x,
        q*q*q*p0.y + 3*q*q*p*p1.y + 3*q*p*p*p2.y + p*p*p*p3.y,
        q*q*q*p0.z + 3*q*q*p*p1.z + 3*q*p*p*p2.z + p*p*p*p3.z,
      );
      card.quaternion.slerpQuaternions(a.fromQuat, CARD_HERO_QUAT, eo);

      if (p >= 1) {
        card.position.copy(CARD_HERO);
        card.quaternion.copy(CARD_HERO_QUAT);
        card.userData.cardState = 'hero';
        card.userData.cardAnim  = null;
        document.body.classList.add('card-focus');
        bgTarget = 1;
      }

    } else if (a.type === 'return') {
      const p0  = a.fromPos;
      const hPos = card.userData.homePos;
      const p3  = hPos;
      const p1  = new THREE.Vector3(p0.x, p0.y + 0.04, p0.z);
      const p2  = new THREE.Vector3(p3.x, p3.y + 0.08, p3.z);

      card.position.set(
        q*q*q*p0.x + 3*q*q*p*p1.x + 3*q*p*p*p2.x + p*p*p*p3.x,
        q*q*q*p0.y + 3*q*q*p*p1.y + 3*q*p*p*p2.y + p*p*p*p3.y,
        q*q*q*p0.z + 3*q*q*p*p1.z + 3*q*p*p*p2.z + p*p*p*p3.z,
      );
      card.quaternion.slerpQuaternions(a.fromQuat, a.toQuat, easeInOut(p));

      if (p >= 1) {
        card.position.copy(hPos);
        card.quaternion.copy(a.toQuat);
        card.userData.cardState = 'home';
        card.userData.cardAnim  = null;
        card.userData.hoverLift = 0; // limpiar residuo
        if (a.onDone) a.onDone();
      }
    }
  });
}

//////////////////////////
// ANIMACIÓN
//////////////////////////

function animate() {
  requestAnimationFrame(animate);

  idleTime = (idleTime + 0.01) % (Math.PI * 200);

  if (boxLid && modelRoot) {

    if (isPreparing) {
      const tensionSpeed = 0.12;

      if (preparationPhase === 0) {
        preparationOffset += (preparationTarget - preparationOffset) * tensionSpeed;
        if (Math.abs(preparationTarget - preparationOffset) < 0.002) {
          preparationPhase = 1;
        }
      } else {
        preparationOffset += (0 - preparationOffset) * tensionSpeed;
        if (Math.abs(preparationOffset) < 0.002) {

          isOpen = !isOpen;
          if (isOpen) {
            const hint = document.getElementById('hint');
            hint.querySelector('p').textContent = 'Toca las cartas para comenzar ✦';
            hint.classList.remove('hidden');
          } else {
            document.getElementById('hint').classList.add('hidden');
          }

          const openAngle = -Math.PI / 4.5;
          targetRotation  = isOpen ? baseRotation + openAngle : baseRotation;

          if (isOpen) {
            targetShadowScale   = 1.15;
            targetShadowOpacity = 0.05;
            targetInnerGlow     = 0.45;
          } else {
            // Sonido cierre de caja
            const sfxCierre = new Audio('assets/cierre_de_caja.mp3');
            sfxCierre.volume = 0.35;
            sfxCierre.play().catch(() => {});
            targetShadowScale   = 1;
            targetShadowOpacity = 0.08;
            targetInnerGlow     = 0;
          }

          idleIntensity     = isOpen ? 0.4 : 1;
          preparationOffset = 0;
          isPreparing       = false;
        }
      }
    }

    const speed   = 0.004;
    const damping = 0.87;

    velocity += (targetRotation - currentRotation) * speed;
    velocity *= damping;
    currentRotation += velocity;

    if (Math.abs(targetRotation - currentRotation) < 0.0005 && Math.abs(velocity) < 0.0005) {
      currentRotation = targetRotation;
      velocity = 0;

      // Caja terminó de cerrarse → disparar celebración con delay suave
      if (pendingCelebracion) {
        pendingCelebracion = false;
        setTimeout(() => {
          if (typeof window.dispararCelebracion === 'function') window.dispararCelebracion();
        }, 1800);
      }
    }

    boxLid.rotation.x = currentRotation + preparationOffset;

    floatOffset = Math.sin(idleTime * 0.4) * 0.006 * idleIntensity;
    const idleRotation = Math.sin(idleTime * 0.5) * 0.004 * idleIntensity;

    // Rotación Y suave siguiendo el mouse (rango ±0.12 rad)
    mouseNorm.x += (mouseNormTarget.x - mouseNorm.x) * 0.03;
    const mouseRotY = mouseNorm.x * 0.12;

    modelRoot.rotation.y  = idleRotation + mouseRotY;
    modelRoot.position.y  = baseModelY + floatOffset;

    innerGlowIntensity   += (targetInnerGlow - innerGlowIntensity) * 0.018;
    innerLight.intensity  = innerGlowIntensity;
    innerLight.position.y = modelRoot.position.y - 0.1;

    const floatFactor = 1 - (floatOffset / 0.006) * 0.02;
    contactShadow.scale.set(
      shadowScale * floatFactor,
      shadowScale * floatFactor,
      shadowScale * floatFactor
    );
  }

  shadowScale   += (targetShadowScale   - shadowScale)   * 0.07;
  shadowOpacity += (targetShadowOpacity - shadowOpacity) * 0.07;
  contactShadow.material.opacity = shadowOpacity;

  // ── 1. Luz dinámica — posición fija ───────────────────────

  // ── 2. Hover tapa — rimLight fijo ────────────────────────

  // ── 3. Tilt suave de carta en hero ────────────────────────
  const heroCard = cardMeshes.find(c => c && c.userData.cardState === 'hero');
  if (heroCard) {
    const tiltTargetX = -mouseNorm.y * 0.07;
    const tiltTargetY =  mouseNorm.x * 0.09;
    cardTiltX += (tiltTargetX - cardTiltX) * 0.06;
    cardTiltY += (tiltTargetY - cardTiltY) * 0.06;

    const base  = CARD_HERO_QUAT.clone();
    const extra = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(cardTiltX, cardTiltY, 0)
    );
    heroCard.quaternion.copy(base.multiply(extra));
    heroCard.position.y = CARD_HERO.y + Math.sin(Date.now() * 0.0013) * 0.003;

  } else {
    cardTiltX += (0 - cardTiltX) * 0.06;
    cardTiltY += (0 - cardTiltY) * 0.06;
  }

  // ── Fondo interpolado ──────────────────────────────────────
  bgT += (bgTarget - bgT) * 0.032;
  const c1 = lerpColor('#F8F4EC', '#b0aca4', bgT);
  const c2 = lerpColor('#E8E3D9', '#9e9a92', bgT);
  const c3 = lerpColor('#9CAF88', '#4a5c42', bgT);
  document.body.style.background = `radial-gradient(circle at center, ${c1} 0%, ${c2} 40%, ${c3} 100%)`;

  // ── Cartas ─────────────────────────────────────────────────
  tickCards();

  // ── Rect de carta hero para partículas ─────────────────────
  if (heroCard) {
    const corners = [
      new THREE.Vector3(-0.28, -0.40, 0),
      new THREE.Vector3( 0.28, -0.40, 0),
      new THREE.Vector3( 0.28,  0.40, 0),
      new THREE.Vector3(-0.28,  0.40, 0),
    ];
    const screenPts = corners.map(c => {
      const v = c.clone().applyMatrix4(heroCard.matrixWorld);
      v.project(camera);
      return {
        x: ( v.x + 1) / 2 * window.innerWidth,
        y: (-v.y + 1) / 2 * window.innerHeight,
      };
    });
    const xs = screenPts.map(p => p.x);
    const ys = screenPts.map(p => p.y);
    setHeroRect({
      left:   Math.min(...xs) - 30,
      right:  Math.max(...xs) + 30,
      top:    Math.min(...ys) - 30,
      bottom: Math.max(...ys) + 30,
    });
  } else {
    setHeroRect(null);
  }

  // ── Raycaster hover ────────────────────────────────────────
  if (mouseDirty) {
    mouseDirty = false;
    if (boxLid) {
      raycaster.setFromCamera(mouse, camera);
      const hero = cardMeshes.find(c => c && c.userData.cardState === 'hero');

      if (hero) {
        const hit = raycaster.intersectObject(hero, true);
        document.body.style.cursor = hit.length > 0 ? 'pointer' : 'default';
        lidHovered = false;

      } else if (isOpen && !cardStarted) {
        const homeCards = cardMeshes.filter(c => c && c.userData.cardState === 'home');
        const hits = raycaster.intersectObjects(homeCards, true);
        if (hits.length > 0) {
          document.body.style.cursor = 'pointer';
          homeCards.forEach(c => { c.userData.hovered = false; });
          let obj = hits[0].object;
          while (obj && !homeCards.includes(obj)) obj = obj.parent;
          if (obj) obj.userData.hovered = true;
        } else {
          document.body.style.cursor = 'default';
          homeCards.forEach(c => { c.userData.hovered = false; });
        }
        lidHovered = false;

      } else {
        const hover = raycaster.intersectObject(boxLid, true);
        lidHovered  = hover.length > 0;
        document.body.style.cursor = lidHovered ? 'pointer' : 'default';
        cardMeshes.forEach(c => { if (c) c.userData.hovered = false; });
      }
    }
  }

  // ── Hover lift cartas en home — todas juntas ──────────────
  if (isOpen && !cardStarted && !cardBusy) {
    const anyHovered = cardMeshes.some(c => c && c.userData.cardState === 'home' && c.userData.hovered);
    cardMeshes.forEach(card => {
      if (!card || card.userData.cardState !== 'home') return;
      const liftTarget = anyHovered ? 0.03 : 0;
      card.userData.hoverLift = (card.userData.hoverLift || 0);
      card.userData.hoverLift += (liftTarget - card.userData.hoverLift) * 0.04;
      card.position.y = card.userData.homePos.y + card.userData.hoverLift;
    });
  } else {
    // resetear lift suavemente cuando hay animación activa
    cardMeshes.forEach(card => {
      if (!card || card.userData.cardState !== 'home') return;
      card.userData.hoverLift = (card.userData.hoverLift || 0);
      card.userData.hoverLift += (0 - card.userData.hoverLift) * 0.04;
      card.position.y = card.userData.homePos.y + card.userData.hoverLift;
    });
  }

  const heroActive = cardMeshes.some(c => c && (
    c.userData.cardState === 'hero'      ||
    c.userData.cardState === 'rising'    ||
    c.userData.cardState === 'returning'
  ));
  controls.enabled = !heroActive;

  controls.update();
  renderer.render(scene, camera);
}
animate();

//////////////////////////
// RESPONSIVE
//////////////////////////

window.addEventListener('resize', function () {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});