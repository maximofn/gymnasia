// Proyección: escena, cámara, etiquetas, navegación y enlace con el presentador.
(function () {
  const C = WORLD_COLORS;
  const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));

  const canvas = document.getElementById("scene");
  const layer = document.getElementById("labels");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(C.bg);
  scene.fog = new THREE.Fog(C.bg, 26, 58);
  scene.add(new THREE.AmbientLight(0x9aa6b8, 0.42));
  scene.add(new THREE.HemisphereLight(0xdfe7f5, 0x07090d, 0.25));
  const key = new THREE.DirectionalLight(0xffffff, 0.8);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -11, right: 11, top: 11, bottom: -11, near: 1, far: 40 });
  scene.add(key, key.target);
  const rim = new THREE.PointLight(0x8fa3c7, 0.6, 16);
  scene.add(rim);

  const camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 200);

  // ── Etiquetas HTML ancladas a puntos 3D ───────────────────────
  const labels = [];
  const stations = {};
  Object.entries(STATIONS).forEach(([id, def]) => {
    const root = new THREE.Group();
    root.position.set(...def.origin);
    scene.add(root);
    const own = [];
    let mark = 0;
    const ctx = {
      root,
      label(html, cls, at) {
        const el = document.createElement("div");
        el.className = "lbl " + cls;
        el.innerHTML = html;
        layer.appendChild(el);
        let obj = at;
        if (Array.isArray(at)) {
          obj = new THREE.Object3D();
          obj.position.set(...at);
          root.add(obj);
        }
        const l = { el, obj, on: false, o: 0, station: id };
        labels.push(l);
        own.push(l);
        return l;
      },
      labelsSince() {
        const out = own.slice(mark);
        mark = own.length;
        return out;
      },
    };
    stations[id] = { id, def, root, update: WORLD[id](ctx), prev: {}, since: {} };
  });

  // ── Navegación ────────────────────────────────────────────────
  const N = STEPS.length;
  let index = Math.min(Math.max(parseInt(location.hash.slice(1), 10) - 1 || 0, 0), N - 1);
  let presenter = null;
  let clock = 0;

  const flashEl = document.getElementById("flash");
  const chipEl = document.getElementById("chip");
  const titleEl = document.getElementById("title");
  const thanksEl = document.getElementById("thanks");
  const blackEl = document.getElementById("black");
  const hintEl = document.getElementById("hint");
  const fadeEl = document.getElementById("fade");

  function go(to) {
    to = Math.min(Math.max(to, 0), N - 1);
    if (to === index) return;
    if (to === index + 1 && STEPS[to].flash) {
      flashEl.classList.remove("on");
      void flashEl.offsetWidth;
      flashEl.classList.add("on");
    }
    index = to;
    history.replaceState(null, "", "#" + (index + 1));
    hintEl.hidden = true;
    notify();
  }
  function notify() {
    if (presenter && !presenter.closed) presenter.postMessage({ type: "state", index }, "*");
  }
  function openPresenter() {
    presenter = window.open("presenter.html", "gymnasia-presentador", "width=1180,height=780");
    setTimeout(notify, 600);
  }
  function fullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  }
  function onKey(e) {
    const k = e.key;
    if (["ArrowRight", "PageDown", " ", "Enter", "ArrowDown"].includes(k)) { e.preventDefault(); go(index + 1); }
    else if (["ArrowLeft", "PageUp", "Backspace", "ArrowUp"].includes(k)) { e.preventDefault(); go(index - 1); }
    else if (k === "Home") go(0);
    else if (k === "End") go(N - 1);
    else if (k === "f" || k === "F") fullscreen();
    else if (k === "p" || k === "P") openPresenter();
    else if (k === "b" || k === "B" || k === ".") blackEl.classList.toggle("on");
  }
  window.addEventListener("keydown", onKey);
  window.addEventListener("message", (e) => {
    const m = e.data || {};
    if (m.type === "hello") { presenter = e.source; notify(); }
    else if (m.type === "go") { presenter = e.source; go(m.index); notify(); }
    else if (m.type === "key") { presenter = e.source; onKey({ key: m.key, preventDefault() {} }); }
  });
  canvas.addEventListener("click", () => go(index + 1));
  setTimeout(() => { hintEl.hidden = true; }, 9000);

  // ── Bucle ─────────────────────────────────────────────────────
  const camPos = new THREE.Vector3();
  const camLook = new THREE.Vector3();
  const goalPos = new THREE.Vector3();
  const goalLook = new THREE.Vector3();
  const v = new THREE.Vector3();
  (function initCamera() {
    const c = resolveCamera(index);
    const o = STATIONS[STEPS[index].station].origin;
    camPos.set(o[0] + c[0], o[1] + c[1], o[2] + c[2]);
    camLook.set(o[0] + c[3], o[1] + c[4], o[2] + c[5]);
  })();

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", resize);
  resize();

  let last = performance.now();
  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    clock += dt;
    const t = clock;
    const step = STEPS[index];
    const active = step.station;

    // Estado de cada parada y tiempo desde el último cambio de cada clave
    Object.values(stations).forEach((st) => {
      const s = resolveStation(st.id, index);
      Object.keys(s).forEach((k) => {
        if (st.prev[k] !== s[k]) st.since[k] = t;
      });
      st.prev = s;
      const since = (k) => (st.since[k] === undefined ? 0 : t - st.since[k]);
      st.update(s, dt, t, since);
    });

    // Cámara
    const c = resolveCamera(index);
    const o = STATIONS[active].origin;
    goalPos.set(o[0] + c[0], o[1] + c[1], o[2] + c[2]);
    goalLook.set(o[0] + c[3], o[1] + c[4], o[2] + c[5]);
    // Entre paradas lejanas (por ejemplo, del final al restaurante) se corta con
    // un fundido en vez de cruzar volando todo el mundo.
    if (camPos.distanceTo(goalPos) > 90) {
      camPos.copy(goalPos);
      camLook.copy(goalLook);
      fadeEl.classList.remove("on");
      void fadeEl.offsetWidth;
      fadeEl.classList.add("on");
    }
    const far = camPos.distanceTo(goalPos) > 25;
    const k = far ? 1.5 : 2.2;
    camPos.set(damp(camPos.x, goalPos.x, k, dt), damp(camPos.y, goalPos.y, k, dt), damp(camPos.z, goalPos.z, k, dt));
    camLook.set(damp(camLook.x, goalLook.x, k, dt), damp(camLook.y, goalLook.y, k, dt), damp(camLook.z, goalLook.z, k, dt));
    camera.position.copy(camPos).add(v.set(Math.sin(t * 0.31) * 0.12, Math.sin(t * 0.23) * 0.07, 0));
    camera.lookAt(camLook);

    key.position.set(camLook.x + 4, camLook.y + 10, camLook.z + 6);
    key.target.position.copy(camLook);
    rim.position.set(camLook.x - 3.5, camLook.y + 3, camLook.z - 3);

    // Superposiciones
    const mesa = stations.mesa.prev;
    const onMesa = active === "mesa";
    titleEl.classList.toggle("on", onMesa && !!mesa.title);
    thanksEl.classList.toggle("on", onMesa && !!mesa.thanks);
    const chip = active === "mesa" ? "" : STATIONS[active].name;
    if (chipEl.textContent !== chip) chipEl.textContent = chip;
    chipEl.classList.toggle("on", !!chip);

    renderer.render(scene, camera);

    // Etiquetas
    const w = window.innerWidth, h = window.innerHeight;
    for (const l of labels) {
      if (l.station !== active) l.on = false;
      l.o = damp(l.o, l.on ? 1 : 0, 9, dt);
      if (l.o < 0.01) {
        if (l.el.style.visibility !== "hidden") { l.el.style.visibility = "hidden"; l.el.style.opacity = 0; }
        continue;
      }
      l.obj.getWorldPosition(v);
      v.project(camera);
      if (v.z > 1) { l.el.style.visibility = "hidden"; continue; }
      const x = (v.x * 0.5 + 0.5) * w;
      const y = (-v.y * 0.5 + 0.5) * h;
      l.el.style.visibility = "visible";
      l.el.style.opacity = l.o.toFixed(3);
      l.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%) scale(${(0.94 + 0.06 * l.o).toFixed(3)})`;
    }

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
