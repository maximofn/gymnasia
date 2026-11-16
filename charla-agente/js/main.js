// Proyección: render con postprocesado, cámara, etiquetas, navegación y enlace
// con el presentador.
(function () {
  const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));

  const canvas = document.getElementById("scene");
  const layer = document.getElementById("labels");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x07090d, 1);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07090d);
  const camera = new THREE.PerspectiveCamera(35, 16 / 9, 0.1, 300);

  // ── Postprocesado ─────────────────────────────────────────────
  // Se renderiza en coma flotante para que solo lo que pasa de 1 (el lima del
  // agente, los rayos) active el bloom; las ilustraciones nunca llegan.
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new THREE.EffectComposer(renderer, target);
  composer.addPass(new THREE.RenderPass(scene, camera));
  const bloom = new THREE.UnrealBloomPass(new THREE.Vector2(1, 1), 0.85, 0.55, 0.95);
  composer.addPass(bloom);
  const finish = new THREE.ShaderPass({
    uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) } },
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `
      uniform sampler2D tDiffuse; uniform float uTime; uniform vec2 uRes; varying vec2 vUv;
      float hash(vec2 p){ p = fract(p * vec2(443.897, 441.423)); p += dot(p, p.yx + 19.19); return fract((p.x + p.y) * p.x); }
      void main(){
        vec2 d = vUv - 0.5;
        float r2 = dot(d, d);
        // Aberración cromática muy leve hacia los bordes.
        vec2 off = d * r2 * 0.012;
        vec3 c = vec3(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b);
        // Las luces muy intensas se comprimen en vez de quemarse.
        c = c / (1.0 + max(c - 1.0, 0.0) * 0.35);
        c *= mix(1.0, 0.42, smoothstep(0.18, 0.62, r2 * 1.55));
        float g = hash(vUv * uRes + fract(uTime * 7.31) * 113.0) - 0.5;
        c += g * 0.035;
        gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
      }`,
  });
  composer.addPass(finish);

  // ── Etiquetas HTML ancladas a puntos 3D ───────────────────────
  const labels = [];
  const stations = {};
  function buildStations() {
    Object.entries(STATIONS).forEach(([id, def]) => {
      const root = new THREE.Group();
      root.position.set(...def.origin);
      scene.add(root);
      const ctx = {
        root,
        // `depth`: la etiqueta crece o encoge con la distancia, como un objeto más.
        label(html, cls, at, opts = {}) {
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
          const l = { el, obj, on: false, o: 0, k: opts.k || 1, station: id, depth: !!opts.depth, fade: 1 };
          labels.push(l);
          return l;
        },
      };
      stations[id] = { id, def, root, update: WORLD[id](ctx), prev: {}, since: {} };
    });
    WORLD.ambient(scene);
  }

  // ── Navegación ────────────────────────────────────────────────
  const N = STEPS.length;
  let index = Math.min(Math.max(parseInt(location.hash.slice(1), 10) - 1 || 0, 0), N - 1);
  let presenter = null;
  let clock = 0;

  const $ = (id) => document.getElementById(id);
  const flashEl = $("flash"), chipEl = $("chip"), titleEl = $("title"), thanksEl = $("thanks");
  const brandEl = $("brand");
  const blackEl = $("black"), hintEl = $("hint"), fadeEl = $("fade"), progressEl = $("progress"), moralEl = $("moral");

  function retrigger(el) {
    el.classList.remove("on");
    void el.offsetWidth;
    el.classList.add("on");
  }
  function go(to) {
    to = Math.min(Math.max(to, 0), N - 1);
    if (to === index) return;
    if (to === index + 1 && STEPS[to].flash) retrigger(flashEl);
    index = to;
    history.replaceState(null, "", "#" + (index + 1));
    hintEl.hidden = true;
    notify();
  }
  function notify() {
    if (presenter && !presenter.closed) presenter.postMessage({ type: "state", index }, "*");
  }
  function openPresenter() {
    presenter = window.open("presenter.html" + location.search, "gymnasia-presentador", "width=1180,height=780");
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
    else if (k === "i" || k === "I") go(QA_INDEX);
  }
  window.addEventListener("keydown", onKey);
  window.addEventListener("message", (e) => {
    const m = e.data || {};
    if (m.type === "hello") { presenter = e.source; notify(); }
    else if (m.type === "go") { presenter = e.source; go(m.index); notify(); }
    else if (m.type === "key") { presenter = e.source; onKey({ key: m.key, preventDefault() {} }); }
  });
  // En el turno de preguntas un clic suelto no avanza: se navega con los enlaces.
  canvas.addEventListener("click", () => { if (STEPS[index].station !== "qa") go(index + 1); });
  brandEl.addEventListener("click", () => go(index + 1));
  // Los enlaces del índice y de «volver» cambian el hash.
  window.addEventListener("hashchange", () => {
    const n = parseInt(location.hash.slice(1), 10);
    if (n) go(n - 1);
  });
  setTimeout(() => { hintEl.hidden = true; }, 9000);

  // ── Cámara ────────────────────────────────────────────────────
  // Muelle críticamente amortiguado: arranca y frena suave, sin el tirón inicial
  // de un acercamiento exponencial.
  function spring() {
    return { x: new THREE.Vector3(), v: new THREE.Vector3() };
  }
  const acc = new THREE.Vector3();
  function stepSpring(s, goal, w, dt) {
    // En subpasos cortos: con un paso largo el muelle se pasa de largo y oscila.
    const n = Math.ceil(dt / (1 / 120));
    for (let i = 0; i < n; i++) {
      acc.subVectors(goal, s.x).multiplyScalar(w * w).addScaledVector(s.v, -2 * w);
      s.v.addScaledVector(acc, dt / n);
      s.x.addScaledVector(s.v, dt / n);
    }
  }
  const camPos = spring(), camLook = spring();
  const goalPos = new THREE.Vector3(), goalLook = new THREE.Vector3();
  const v = new THREE.Vector3();
  function cameraGoal(i) {
    const c = resolveCamera(i);
    const o = STATIONS[STEPS[i].station].origin;
    goalPos.set(o[0] + c[0], o[1] + c[1], o[2] + c[2]);
    goalLook.set(o[0] + c[3], o[1] + c[4], o[2] + c[5]);
  }

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(w, h);
    finish.uniforms.uRes.value.set(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", resize);

  // Con `?shot` el tiempo avanza aunque el render vaya lento (capturas sin GPU).
  const MAX_DT = location.search.includes("shot") ? 0.5 : 0.1;
  // ── Turno de preguntas ────────────────────────────────────────
  const qaEl = $("qa");
  const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  let qaShown;
  function renderQA(q) {
    if (q === qaShown) return;
    qaShown = q;
    qaEl.classList.toggle("on", q !== null && q !== undefined);
    if (q === null || q === undefined) return;
    if (q === 0) {
      const items = QA.map((x, i) => `<li><a href="#${QA_INDEX + 2 + i}"><span>${i + 1}</span>${esc(x.short)}</a></li>`).join("");
      qaEl.innerHTML = `<div class="qa-index"><h1>Preguntas<small>Pulsa una para ver la respuesta · <kbd>I</kbd> vuelve aquí</small></h1><ol class="qa-cols">${items}</ol></div>`;
      return;
    }
    const x = QA[q - 1];
    qaEl.innerHTML = `<div class="qa-answer"><div class="qa-meta"><span>Pregunta ${q} de ${QA.length}</span></div>` +
      `<h1>${esc(x.q)}</h1><ul>${x.a.map((t) => `<li>${esc(t)}</li>`).join("")}</ul></div>` +
      `<a class="qa-back" href="#${QA_INDEX + 1}">← Volver al índice <kbd>I</kbd></a>`;
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min((now - last) / 1000, MAX_DT);
    last = now;
    clock += dt;
    const t = clock;
    const step = STEPS[index];
    const active = step.station;
    WORLD.tick(t);

    Object.values(stations).forEach((st) => {
      const s = resolveStation(st.id, index);
      Object.keys(s).forEach((k) => {
        if (st.prev[k] !== s[k]) st.since[k] = t;
      });
      st.prev = s;
      const since = (k) => (st.since[k] === undefined ? 0 : t - st.since[k]);
      st.update(s, dt, t, since, st.id === active);
    });

    cameraGoal(index);
    // Entre paradas lejanas (del final al restaurante) se corta con un fundido.
    if (camPos.x.distanceTo(goalPos) > 100) {
      camPos.x.copy(goalPos); camPos.v.set(0, 0, 0);
      camLook.x.copy(goalLook); camLook.v.set(0, 0, 0);
      retrigger(fadeEl);
    }
    stepSpring(camPos, goalPos, 2.6, dt);
    stepSpring(camLook, goalLook, 2.6, dt);
    // Respiración de cámara: un paralaje mínimo que hace que las capas parezcan reales.
    camera.position.copy(camPos.x).add(v.set(Math.sin(t * 0.21) * 0.18, Math.sin(t * 0.17) * 0.1, 0));
    camera.lookAt(camLook.x);

    // Superposiciones
    const brand = STEPS[index].brand || "";
    if (brandEl.dataset.on !== brand) brandEl.dataset.on = brand;
    const mesa = stations.mesa.prev;
    const onMesa = active === "mesa";
    titleEl.classList.toggle("on", onMesa && !!mesa.title);
    moralEl.classList.toggle("on", onMesa && !!mesa.moral);
    canvas.classList.toggle("blurred", onMesa && (!!mesa.title || !!mesa.moral));
    thanksEl.classList.toggle("on", onMesa && !!mesa.thanks);
    const name = active === "mesa" || active === "qa" ? "" : STATIONS[active].name;
    if (chipEl.dataset.name !== name) {
      chipEl.dataset.name = name;
      const [num, text] = name.includes(" · ") ? name.split(" · ") : ["", name];
      chipEl.innerHTML = name ? (num ? `<b>${num.replace("Parada ", "")}</b>` : "") + `<span>${text}</span>` : "";
    }
    chipEl.classList.toggle("on", !!name);
    progressEl.style.width = (Math.min(index + 1, QA_INDEX) / QA_INDEX) * 100 + "%";
    progressEl.hidden = active === "qa";
    renderQA(active === "qa" ? stations.qa.prev.q : null);

    finish.uniforms.uTime.value = t;
    composer.render();

    // Etiquetas
    const w = window.innerWidth, h = window.innerHeight;
    const unit = h / 1080;
    for (const l of labels) {
      if (l.station !== active) l.on = false;
      l.o = damp(l.o, l.on ? 1 : 0, 8 * l.k, dt);
      if (l.o < 0.01) {
        if (l.el.style.visibility !== "hidden") { l.el.style.visibility = "hidden"; l.el.style.opacity = 0; }
        continue;
      }
      l.obj.getWorldPosition(v);
      const dist = v.distanceTo(camera.position);
      v.project(camera);
      if (v.z > 1) { l.el.style.visibility = "hidden"; continue; }
      const x = (v.x * 0.5 + 0.5) * w;
      const y = (-v.y * 0.5 + 0.5) * h;
      const sc = unit * (l.depth ? Math.min(Math.max(12 / dist, 0.55), 1.7) : 1) * (0.94 + 0.06 * l.o);
      l.el.style.visibility = "visible";
      l.el.style.opacity = (l.o * l.fade).toFixed(3);
      l.el.style.filter = l.o < 0.97 ? `blur(${((1 - l.o) * 8).toFixed(1)}px)` : "";
      l.el.style.transform = `translate(${x.toFixed(1)}px, ${(y + (1 - l.o) * 14).toFixed(1)}px) translate(-50%, -50%) scale(${sc.toFixed(3)})`;
    }

    requestAnimationFrame(frame);
  }

  WORLD.load().then(() => {
    buildStations();
    resize();
    cameraGoal(index);
    camPos.x.copy(goalPos);
    camLook.x.copy(goalLook);
    document.getElementById("loading").classList.add("done");
    requestAnimationFrame((now) => { last = now; frame(now); });
  });
})();
