// The HTML pages the AR viewer screen runs in its WebView (an iframe on web). Plain strings with no React Native
// imports, so they can also be generated outside the app (e.g. to test the AR page in a desktop browser).

const AR_ACCENT = '#83D5C6';
const MODEL_VIEWER_SCRIPT = 'https://ajax.googleapis.com/ajax/libs/model-viewer/4.0.0/model-viewer.min.js';
// MindAR 1.2.5 image tracking on three.js 0.160 (MindAR's three add-on isn't tested against newer three).
const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.160.1';
const MINDAR_URL = 'https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image-three.prod.js';
const clean = (name: string) => name.replace(/[<>"&\\]/g, '');

// A point of interest an admin pinned on the model (backend src/utils/arHotspots.ts), in the model's glTF coordinates.
export interface ArHotspot {
  id: string;
  position: [number, number, number];
  normal: [number, number, number];
  title: string;
  description: string;
}

// JSON that's safe inside a <script> (no "</script>" break-out).
const scriptJson = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c');

// The card that shows a tapped point's title and information (text is set with textContent, never as HTML).
const CARD_CSS = `
  #card { display: none; position: absolute; left: 12px; right: 12px; top: 12px; z-index: 5; max-height: 45%; overflow-y: auto;
    background: #fff; color: #14231C; border-radius: 14px; padding: 14px 44px 14px 16px; box-shadow: 0 6px 20px rgba(0,0,0,0.35); }
  #card .num { display: inline-flex; width: 24px; height: 24px; border-radius: 12px; background: #1F6D52; color: #fff; font-weight: 700;
    font-size: 12px; align-items: center; justify-content: center; margin-right: 8px; vertical-align: middle; }
  #card h3 { display: inline; margin: 0; font-size: 16px; vertical-align: middle; }
  #card p { margin: 8px 0 0; font-size: 14px; line-height: 1.45; white-space: pre-line; }
  #card .close { position: absolute; top: 6px; right: 8px; border: none; background: none; font-size: 22px; color: #5B6B62; padding: 6px; }`;
const CARD_HTML = `<div id="card" role="dialog" aria-live="polite"><span class="num"></span><h3></h3><p></p>
<button class="close" type="button" aria-label="Close">×</button></div>`;
const cardScript = (hotspots: ArHotspot[]) => `
  let HOTSPOTS = ${scriptJson(hotspots.map((h) => ({ title: h.title, description: h.description })))};
  const card = document.getElementById('card');
  function showPoint(i) {
    const h = HOTSPOTS[i];
    if (!h) return;
    card.querySelector('.num').textContent = String(i + 1);
    card.querySelector('h3').textContent = h.title;
    const p = card.querySelector('p');
    p.textContent = h.description;
    p.style.display = h.description ? 'block' : 'none';
    card.style.display = 'block';
  }
  card.querySelector('.close').addEventListener('click', () => { card.style.display = 'none'; });`;

// Plain 3D view: Google's <model-viewer> with touch orbit/zoom and the admin's numbered points (tap → card).
export function viewerHtml(src: string, name: string, hotspots: ArHotspot[] = []) {
  const vec = (v: number[]) => v.map((n) => `${Number(n)}m`).join(' ');
  const pins = hotspots
    .map(
      (h, i) =>
        `<button class="pin" type="button" slot="hotspot-${i}" data-i="${i}" data-position="${vec(h.position)}" data-normal="${vec(h.normal)}" data-visibility-attribute="visible" aria-label="Point ${i + 1}">${i + 1}</button>`,
    )
    .join('');
  return `<!doctype html><html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<script type="module" src="${MODEL_VIEWER_SCRIPT}"></script>
<style>
  html, body { margin: 0; height: 100%; background: #123C2C; font-family: sans-serif; }
  model-viewer { width: 100%; height: 100%; --poster-color: transparent; }
  .err { color: #EAF2ED; position: absolute; top: 45%; width: 100%; text-align: center; font-size: 14px; }
  .pin { width: 28px; height: 28px; border-radius: 14px; border: 2px solid #fff; background: #1F6D52; color: #fff; font-weight: 700;
    font-size: 12px; padding: 0; box-shadow: 0 2px 6px rgba(0,0,0,0.4); }
  .pin:not([data-visible]) { opacity: 0.35; }${CARD_CSS}
</style></head><body>
<model-viewer src="${src}" alt="${clean(name)}" camera-controls ${hotspots.length ? '' : 'auto-rotate'} shadow-intensity="1" touch-action="pan-y">${pins}</model-viewer>
${CARD_HTML}
<script>${cardScript(hotspots)}
  document.querySelectorAll('.pin').forEach((b) => b.addEventListener('click', () => showPoint(Number(b.dataset.i))));
  document.querySelector('model-viewer').addEventListener('error', function () {
    document.body.insertAdjacentHTML('beforeend', '<div class="err">Couldn\\'t load this model.</div>');
  });
</script>
</body></html>`;
}

// What the AR page needs to show one model.
export interface ArModelPayload {
  id: string;
  src: string;
  name: string;
  hotspots: ArHotspot[];
}

// Printed AR cards carry a QR code with this prefix + the model id (admin-web src/pages/ArCardPage.tsx).
export const AR_CARD_PREFIX = 'cogniview-ar:';
const JSQR_URL = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/+esm';

// Marker AR: the camera feed with the model standing on the printed CogniView AR marker (MindAR image tracking).
// The marker is target 0 of marker.mind; MindAR's anchor has the marker in its XY plane (1 unit = marker width)
// with +Z pointing out of the paper, so a Y-up model is turned to stand up on it and scaled to fit.
// Admin points appear as numbered pins that follow the model; tapping one (not dragging) shows its card.
//
// `targets` lists what each MindAR target in `targetSrc` is (GET /api/ar-targets/index): null = the shared printed
// marker, which shows whatever model is open; a model id = a trigger picture of that model — seeing it opens that
// model on the picture. `scan` also reads the QR code on printed AR cards.
// To open a model the page posts {type:'scan', id} to the app (ReactNativeWebView.postMessage, or the parent window
// on web), and the app — which has the student's session — answers by calling window.cvLoadModel(model) or
// window.cvScanError(message) (or posting {type:'load'|'scan-error'}).
export function arHtml(
  targetSrc: string,
  { model = null, scan = false, targets = [null] }: { model?: ArModelPayload | null; scan?: boolean; targets?: (string | null)[] },
) {
  return `<!doctype html><html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<script type="importmap">{"imports":{
  "three":"${THREE_URL}/build/three.module.js",
  "three/addons/":"${THREE_URL}/examples/jsm/",
  "mindar-image-three":"${MINDAR_URL}"}}</script>
<style>
  html, body { margin: 0; height: 100%; background: #000; overflow: hidden; font-family: sans-serif; touch-action: none; }
  /* Own stacking context: MindAR puts its camera <video> at z-index -2, which would otherwise sit under the body. */
  #stage { position: absolute; inset: 0; isolation: isolate; }
  #hint { position: absolute; left: 16px; right: 16px; bottom: 18px; background: rgba(18,60,44,0.88); color: #fff;
    border-radius: 12px; padding: 12px 14px; font-size: 14px; line-height: 1.4; text-align: center; }
  #hint b { color: ${AR_ACCENT}; }${CARD_CSS}
</style></head><body>
<div id="stage"></div>
<div id="hint">Starting camera…</div>
${CARD_HTML}
<script type="module">
  import * as THREE from 'three';
  import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
  import { MindARThree } from 'mindar-image-three';
${cardScript([])}
  const SCAN = ${scan ? 'true' : 'false'};
  const INITIAL = ${scriptJson(model)};
  const TARGETS = ${scriptJson(targets)};
  const HAS_PICTURES = TARGETS.some((t) => t);
  const PREFIX = ${JSON.stringify(AR_CARD_PREFIX)};
  const hint = document.getElementById('hint');
  const say = (html) => { hint.innerHTML = html; hint.style.display = html ? 'block' : 'none'; };
  const LOOK = 'Point your camera at the printed <b>CogniView AR</b> marker';
  const lower = (t) => t.charAt(0).toLowerCase() + t.slice(1);
  const send = (msg) => {
    const text = JSON.stringify(msg);
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(text);
    else window.parent.postMessage(text, '*');
  };
  let found = false, model = null, currentId = null, loadToken = 0, started = false;

  function status() {
    if (!started) return;
    if (!model) {
      if (currentId) say('Loading the model…');
      else if (SCAN) say(HAS_PICTURES ? 'Scan the QR code on a CogniView <b>AR card</b>, or point at a picture from your lesson' : 'Scan the QR code on a CogniView <b>AR card</b>');
      else say('Loading the model…');
    } else say(found ? '' : LOOK + (HAS_PICTURES ? ', or a picture from your lesson' : ''));
  }

  const mindar = new MindARThree({
    container: document.getElementById('stage'), imageTargetSrc: ${JSON.stringify(targetSrc)},
    uiScanning: 'no', uiLoading: 'no', uiError: 'no', filterMinCF: 0.0001, filterBeta: 0.001,
  });
  const { renderer, scene, camera } = mindar;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x445544, 2.4));
  const sun = new THREE.DirectionalLight(0xffffff, 2);
  sun.position.set(0.5, 1, 2);
  scene.add(sun);

  const upright = new THREE.Group();          // turns the model's +Y (up) to the target's +Z (out of the picture)
  upright.rotation.x = Math.PI / 2;
  const pivot = new THREE.Group();            // user rotation (drag) and size (pinch)
  upright.add(pivot);
  // One anchor per target. The model sits on whichever target was seen last: the marker, or a trigger picture —
  // and a picture of a different model opens that model.
  let active = -1;
  TARGETS.forEach((modelId, i) => {
    const anchor = mindar.addAnchor(i);
    anchor.onTargetFound = () => {
      active = i;
      anchor.group.add(upright);
      found = true;
      if (modelId && modelId !== currentId) { currentId = modelId; model = null; pivot.clear(); send({ type: 'scan', id: modelId }); }
      status();
    };
    anchor.onTargetLost = () => {
      if (i !== active) return;
      found = false;
      if (model) say((TARGETS[i] ? 'Picture' : 'Marker') + ' lost — ' + lower(LOOK)); else status();
    };
  });

  const pins = [];
  function loadModel(m) {
    const token = ++loadToken;
    currentId = m.id;
    pivot.clear();
    pivot.rotation.set(0, 0, 0);
    pins.length = 0;
    model = null;
    card.style.display = 'none';
    HOTSPOTS = m.hotspots.map((h) => ({ title: h.title, description: h.description }));
    status();
    new GLTFLoader().loadAsync(m.src).then((gltf) => {
      if (token !== loadToken) return; // another card was scanned meanwhile
      const obj = gltf.scene;
      const box = new THREE.Box3().setFromObject(obj);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      obj.position.set(-center.x, -box.min.y, -center.z); // centred, base on the paper
      const maxDim = Math.max(size.x, size.y, size.z, 1e-6);
      pivot.scale.setScalar(0.7 / maxDim); // 70% of the marker's width
      pivot.add(obj);
      // Pins live in the model's own coordinates (children of gltf.scene), nudged off the surface along its normal.
      m.hotspots.forEach((h, i) => {
        const pin = new THREE.Sprite(new THREE.SpriteMaterial({ map: pinTexture(i + 1) }));
        const off = maxDim * 0.02;
        pin.position.set(h.position[0] + h.normal[0] * off, h.position[1] + h.normal[1] * off, h.position[2] + h.normal[2] * off);
        pin.scale.setScalar(maxDim * 0.1);
        pin.userData.index = i;
        obj.add(pin);
        pins.push(pin);
      });
      model = obj;
      status();
    }).catch(() => { if (token === loadToken) say("Couldn't load this model."); });
  }
  window.cvLoadModel = loadModel;
  window.cvScanError = (message) => { currentId = null; say(message + ' Scan another card.'); };
  addEventListener('message', (e) => {
    let d = e.data;
    if (typeof d === 'string') { try { d = JSON.parse(d); } catch { return; } }
    if (d && d.type === 'load' && d.model) loadModel(d.model);
    else if (d && d.type === 'scan-error') window.cvScanError(String(d.message || "That card couldn't be opened."));
  });

  // The AR card scanner: read the card's QR code from the camera feed a few times a second.
  let jsQR = null;
  const qrCanvas = document.createElement('canvas');
  const qrCtx = qrCanvas.getContext('2d', { willReadFrequently: true });
  function scanQr() {
    const video = mindar.video || document.querySelector('#stage video');
    if (!jsQR || !video || !video.videoWidth) return;
    const w = 640, h = Math.round((640 * video.videoHeight) / video.videoWidth);
    qrCanvas.width = w;
    qrCanvas.height = h;
    qrCtx.drawImage(video, 0, 0, w, h);
    const code = jsQR(qrCtx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' });
    const text = code && code.data.trim();
    if (!text || !text.startsWith(PREFIX)) return;
    const id = text.slice(PREFIX.length);
    if (!/^[0-9a-fA-F-]{36}$/.test(id) || id === currentId) return;
    currentId = id;
    status();
    send({ type: 'scan', id });
  }

  function pinTexture(n) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    g.beginPath(); g.arc(64, 64, 56, 0, Math.PI * 2);
    g.fillStyle = '#1F6D52'; g.fill();
    g.lineWidth = 10; g.strokeStyle = '#FFFFFF'; g.stroke();
    g.fillStyle = '#FFFFFF'; g.font = 'bold 60px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(String(n), 64, 68);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  // A tap (little movement, quick) on a pin opens its card.
  const raycaster = new THREE.Raycaster();
  let down = null;
  addEventListener('pointerdown', (e) => { down = e.target.closest('#card') ? null : { x: e.clientX, y: e.clientY, t: Date.now() }; });
  addEventListener('pointerup', (e) => {
    if (!down || !pins.length || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 10 || Date.now() - down.t > 400) return;
    const r = renderer.domElement.getBoundingClientRect();
    raycaster.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
    const hit = raycaster.intersectObjects(pins, false)[0];
    if (hit) showPoint(hit.object.userData.index);
  });

  // One finger turns the model; two fingers resize it.
  let lastX = null, pinch = null;
  addEventListener('touchstart', (e) => {
    if (e.target.closest('#card')) return;
    lastX = e.touches.length === 1 ? e.touches[0].clientX : null;
    pinch = e.touches.length === 2 ? { d: dist(e.touches), s: pivot.scale.x } : null;
  });
  addEventListener('touchmove', (e) => {
    if (pinch && e.touches.length === 2) pivot.scale.setScalar(Math.min(pinch.s * 6, Math.max(pinch.s / 6, pinch.s * dist(e.touches) / pinch.d)));
    else if (lastX !== null && e.touches.length === 1) { pivot.rotation.y += (e.touches[0].clientX - lastX) * 0.01; lastX = e.touches[0].clientX; }
  });
  addEventListener('touchend', () => { lastX = null; pinch = null; });
  function dist(t) { return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY); }

  if (INITIAL) loadModel(INITIAL);
  mindar.start().then(() => {
    started = true;
    status();
    renderer.setAnimationLoop(() => renderer.render(scene, camera));
    if (SCAN) {
      import(${JSON.stringify(JSQR_URL)}).then((m) => { jsQR = m.default; }).catch(() => say("Couldn't load the card scanner. Check your connection."));
      setInterval(scanQr, 350);
    }
  }).catch((err) => {
    const denied = err && (err.name === 'NotAllowedError' || err.name === 'SecurityError');
    say(denied ? 'Camera access was blocked. Allow the camera for CogniView AR, then reopen this screen.' : "Couldn't start the camera or the AR tracker. Check your connection and try again.");
  });
</script>
</body></html>`;
}
