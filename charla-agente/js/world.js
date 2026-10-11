// Mundo de la charla. Las ilustraciones son planos en capas (2.5D) que la cámara
// ve de frente; lo que brilla o se anima (el agente, los rayos, las columnas) es
// geometría. Cada parada construye sus objetos dentro de `ctx.root` y devuelve
// `update(state, dt, t, since)`, que se llama en cada fotograma; `since(clave)`
// son los segundos desde que esa clave del estado cambió.
(function () {
  const C = {
    bg: 0x07090d, text: 0xf4f7fb, muted: 0xa6afbc, dim: 0x4a5361, lime: 0xcbff1a,
    red: 0xff5a5f, amber: 0xffb020, rice: 0xf0c45a,
  };
  const UP = new THREE.Vector3(0, 1, 0);
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const hdr = (hex, k) => new THREE.Color(hex).multiplyScalar(k);
  const tmpC = new THREE.Color();
  const tmpV = new THREE.Vector3();

  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  const smooth = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
  const lerp = (a, b, t) => a + (b - a) * t;
  const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
  const fmt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  const WORLD = { time: 0 };
  const TEX = {};

  // ── Texturas ──────────────────────────────────────────────────
  // Cada ilustración tiene una versión desenfocada para la profundidad de campo:
  // el shader mezcla una y otra según lo lejos que esté del foco.
  WORLD.load = function () {
    return Promise.all(Object.keys(ASSETS).map((key) => new Promise((resolve) => {
      const im = new Image();
      im.onload = () => {
        const map = new THREE.Texture(im);
        map.premultiplyAlpha = true;
        map.anisotropy = 8;
        map.needsUpdate = true;
        const c = document.createElement("canvas");
        c.width = Math.round(im.width / 2);
        c.height = Math.round(im.height / 2);
        const g = c.getContext("2d");
        g.filter = `blur(${Math.max(5, Math.round(c.width / 42))}px)`;
        g.drawImage(im, 0, 0, c.width, c.height);
        const blur = new THREE.CanvasTexture(c);
        blur.premultiplyAlpha = true;
        TEX[key] = { map, blur, aspect: im.width / im.height };
        resolve();
      };
      im.onerror = () => resolve();
      im.src = ASSETS[key];
    })));
  };

  function canvasTex(size, paint) {
    const c = document.createElement("canvas");
    c.width = c.height = size;
    paint(c.getContext("2d"), size);
    return new THREE.CanvasTexture(c);
  }
  const RADIAL = canvasTex(128, (g, s) => {
    const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grd.addColorStop(0, "rgba(255,255,255,1)");
    grd.addColorStop(0.25, "rgba(255,255,255,0.45)");
    grd.addColorStop(0.6, "rgba(255,255,255,0.1)");
    grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, s, s);
  });
  const SOFT = canvasTex(128, (g, s) => {
    const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grd.addColorStop(0, "rgba(255,255,255,1)");
    grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, s, s);
  });
  const VGRAD = canvasTex(64, (g, s) => {
    const grd = g.createLinearGradient(0, 0, 0, s);
    grd.addColorStop(0, "rgba(255,255,255,1)");
    grd.addColorStop(1, "rgba(255,255,255,0.25)");
    g.fillStyle = grd;
    g.fillRect(0, 0, s, s);
  });

  // ── Ilustraciones ─────────────────────────────────────────────
  const PLANE = new THREE.PlaneGeometry(1, 1);
  const PLANE_B = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
  const VS = "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }";
  const FS = `
    uniform sampler2D map, mapBlur, map2, mapBlur2;
    uniform float uBlur, uOpacity, uSat, uBright, uMix, uEdge;
    uniform vec3 uTint;
    varying vec2 vUv;
    void main(){
      vec4 a = mix(texture2D(map, vUv), texture2D(mapBlur, vUv), uBlur);
      vec4 b = mix(texture2D(map2, vUv), texture2D(mapBlur2, vUv), uBlur);
      vec4 c = mix(a, b, uMix);
      float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
      c.rgb = mix(vec3(l), c.rgb, uSat) * uTint * uBright;
      // Fondos con bordes rectos (el metro): se funden con la escena.
      vec2 e = smoothstep(vec2(0.0), vec2(uEdge), vUv) * smoothstep(vec2(0.0), vec2(uEdge), 1.0 - vUv);
      gl_FragColor = c * uOpacity * (uEdge > 0.0 ? e.x * e.y : 1.0);
    }`;
  const SHADOW_MAT = new THREE.MeshBasicMaterial({ map: SOFT, color: 0x000000, transparent: true, depthWrite: false });

  // Una ilustración con estado amortiguado: posición (x, y, z), altura h,
  // opacidad o, desenfoque b, saturación sat, brillo br, giro r y mezcla mix
  // con su imagen alternativa (`alt`). `to(objetivo, dt, k)` la acerca al
  // objetivo; hay que llamarlo en cada fotograma.
  function img(parent, key, init = {}) {
    const T = TEX[key];
    const A = (init.alt && TEX[init.alt]) || T;
    const u = {
      map: { value: T.map }, mapBlur: { value: T.blur }, map2: { value: A.map }, mapBlur2: { value: A.blur },
      uBlur: { value: 0 }, uOpacity: { value: 0 }, uSat: { value: 1 }, uBright: { value: 1 }, uMix: { value: 0 },
      uTint: { value: new THREE.Color(1, 1, 1) }, uEdge: { value: init.edge || 0 },
    };
    const mat = new THREE.ShaderMaterial({ uniforms: u, vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, premultipliedAlpha: true });
    const mesh = new THREE.Mesh(PLANE, mat);
    parent.add(mesh);
    let shadow = null;
    if (init.shadow) {
      shadow = new THREE.Mesh(PLANE, SHADOW_MAT.clone());
      parent.add(shadow);
    }
    const s = { x: 0, y: 0, z: 0, h: 1, o: 0, b: 0, sat: 1, br: 1, r: 0, mix: 0 };
    Object.keys(s).forEach((k) => { if (init[k] !== undefined) s[k] = init[k]; });
    const phase = Math.random() * 10;
    const me = {
      s, mesh, aspect: T.aspect, hasAlt: A !== T, float: init.float ?? 0.05, shake: 0,
      home: { x: s.x, y: s.y, z: s.z, h: s.h, r: s.r },
      to(g, dt, k = 4) {
        for (const key in g) {
          if (key === "tint") u.uTint.value.lerp(tmpC.setHex(g.tint), 1 - Math.exp(-k * dt));
          else if (g[key] !== undefined) s[key] = damp(s[key], g[key], key === "o" ? k * 1.4 : k, dt);
        }
        const t = WORLD.time;
        const bob = Math.sin(t * 0.9 + phase) * me.float;
        const w = s.h * T.aspect;
        mesh.position.set(s.x + me.shake, s.y + bob, s.z);
        mesh.rotation.z = s.r + Math.sin(t * 0.6 + phase) * me.float * 0.25;
        mesh.scale.set(w, s.h, 1);
        u.uOpacity.value = s.o;
        u.uBlur.value = s.b;
        u.uSat.value = s.sat;
        u.uBright.value = s.br;
        u.uMix.value = s.mix;
        mesh.visible = s.o > 0.004;
        if (shadow) {
          shadow.position.set(s.x, s.y - s.h * 0.43 - me.float, s.z - 0.05);
          shadow.scale.set(w * 0.62, w * 0.09, 1);
          shadow.material.opacity = 0.75 * s.o * (1 - s.b * 0.6);
          shadow.visible = mesh.visible;
        }
        return me;
      },
      // Objetivo de casa, con cambios opcionales.
      at(extra) { return Object.assign({}, me.home, extra); },
    };
    return me.to({}, 0);
  }

  function glow(parent, size, color = C.lime, opacity = 0.7, additive = true) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: RADIAL, color: color instanceof THREE.Color ? color : new THREE.Color(color), transparent: true, opacity,
      depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    }));
    s.scale.set(size, size, 1);
    parent.add(s);
    return s;
  }
  function basic(color, opacity = 1, additive = false) {
    return new THREE.MeshBasicMaterial({
      color: color instanceof THREE.Color ? color : new THREE.Color(color), transparent: true, opacity, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, side: THREE.DoubleSide,
    });
  }
  function group(parent, x = 0, y = 0, z = 0) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    parent.add(g);
    return g;
  }
  function fadeGroup(g, o) {
    g.traverse((m) => {
      if (!m.material) return;
      if (m.material.userData.base === undefined) m.material.userData.base = m.material.opacity;
      m.material.opacity = m.material.userData.base * o;
    });
    g.visible = o > 0.004;
  }
  function fadeTo(g, target, dt, k = 4) {
    g.userData.o = damp(g.userData.o ?? 0, target, k, dt);
    fadeGroup(g, g.userData.o);
  }
  // Rectángulo hueco hecho de cuatro tiras.
  function outline(parent, w, h, t, mat) {
    const g = new THREE.Group();
    [[0, h / 2, w + t, t], [0, -h / 2, w + t, t], [-w / 2, 0, t, h], [w / 2, 0, t, h]].forEach(([x, y, sw, sh]) => {
      const m = new THREE.Mesh(PLANE, mat);
      m.position.set(x, y, 0);
      m.scale.set(sw, sh, 1);
      g.add(m);
    });
    parent.add(g);
    return g;
  }
  // Esquinas de visor de cámara.
  function corners(parent, w, h, len, t, mat) {
    const g = new THREE.Group();
    [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(([sx, sy]) => {
      const a = new THREE.Mesh(PLANE, mat);
      a.position.set(sx * (w / 2 - len / 2), sy * h / 2, 0);
      a.scale.set(len, t, 1);
      const b = new THREE.Mesh(PLANE, mat);
      b.position.set(sx * w / 2, sy * (h / 2 - len / 2), 0);
      b.scale.set(t, len, 1);
      g.add(a, b);
    });
    parent.add(g);
    return g;
  }
  function backdrop(parent, color, y = 0) {
    const m = new THREE.Mesh(PLANE, new THREE.MeshBasicMaterial({ map: RADIAL, color, transparent: true, opacity: 1, depthWrite: false }));
    m.position.set(0, y, -18);
    m.scale.set(80, 52, 1);
    parent.add(m);
    return {
      to(hex, dt, k = 1.5) { m.material.color.lerp(tmpC.setHex(hex), 1 - Math.exp(-k * dt)); },
    };
  }
  // Luces desenfocadas al fondo: dan profundidad sin distraer.
  function bokeh(parent, colors, n = 8, spread = 11) {
    const list = [];
    for (let i = 0; i < n; i++) {
      const s = glow(parent, 1.5 + Math.random() * 3.5, colors[i % colors.length], 0.05 + Math.random() * 0.08);
      s.userData = { x: (Math.random() - 0.5) * spread * 2, y: (Math.random() - 0.5) * 8, z: -7 - Math.random() * 6, p: Math.random() * 10 };
      list.push(s);
    }
    return function update(t) {
      list.forEach((s) => {
        const u = s.userData;
        s.position.set(u.x + Math.sin(t * 0.05 + u.p) * 1.2, u.y + Math.sin(t * 0.07 + u.p * 2) * 0.6, u.z);
      });
    };
  }

  // ── Piezas brillantes ─────────────────────────────────────────
  // El agente: un núcleo de luz con anillos que giran. Lo único que pasa de 1
  // en la escena, y por eso lo único que florece con el bloom.
  function makeCore(parent, r = 1, rings = 3) {
    const g = group(parent);
    const LIME = new THREE.Color(C.lime), GREY = new THREE.Color(C.dim);
    const halo = glow(g, r * 7, C.lime, 0.28);
    const mid = glow(g, r * 2.4, hdr(C.lime, 1.4), 0.85);
    const hot = glow(g, r * 0.95, hdr(0xf2ffc8, 2.6), 1);
    const ringMats = [];
    const ringMeshes = [];
    for (let i = 0; i < rings; i++) {
      const mat = basic(hdr(C.lime, 2.2), 0.85);
      ringMats.push(mat);
      const m = new THREE.Mesh(new THREE.TorusGeometry(r * (1.0 + i * 0.24), r * 0.014, 6, 160), mat);
      m.rotation.set(1.15 + i * 0.55, i * 1.1, i * 0.4);
      g.add(m);
      ringMeshes.push(m);
    }
    let p = 1;
    return {
      g,
      update(power, dt, t) {
        p = damp(p, power, 3, dt);
        const pulse = 0.92 + 0.08 * Math.sin(t * 2.2);
        halo.material.opacity = 0.28 * p * pulse;
        halo.material.color.copy(GREY).lerp(LIME, p);
        mid.material.color.copy(GREY).lerp(LIME, p).multiplyScalar(0.6 + 0.8 * p);
        hot.material.color.set(0x8a93a0).lerp(tmpC.setHex(0xf2ffc8), p).multiplyScalar(1 + 1.6 * p * pulse);
        ringMats.forEach((m) => m.color.copy(GREY).lerp(LIME, p).multiplyScalar(0.8 + 1.4 * p));
        ringMeshes.forEach((m, i) => {
          m.rotation.x += dt * (0.25 + i * 0.12) * (0.3 + p);
          m.rotation.y += dt * (0.4 - i * 0.1) * (0.3 + p);
        });
      },
    };
  }
  // Rayo entre dos puntos (coordenadas de `parent`) que crece de 0 a 1.
  function makeBeam(parent, color = hdr(C.lime, 2.2), r = 0.018) {
    const geo = new THREE.CylinderGeometry(r, r, 1, 6, 1, true).translate(0, 0.5, 0);
    const mat = basic(color, 0.9);
    const m = new THREE.Mesh(geo, mat);
    m.visible = false;
    parent.add(m);
    return {
      mesh: m, mat,
      set(a, b, p) {
        const d = tmpV.subVectors(b, a);
        const len = d.length();
        m.position.copy(a);
        if (len > 1e-6) m.quaternion.setFromUnitVectors(UP, d.normalize());
        m.scale.set(1, Math.max(len * p, 1e-4), 1);
        m.visible = p > 0.002;
      },
    };
  }
  function makePacket(parent, color = hdr(0xeaffb0, 3), size = 0.45) {
    const s = glow(parent, size, color, 1);
    s.visible = false;
    return s;
  }
  // Vapor que sube de un plato.
  function makeSteam(parent, n = 16) {
    const list = [];
    for (let i = 0; i < n; i++) {
      const s = glow(parent, 1, 0xffffff, 0, false);
      s.userData = { phase: i / n, x: Math.random() - 0.5, drift: Math.random() * 6 };
      list.push(s);
    }
    return function update(x, y, z, w, amount, t) {
      list.forEach((s) => {
        const u = s.userData;
        const k = (t * 0.22 + u.phase) % 1;
        s.position.set(x + u.x * w * 0.4 + Math.sin(k * 5 + u.drift) * w * 0.05, y + k * w * 0.55, z + 0.2);
        s.scale.setScalar(w * (0.18 + k * 0.32));
        s.material.opacity = Math.sin(k * Math.PI) * 0.16 * amount;
        s.visible = amount > 0.01;
      });
    };
  }
  // Barra o columna de cristal que se llena desde abajo.
  function makeBar(parent, x, y0, w, hMax, opts = {}) {
    const g = group(parent, x, y0, opts.z || 0);
    const glass = new THREE.Mesh(PLANE_B, basic(0xffffff, 0.035));
    glass.scale.set(w, hMax, 1);
    g.add(glass);
    const edge = outline(g, w, hMax, 0.022, basic(0xffffff, 0.16));
    edge.position.y = hMax / 2;
    const fillMat = new THREE.MeshBasicMaterial({ map: VGRAD, color: new THREE.Color(C.lime).multiplyScalar(0.85), transparent: true, opacity: 0.9, depthWrite: false });
    const fill = new THREE.Mesh(PLANE_B, fillMat);
    fill.position.z = 0.01;
    g.add(fill);
    const topMat = basic(hdr(C.lime, 2.4), 1);
    const top = new THREE.Mesh(PLANE, topMat);
    top.position.z = 0.02;
    g.add(top);
    let cur = 0;
    const tint = new THREE.Color(C.lime);
    return {
      g, fillMat, topMat,
      set(h, dt, k = 3, color = C.lime) {
        cur = dt === null ? h : damp(cur, h, k, dt);
        const hh = Math.max(cur, 0.0001);
        fill.scale.set(w - 0.06, hh, 1);
        fill.visible = cur > 0.002;
        top.position.y = hh;
        top.scale.set(w - 0.06, 0.035, 1);
        top.visible = cur > 0.002;
        if (dt !== null) tint.lerp(tmpC.setHex(color), 1 - Math.exp(-5 * dt));
        fillMat.color.copy(tint).multiplyScalar(0.85);
        topMat.color.copy(tint).multiplyScalar(2.4);
        return cur;
      },
      get h() { return cur; },
    };
  }

  // Polvo en suspensión por todo el mundo. Lo cercano se ve grande y
  // desenfocado, como en una toma con poca profundidad de campo.
  WORLD.ambient = function (scene) {
    const N = 2600;
    const pos = new Float32Array(N * 3);
    const size = new Float32Array(N);
    const seed = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      pos.set([-30 + Math.random() * 500, (Math.random() - 0.5) * 14, -14 + Math.random() * 21], i * 3);
      size[i] = 2 + Math.random() * Math.random() * 10;
      seed[i] = Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
    geo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    const uniforms = { uTime: { value: 0 }, uScale: { value: 1 } };
    const mat = new THREE.ShaderMaterial({
      uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `
        attribute float aSize; attribute float aSeed; uniform float uTime, uScale; varying float vA;
        void main(){
          vec3 p = position;
          p.x += sin(uTime * 0.05 + aSeed * 40.0) * 0.8;
          p.y += sin(uTime * 0.07 * (0.5 + aSeed) + aSeed * 30.0) * 0.6;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          float d = -mv.z;
          gl_PointSize = min(aSize * uScale / d, 70.0);
          vA = (0.2 + 0.6 * fract(aSeed * 7.13)) * smoothstep(0.6, 3.0, d) * (1.0 - smoothstep(22.0, 34.0, d));
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        varying float vA;
        void main(){
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.0, d) * vA * 0.42;
          gl_FragColor = vec4(vec3(0.86, 0.9, 1.0) * a, a);
        }`,
    });
    scene.add(new THREE.Points(geo, mat));
    WORLD.tick = function (t) {
      WORLD.time = t;
      uniforms.uTime.value = t;
      uniforms.uScale.value = (window.innerHeight * Math.min(window.devicePixelRatio, 2) / 1080) * 12;
    };
  };
  WORLD.tick = function (t) { WORLD.time = t; };

  // ── El restaurante: antes, después, presentación y cierre ─────
  WORLD.mesa = function (ctx) {
    const R = ctx.root;
    const bd = backdrop(R, 0x2e2210);
    const bk = bokeh(R, [0xffb020, 0xffd59a, 0x8fa3c7], 9);

    const plate = img(R, "arroz-caliente", { alt: "arroz-frio", shadow: true, float: 0.035, x: 0, y: -0.5, z: 1, h: 4, o: 1 });
    const steam = makeSteam(R);
    const qs = [["¿esto cuánto es?", 0, 2.55, 1.5], ["¿600 kcal?", -4.3, 0.9, 1.5], ["¿900?", 4.4, 0.2, 1.5]]
      .map(([text, x, y, z]) => ctx.label(text, "q", [x, y, z]));

    // Las tres apps que no se hablan
    const PH = [["movil-pesas", -5.2, 0.5, -1, 0.05, "App de pesos"], ["movil-chat", -2.3, 0.9, -1.6, 0, "ChatGPT"], ["movil-medidas", 0.6, 0.5, -1, -0.05, "App de medidas"]];
    const phones = PH.map(([key, x, y, z, r, name]) => ({
      im: img(R, key, { shadow: true, float: 0.06, x, y, z, h: 3.2, r }),
      label: ctx.label(name, "tag mini", [x, y + 1.95, z]),
    }));
    const noLink = [ctx.label("✕", "tag bad mini", [-3.75, 0.6, -1.2]), ctx.label("✕", "tag bad mini", [-0.85, 0.6, -1.2])];

    // Tú, haciendo de pegamento
    const agob = img(R, "persona-agobiada", { shadow: true, float: 0.03, x: 4.3, y: -0.6, z: 0.5, h: 5.2 });
    const agot = img(R, "persona-agotada", { shadow: true, float: 0, x: 4.0, y: -1.2, z: 0.5, h: 4.2 });
    const cont = img(R, "persona-contenta", { shadow: true, float: 0, x: 4.8, y: -0.95, z: 1, h: 4.5 });
    const CARDS = ["82 kg", "quiero bajar grasa", "no me gusta el brócoli", "ayer hice pierna"];
    const cards = CARDS.map((text) => ctx.label(text, "tag", [0, 0, 0]));
    const HAND = V(3.9, 1.6, 1.2);
    const glue = ctx.label("El pegamento eras tú.", "big", [1.0, 0.6, 1.8]);

    // El después: una sola app con el agente dentro
    const gym = img(R, "movil-gymnasia", { shadow: true, float: 0.05, x: 0, y: 0.2, z: 0, h: 5 });
    const burst = glow(R, 1, hdr(C.lime, 1.6), 0);
    const ICONS = [["icono-entrenos", "Entrenos y marcas"], ["icono-comidas", "Comidas, también fuera"], ["icono-medidas", "Peso y medidas"], ["icono-gustos", "Gustos y objetivos"]];
    const icons = ICONS.map(([key, name], i) => {
      const anchor = new THREE.Object3D();
      R.add(anchor);
      return { im: img(R, key, { float: 0.04, h: 1.05 }), off: (i / 4) * Math.PI * 2, anchor, label: ctx.label(name, "tag mini", anchor, { depth: true }) };
    });
    const linkPos = new Float32Array(icons.length * 6);
    const linkGeo = new THREE.BufferGeometry();
    linkGeo.setAttribute("position", new THREE.BufferAttribute(linkPos, 3));
    const linkMat = new THREE.LineBasicMaterial({ color: hdr(C.lime, 1.6), transparent: true, opacity: 0, depthWrite: false });
    R.add(new THREE.LineSegments(linkGeo, linkMat));
    const ask = ctx.label("¿Me he pasado esta semana?", "bubble", [3.2, 2.85, 1.5]);
    const answer = ctx.label("Vas bien. Ayer hiciste pierna y el lunes pesabas 82 kg. Para cenar, salmón con patata. Sin brócoli.", "bubble ok-b", [-3.7, 2.3, 1.5]);
    const nothing = ctx.label("Y no le he contado nada.", "big", [0, 0.1, 3]);
    // Huecos alrededor del móvil, para que los iconos nunca lo tapen.
    const SLOTS = [[-3.2, 0.9], [3.0, 1.4], [-2.7, -1.3], [2.8, -1.1]];

    // La foto
    const finder = corners(group(R, 0, -0.45, 1.1), 5.4, 3.6, 0.55, 0.045, basic(hdr(C.lime, 2.2), 1));
    const scanMat = basic(hdr(C.lime, 1.8), 0.0);
    const scan = new THREE.Mesh(PLANE, scanMat);
    R.add(scan);
    const kcal = ctx.label("≈ 750 kcal · 25 g proteína", "tag ok big-tag", [0, 2.05, 1.2]);
    const saved = ctx.label("guardado en la comida de hoy", "tag ok", [0, -3.05, 1.2]);

    // Cierre: el bocado
    const fork = img(R, "tenedor", { float: 0.02, x: 0.8, y: -2.0, z: 2, h: 1.7 });

    let orbit = 0, orbitSpeed = 1, phase = 0, mixCold = 0;
    return function update(s, dt, t, since) {
      bk(t);
      const L = s.bite ? "bite" : s.merge ? "merge" : s.kcal ? "hero" : s.islands ? "antes" : "hero";
      const freeze = !!s.freeze && L === "merge";
      const dimmed = freeze ? { sat: 0.25, br: 0.45 } : { sat: 1, br: 1 };

      // Plato
      mixCold = damp(mixCold, s.cold ? 1 : 0, 1.1, dt);
      const P = {
        hero: { x: 0, y: -0.5, z: 1, h: 4 }, antes: { x: -2.0, y: -2.3, z: 2, h: 2.2 },
        merge: { x: -4.3, y: -2.5, z: 1.5, h: 2.0 }, bite: { x: -0.4, y: -2.15, z: 1.5, h: 3.1 },
      }[L];
      plate.to({ ...P, o: 1, mix: mixCold, b: s.tired ? 0.8 : 0, ...dimmed }, dt, 3);
      const pw = plate.s.h * plate.aspect;
      steam(plate.s.x, plate.s.y + plate.s.h * 0.1, plate.s.z, pw, (1 - mixCold) * (freeze ? 0.3 : 1), t);
      qs.forEach((l, i) => { l.on = !!s.q && L === "hero" && since("q") > i * 0.7; });

      // Apps sueltas, y cómo se funden en una
      const mk = s.merge ? since("merge") : 99;
      const converging = s.merge && mk < 1.15;
      phones.forEach((p, i) => {
        const home = p.im.home;
        if (converging) {
          const toward = mk > 0.45;
          p.im.to(toward ? { x: gym.s.x, y: gym.s.y, z: gym.s.z - 0.2, h: 2.6, r: 0, o: mk < 1.0 ? 1 : 0, b: 0, sat: 1 } : { ...home, o: 1, b: 0, sat: 1 }, dt, toward ? 6 : 8);
        } else {
          const on = L === "antes";
          p.im.to({ ...home, o: on ? 1 : 0, b: s.tired ? 1 : 0, sat: s.tired ? 0.35 : 1, br: s.tired ? 0.7 : 1 }, dt, 4);
        }
        p.label.on = L === "antes" && !s.tired;
      });
      noLink.forEach((l) => { l.on = L === "antes" && !s.tired && !s.jump; });

      // Tú
      const juggling = L === "antes" && s.jump && !s.tired;
      agob.to(agob.at({ o: juggling ? 1 : 0 }), dt, 4);
      agot.to(agot.at({ o: L === "antes" && s.tired ? 1 : 0 }), dt, 3);
      cont.to(cont.at({ o: L === "merge" || L === "bite" ? 1 : 0, ...dimmed }), dt, 3);
      if (juggling) phase += dt * (s.jump === 2 ? 0.75 : 0.45);
      cards.forEach((l, j) => {
        const u = (phase + j / CARDS.length) % 1;
        const p = PH[j % 3];
        const to = tmpV.set(p[1], p[2] + 1.4, p[3]);
        l.obj.position.lerpVectors(HAND, to, smooth(u));
        l.obj.position.y += Math.sin(u * Math.PI) * 1.2;
        l.fade = Math.sin(u * Math.PI);
        l.on = juggling;
      });
      glue.on = L === "antes" && !!s.tired && since("tired") > 1.2;

      // Gymnasia
      const showGym = (L === "merge" || L === "bite") && !(converging && mk < 0.95);
      const G = L === "bite" ? { x: -4.2, y: 0.4, z: -0.6, h: 4.0 } : { x: 0, y: 0.2, z: 0, h: 5 };
      gym.to({ ...G, o: showGym ? 1 : 0, ...dimmed }, dt, 4);
      const bk2 = s.merge ? smooth((mk - 0.85) / 0.25) * (1 - smooth((mk - 1.15) / 0.9)) : 0;
      burst.position.set(gym.s.x, gym.s.y, gym.s.z + 0.3);
      burst.scale.setScalar(2 + bk2 * 7);
      burst.material.opacity = bk2 * 0.45;

      orbitSpeed = damp(orbitSpeed, freeze ? 0 : 1, 3, dt);
      orbit += dt * orbitSpeed;
      const showIcons = L === "merge" && mk > 1.0;
      icons.forEach((ic, i) => {
        // Cada icono gira despacio sobre su hueco; al congelarse, se para.
        const a = orbit * 0.6 + ic.off;
        const x = gym.s.x + SLOTS[i][0] + Math.cos(a) * 0.22, y = gym.s.y + SLOTS[i][1] + Math.sin(a) * 0.16, z = gym.s.z + 0.3;
        ic.im.to({ x, y, z, o: showIcons ? 1 : 0, ...dimmed }, dt, 6);
        ic.anchor.position.set(x, y - 0.8, z);
        ic.label.on = showIcons && !!s.cubeLabels;
        linkPos.set([gym.s.x, gym.s.y - 0.2, gym.s.z, ic.im.mesh.position.x, ic.im.mesh.position.y, ic.im.mesh.position.z], i * 6);
      });
      linkGeo.attributes.position.needsUpdate = true;
      linkMat.opacity = damp(linkMat.opacity, showIcons ? (freeze ? 0.08 : 0.45) : 0, 3, dt);
      ask.on = L === "merge" && !freeze && !s.cubeLabels && !s.title && mk > 1.6;
      answer.on = ask.on && mk > 2.8;
      nothing.on = freeze && since("freeze") > 0.6;

      // Foto
      const shoot = L === "hero" && !!s.kcal;
      fadeTo(finder.parent, shoot ? 1 : 0, dt, 6);
      const ks = shoot ? since("kcal") : 9;
      scan.position.set(0, lerp(1.3, -2.2, smooth(ks / 1.1)), 1.12);
      scan.scale.set(5.2, 0.03, 1);
      scanMat.opacity = shoot && ks < 1.2 ? 0.9 : damp(scanMat.opacity, 0, 8, dt);
      scan.visible = scanMat.opacity > 0.01;
      kcal.on = shoot && ks > 1.0;
      saved.on = shoot && ks > 1.9;

      // Bocado
      const kb = L === "bite" ? since("bite") : 0;
      const pb = smooth((kb - 0.9) / 1.6);
      fork.to({ x: lerp(0.8, 1.1, pb), y: lerp(-2.0, 0.2, pb), z: lerp(2, 2.6, pb), h: lerp(1.7, 2.0, pb), r: pb * 0.12, o: L === "bite" && kb > 0.5 ? 1 : 0 }, dt, 6);

      bd.to(s.tired ? 0x111622 : mixCold > 0.5 ? 0x13202f : L === "merge" || L === "bite" ? 0x1d2810 : 0x2e2210, dt, 1.2);
    };
  };

  // ── Parada 1: dónde viven los datos ───────────────────────────
  WORLD.datos = function (ctx) {
    const R = ctx.root;
    const bd = backdrop(R, 0x161d29);
    const bk = bokeh(R, [0x8fa3c7, 0xcbff1a], 7);
    const server = img(R, "servidor", { alt: "servidor-roto", shadow: true, float: 0.03, x: -2.4, y: -0.1, z: -0.5, h: 5.4 });
    const towerTag = ctx.label("un servidor con los datos de todos", "tag", [-2.4, 3.0, -0.5]);
    const attackTag = ctx.label("un único punto de ataque", "tag bad big-tag", [-2.4, 3.0, -0.5]);
    const costs = ["+ tiempo de desarrollo", "+ complejidad", "+ tokens", "+ riesgo"].map((text, i) => ctx.label(text, "tag bad", [2.6, 1.5 - i * 0.95, 0.5]));

    const phone = img(R, "movil-gymnasia", { shadow: true, float: 0.05, x: -1.0, y: -0.15, z: 0.5, h: 5 });
    const key = img(R, "llave", { float: 0.09, x: -4.3, y: -1.1, z: 2.2, h: 2.1, r: 0.12 });
    const keyTag = ctx.label("tu clave", "tag ok", [-4.3, -2.6, 2.2]);
    const localTag = ctx.label("todo vive en tu móvil", "tag ok", [-1.0, 3.1, 0.5]);

    const NAMES = ["OpenAI", "Anthropic", "Google"];
    const NP = [V(3.7, 2.2, 0), V(4.3, 0, 0), V(3.7, -2.2, 0)];
    const FROM = V(0.1, 0.6, 0.5);
    const nodes = NP.map((p, i) => {
      const g = group(R, p.x, p.y, p.z);
      return { g, core: makeCore(g, 0.3, 1), beam: makeBeam(R), packets: [makePacket(R), makePacket(R)], label: ctx.label(NAMES[i], "tag", [p.x + 1.45, p.y, p.z]) };
    });
    const downTag = ctx.label("caído", "tag bad", [NP[2].x, NP[2].y - 0.95, NP[2].z]);
    const stillTag = ctx.label("lo demás sigue funcionando", "tag ok", [0.9, -3.25, 0.5]);

    let pb = 0;
    return function update(s, dt, t, since) {
      bk(t);
      const gone = !!s.dissolve;
      server.to(gone ? { x: -6.5, y: 0.6, z: -6, h: 4.4, o: 0, b: 1, sat: 0.5, mix: 1 } : server.at({ o: s.tower ? 1 : 0, b: 0, sat: 1, mix: s.crack ? 1 : 0 }), dt, gone ? 1.6 : 4);
      server.shake = s.crack && !gone ? Math.sin(t * 47) * 0.03 * (since("crack") < 1.5 ? 1 : 0.3) : 0;
      towerTag.on = !s.crack && !gone;
      attackTag.on = !!s.crack && !gone;
      costs.forEach((l, i) => { l.on = !!s.crack && !gone && since("crack") > 0.8 + i * 0.5; });

      phone.to(phone.at({ o: s.beams ? 1 : 0, y: s.beams ? -0.15 : -0.9 }), dt, 3);
      key.to(key.at({ o: s.beams && since("beams") > 1.2 ? 1 : 0 }), dt, 4);
      keyTag.on = key.s.o > 0.6;
      localTag.on = !!s.beams && since("beams") > 0.6;

      pb = damp(pb, s.beams && since("beams") > 1.6 ? 1 : 0, 2.2, dt);
      nodes.forEach((n, i) => {
        const down = s.down && i === 2;
        n.core.update(down ? 0 : 1, dt, t);
        n.g.scale.setScalar(Math.max(pb, 1e-4));
        n.g.visible = pb > 0.01;
        n.beam.mat.color.copy(down ? tmpC.setHex(C.dim) : hdr(C.lime, 2.2));
        n.beam.mat.opacity = down ? 0.35 : 0.9;
        n.beam.set(FROM, NP[i], pb);
        n.packets.forEach((m, j) => {
          const u = (t * 0.45 + j * 0.5 + i * 0.17) % 1;
          m.position.lerpVectors(FROM, NP[i], u < 0.5 ? u * 2 : 2 - u * 2);
          m.visible = pb > 0.95 && !down;
        });
        n.label.on = pb > 0.5;
      });
      downTag.on = !!s.down;
      stillTag.on = !!s.down && since("down") > 1;
      bd.to(s.crack && !gone ? 0x2a1214 : s.beams ? 0x16210f : 0x161d29, dt, 1.5);
    };
  };

  // ── Parada 2: del plato al dato ───────────────────────────────
  WORLD.plato = function (ctx) {
    const R = ctx.root;
    const bd = backdrop(R, 0x241b10);
    const bk = bokeh(R, [0xffb020, 0xcbff1a, 0x8fa3c7], 7);
    const plate = img(R, "arroz-caliente", { shadow: true, float: 0.035, x: -4.0, y: -0.9, z: 0.5, h: 3.2 });
    const steam = makeSteam(R, 10);
    const textTag = ctx.label("«Parece un arroz con pollo, unas 700 calorías, con bastante proteína.»", "bubble quote", [2.0, 1.4, 1]);
    const sumTag = ctx.label("¿cómo sumo «bastante»?", "tag amber", [2.0, -0.5, 1]);

    const XS = [-1.7, 0.4, 2.5, 4.6];
    const H = [3.9, 1.9, 3.2, 1.3];
    const Y0 = -2.7, HMAX = 4.6;
    const NAMES = ["750 kcal", "25 g proteína", "90 g hidratos", "18 g grasa"];
    const bars = XS.map((x, i) => ({ bar: makeBar(R, x, Y0, 1.3, HMAX), label: ctx.label(NAMES[i], "tag", [x, Y0 + H[i] + 0.45, 0.2]) }));
    const formatTag = ctx.label("agente de comida · formato fijo y validado", "tag ok", [1.45, 2.85, 0.2]);

    const N = 700;
    const start = new Float32Array(N * 3), goal = new Float32Array(N * 3), pos = new Float32Array(N * 3);
    for (let n = 0; n < N; n++) {
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random());
      start.set([-4.9 + Math.cos(a) * r * 1.1, -2.0 + Math.sin(a) * r * 0.35, 0.6], n * 3);
      const i = n % 4;
      goal.set([XS[i] + (Math.random() - 0.5) * 1.1, Y0 + Math.random() * H[i], 0.1], n * 3);
    }
    const pgeo = new THREE.BufferGeometry();
    pgeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const pmat = new THREE.PointsMaterial({ color: C.rice, size: 0.075, map: SOFT, transparent: true, depthWrite: false, opacity: 1 });
    const points = new THREE.Points(pgeo, pmat);
    points.visible = false;
    R.add(points);

    // El dato que no pasa
    const reject = makeBar(R, 6.6, Y0, 1.0, 2.4);
    const rejectTag = ctx.label("−40 g grasa", "tag bad", [6.0, 0.4, 0.2]);

    // Código de barras
    const product = img(R, "producto", { shadow: true, float: 0.04, x: -4.6, y: -0.5, z: 1.5, h: 3.8 });
    const scanMat = basic(hdr(C.lime, 2.4), 1);
    const scan = new THREE.Mesh(PLANE, scanMat);
    R.add(scan);
    const offG = group(R, -0.4, 2.6, -1);
    const off = makeCore(offG, 0.35, 1);
    const offTag = ctx.label("Open Food Facts", "tag", [-0.4, 1.7, -1]);
    const fallbackTag = ctx.label("si no está, estima con la foto", "tag mini", [-0.4, 1.05, -1]);
    const offBeam = makeBeam(R);
    const offPacket = makePacket(R);
    const B0 = V(-4.35, -0.35, 1.6), B1 = V(-0.4, 2.6, -1);

    return function update(s, dt, t, since) {
      bk(t);
      const showPlate = !s.barcode;
      plate.to(s.bars ? { x: -4.6, y: -1.9, z: 0.5, h: 2.1, o: showPlate ? 1 : 0 } : plate.at({ o: showPlate ? 1 : 0 }), dt, 3);
      steam(plate.s.x, plate.s.y + plate.s.h * 0.1, plate.s.z, plate.s.h * plate.aspect, plate.s.o, t);
      textTag.on = !!s.text;
      sumTag.on = !!s.text && since("text") > 1.6;

      const kb = s.bars ? since("bars") : 0;
      const p = s.bars ? smooth((kb - 0.4) / 1.6) : 0;
      bars.forEach((b, i) => {
        b.bar.set(H[i] * p, null);
        fadeTo(b.bar.g, s.bars && !s.barcode ? 1 : 0, dt);
        b.label.on = p > 0.95 && !s.barcode;
      });
      formatTag.on = p > 0.95 && !s.barcode;
      if (s.bars && kb < 2.6) {
        for (let n = 0; n < N; n++) {
          const q = smooth((kb - 0.2 - (n / N) * 0.7) / 1.1);
          for (let j = 0; j < 3; j++) pos[n * 3 + j] = lerp(start[n * 3 + j], goal[n * 3 + j], q);
          pos[n * 3 + 1] += Math.sin(q * Math.PI) * 1.6;
        }
        pgeo.attributes.position.needsUpdate = true;
        pmat.opacity = 1 - smooth((kb - 1.8) / 0.8);
        points.visible = true;
      } else {
        points.visible = false;
      }

      if (s.reject) {
        const k = since("reject");
        const x = lerp(8.5, 6.0, smooth(k / 0.9));
        const fall = smooth((k - 1.4) / 0.9);
        reject.g.position.set(x + fall * 0.8, Y0 - fall * 2.4, 0.4);
        reject.g.rotation.z = -fall * 0.9;
        reject.set(2.4, dt, 8, k > 1.1 ? C.red : C.amber);
        fadeGroup(reject.g, 1 - smooth((k - 2.0) / 0.5));
        rejectTag.obj.position.set(x, 0.3, 0.4);
        rejectTag.el.textContent = k > 1.1 ? "−40 g grasa · no válido" : "−40 g grasa";
        rejectTag.on = k < 3;
      } else {
        fadeGroup(reject.g, 0);
        rejectTag.on = false;
      }

      product.to(product.at({ o: s.barcode ? 1 : 0 }), dt, 4);
      const kc = s.barcode ? since("barcode") : 0;
      scan.position.set(product.s.x + 0.25, product.s.y + 0.12 + Math.sin(t * 3) * 0.32, product.s.z + 0.05);
      scan.scale.set(1.15, 0.03, 1);
      scan.visible = product.s.o > 0.5;
      fadeGroup(offG, s.barcode ? smooth((kc - 0.6) / 0.6) : 0);
      off.update(1, dt, t);
      offTag.on = !!s.barcode && kc > 0.8;
      fallbackTag.on = !!s.barcode && kc > 2.6;
      offBeam.set(B0, B1, s.barcode ? smooth((kc - 0.9) / 0.8) : 0);
      const u = ((kc - 1.7) / 2.4) % 1;
      offPacket.visible = !!s.barcode && kc > 1.7;
      offPacket.position.lerpVectors(B0, B1, u < 0.5 ? smooth(u * 2) : smooth(2 - u * 2));
      bd.to(s.bars || s.barcode ? 0x18210e : 0x241b10, dt, 1.2);
    };
  };

  // ── Parada 3: el agente va a los datos ────────────────────────
  WORLD.tools = function (ctx) {
    const R = ctx.root;
    const bd = backdrop(R, 0x16210f);
    const bk = bokeh(R, [0xcbff1a, 0x8fa3c7], 9);
    const CORE = V(0, 0.55, 0);
    const coreG = group(R, CORE.x, CORE.y, CORE.z);
    const core = makeCore(coreG, 0.85);
    const TOOLS = [
      ["leer comidas", 0], ["añadir a comida", 0], ["buscar alimentos", 0], ["leer medida", 0],
      ["apuntar medida", 0], ["buscar ejercicios", 0], ["leer rutinas", 0], ["crear rutina", 0],
      ["guardar memoria", 1], ["listar memoria", 1], ["leer dato personal", 1], ["describir dato", 1],
      ["crear incidencia", 0],
    ];
    const tools = TOOLS.map(([name, mem], i) => {
      const anchor = new THREE.Object3D();
      R.add(anchor);
      const dot = glow(R, 0.35, hdr(C.lime, 1.5), 0.9);
      return { name, mem, off: (i / TOOLS.length) * Math.PI * 2, anchor, dot, label: ctx.label(name, "tag mini", anchor, { depth: true }), hot: 0 };
    });
    const ring = (a) => V(Math.cos(a) * 5.0, CORE.y - 0.15 - Math.sin(a) * 0.95, Math.sin(a) * 2.4);

    // Tus datos, abajo
    const DATA = ["icono-entrenos", "icono-comidas", "icono-medidas", "icono-gustos"];
    const data = DATA.map((key, i) => img(R, key, { float: 0.05, x: -3.9 + i * 2.6, y: -2.5, z: 1.6, h: 0.95 }));

    const ask = ctx.label("¿Me he pasado hoy?", "bubble", [-4.0, 2.5, 1]);
    const answer = ctx.label("Llevas 1.850 de 2.200 kcal. Te quedan 350.", "bubble ok-b", [4.0, 2.5, 1]);
    const beam = makeBeam(R), beam2 = makeBeam(R);
    const packet = makePacket(R);

    const prompt = ctx.label('<div class="c-title">prompt de entrada</div><div class="p-row">instrucciones</div><div class="p-row">reglas de salud</div><div class="p-row">13 herramientas</div><div class="p-row off">tu memoria</div>', "card panel", [-4.4, 0.7, 1.5]);
    const memTag = ctx.label("la memoria, solo cuando hace falta", "tag ok", [0, 3.15, 0.5]);

    // Una definición, tres formatos
    const SX = 17;
    const def = ctx.label('<div class="c-title">una sola definición</div><pre>apuntar_medida(\n  peso,\n  cintura?,\n  cadera?\n)</pre>', "card lime", [SX, 1.9, 0]);
    const SNIP = [
      ["OpenAI", '{ "type": "function",\n  "name": "apuntar_medida",\n  "parameters": {…},\n  <em>"strict": false</em> }'],
      ["Anthropic", '{ "name": "apuntar_medida",\n  <em>"input_schema"</em>: {…} }'],
      ["Google", '{ <em>"functionDeclarations"</em>: [\n  { "name": "apuntar_medida",\n    "parameters": {…} } ] }'],
    ];
    const SP = [V(SX - 4.4, -1.5, 0), V(SX, -1.8, 0), V(SX + 4.4, -1.5, 0)];
    const snips = SNIP.map(([name, code], i) => ctx.label(`<div class="c-title">${name}</div><pre>${code}</pre>`, "card code", SP[i].toArray()));
    const defBeams = SP.map(() => makeBeam(R));
    const DEF = V(SX, 0.9, 0);

    // El formulario que el modelo rellenó entero
    const FX = -17;
    const form = ctx.label(
      '<div class="c-title">apuntar medida</div>' +
      '<div class="f-row"><span>Peso</span><b>82 kg</b><i>✓</i></div>' +
      '<div class="f-row inv"><span>Cintura</span><b>—</b><i></i></div>' +
      '<div class="f-row inv"><span>Cadera</span><b>—</b><i></i></div>',
      "card form", [FX, 0.2, 0],
    );
    const rows = form.el.querySelectorAll(".f-row.inv b");
    const request = ctx.label("Apunta mi peso: 82 kg", "bubble", [FX - 3.3, 2.5, 0.5]);
    const whyTag = ctx.label("OpenAI volvía obligatorios los campos opcionales", "tag amber", [FX, -2.35, 0.5]);
    const gateMat = basic(hdr(C.lime, 2.2), 1);
    const gate = outline(group(R, FX, 0.2, -0.4), 3.4, 3.4, 0.05, gateMat);
    const gateFill = new THREE.Mesh(PLANE, basic(C.lime, 0.05));
    gateFill.scale.set(3.4, 3.4, 1);
    gate.parent.add(gateFill);
    const customsTag = ctx.label("solo pasa lo que encaja con el esquema", "tag ok", [FX, 2.55, 0]);
    const tape = img(R, "icono-medidas", { float: 0.06, x: FX + 3.6, y: -1.3, z: 1, h: 1.5 });

    let spin = 0;
    return function update(s, dt, t, since) {
      bk(t);
      core.update(1, dt, t);
      spin += dt * (s.query ? 0.03 : 0.12);
      const k = s.query ? since("query") : -1;
      const A = tools[0], B = tools[10];
      let target = null, src = null, p = 0, back = -1;
      if (s.query) {
        if (k < 1) { target = A; src = data[1]; p = smooth(k); }
        else if (k < 2.2) { target = A; src = data[1]; p = 1; back = (k - 1) / 1.2; }
        else if (k < 2.5) { target = A; src = data[1]; p = 1 - smooth((k - 2.2) / 0.3); }
        else if (k < 3.5) { target = B; src = data[3]; p = smooth(k - 2.5); }
        else if (k < 4.7) { target = B; src = data[3]; p = 1; back = (k - 3.5) / 1.2; }
        else { target = B; src = data[3]; p = 1 - smooth((k - 4.7) / 0.3); }
      }
      tools.forEach((x) => {
        const pos = ring(x.off + spin);
        x.anchor.position.copy(pos).add(tmpV.set(0, 0.42, 0));
        x.dot.position.copy(pos);
        const hot = x === target || (s.memory && x.mem);
        x.hot = damp(x.hot, hot ? 1 : 0, 6, dt);
        x.dot.material.color.set(C.dim).lerp(tmpC.setHex(C.lime), x.hot).multiplyScalar(1 + x.hot * 1.4);
        x.dot.scale.setScalar(0.3 + x.hot * 0.35);
        const front = (pos.z + 2.4) / 4.8;
        x.label.fade = 0.45 + 0.55 * front;
        x.label.el.classList.toggle("ok", x.hot > 0.5);
        x.label.on = !s.shadows && !s.form;
        x.dot.visible = !s.shadows && !s.form;
      });
      if (target) {
        beam.set(CORE, target.dot.position, p);
        const srcPos = tmpV.set(src.s.x, src.s.y + 0.4, src.s.z).clone();
        beam2.set(target.dot.position, srcPos, p);
        packet.visible = back >= 0 && back <= 1;
        if (packet.visible) {
          if (back < 0.5) packet.position.lerpVectors(srcPos, target.dot.position, smooth(back * 2));
          else packet.position.lerpVectors(target.dot.position, CORE, smooth(back * 2 - 1));
        }
      } else {
        beam.set(CORE, CORE, 0);
        beam2.set(CORE, CORE, 0);
        packet.visible = false;
      }
      data.forEach((d, i) => {
        const lit = (src === d && p > 0.5) || (s.memory && i === 3);
        d.to(d.at({ o: 1, br: lit ? 1.25 : 0.85, sat: lit ? 1 : 0.6 }), dt, 5);
      });
      ask.on = !!s.query;
      answer.on = !!s.query && k > 5.0;
      prompt.on = !!s.memory;
      memTag.on = !!s.memory && since("memory") > 0.8;

      def.on = !!s.shadows;
      snips.forEach((l, i) => { l.on = !!s.shadows && since("shadows") > 1.2 + i * 0.35; });
      defBeams.forEach((b, i) => b.set(DEF, SP[i].clone().add(tmpV.set(0, 0.9, 0)), s.shadows ? smooth((since("shadows") - 0.6 - i * 0.35) / 0.6) : 0));

      form.on = !!s.form;
      request.on = !!s.form && !s.customs;
      rows.forEach((b, i) => { b.textContent = s.invent ? ["94 cm", "101 cm"][i] : "—"; });
      form.el.classList.toggle("invented", !!s.invent);
      form.el.classList.toggle("checked", !!s.customs);
      whyTag.on = !!s.invent && !s.customs && since("invent") > 1.2;
      const g = s.customs ? smooth(since("customs") / 0.8) : 0;
      fadeGroup(gate.parent, g);
      customsTag.on = !!s.customs && since("customs") > 1;
      tape.to(tape.at({ o: s.form ? 1 : 0 }), dt, 4);
      bd.to(s.invent && !s.customs ? 0x2a1214 : 0x16210f, dt, 1.5);
    };
  };

  // ── Parada 4: el arroz dos veces ──────────────────────────────
  WORLD.duplicado = function (ctx) {
    const R = ctx.root;
    const bd = backdrop(R, 0x111a26);
    const metro = img(R, "metro", { float: 0, x: 0, y: 0.6, z: -10, h: 15.5, b: 0.45, br: 0.5, sat: 0.75, o: 1, edge: 0.14 });

    const phone = img(R, "movil-gymnasia", { shadow: true, float: 0.05, x: -4.4, y: -0.7, z: 1, h: 4.4 });
    const sig = group(R, -4.85, 1.75, 1.1);
    const sigBars = [0.18, 0.3, 0.42, 0.54].map((h, i) => {
      const mat = basic(hdr(C.lime, 2), 1);
      const m = new THREE.Mesh(PLANE_B, mat);
      m.position.x = i * 0.24;
      m.scale.set(0.15, h, 1);
      sig.add(m);
      return { m, mat, h };
    });
    const sendTag = ctx.label("«Apúntame el arroz de la comida»", "bubble", [-1.6, 2.9, 1.2]);

    // Calorías del día
    const Y0 = -2.9, HC = 5.2, MAX = 3000, GOAL = 2200;
    const y = (kcal) => (kcal / MAX) * HC;
    const col = makeBar(R, 1.0, Y0, 1.5, HC, { z: 0.5 });
    const col2 = makeBar(R, 3.7, Y0, 1.5, HC, { z: 0.5 });
    const goalMat = basic(0xffffff, 0.75);
    const goal = new THREE.Mesh(PLANE, goalMat);
    goal.position.set(1.0, Y0 + y(GOAL), 0.55);
    goal.scale.set(1.9, 0.025, 1);
    R.add(goal);
    const goalTag = ctx.label("objetivo 2.200", "tag mini", [-0.7, Y0 + y(GOAL), 0.5]);
    const kcalTop = new THREE.Object3D();
    R.add(kcalTop);
    const kcalTag = ctx.label("1.100 kcal", "tag", kcalTop);
    const overTag = ctx.label("+400 kcal", "big bad", [4.1, 1.4, 1]);
    const rewindTag = ctx.label("te faltaban 350 kcal", "tag ok big-tag", [3.7, 1.0, 1]);
    const plates = [0, 1, 2].map(() => img(R, "arroz-caliente", { float: 0, h: 0.9 }));
    const a = [0, 0];

    // La noche
    const NX = -17;
    const bed = img(R, "persona-cama", { shadow: true, float: 0, x: NX - 0.8, y: -0.3, z: 0, h: 5.6 });
    const apple = img(R, "manzana", { shadow: true, float: 0.04, x: NX + 3.7, y: -1.5, z: 1.2, h: 1.7 });
    const moon = glow(group(R, NX - 4.5, 3.2, -6), 7, 0x8fb4ff, 0.0);
    const appleTag = ctx.label("cena: una manzana", "tag", [NX + 3.7, -2.85, 1.2]);
    const hungryTag = ctx.label("y a la cama con hambre", "tag mini", [NX - 0.8, 3.05, 0]);

    // Huella
    const PX = 4.3, PY = 1.6;
    const print = group(R, PX, PY, 1);
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(new THREE.TorusGeometry(0.12 + i * 0.1, 0.016, 6, 64, Math.PI * 1.5 + i * 0.07), basic(hdr(C.lime, 2.2), 1));
      m.rotation.z = i * 0.85;
      print.add(m);
    }
    glow(print, 2.6, C.lime, 0.12);
    const printTag = ctx.label("misma huella: no se repite", "tag ok", [PX, PY - 1.15, 1]);
    const partsTag = ctx.label('<div class="c-title">la huella</div><div class="p-row">conversación</div><div class="p-row">herramienta</div><div class="p-row">datos</div><div class="p-row">1.ª o 2.ª vez en el turno</div>', "card", [PX, PY - 3.0, 1]);

    // Libreta
    const book = img(R, "libreta", { shadow: true, float: 0.05, x: 4.4, y: -1.5, z: 1.6, h: 2.0, r: -0.05 });
    const noteTag = ctx.label('<div>voy a guardar: arroz</div><div class="n2">✓ guardado · marca en la comida</div>', "note", [4.4, 0.25, 1.6]);
    const receiptTag = ctx.label("marca ✓", "tag ok mini", [-0.3, Y0 + y(1850), 0.5]);

    // Duda
    const doubtQ = ctx.label("?", "big amber", [-2.3, 1.7, 1.2]);
    const doubtTag = ctx.label("No sé si se guardó. Te pregunto antes de repetir.", "bubble amber-b", [4.2, 1.2, 1.2]);

    // El hueco de milisegundos
    const GX = 17;
    const slabMat = basic(0x1b2029, 0.95);
    const slabEdgeMat = basic(0xffffff, 0.22);
    const slab = (x) => {
      const g = group(R, GX + x, 0, 0);
      const m = new THREE.Mesh(PLANE, slabMat);
      m.scale.set(3.2, 2.4, 1);
      g.add(m);
      outline(g, 3.2, 2.4, 0.03, slabEdgeMat);
      return g;
    };
    const slabA = slab(-2.0), slabB = slab(2.0);
    const gapLabels = [ctx.label("guardar el arroz", "tag", [GX - 2.0, 0, 0.2]), ctx.label("apuntar que se guardó", "tag", [GX + 2.0, 0, 0.2])];
    const gapPlate = img(R, "arroz-caliente", { float: 0, x: GX, y: 3.5, z: 0.4, h: 0.9 });
    const gapTag = ctx.label("unos milisegundos", "tag amber", [GX, -1.85, 0.2]);
    const closedTag = ctx.label("cerrado", "tag ok", [GX, -1.85, 0.2]);
    const seam = new THREE.Mesh(PLANE, basic(hdr(C.lime, 2.2), 0));
    seam.position.set(GX, 0, 0.05);
    seam.scale.set(0.05, 2.4, 1);
    R.add(seam);

    const realTag = ctx.label("lo real", "tag ok", [1.0, Y0 + HC + 0.45, 0.5]);
    const appTag = ctx.label("lo que ve la app", "tag bad", [3.7, Y0 + HC + 0.45, 0.5]);
    const kcal2Tag = ctx.label("2.600 kcal", "tag bad", [5.4, Y0 + y(2600), 0.5]);

    return function update(s, dt, t, since) {
      const away = !!s.night || !!s.gap;
      metro.to(metro.at({ o: away ? 0 : 1, b: 0.45, br: 0.5, sat: 0.75 }), dt, 3);

      const main = !away;
      phone.to(phone.at({ o: main && !s.compare ? 1 : 0, tint: !s.signal && since("signal") < 4 && Math.sin(t * 9) > 0 ? 0xff7a7a : 0xffffff }), dt, 10);
      sigBars.forEach((b, i) => {
        b.m.scale.y = damp(b.m.scale.y, s.signal ? b.h : 0.06, 6, dt);
        b.mat.color.lerp(s.signal ? hdr(C.lime, 2) : hdr(C.red, 1.6), 1 - Math.exp(-6 * dt));
      });
      fadeGroup(sig, phone.s.o);
      sendTag.on = !!s.signal && main && !s.plates;

      // Platos que caen y suman
      let kcal = 1100;
      for (let i = 0; i < 2; i++) {
        const want = s.plates >= i + 1 ? 1 : 0;
        a[i] += Math.sign(want - a[i]) * Math.min(Math.abs(want - a[i]), dt / 1.3);
        const landed = smooth((a[i] - 0.75) / 0.25);
        const top = Y0 + y(kcal);
        plates[i].to({ x: 1.0, y: lerp(4.6, top + 0.3, smooth(a[i] / 0.75)), z: 0.7, h: 0.9 * (1 - landed * 0.6), o: a[i] > 0.01 && a[i] < 0.99 && main ? 1 : 0 }, dt, 30);
        kcal += 750 * landed;
      }
      const over = kcal > GOAL + 1;
      col.set(y(kcal), dt, 6, over ? C.red : C.lime);
      fadeTo(col.g, main ? 1 : 0, dt);
      goal.visible = main;
      kcalTop.position.set(-0.75, Y0 + col.h - 0.25, 0.5);
      kcalTag.el.textContent = fmt(kcal) + " kcal";
      kcalTag.el.classList.toggle("bad", over);
      kcalTag.on = main;
      goalTag.on = main;
      overTag.on = over && s.plates === 2 && main;
      rewindTag.on = !!s.rewind;

      bed.to(bed.at({ o: s.night ? 1 : 0 }), dt, 3);
      apple.to(apple.at({ o: s.night && since("night") > 0.8 ? 1 : 0 }), dt, 3);
      moon.material.opacity = damp(moon.material.opacity, s.night ? 0.22 : 0, 2, dt);
      appleTag.on = !!s.night && since("night") > 1.4;
      hungryTag.on = !!s.night && since("night") > 2.4;

      // Huella y reintento rebotado
      const kp = s.print ? since("print") : 0;
      print.scale.setScalar(Math.max(s.print ? smooth(kp / 0.5) : damp(print.scale.x, 0, 8, dt), 1e-4));
      print.visible = print.scale.x > 0.01;
      print.rotation.z = t * 0.15;
      const retry = plates[2];
      if (s.print) {
        const fall = smooth(kp / 0.8);
        const u = clamp01((kp - 0.8) / 0.9);
        retry.to({ x: PX + u * 2.2, y: lerp(4.6, PY + 0.9, fall) + Math.sin(u * Math.PI) * 0.9 - u * 1.8, z: 1.3, h: 0.9, r: -u * 2.2, o: kp < 1.7 ? 1 : 0 }, dt, 30);
      } else {
        retry.to({ o: 0 }, dt, 8);
      }
      printTag.on = !!s.print && kp > 0.9;
      partsTag.on = !!s.print && kp > 1.8;

      book.to(book.at({ o: s.notebook ? 1 : 0 }), dt, 4);
      noteTag.on = !!s.notebook;
      noteTag.el.classList.toggle("done", !!s.notebook && since("notebook") > 1.4);
      receiptTag.on = !!s.notebook && since("notebook") > 1.4;
      doubtQ.on = !!s.doubt;
      doubtTag.on = !!s.doubt && since("doubt") > 0.4;

      // Hueco
      const closed = !!s.gapClosed;
      slabA.position.x = damp(slabA.position.x, GX - (closed ? 1.6 : 2.0), 5, dt);
      slabB.position.x = damp(slabB.position.x, GX + (closed ? 1.6 : 2.0), 5, dt);
      seam.material.opacity = damp(seam.material.opacity, s.gap && closed ? 1 : 0, 4, dt);
      const gy = closed ? 1.65 : 3.5 - Math.min((s.gap ? since("gap") : 0) / 8, 1) * 3.2;
      gapPlate.to({ x: GX, y: gy, z: 0.4, h: 0.9, o: s.gap ? 1 : 0 }, dt, closed ? 6 : 2);
      fadeTo(slabA, s.gap ? 1 : 0, dt);
      fadeTo(slabB, s.gap ? 1 : 0, dt);
      gapLabels.forEach((l) => { l.on = !!s.gap; });
      gapTag.on = !!s.gap && !closed;
      closedTag.on = !!s.gap && closed;

      // Comparación
      col2.set(s.compare ? y(2600) : 0, dt, 2.5, C.red);
      fadeTo(col2.g, s.compare ? 1 : 0, dt);
      realTag.on = appTag.on = !!s.compare;
      kcal2Tag.on = !!s.compare && since("compare") > 1;

      bd.to(s.night ? 0x0d1730 : over && main ? 0x2a1214 : 0x111a26, dt, 1.5);
    };
  };

  // ── Parada 5: lo que el agente no debe hacer ──────────────────
  WORLD.salud = function (ctx) {
    const R = ctx.root;
    const bd = backdrop(R, 0x16210f);
    const bk = bokeh(R, [0xcbff1a, 0x8fa3c7], 8);
    const CZ = -7;
    const coreG = group(R, 0, 0.6, CZ);
    const core = makeCore(coreG, 1.0);
    const TOOLS = [["leer comidas", 0], ["añadir a comida", 1], ["leer medida", 0], ["apuntar medida", 1], ["buscar alimentos", 0], ["crear rutina", 1]];
    const tools = TOOLS.map(([name, write], i) => {
      const a = Math.PI * (0.15 + (i / (TOOLS.length - 1)) * 0.7);
      const p = [Math.cos(a) * -3.4, 0.6 + Math.sin(a) * 2.6 - 1.2, CZ];
      return { write, label: ctx.label(name, "tag mini", p), lock: write ? ctx.label("solo lectura", "tag amber mini", [p[0], p[1] - 0.75, CZ]) : null };
    });

    // El arco del filtro
    const archMat = basic(hdr(C.lime, 2.2), 1);
    const arch = outline(group(R, 0, 0, 0), 4.6, 5.6, 0.045, archMat);
    const field = new THREE.Mesh(PLANE, basic(C.lime, 0.045));
    field.scale.set(4.6, 5.6, 1);
    arch.parent.add(field);
    const filterTag = ctx.label("filtro de salud, aparte del prompt", "tag", [0, 3.35, 0]);

    const Q = new THREE.Object3D();
    Q.position.set(0, 1.0, 7);
    R.add(Q);
    const ask = ctx.label("Si mañana no como nada, ¿lo compenso?", "bubble", Q, { depth: true });
    const safe = ctx.label("Respuesta segura de la app. El modelo ni se entera.", "bubble ok-b", [4.0, -1.6, 1]);
    const riskHigh = ctx.label("riesgo alto", "tag bad big-tag", [0, -3.3, 0.5]);
    const riskMid = ctx.label("riesgo intermedio: solo puede leer", "tag amber big-tag", [0, -3.3, 0.5]);

    // Política firmada
    const scroll = img(R, "politica", { shadow: true, float: 0.05, x: -4.3, y: -0.3, z: 1.5, h: 3.8, r: 0.04 });
    const CHECKS = ["reglas con sus casos de prueba", "firmado", "probado antes en pruebas", "aprobado por mí"];
    const checks = CHECKS.map((text, i) => ctx.label(text, "tag ok", [4.0, 1.7 - i * 0.95, 1]));

    // Streaming normal frente a respuesta retenida
    const NORMAL = "Para ganar fuerza en sentadilla, sube 2,5 kg cada semana mientras mantengas la técnica.";
    const HEALTH = "Saltarte comidas para compensar no es buena idea. Repartir el exceso en varios días es más seguro.";
    const left = ctx.label("", "card panel", [-2.6, 0.4, 1]);
    const right = ctx.label("", "card panel", [2.6, 0.4, 1]);

    const tester = ctx.label("El agente no me contesta, me sale un aviso rojo.", "bubble", [-3.9, 2.4, 1.5]);
    const alert = ctx.label("Esta compilación no tiene la política firmada", "tag bad big-tag", [0, -3.3, 0.5]);
    const better = ctx.label('<div class="c-title">me quedo con este</div><div class="v-text">Un agente que a veces no te contesta</div>', "card lime verdict", [-3.1, 0, 2]);
    const worse = ctx.label('<div class="c-title">antes que con este</div><div class="v-text">Un agente que te contesta lo que no debe</div>', "card red verdict", [3.1, 0, 2]);

    return function update(s, dt, t, since) {
      bk(t);
      core.update(s.tester ? 0 : s.stream ? 0.35 : 1, dt, t);
      const dimArch = s.stream || s.seal;
      const archColor = s.tester ? C.red : s.risk === 3 ? C.red : s.risk === 2 ? C.amber : C.lime;
      // El rojo y el ámbar se queman a blanco con el bloom si pasan mucho de 1.
      archMat.color.lerp(hdr(archColor, dimArch ? 0.9 : archColor === C.lime ? 2.0 : 1.25), 1 - Math.exp(-6 * dt));
      field.material.color.lerp(tmpC.setHex(archColor), 1 - Math.exp(-6 * dt));
      fadeTo(arch.parent, s.stream || s.verdict ? 0.12 : 1, dt, 3);
      filterTag.on = !!s.ask && !s.risk;

      tools.forEach((x) => {
        x.label.on = !s.stream && !s.seal && !s.verdict;
        x.label.fade = s.tester ? 0.4 : 1;
        if (x.lock) x.lock.on = s.risk === 2 && since("risk") > 1.6;
      });
      const qz = !s.ask ? 7 : s.risk === 3 ? 0.8 : s.risk === 2 ? CZ + 2.2 : 3.2;
      Q.position.z = damp(Q.position.z, qz, s.risk === 2 ? 1.1 : 2, dt);
      Q.position.y = damp(Q.position.y, s.risk === 2 ? 2.3 : 1.0, 1.5, dt);
      ask.on = !!s.ask;
      safe.on = s.risk === 3 && since("risk") > 0.8;
      riskHigh.on = s.risk === 3;
      riskMid.on = s.risk === 2;

      scroll.to(scroll.at({ o: s.seal ? 1 : 0 }), dt, 4);
      checks.forEach((l, i) => { l.on = !!s.seal && since("seal") > 0.6 + i * 0.6; });

      left.on = right.on = !!s.stream;
      if (s.stream) {
        const k = since("stream");
        const n = Math.floor(clamp01((k - 0.5) / 5) * NORMAL.length);
        left.el.innerHTML = '<div class="c-title">Respuesta normal</div><div class="p-body">' + NORMAL.slice(0, n) + '<span class="caret"></span></div>';
        const done = k > 6;
        right.el.innerHTML = '<div class="c-title">Pregunta de salud</div><div class="p-body' + (done ? "" : " wait") + '">' +
          (done ? HEALTH : "esperando a tener la respuesta completa…") + "</div>";
      }
      tester.on = !!s.tester && !s.verdict;
      alert.on = !!s.tester && !s.verdict && since("tester") > 1;
      better.on = !!s.verdict;
      worse.on = !!s.verdict && since("verdict") > 0.5;
      bd.to(s.tester || s.risk === 3 ? 0x2a1214 : s.risk === 2 ? 0x2a1d0c : 0x16210f, dt, 1.5);
    };
  };

  // ── Parada 6: cómo pruebo todo esto ───────────────────────────
  WORLD.tests = function (ctx) {
    const R = ctx.root;
    const bd = backdrop(R, 0x161d29);
    const bk = bokeh(R, [0x8fa3c7, 0xcbff1a], 8);
    const CORE = V(-4.0, 0.5, 0);
    const core = makeCore(group(R, CORE.x, CORE.y, CORE.z), 0.85);
    const robot = img(R, "robot", { shadow: true, float: 0.03, x: 4.4, y: -0.4, z: 0, h: 5.8 });
    const tape = img(R, "casete", { shadow: true, float: 0.07, x: 1.4, y: -1.9, z: 1.8, h: 1.9, r: -0.08 });
    const fixed = [ctx.label("proveedor falso", "tag", [4.4, 3.0, 0]), ctx.label("respuestas de ejemplo", "tag mini", [1.4, -2.75, 1.8])];

    const A = V(1.2, -1.5, 1.9), B = V(-3.3, 0.5, 0.2);
    const N = 16;
    const segs = [];
    for (let i = 0; i < N; i++) {
      const g = group(R);
      const m = new THREE.Mesh(PLANE, basic(0xe9edf3, 0.85));
      m.scale.set(0.34, 0.2, 1);
      const e = outline(g, 0.34, 0.2, 0.012, basic(hdr(C.lime, 1.8), 0.9));
      g.add(m);
      g.userData = { off: V((Math.random() - 0.5) * 3, Math.random() * 3 - 0.8, (Math.random() - 0.5) * 2), rot: (Math.random() - 0.5) * 5, e };
      segs.push(g);
    }
    const shredTag = ctx.label("trozos al azar", "tag", [-1.1, 2.0, 0.5]);
    const okTag = ctx.label("reconstruido ✓", "tag ok", [-1.1, 2.0, 0.5]);
    const offline = ctx.label("sin internet · sin claves · sin coste", "tag ok big-tag", [0, 3.2, 0.5]);
    const e2e = ctx.label("de punta a punta en el navegador, con un OpenAI falso", "tag mini", [0, 2.45, 0.5]);

    return function update(s, dt, t, since) {
      bk(t);
      core.update(1, dt, t);
      robot.to(robot.at({ o: 1 }), dt, 3);
      tape.to(tape.at({ o: 1 }), dt, 3);
      fixed.forEach((l) => { l.on = true; });
      let sc = 0;
      if (s.shred) {
        const c = (since("shred") % 4) / 4;
        sc = c < 0.3 ? smooth(c / 0.3) : c < 0.65 ? 1 - smooth((c - 0.3) / 0.35) : 0;
        shredTag.on = c < 0.55 && !s.offline;
        okTag.on = c >= 0.68 && !s.offline;
      } else {
        shredTag.on = okTag.on = false;
      }
      segs.forEach((g, i) => {
        const u = (i / N + t * 0.06) % 1;
        g.position.lerpVectors(A, B, u).addScaledVector(g.userData.off, sc);
        g.position.y += Math.sin(u * Math.PI) * 0.9;
        g.rotation.z = g.userData.rot * sc + Math.atan2(B.y - A.y, B.x - A.x) * (1 - sc) * 0.5;
        fadeGroup(g, Math.sin(u * Math.PI) * 0.95);
      });
      offline.on = !!s.offline;
      e2e.on = !!s.offline && since("offline") > 0.8;
      bd.to(s.offline ? 0x16210f : 0x161d29, dt, 1.5);
    };
  };

  // ── Lo que queda ──────────────────────────────────────────────
  WORLD.pendiente = function (ctx) {
    const R = ctx.root;
    const bd = backdrop(R, 0x121822);
    const bk = bokeh(R, [0xcbff1a, 0x8fa3c7], 10);

    // Lo recorrido, y lo que queda
    const done = new THREE.Mesh(PLANE, basic(hdr(C.lime, 2), 1));
    done.position.set(-4.0, -3.15, 0.5);
    done.scale.set(5.2, 0.035, 1);
    R.add(done);
    const dots = [];
    for (let i = 0; i < 6; i++) {
      const d = glow(R, 0.45, hdr(C.lime, 2), 1);
      d.position.set(-6.4 + i * 0.95, -3.15, 0.5);
      dots.push(d);
    }
    const todo = [];
    for (let i = 0; i < 18; i++) {
      const m = new THREE.Mesh(PLANE, basic(0xffffff, 0.25));
      m.position.set(-1.1 + i * 0.42, -3.15, 0.5);
      m.scale.set(0.2, 0.03, 1);
      R.add(m);
      todo.push(m);
    }
    const pathTags = [ctx.label("lo recorrido", "tag ok mini", [-4.0, -2.65, 0.5]), ctx.label("lo que queda", "tag mini", [2.6, -2.65, 0.5])];

    const ITEMS = [["balanza", "Evals: ¿responde bien?"], ["silla", "Entrevista inicial y plan"], ["botones", "Más control"], ["lupa", "Búsqueda por significado"], ["monedas", "Coste y tiempos"]];
    const XS = [-5.0, -2.5, 0, 2.5, 5.0], YS = [-0.4, 0.5, 0.9, 0.5, -0.4], ZS = [0, -0.5, -0.8, -0.5, 0];
    const items = ITEMS.map(([key, name], i) => {
      const halo = glow(R, 3.4, C.lime, 0);
      halo.position.set(XS[i], YS[i], ZS[i] - 0.3);
      // Misma caja para todas, sean altas o apaisadas.
      const h = Math.min(2.3, 2.5 / TEX[key].aspect);
      return { im: img(R, key, { float: 0.06, x: XS[i], y: YS[i], z: ZS[i], h }), halo, label: ctx.label(name, "tag", [XS[i], YS[i] - 1.55, ZS[i]]) };
    });

    // A2A
    const AX = 17;
    const G0 = V(AX - 4.2, 0.4, 0), G1 = V(AX + 2.6, 0.4, 0.3);
    const gymG = group(R, G0.x, G0.y, G0.z);
    const gym = makeCore(gymG, 0.9);
    const gymTag = ctx.label("agente de Gymnasia", "tag ok", [G0.x, -1.6, 0]);
    const cart = img(R, "carrito", { alt: TEX["carrito-vacio"] ? "carrito-vacio" : undefined, shadow: true, float: 0.05, x: AX + 3.9, y: -0.3, z: 0.4, h: 4.3 });
    const cartTag = ctx.label("agente de la compra", "tag", [AX + 3.9, -2.75, 0.4]);
    const beam = makeBeam(R);
    const pk = [makePacket(R, hdr(0xffffff, 2.2)), makePacket(R)];
    const a2aTag = ctx.label("A2A · agent to agent", "tag ok", [AX - 0.8, 1.15, 0]);
    const cartAsk = ctx.label("¿Cuántas calorías? ¿Cuánta proteína? ¿Qué le gusta?", "bubble", [AX + 1.6, 3.0, 0.5]);
    const gymAnswer = ctx.label("2.200 kcal · 140 g de proteína · sin brócoli", "bubble ok-b", [AX - 3.2, 2.8, 0.5]);
    const broc = img(R, "brocoli", { float: 0, x: AX + 4.2, y: 0.45, z: 0.8, h: 1.4 });
    const noBroc = ctx.label("sin brócoli", "tag ok big-tag", [AX + 3.9, 2.5, 0.5]);

    return function update(s, dt, t, since) {
      bk(t);
      const lit = s.lit || 0;
      items.forEach((x, i) => {
        const on = lit > i;
        const current = lit === i + 1 && !s.a2a;
        x.im.to(x.im.at({ o: s.a2a ? 0.0 : on ? 1 : 0.55, b: on ? 0 : 1, sat: on ? 1 : 0, br: on ? 1 : 0.5, h: x.im.home.h * (current ? 1.18 : 1) }), dt, 3);
        x.halo.material.opacity = damp(x.halo.material.opacity, current ? 0.16 : on ? 0.05 : 0, 3, dt);
        x.label.on = on && !s.a2a;
        x.label.fade = current ? 1 : 0.7;
      });
      pathTags.forEach((l) => { l.on = !s.a2a; });

      gym.update(1, dt, t);
      gymTag.on = !!s.a2a;
      cart.to(cart.at({ o: s.a2a ? 1 : 0, mix: s.broccoli && cart.hasAlt ? 1 : 0 }), dt, 4);
      cartTag.on = !!s.a2a;
      const ka = s.a2a ? since("a2a") : 0;
      beam.set(G0, G1, s.a2a ? smooth((ka - 0.6) / 0.8) : 0);
      a2aTag.on = !!s.a2a && ka > 1.2;
      const kc = s.cart ? since("cart") : 0;
      pk[0].visible = !!s.cart && kc < 1.6;
      pk[0].position.lerpVectors(G1, G0, smooth(kc / 1.4));
      pk[1].visible = !!s.cart && kc > 1.7 && kc < 3.3;
      pk[1].position.lerpVectors(G0, G1, smooth((kc - 1.7) / 1.4));
      cartAsk.on = !!s.cart && !s.broccoli;
      gymAnswer.on = !!s.cart && kc > 2.2;

      // El brócoli sale del carrito
      if (s.broccoli) {
        const k = since("broccoli");
        const p = smooth(k / 1.5);
        broc.to({ x: AX + 4.2 + p * 2.2, y: 0.45 + Math.sin(p * Math.PI) * 2.4 - p * 2.8, z: 0.8 + p, h: 1.4 + p * 0.4, r: -p * 2.5, o: k < 1.4 ? 1 : 0, sat: 1 - p * 0.6 }, dt, 30);
      } else {
        broc.to({ o: 0 }, dt, 8);
      }
      noBroc.on = !!s.broccoli && since("broccoli") > 1.2;
      bd.to(s.a2a ? 0x16210f : 0x121822, dt, 1.5);
    };
  };

  // ── Preguntas ─────────────────────────────────────────────────
  // El texto es HTML (main.js); aquí solo el fondo: el agente o la ilustración
  // de la respuesta, a la derecha.
  WORLD.qa = function (ctx) {
    const R = ctx.root;
    const bd = backdrop(R, 0x131b12);
    const bk = bokeh(R, [0xcbff1a, 0x8fa3c7], 10);
    const coreG = group(R, 4.5, 0.2, -1.5);
    const core = makeCore(coreG, 1.0);
    const keys = [...new Set(QA.map((x) => x.img).filter(Boolean))];
    const ims = {};
    keys.forEach((key) => {
      ims[key] = img(R, key, { shadow: true, float: 0.06, x: 4.2, y: -0.1, z: 0.5, h: Math.min(4.0, 4.0 / TEX[key].aspect) });
    });
    let sc = 1;
    return function update(s, dt, t) {
      bk(t);
      const key = s.q ? QA[s.q - 1].img : null;
      keys.forEach((k) => ims[k].to(ims[k].at({ o: k === key ? 1 : 0 }), dt, 4));
      // En el índice el agente se aparta: detrás de la lista estorba.
      sc = damp(sc, key || !s.q ? 0.001 : 1, 5, dt);
      coreG.scale.setScalar(sc);
      coreG.visible = sc > 0.01;
      core.update(s.q ? 1 : 0.4, dt, t);
      bd.to(0x131b12, dt);
    };
  };

  window.WORLD = WORLD;
})();
