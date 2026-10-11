// Mundo 3D de la charla. Cada parada es una función que construye sus objetos
// dentro de `ctx.root` y devuelve `update(state, dt, t, since)`, que se llama en
// cada fotograma. `since(clave)` son los segundos desde que esa clave del estado
// cambió por última vez; sirve para encadenar animaciones dentro de un paso.
(function () {
  const C = {
    bg: 0x07090d, surf: 0x141820, surf2: 0x1b2029, line: 0x252b35, text: 0xf4f7fb,
    muted: 0xa6afbc, dim: 0x4a5361, lime: 0xcbff1a, red: 0xff5a5f, amber: 0xffb020,
    rice: 0xe8d6b0, chicken: 0xd9a066, herb: 0x5e8c3a, cold: 0x9fb2c8, metal: 0xd6dce5,
  };
  const UP = new THREE.Vector3(0, 1, 0);
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const tmpC = new THREE.Color();
  const tmpV = new THREE.Vector3();
  const tmpV2 = new THREE.Vector3();

  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  const smooth = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
  const lerp = (a, b, t) => a + (b - a) * t;
  const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
  const fmt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  const box = (x, y, z) => new THREE.BoxGeometry(x, y, z);
  const cyl = (a, b, h, s = 32) => new THREE.CylinderGeometry(a, b, h, s);
  const sphere = (r, s = 24) => new THREE.SphereGeometry(r, s, Math.max(8, s / 2));
  const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.12, ...o });
  // Materiales que brillan: base negra y color en la emisión, para que el lima no
  // se sature a amarillo al sumarse con la luz de la escena.
  const E = (color, i = 0.8, o = {}) => {
    const m = M(0x000000, { emissive: color, emissiveIntensity: 0.65 + 0.35 * Math.min(i, 1), ...o });
    m.userData.glow = true;
    return m;
  };

  function add(parent, geo, mat, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  function group(parent, x = 0, y = 0, z = 0) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    parent.add(g);
    return g;
  }
  function scaleTo(o, s, dt, k = 7) {
    const base = o.userData.baseScale || 1;
    const cur = o.userData.s ?? 0;
    const v = damp(cur, s, k, dt);
    o.userData.s = v;
    o.scale.setScalar(Math.max(v * base, 1e-4));
    o.visible = v > 0.003;
  }
  function moveTo(o, x, y, z, dt, k = 5) {
    o.position.set(damp(o.position.x, x, k, dt), damp(o.position.y, y, k, dt), damp(o.position.z, z, k, dt));
  }
  function colorTo(mat, hex, dt, k = 5) {
    const f = 1 - Math.exp(-k * dt);
    if (mat.userData.glow) mat.emissive.lerp(tmpC.setHex(hex), f);
    else mat.color.lerp(tmpC.setHex(hex), f);
  }

  let glowTexture = null;
  function glow(parent, size, color = C.lime, opacity = 0.7) {
    if (!glowTexture) {
      const c = document.createElement("canvas");
      c.width = c.height = 128;
      const g = c.getContext("2d");
      const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      grd.addColorStop(0, "rgba(255,255,255,1)");
      grd.addColorStop(0.3, "rgba(255,255,255,0.35)");
      grd.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = grd;
      g.fillRect(0, 0, 128, 128);
      glowTexture = new THREE.CanvasTexture(c);
    }
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    s.scale.set(size, size, 1);
    parent.add(s);
    return s;
  }

  // Rayo entre dos puntos (en coordenadas de `parent`) que crece de 0 a 1.
  function makeBeam(parent, color = C.lime, r = 0.035) {
    const geo = new THREE.CylinderGeometry(r, r, 1, 8, 1, true);
    geo.translate(0, 0.5, 0);
    const mat = E(color, 1);
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
  function makePacket(parent, color = C.lime, r = 0.09) {
    const m = add(parent, sphere(r, 16), E(color, 1.2));
    m.castShadow = false;
    m.visible = false;
    return m;
  }
  // Posición de un objeto en las coordenadas locales de la parada.
  function localPos(obj, root, out) {
    obj.getWorldPosition(out);
    return root.worldToLocal(out);
  }

  // ── Piezas compartidas ─────────────────────────────────────────
  function makePlate(parent, withSteam = true) {
    const g = group(parent);
    add(g, cyl(1.05, 0.8, 0.12, 48), M(0xe9edf3, { roughness: 0.3 }));
    const riceMat = M(C.rice, { roughness: 0.85 });
    const rice = add(g, new THREE.IcosahedronGeometry(0.72, 3), riceMat, 0, 0.12, 0);
    rice.scale.set(1, 0.38, 1);
    const chickMat = M(C.chicken, { roughness: 0.7 });
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const r = 0.22 + (i % 3) * 0.13;
      const surface = 0.12 + 0.2736 * Math.sqrt(1 - (r / 0.72) ** 2);
      const b = add(g, box(0.2, 0.12, 0.16), chickMat, Math.cos(a) * r, surface + 0.01, Math.sin(a) * r);
      b.rotation.set(a, a * 2, 0);
    }
    const herbMat = M(C.herb);
    for (let i = 0; i < 5; i++) {
      const a = i * 1.7 + 0.4;
      add(g, new THREE.TetrahedronGeometry(0.06), herbMat, Math.cos(a) * 0.42, 0.37, Math.sin(a) * 0.42);
    }
    const steam = [];
    if (withSteam) {
      for (let i = 0; i < 12; i++) {
        const m = glow(g, 0.6, 0xffffff, 0);
        m.material.blending = THREE.NormalBlending;
        m.userData = { phase: i / 12, x: (Math.random() - 0.5) * 0.6, z: (Math.random() - 0.5) * 0.6 };
        steam.push(m);
      }
    }
    let c = 0;
    let h = 1;
    return {
      g, riceMat,
      update(heat, cold, dt, t) {
        c = damp(c, cold, 1.6, dt);
        h = damp(h, heat * (1 - cold), 1.6, dt);
        riceMat.color.setHex(C.rice).lerp(tmpC.setHex(C.cold), c);
        chickMat.color.setHex(C.chicken).lerp(tmpC.setHex(0x8e97a6), c);
        steam.forEach((m) => {
          const k = (t * 0.35 + m.userData.phase) % 1;
          m.position.set(m.userData.x + Math.sin(k * 6 + m.userData.phase * 9) * 0.12, 0.45 + k * 1.7, m.userData.z);
          m.scale.setScalar(0.5 + k * 1.3);
          m.material.opacity = Math.sin(k * Math.PI) * 0.3 * h;
        });
      },
    };
  }

  function makePhone(parent) {
    const g = group(parent);
    add(g, box(1.05, 2.1, 0.1), M(C.line, { metalness: 0.45, roughness: 0.35 }));
    const screenMat = new THREE.MeshBasicMaterial({ color: 0x0b0e13 });
    add(g, new THREE.PlaneGeometry(0.93, 1.95), screenMat, 0, 0, 0.056);
    [[C.text, 0.62], [C.muted, 0.5], [C.lime, 0.44], [C.dim, 0.56]].forEach(([color, w], i) => {
      add(g, new THREE.PlaneGeometry(w, 0.07), new THREE.MeshBasicMaterial({ color }), -0.12 + i * 0.03, 0.6 - i * 0.24, 0.06);
    });
    return { g, screenMat };
  }

  function makeCore(parent, r = 0.4) {
    const g = group(parent);
    const mat = M(0x000000, { emissive: C.lime, emissiveIntensity: 1, flatShading: true, roughness: 0.4 });
    const core = add(g, new THREE.IcosahedronGeometry(r, 1), mat);
    const halo = glow(g, r * 4.6, C.lime, 0.5);
    let p = 1;
    return {
      g, core,
      update(power, dt, t) {
        p = damp(p, power, 3, dt);
        core.rotation.set(t * 0.4, t * 0.6, 0);
        mat.emissive.setHex(C.dim).lerp(tmpC.setHex(C.lime), p);
        mat.emissiveIntensity = 0.55 + 0.45 * p;
        halo.material.opacity = 0.42 * p * (0.88 + 0.12 * Math.sin(t * 2));
      },
    };
  }

  function makeFigure(parent) {
    const g = group(parent);
    add(g, new THREE.CapsuleGeometry(0.15, 0.32, 4, 12), M(C.muted), 0, 0.31, 0);
    add(g, sphere(0.13), M(C.text), 0, 0.72, 0);
    return g;
  }

  function hexIsland(parent, r = 0.75) {
    return add(parent, cyl(r, r, 0.14, 6), M(C.line, { roughness: 0.7 }));
  }

  // ── Paradas ───────────────────────────────────────────────────
  const WORLD = {};

  // El restaurante: antes, después, presentación y cierre.
  WORLD.mesa = function (ctx) {
    const R = ctx.root;
    add(R, cyl(3.4, 3.4, 0.25, 64), M(C.surf, { roughness: 0.85 }), 0, -0.15, 0);
    const plate = makePlate(R);
    plate.g.position.set(0, 0, 0.3);

    // Las tres apps desconectadas
    const IP = [V(-2.7, 2.3, -0.9), V(0, 3.0, -2.2), V(2.7, 2.3, -0.9)];
    const islands = IP.map((p) => {
      const g = group(R, p.x, p.y, p.z);
      hexIsland(g);
      return g;
    });
    // pesas
    const bar = add(islands[0], cyl(0.035, 0.035, 1, 12), M(C.muted, { metalness: 0.6 }), 0, 0.34, 0);
    bar.rotation.z = Math.PI / 2;
    [-0.38, 0.38].forEach((x) => { add(islands[0], cyl(0.2, 0.2, 0.07, 24), M(C.text), x, 0.34, 0).rotation.z = Math.PI / 2; });
    // chat
    add(islands[1], box(0.85, 0.5, 0.1), M(C.text), 0, 0.5, 0);
    const tail = add(islands[1], new THREE.ConeGeometry(0.1, 0.24, 3), M(C.text), -0.24, 0.2, 0);
    tail.rotation.z = Math.PI + 0.4;
    [-0.2, 0, 0.2].forEach((x) => add(islands[1], sphere(0.05, 12), M(C.bg), x, 0.5, 0.06));
    // medidas
    add(islands[2], new THREE.TorusGeometry(0.24, 0.07, 10, 28), M(C.muted), 0, 0.42, 0);
    add(islands[2], box(0.5, 0.07, 0.03), M(0xe9edf3), 0.3, 0.2, 0.05).rotation.z = -0.5;
    ctx.label("Pesos", "tag mini", [IP[0].x, IP[0].y + 0.95, IP[0].z]);
    ctx.label("ChatGPT", "tag mini", [IP[1].x, IP[1].y + 1.05, IP[1].z]);
    ctx.label("Medidas", "tag mini", [IP[2].x, IP[2].y + 0.95, IP[2].z]);
    const islandLabels = ctx.labelsSince();

    // El agente dentro del móvil
    const phone = makePhone(R);
    phone.g.position.set(1.7, 1.15, -1.5);
    phone.g.rotation.y = -0.35;
    const agent = group(R, -1.0, 2.5, -1.0);
    const core = makeCore(agent, 0.36);
    const NAMES = ["Entrenos", "Comidas", "Medidas", "Gustos"];
    const cubes = NAMES.map((name, i) => {
      const m = add(agent, box(0.26, 0.26, 0.26), M(i % 2 ? C.muted : C.text));
      m.userData.offset = (i / 4) * Math.PI * 2;
      m.userData.label = ctx.label(name, "tag mini", m);
      return m;
    });
    const linePos = new Float32Array(cubes.length * 6);
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute("position", new THREE.BufferAttribute(linePos, 3));
    agent.add(new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({ color: C.lime, transparent: true, opacity: 0.55 })));

    // El monigote que hace de pegamento
    const fig = makeFigure(R);
    fig.position.copy(IP[1]).add(V(0, 0.07, 0));
    const CARDS = ["82 kg", "quiero bajar grasa", "no me gusta el brócoli", "ayer hice pierna"];
    const card = ctx.label(CARDS[0], "tag", [0, 0, 0]);
    let phase = 0;
    let cardIndex = -1;

    const qLabel = ctx.label("¿600? ¿900?", "big", [0, 1.75, 0.3]);
    const kcalLabel = ctx.label("750 kcal · 25 g proteína", "tag ok big-tag", [0, 1.85, 0.3]);

    // Tenedor del cierre
    const fork = group(R);
    const forkMat = M(C.metal, { metalness: 0.3, roughness: 0.35 });
    add(fork, box(0.07, 0.025, 1.0), forkMat, 0, 0, 0.55);
    [-0.06, 0, 0.06].forEach((x) => add(fork, box(0.02, 0.02, 0.32), forkMat, x, 0, -0.1));
    const blob = add(fork, sphere(0.1, 16), plate.riceMat, 0, 0.05, -0.12);
    const F0 = V(2.8, 1.5, 1.8), F1 = V(0.35, 0.45, 0.55), F2 = V(0.9, 1.9, 2.4);

    let orbit = 0;
    let orbitSpeed = 0.6;

    return function update(s, dt, t, since) {
      plate.update(s.heat ?? 1, s.cold ? 1 : 0, dt, t);
      const showIslands = s.islands && !s.merge;
      islands.forEach((g, i) => {
        scaleTo(g, showIslands ? 1 : 0, dt, 5);
        const target = s.merge ? phone.g.position : IP[i];
        moveTo(g, target.x, target.y + Math.sin(t * 1.2 + i) * 0.06, target.z, dt, 3);
      });
      islandLabels.forEach((l) => { l.on = !!showIslands; });

      scaleTo(phone.g, s.merge ? 1 : 0, dt, 4);
      scaleTo(agent, s.merge ? 1 : 0, dt, 3);
      core.update(1, dt, t);
      orbitSpeed = damp(orbitSpeed, s.freeze ? 0 : 0.6, 4, dt);
      orbit += dt * orbitSpeed;
      cubes.forEach((m, i) => {
        const a = orbit + m.userData.offset;
        m.position.set(Math.cos(a) * 1.0, Math.sin(a * 1.3) * 0.25, Math.sin(a) * 1.0);
        m.rotation.set(orbit * 1.6, orbit * 1.1, 0);
        linePos.set([0, 0, 0, m.position.x, m.position.y, m.position.z], i * 6);
        m.userData.label.on = !!(s.cubeLabels && s.merge);
      });
      lineGeo.attributes.position.needsUpdate = true;

      // Monigote
      scaleTo(fig, showIslands ? 1 : 0, dt, 5);
      if (s.jump && showIslands) {
        phase += dt * (s.jump === 2 ? 1.6 : 0.9);
        const i = Math.floor(phase) % 3;
        const f = phase % 1;
        const a = IP[i], b = IP[(i + 1) % 3];
        fig.position.set(lerp(a.x, b.x, f), lerp(a.y, b.y, f) + 0.07 + Math.sin(f * Math.PI) * 1.0, lerp(a.z, b.z, f));
        const ci = Math.floor(phase) % CARDS.length;
        if (ci !== cardIndex) { cardIndex = ci; card.el.textContent = CARDS[ci]; }
      } else {
        moveTo(fig, IP[1].x, IP[1].y + 0.07, IP[1].z, dt, 4);
      }
      fig.rotation.x = damp(fig.rotation.x, s.tired ? 0.6 : 0, 3, dt);
      card.obj.position.copy(fig.position).add(tmpV2.set(0, 1.25, 0));
      card.on = !!(s.jump && showIslands);

      qLabel.on = !!s.q;
      kcalLabel.on = !!s.kcal;

      // Bocado final
      if (s.bite) {
        const k = since("bite");
        const p1 = smooth(k / 0.9), p2 = smooth((k - 1.1) / 0.9);
        tmpV.lerpVectors(F0, F1, p1).lerp(F2, p2);
        fork.position.copy(tmpV);
        fork.rotation.x = -0.5 - p2 * 0.3;
        fork.rotation.y = 0.5;
        scaleTo(fork, 1, dt, 6);
        blob.visible = k > 1.0;
      } else {
        fork.position.copy(F0);
        scaleTo(fork, 0, dt, 8);
      }
    };
  };

  // Parada 1: dónde viven los datos
  WORLD.datos = function (ctx) {
    const R = ctx.root;
    add(R, cyl(2.4, 2.4, 0.1, 48), M(C.surf), 0, 0, 0);
    const phone = makePhone(R);
    phone.g.position.set(0, 1.75, 0);
    phone.g.scale.setScalar(1.45);

    // Servidor
    const tower = group(R, -5.2, 0, -4.2);
    const leds = [];
    const units = [];
    for (let i = 0; i < 6; i++) {
      const u = group(tower, 0, 0.3 + i * 0.55, 0);
      add(u, box(1.5, 0.45, 1.1), M(C.line, { metalness: 0.4, roughness: 0.4 }));
      for (let j = 0; j < 3; j++) {
        const mat = E(C.lime, 0.9);
        leds.push(mat);
        add(u, box(0.09, 0.09, 0.02), mat, 0.42 + j * 0.13, 0, 0.56);
      }
      units.push(u);
    }
    const swarm = [];
    for (let i = 0; i < 46; i++) {
      const m = add(tower, box(0.12, 0.12, 0.12), M(C.muted));
      m.userData = { a: Math.random() * Math.PI * 2, r: 1.3 + Math.random() * 0.8, y: 0.4 + Math.random() * 3, v: 0.2 + Math.random() * 0.4 };
      swarm.push(m);
    }
    const towerTag = ctx.label("Servidor", "tag mini", [-5.2, 4.1, -4.2]);
    const crackTag = ctx.label("un único punto de ataque", "tag bad", [-5.2, 4.1, -4.2]);
    ctx.labelsSince();

    // Proveedores
    const NP = [V(4.2, 3.9, -1.2), V(4.8, 2.2, -1.2), V(4.2, 0.6, -1.2)];
    const NAMES = ["OpenAI", "Anthropic", "Google"];
    const from = V(0.75, 1.95, 0);
    const nodes = NP.map((p, i) => {
      const g = group(R, p.x, p.y, p.z);
      const mat = M(C.text);
      add(g, sphere(0.32), mat);
      const ring = add(g, new THREE.TorusGeometry(0.5, 0.025, 8, 48), E(C.lime, 0.8));
      ring.rotation.x = Math.PI / 2;
      ctx.label(NAMES[i], "tag", [p.x + 1.45, p.y, p.z]);
      return { g, mat, ring, beam: makeBeam(R), packets: [makePacket(R), makePacket(R)] };
    });
    const nodeLabels = ctx.labelsSince();
    const downTag = ctx.label("caído", "tag bad", [NP[2].x + 1.45, NP[2].y - 0.55, NP[2].z]);

    // Tu clave
    const key = group(R, -1.55, 1.0, 0.9);
    add(key, new THREE.TorusGeometry(0.17, 0.055, 10, 28), E(C.lime, 0.7), -0.3, 0, 0);
    add(key, box(0.45, 0.08, 0.06), E(C.lime, 0.7), 0.08, 0, 0);
    add(key, box(0.06, 0.14, 0.06), E(C.lime, 0.7), 0.24, -0.08, 0);
    const keyTag = ctx.label("tu clave", "tag ok", [-1.55, 0.45, 0.9]);

    let pd = 0;
    let pb = 0;
    return function update(s, dt, t) {
      pd = damp(pd, s.dissolve ? 1 : 0, 1.5, dt);
      units.forEach((u, i) => {
        const p = clamp01(pd * 1.8 - i * 0.12);
        u.position.y = 0.3 + i * 0.55 - p * 1.5;
        u.scale.setScalar(Math.max(1 - p, 1e-4));
        u.visible = p < 0.995;
      });
      tower.position.x = -5.2 + (s.crack && !s.dissolve ? Math.sin(t * 45) * 0.035 : 0);
      leds.forEach((m, i) => {
        const on = s.crack ? (Math.sin(t * 8 + i) > 0 ? C.red : 0x5a1a1c) : (Math.sin(t * 3 + i * 1.7) > -0.3 ? C.lime : C.dim);
        colorTo(m, on, dt, 12);
      });
      swarm.forEach((m) => {
        const u = m.userData;
        u.a += dt * u.v;
        const r = u.r * (1 + pd * 3);
        m.position.set(Math.cos(u.a) * r, u.y + pd * 1.5, Math.sin(u.a) * r);
        m.scale.setScalar(Math.max(1 - pd, 1e-4));
        m.visible = pd < 0.99;
      });
      towerTag.on = !s.crack && pd < 0.5;
      crackTag.on = !!s.crack && !s.dissolve;

      pb = damp(pb, s.beams ? 1 : 0, 2.2, dt);
      nodes.forEach((n, i) => {
        scaleTo(n.g, s.beams ? 1 : 0, dt, 4);
        const down = s.down && i === 2;
        colorTo(n.mat, down ? C.dim : C.text, dt);
        colorTo(n.ring.material, down ? C.dim : C.lime, dt);
        colorTo(n.beam.mat, down ? C.dim : C.lime, dt);
        n.beam.set(from, NP[i], pb);
        n.packets.forEach((m, j) => {
          const u = (t * 0.45 + j * 0.5 + i * 0.17) % 1;
          m.position.lerpVectors(from, NP[i], u < 0.5 ? u * 2 : 2 - u * 2);
          m.visible = pb > 0.95 && !down;
        });
        n.ring.rotation.z = t * 0.6;
      });
      nodeLabels.forEach((l) => { l.on = pb > 0.5; });
      downTag.on = !!s.down;
      scaleTo(key, s.beams ? 1 : 0, dt, 4);
      key.rotation.y = Math.sin(t * 0.8) * 0.25;
      keyTag.on = !!s.beams;
    };
  };

  // Parada 2: del plato al dato
  WORLD.plato = function (ctx) {
    const R = ctx.root;
    add(R, box(15, 0.2, 6), M(C.surf, { roughness: 0.85 }), 0.4, -0.1, 0.4);
    const PX = -3.6;
    const plate = makePlate(R);
    plate.g.position.set(PX, 0, 0);
    plate.g.userData.s = 1;
    const textTag = ctx.label("«parece un arroz con pollo, unas 700 calorías, con bastante proteína»", "bubble", [PX, 2.3, 0]);

    const XS = [-1.2, 0.6, 2.4, 4.2];
    const H = [2.6, 1.2, 2.2, 0.9];
    const NAMES = ["750 kcal", "25 g proteína", "90 g hidratos", "18 g grasa"];
    const bars = XS.map((x, i) => {
      const frameMat = new THREE.LineBasicMaterial({ color: C.dim });
      const frame = new THREE.LineSegments(new THREE.EdgesGeometry(box(1.15, 3, 0.85)), frameMat);
      frame.position.set(x, 1.5, 0);
      R.add(frame);
      const geo = box(0.9, 1, 0.6);
      geo.translate(0, 0.5, 0);
      const bar = add(R, geo, M(C.text, { roughness: 0.4 }), x, 0, 0);
      bar.scale.y = 1e-4;
      const label = ctx.label(NAMES[i], "tag", [x, H[i] + 0.45, 0]);
      return { bar, frameMat, label };
    });

    const N = 520;
    const start = new Float32Array(N * 3);
    const target = new Float32Array(N * 3);
    const pos = new Float32Array(N * 3);
    for (let n = 0; n < N; n++) {
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 0.7;
      start.set([PX + Math.cos(a) * r, 0.15 + Math.random() * 0.3, Math.sin(a) * r], n * 3);
      const i = n % 4;
      target.set([XS[i] + (Math.random() - 0.5) * 0.85, Math.random() * H[i], (Math.random() - 0.5) * 0.55], n * 3);
    }
    const pgeo = new THREE.BufferGeometry();
    pgeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const pmat = new THREE.PointsMaterial({ color: C.rice, size: 0.07, transparent: true, opacity: 1 });
    const points = new THREE.Points(pgeo, pmat);
    points.visible = false;
    R.add(points);

    // Dato que no pasa la validación
    const rgeo = box(0.9, 1.4, 0.6);
    rgeo.translate(0, 0.7, 0);
    const reject = add(R, rgeo, M(C.red, { emissive: C.red, emissiveIntensity: 0.25 }), 8, 0, 1.0);
    reject.visible = false;
    const rejectTop = new THREE.Object3D();
    R.add(rejectTop);
    const rejectTag = ctx.label("−40 g grasa", "tag bad", rejectTop);

    // Código de barras y Open Food Facts
    const product = group(R, PX, 0, 1.9);
    const pg = box(1.0, 1.5, 0.4);
    pg.translate(0, 0.75, 0);
    add(product, pg, M(0xe9edf3));
    add(product, new THREE.PlaneGeometry(0.72, 0.42), new THREE.MeshBasicMaterial({ color: 0xffffff }), 0, 0.45, 0.205);
    let bx = -0.31;
    while (bx < 0.31) {
      const w = [0.012, 0.02, 0.03][Math.floor(Math.random() * 3)];
      add(product, box(w, 0.34, 0.004), new THREE.MeshBasicMaterial({ color: 0x0b0e13 }), bx + w / 2, 0.47, 0.207);
      bx += w + 0.012 + Math.random() * 0.02;
    }
    const scan = add(product, new THREE.PlaneGeometry(0.82, 0.025), new THREE.MeshBasicMaterial({ color: C.lime }), 0, 0.45, 0.215);
    const cloud = group(R, 0.2, 3.9, -2.2);
    [[0, 0, 0, 0.55], [0.55, 0.1, 0, 0.42], [-0.55, 0.05, 0, 0.42], [0.25, 0.4, 0, 0.4], [-0.25, 0.35, 0, 0.38]].forEach(([x, y, z, r]) => add(cloud, sphere(r), M(C.muted, { roughness: 0.9 }), x, y, z));
    const offTag = ctx.label("Open Food Facts", "tag", [0.2, 4.95, -2.2]);
    const offBeam = makeBeam(R);
    const offPacket = makePacket(R);
    const B0 = V(PX, 1.6, 1.9), B1 = V(0.2, 3.5, -2.2);

    let pBars = 0;
    return function update(s, dt, t, since) {
      plate.update(1, 0, dt, t);
      scaleTo(plate.g, s.bars || s.barcode ? 0 : 1, dt, 5);
      textTag.on = !!s.text;

      pBars = s.bars ? smooth((since("bars") - 0.3) / 1.5) : 0;
      bars.forEach((b, i) => {
        b.bar.scale.y = Math.max(H[i] * pBars, 1e-4);
        b.bar.visible = pBars > 0.001;
        colorTo(b.frameMat, pBars > 0.98 ? C.lime : C.dim, dt, 4);
        b.label.on = pBars > 0.95;
      });
      if (s.bars && pBars < 1) {
        const k = since("bars");
        for (let n = 0; n < N; n++) {
          const p = smooth((k - (n / N) * 0.6) / 1.0);
          for (let j = 0; j < 3; j++) pos[n * 3 + j] = lerp(start[n * 3 + j], target[n * 3 + j], p);
          pos[n * 3 + 1] += Math.sin(p * Math.PI) * 1.2;
        }
        pgeo.attributes.position.needsUpdate = true;
        pmat.opacity = 1 - pBars * pBars;
        points.visible = true;
      } else {
        points.visible = false;
      }

      if (s.reject) {
        const k = since("reject");
        const x = lerp(8, 5.6, smooth(k / 1.0));
        const fall = smooth((k - 1.2) / 0.9);
        reject.position.set(x + fall * 0.8, -fall * 1.2, 1.0);
        reject.rotation.z = -fall * 1.1;
        reject.scale.setScalar(Math.max(1 - smooth((k - 1.8) / 0.5), 1e-4));
        reject.visible = k < 2.4;
        rejectTop.position.set(x, 1.95, 1.0);
        rejectTag.el.textContent = k > 1.1 ? "−40 g grasa · no válido" : "−40 g grasa";
        rejectTag.on = k < 3.2;
      } else {
        reject.visible = false;
        rejectTag.on = false;
      }

      scaleTo(product, s.barcode ? 1 : 0, dt, 5);
      scaleTo(cloud, s.barcode ? 1 : 0, dt, 4);
      scan.position.y = 0.45 + Math.sin(t * 3) * 0.18;
      offTag.on = !!s.barcode;
      const kb = s.barcode ? since("barcode") : 0;
      offBeam.set(B0, B1, s.barcode ? smooth((kb - 0.8) / 0.8) : 0);
      const u = ((kb - 1.6) / 2.4) % 1;
      offPacket.visible = !!s.barcode && kb > 1.6;
      offPacket.position.lerpVectors(B0, B1, u < 0.5 ? smooth(u * 2) : smooth(2 - u * 2));
    };
  };

  // Parada 3: el agente va a los datos
  WORLD.tools = function (ctx) {
    const R = ctx.root;
    add(R, cyl(4.2, 4.2, 0.1, 64), M(C.surf), 0, 0, 0);
    const core = makeCore(group(R, 0, 2.2, 0), 0.55);
    const TOOLS = [
      ["leer comidas", "r"], ["añadir a comida", "w"], ["buscar alimentos", "r"], ["leer medida", "r"],
      ["apuntar medida", "w"], ["buscar ejercicios", "r"], ["leer rutinas", "r"], ["crear rutina", "w"],
      ["guardar memoria", "w", 1], ["listar memoria", "r", 1], ["leer dato personal", "r", 1], ["describir dato", "r", 1],
      ["crear incidencia", "w"],
    ];
    const ring = group(R, 0, 2.2, 0);
    ring.rotation.x = 0.32;
    const spin = group(ring);
    const sats = TOOLS.map(([name, , mem], i) => {
      const a = (i / TOOLS.length) * Math.PI * 2;
      const mat = M(C.muted, { emissive: C.lime, emissiveIntensity: 0 });
      const m = add(spin, box(0.34, 0.34, 0.34), mat, Math.cos(a) * 3.4, 0, Math.sin(a) * 3.4);
      return { m, mat, mem, label: ctx.label(name, "tag mini", m) };
    });
    const satLabels = sats.map((x) => x.label);
    const prompt = group(R, -1.6, 2.4, 1.2);
    add(prompt, box(0.9, 1.15, 0.05), M(C.surf2));
    [0.35, 0.18, 0.01, -0.16, -0.33].forEach((y, i) => add(prompt, box(0.6 - (i % 2) * 0.15, 0.05, 0.01), M(C.dim), -0.05, y, 0.03));
    const promptTag = ctx.label("prompt", "tag mini", [-1.6, 3.25, 1.2]);
    const memTag = ctx.label("memoria: solo cuando hace falta", "tag ok", [0, 4.1, 0]);

    const ask = ctx.label("¿me he pasado hoy?", "bubble", [-3.0, 4.5, 1.2]);
    const answer = ctx.label("Llevas 1.850 de 2.200 kcal. Te quedan 350.", "bubble ok-b", [3.0, 4.5, 1.2]);
    const beam = makeBeam(R);
    const packet = makePacket(R);
    const CORE = V(0, 2.2, 0);
    const satPos = V(0, 0, 0);

    // Una definición, tres formatos
    const SR = group(R, 11, 0, 0);
    add(SR, box(4.6, 3.6, 0.05), M(C.surf2), 0, 1.8, -2.3);
    add(SR, box(0.05, 3.6, 4.6), M(C.surf2), -2.3, 1.8, 0);
    add(SR, box(4.6, 0.05, 4.6), M(C.surf2), 0, 0, 0);
    const PARTS = [[[1.2, 0.3, 0.3], [0, 0.45, 0]], [[0.3, 1.2, 0.3], [0, 0, 0]], [[0.3, 0.3, 1.0], [0.45, -0.45, 0.35]], [[0.3, 0.3, 0.3], [-0.45, -0.45, 0]]];
    function shape(parent, mat) {
      const g = group(parent);
      PARTS.forEach(([size, p]) => add(g, box(...size), mat, ...p));
      return g;
    }
    const obj = shape(group(SR, 0, 1.8, 0.2), E(C.lime, 0.45));
    const shadowMat = new THREE.MeshBasicMaterial({ color: 0x050608 });
    const proj = [
      [[0, 1.8, -2.26], [1, 1, 0.002]],
      [[-2.26, 1.8, 0.2], [0.002, 1, 1]],
      [[0, 0.04, 0.2], [1, 0.002, 1]],
    ].map(([p, sc]) => {
      const g = group(SR, ...p);
      g.scale.set(...sc);
      return shape(g, shadowMat);
    });
    const wallTags = [
      ctx.label("OpenAI", "tag", [11, 3.95, -2.3]),
      ctx.label("Anthropic", "tag", [8.7, 3.95, 0]),
      ctx.label("Google", "tag", [11, 0.15, 2.5]),
      ctx.label("una sola definición", "tag ok", [11, 3.1, 0.2]),
    ];

    // Formulario de medidas
    const FX = -11;
    const arch = group(R, FX, 0, -1.4);
    const archMat = E(C.lime, 0.5);
    add(arch, box(0.3, 3.0, 0.3), archMat, -1.9, 1.5, 0);
    add(arch, box(0.3, 3.0, 0.3), archMat, 1.9, 1.5, 0);
    add(arch, new THREE.TorusGeometry(1.9, 0.15, 10, 40, Math.PI), archMat, 0, 3.0, 0);
    add(R, cyl(3, 3, 0.1, 48), M(C.surf), FX, 0, 0);
    const formAnchor = new THREE.Object3D();
    formAnchor.position.set(FX, 2.3, 0.6);
    R.add(formAnchor);
    const form = ctx.label(
      '<div class="f-title">apuntar medida</div>' +
      '<div class="f-row" data-k="peso"><span>Peso</span><b>82 kg</b><i>✓</i></div>' +
      '<div class="f-row inv" data-k="cintura"><span>Cintura</span><b>—</b><i></i></div>' +
      '<div class="f-row inv" data-k="cadera"><span>Cadera</span><b>—</b><i></i></div>',
      "form", formAnchor,
    );
    const rows = form.el.querySelectorAll(".f-row.inv b");
    const request = ctx.label("Apunta mi peso: 82 kg", "bubble", [FX - 2.6, 4.0, 0.6]);
    const customsTag = ctx.label("solo pasa lo que encaja con el esquema", "tag ok", [FX, 3.6, -1.4]);

    return function update(s, dt, t, since) {
      core.update(1, dt, t);
      spin.rotation.y += dt * (s.query ? 0.04 : 0.14);
      const k = s.query ? since("query") : -1;
      const A = sats[0], B = sats[10];
      let active = null;
      if (s.query) {
        let p = 0, back = -1;
        if (k < 1) { active = A; p = smooth(k); }
        else if (k < 2) { active = A; p = 1; back = k - 1; }
        else if (k < 2.3) { active = A; p = 1 - smooth((k - 2) / 0.3); }
        else if (k < 3.3) { active = B; p = smooth(k - 2.3); }
        else if (k < 4.3) { active = B; p = 1; back = k - 3.3; }
        else { active = B; p = 1 - smooth((k - 4.3) / 0.3); }
        localPos(active.m, R, satPos);
        beam.set(CORE, satPos, p);
        packet.visible = back >= 0;
        if (back >= 0) packet.position.lerpVectors(satPos, CORE, smooth(back));
      } else {
        beam.set(CORE, CORE, 0);
        packet.visible = false;
      }
      sats.forEach((x) => {
        const hot = x === active || (s.memory && x.mem);
        x.mat.emissiveIntensity = damp(x.mat.emissiveIntensity, hot ? 0.9 : 0, 6, dt);
        colorTo(x.mat, hot ? C.lime : C.muted, dt, 6);
        x.m.rotation.set(t * 0.5, t * 0.4, 0);
      });
      satLabels.forEach((l) => { l.on = !s.shadows && !s.form; });
      ask.on = !!s.query;
      answer.on = s.query && k > 4.4;
      scaleTo(prompt, s.memory ? 1 : 0, dt, 5);
      promptTag.on = !!s.memory;
      memTag.on = !!s.memory;

      obj.parent.rotation.y += dt * 0.35;
      obj.parent.rotation.x = 0.3;
      proj.forEach((p) => p.rotation.copy(obj.parent.rotation));
      wallTags.forEach((l) => { l.on = !!s.shadows; });

      form.on = !!s.form;
      request.on = !!s.form && !s.customs;
      rows.forEach((b, i) => {
        b.textContent = s.invent ? ["94 cm", "101 cm"][i] : "—";
      });
      form.el.classList.toggle("invented", !!s.invent);
      form.el.classList.toggle("checked", !!s.customs);
      scaleTo(arch, s.customs ? 1 : 0.0, dt, 4);
      formAnchor.position.z = damp(formAnchor.position.z, s.customs ? -1.4 : 0.6, 1.5, dt);
      customsTag.on = !!s.customs && since("customs") > 1;
    };
  };

  // Parada 4: el arroz dos veces
  WORLD.duplicado = function (ctx) {
    const R = ctx.root;
    // Túnel de metro
    add(R, box(10, 0.1, 22), M(C.surf, { roughness: 0.9 }), 0, -0.05, -5);
    add(R, box(10, 0.02, 0.16), M(0xc9b458), 0, 0.01, 3.2);
    for (let z = -14; z <= 4; z += 2.2) {
      add(R, new THREE.TorusGeometry(4.6, 0.07, 8, 64, Math.PI), M(C.line), 0, 0, z);
      add(R, box(0.9, 0.05, 0.12), E(0xf4f7fb, 0.5), 0, 4.55, z);
    }

    // Móvil y cobertura
    const phone = makePhone(R);
    phone.g.position.set(-2.6, 1.7, 0.5);
    phone.g.rotation.y = 0.3;
    const signal = group(R, -2.9, 3.05, 0.5);
    const bars = [0.15, 0.25, 0.35, 0.45].map((h, i) => {
      const g = box(0.14, h, 0.14);
      g.translate(0, h / 2, 0);
      const mat = E(C.lime, 0.6);
      return { m: add(signal, g, mat, i * 0.2, 0, 0), mat };
    });

    // Columna de calorías del día
    const CX = 1.4, HC = 4, MAX = 3000, GOAL = 2200;
    const y = (kcal) => (kcal / MAX) * HC;
    function column(x) {
      const g = group(R, x, 0, 0);
      add(g, cyl(0.72, 0.72, HC, 48), M(C.text, { transparent: true, opacity: 0.07, depthWrite: false, side: THREE.DoubleSide }), 0, HC / 2, 0).castShadow = false;
      [0, HC].forEach((yy) => { add(g, new THREE.TorusGeometry(0.72, 0.03, 8, 48), M(C.line), 0, yy, 0).rotation.x = Math.PI / 2; });
      const goal = add(g, new THREE.TorusGeometry(0.8, 0.022, 8, 48), M(C.text), 0, y(GOAL), 0);
      goal.rotation.x = Math.PI / 2;
      const fg = cyl(0.66, 0.66, 1, 48);
      fg.translate(0, 0.5, 0);
      const fillMat = E(C.lime, 0.35);
      const fill = add(g, fg, fillMat);
      return { g, fill, fillMat };
    }
    const col = column(CX);
    const col2 = column(3.6);
    col2.g.userData.s = 0;
    col2.g.scale.setScalar(1e-4);
    const goalTag = ctx.label("objetivo 2.200", "tag mini", [CX - 1.6, y(GOAL), 0]);
    const kcalTop = new THREE.Object3D();
    R.add(kcalTop);
    const kcalTag = ctx.label("1.100 kcal", "tag", kcalTop);
    const overTag = ctx.label("+400 kcal", "big bad", [CX + 2.3, 3.5, 0.6]);
    const rewindTag = ctx.label("Te faltaban 350 kcal", "tag ok big-tag", [CX - 2.2, 3.4, 0.6]);

    // Platos que caen
    const plates = [0, 1, 2].map(() => {
      const p = makePlate(R, false);
      p.g.userData.baseScale = 0.42;
      p.g.scale.setScalar(1e-4);
      p.g.visible = false;
      return p;
    });
    const a = [0, 0];

    // Noche
    const night = group(R, 0.6, 0, 3.2);
    add(night, sphere(0.26), M(0xd94848, { roughness: 0.5 }), -0.6, 0.3, 2.3);
    add(night, cyl(0.02, 0.02, 0.16, 6), M(0x6b4a2b), -0.6, 0.6, 2.3);
    add(night, box(1.7, 0.3, 0.85), M(C.line), -3.5, 0.15, 2.3);
    add(night, box(0.4, 0.12, 0.6), M(C.text), -2.95, 0.36, 2.3);
    const sleeper = makeFigure(night);
    sleeper.position.set(-3.9, 0.45, 2.3);
    sleeper.rotation.z = -Math.PI / 2;
    const appleTag = ctx.label("cena: una manzana", "tag", [0, 1.3, 5.5]);

    // Huella
    const print = group(R, CX, 5.0, 0);
    for (let i = 0; i < 5; i++) {
      const arc = add(print, new THREE.TorusGeometry(0.12 + i * 0.085, 0.018, 6, 48, Math.PI * 1.55 + i * 0.08), E(C.lime, 0.9));
      arc.rotation.z = i * 0.9;
    }
    add(print, cyl(0.6, 0.6, 0.02, 48), E(C.lime, 0.15, { transparent: true, opacity: 0.25 }), 0, 0, -0.02).rotation.x = Math.PI / 2;
    const printTag = ctx.label("misma huella: no se repite", "tag ok", [CX + 2.4, 5.0, 0]);

    // Libreta y recibo
    const notebook = group(R, -0.9, 0.9, 1.9);
    add(notebook, box(1.0, 0.06, 1.3), M(0xe9edf3));
    [-0.35, -0.12, 0.11, 0.34].forEach((z) => add(notebook, box(0.7, 0.01, 0.03), M(C.dim), 0, 0.035, z));
    notebook.rotation.x = 0.9;
    const noteTag = ctx.label('<div>voy a guardar: arroz</div><div class="n2">✓ guardado · marca en la comida</div>', "note", [-0.9, 2.05, 1.9]);
    const receiptTag = ctx.label("marca ✓", "tag ok", [CX - 1.5, y(1850), 0]);

    // Duda
    const doubtQ = ctx.label("?", "big amber", [-2.6, 4.3, 0.5]);
    const doubtTag = ctx.label("No sé si se guardó. Te pregunto antes de repetir.", "bubble amber-b", [0.4, 4.4, 1.2]);

    // El hueco de milisegundos
    const GX = 12;
    add(R, cyl(2.6, 2.6, 0.1, 48), M(C.surf), GX, 0, 0);
    const slabMat = M(C.line, { emissive: C.lime, emissiveIntensity: 0 });
    const slabA = add(R, box(1.6, 1.2, 0.5), slabMat, GX - 1.0, 0.6, 0);
    const slabB = add(R, box(1.6, 1.2, 0.5), slabMat, GX + 1.0, 0.6, 0);
    ctx.labelsSince();
    ctx.label("guardado", "tag", [GX - 1.0, 1.55, 0.3]);
    ctx.label("apuntado", "tag", [GX + 1.0, 1.55, 0.3]);
    const gapLabels = ctx.labelsSince();
    const gapPlate = makePlate(R, false);
    gapPlate.g.userData.baseScale = 0.3;
    const gapTag = ctx.label("unos milisegundos", "tag amber", [GX, 2.6, 0.2]);
    const closedTag = ctx.label("cerrado", "tag ok", [GX, 2.6, 0.2]);

    const realTag = ctx.label("lo real", "tag ok", [CX, 4.55, 0]);
    const appTag = ctx.label("lo que ve la app", "tag bad", [3.6, 4.55, 0]);
    const kcal2Tag = ctx.label("2.600 kcal", "tag bad", [3.6 + 1.55, y(2600) - 0.3, 0]);

    return function update(s, dt, t, since) {
      // Cobertura
      bars.forEach((b, i) => {
        b.m.scale.y = damp(b.m.scale.y, s.signal ? 1 : 0.15, 6, dt);
        colorTo(b.mat, s.signal ? C.lime : C.red, dt, 6);
      });
      const blink = !s.signal && since("signal") < 5 && Math.sin(t * 9) > 0;
      phone.screenMat.color.setHex(blink ? 0x5a1a1c : 0x0b0e13);

      // Platos y calorías
      let kcal = 1100;
      for (let i = 0; i < 2; i++) {
        const want = s.plates >= i + 1 ? 1 : 0;
        a[i] += Math.sign(want - a[i]) * Math.min(Math.abs(want - a[i]), dt / 1.3);
        const landed = smooth((a[i] - 0.75) / 0.25);
        const top = y(kcal);
        const p = plates[i];
        p.g.position.set(CX, lerp(6.4, top + 0.15, smooth(a[i] / 0.75)), 0);
        const vis = a[i] > 0.001 && a[i] < 0.999;
        p.g.visible = vis;
        p.g.scale.setScalar(0.42 * Math.max(1 - landed, 1e-3));
        kcal += 750 * landed;
      }
      col.fill.scale.y = Math.max(y(kcal), 1e-4);
      const over = kcal > GOAL + 1;
      colorTo(col.fillMat, over ? C.red : C.lime, dt, 6);
      kcalTop.position.set(CX - 1.7, y(kcal) - 0.3, 0);
      kcalTag.el.textContent = fmt(kcal) + " kcal";
      kcalTag.el.classList.toggle("bad", over);
      kcalTag.on = true;
      goalTag.on = true;
      overTag.on = over && s.plates === 2;
      rewindTag.on = !!s.rewind;

      scaleTo(night, s.night ? 1 : 0, dt, 4);
      appleTag.on = !!s.night;

      // Huella y reintento rebotado
      scaleTo(print, s.print ? 1 : 0, dt, 5);
      print.rotation.y = Math.sin(t * 0.8) * 0.2;
      const retry = plates[2];
      if (s.print) {
        const k = since("print");
        const fall = smooth(k / 0.7);
        const u = clamp01((k - 0.7) / 0.9);
        retry.g.position.set(CX + u * 2.0, lerp(7.6, 5.45, fall) + Math.sin(u * Math.PI) * 0.9 - u * 1.6, 0.4);
        retry.g.rotation.z = -u * 2.2;
        retry.g.visible = k < 1.6;
        retry.g.scale.setScalar(0.4 * Math.max(1 - smooth((k - 1.2) / 0.4), 1e-3));
        printTag.on = k > 0.7;
      } else {
        retry.g.visible = false;
        printTag.on = false;
      }

      scaleTo(notebook, s.notebook ? 1 : 0, dt, 5);
      noteTag.on = !!s.notebook;
      noteTag.el.classList.toggle("done", s.notebook && since("notebook") > 1.3);
      receiptTag.on = s.notebook && since("notebook") > 1.3;

      doubtQ.on = !!s.doubt;
      doubtTag.on = s.doubt && since("doubt") > 0.4;

      // Hueco
      const closed = !!s.gapClosed;
      slabA.position.x = damp(slabA.position.x, GX - (closed ? 0.8 : 1.0), 5, dt);
      slabB.position.x = damp(slabB.position.x, GX + (closed ? 0.8 : 1.0), 5, dt);
      slabMat.emissiveIntensity = damp(slabMat.emissiveIntensity, closed ? 0.35 : 0, 4, dt);
      scaleTo(gapPlate.g, s.gap ? 1 : 0, dt, 4);
      const gy = closed ? 1.4 : 3.0 - Math.min(since("gap") / 9, 1) * 2.25;
      gapPlate.g.position.set(GX, damp(gapPlate.g.position.y || 3, gy, closed ? 6 : 2, dt), 0);
      gapLabels.forEach((l) => { l.on = !!s.gap; });
      gapTag.on = s.gap && !closed;
      closedTag.on = s.gap && closed;

      // Comparación
      scaleTo(col2.g, s.compare ? 1 : 0, dt, 4);
      col2.fill.scale.y = y(2600);
      colorTo(col2.fillMat, C.red, dt, 6);
      realTag.on = !!s.compare;
      appTag.on = !!s.compare;
      kcal2Tag.on = !!s.compare;
    };
  };

  // Parada 5: lo que el agente no debe hacer
  WORLD.salud = function (ctx) {
    const R = ctx.root;
    add(R, box(10, 0.1, 18), M(C.surf, { roughness: 0.9 }), 0, -0.05, -2);
    const arch = group(R, 0, 0, 0);
    const archMat = E(C.lime, 0.45);
    add(arch, box(0.35, 3.2, 0.35), archMat, -1.7, 1.6, 0);
    add(arch, box(0.35, 3.2, 0.35), archMat, 1.7, 1.6, 0);
    add(arch, new THREE.TorusGeometry(1.7, 0.17, 10, 40, Math.PI), archMat, 0, 3.2, 0);

    const CZ = -5.5;
    const core = makeCore(group(R, 0, 2.2, CZ), 0.5);
    const ring = group(R, 0, 2.2, CZ);
    ring.rotation.x = 0.3;
    const spin = group(ring);
    const TOOLS = [["leer comidas", 0], ["añadir a comida", 1], ["leer medida", 0], ["apuntar medida", 1], ["buscar alimentos", 0], ["crear rutina", 1]];
    const sats = TOOLS.map(([name, write], i) => {
      const ang = (i / TOOLS.length) * Math.PI * 2;
      const mat = M(C.muted);
      const m = add(spin, box(0.32, 0.32, 0.32), mat, Math.cos(ang) * 2.3, 0, Math.sin(ang) * 2.3);
      let lock = null;
      if (write) {
        lock = group(spin, Math.cos(ang) * 2.3, 0.42, Math.sin(ang) * 2.3);
        add(lock, box(0.26, 0.2, 0.12), E(C.amber, 0.5));
        add(lock, new THREE.TorusGeometry(0.08, 0.025, 6, 16, Math.PI), M(C.metal, { metalness: 0.8 }), 0, 0.1, 0);
        lock.userData.s = 0;
        lock.scale.setScalar(1e-4);
      }
      return { m, mat, lock, label: ctx.label(name, "tag mini", m) };
    });

    const Q = new THREE.Object3D();
    Q.position.set(0, 2.7, 7);
    R.add(Q);
    const ask = ctx.label("si mañana no como nada, ¿lo compenso?", "bubble", Q);
    const safe = ctx.label("Respuesta segura de la app. El modelo no la ve.", "bubble ok-b", [3.4, 1.4, 0.8]);
    const riskHigh = ctx.label("riesgo alto", "tag bad", [0, 4.45, 0]);
    const riskMid = ctx.label("riesgo intermedio: solo lectura", "tag amber", [0, 4.45, 0]);

    // Política firmada
    const scroll = group(R, -4.4, 0, 0.6);
    add(scroll, box(1.7, 2.3, 0.04), M(0xe9edf3), 0, 2.2, 0);
    [2.95, 2.7, 2.45, 2.2, 1.95].forEach((yy, i) => add(scroll, box(1.2 - (i % 2) * 0.3, 0.05, 0.01), M(C.dim), -0.1, yy, 0.03));
    add(scroll, cyl(0.28, 0.28, 0.07, 32), E(C.lime, 0.6), 0.45, 1.35, 0.06).rotation.x = Math.PI / 2;
    scroll.userData.s = 0;
    scroll.scale.setScalar(1e-4);
    const sealTag = ctx.label("reglas + casos de prueba · firmado", "tag ok", [-4.4, 3.75, 0.6]);

    // Streaming normal frente a respuesta retenida
    const NORMAL = "Para ganar fuerza en sentadilla, sube 2,5 kg cada semana mientras mantengas la técnica.";
    const HEALTH = "Saltarte comidas para compensar no es buena idea. Repartir el exceso en varios días es más seguro.";
    const left = ctx.label("", "panel", [-2.5, 2.9, 2.4]);
    const right = ctx.label("", "panel", [2.5, 2.9, 2.4]);

    const alert = ctx.label("La compilación no contiene la política firmada", "tag bad big-tag", [0, 4.6, CZ]);

    return function update(s, dt, t, since) {
      core.update(s.tester ? 0 : 1, dt, t);
      spin.rotation.y += dt * 0.15;
      sats.forEach((x) => {
        x.m.rotation.set(t * 0.5, t * 0.4, 0);
        colorTo(x.mat, s.tester ? C.dim : C.muted, dt);
        if (x.lock) scaleTo(x.lock, s.risk === 2 ? 1 : 0, dt, 6);
        x.label.on = !s.stream;
      });
      const archColor = s.risk === 3 ? C.red : s.risk === 2 ? C.amber : C.lime;
      colorTo(archMat, archColor, dt, 6);

      const qz = !s.ask ? 7 : s.risk === 3 ? 0.9 : s.risk === 2 ? CZ + 1.1 : 1.8;
      moveTo(Q, 0, 2.7, qz, dt, s.risk === 2 ? 1.2 : 2);
      ask.on = !!s.ask;
      safe.on = s.risk === 3 && since("risk") > 0.6;
      riskHigh.on = s.risk === 3;
      riskMid.on = s.risk === 2;

      scaleTo(scroll, s.seal ? 1 : 0, dt, 5);
      sealTag.on = !!s.seal;

      left.on = right.on = !!s.stream;
      if (s.stream) {
        const k = since("stream");
        const n = Math.floor(clamp01((k - 0.5) / 5) * NORMAL.length);
        left.el.innerHTML = '<div class="p-title">Respuesta normal</div><div class="p-body">' + NORMAL.slice(0, n) + '<span class="caret"></span></div>';
        const done = k > 6;
        right.el.innerHTML = '<div class="p-title">Pregunta de salud</div><div class="p-body' + (done ? "" : " wait") + '">' +
          (done ? HEALTH : "esperando a tener la respuesta completa…") + "</div>";
      }
      alert.on = !!s.tester;
    };
  };

  // Parada 6: cómo pruebo todo esto
  WORLD.tests = function (ctx) {
    const R = ctx.root;
    add(R, cyl(5.5, 5.5, 0.1, 64), M(C.surf), 0, 0, 0);
    const core = makeCore(group(R, -3.4, 2.2, 0), 0.5);
    const bot = group(R, 3.4, 0, 0);
    const botMat = M(C.line, { metalness: 0.4, roughness: 0.4 });
    [-0.22, 0.22].forEach((x) => add(bot, box(0.22, 0.8, 0.22), botMat, x, 0.4, 0));
    add(bot, box(1.0, 1.1, 0.6), botMat, 0, 1.35, 0);
    add(bot, box(0.7, 0.5, 0.5), botMat, 0, 2.2, 0);
    [-0.15, 0.15].forEach((x) => add(bot, box(0.1, 0.06, 0.02), E(C.text, 0.6), x, 2.25, 0.26));
    add(bot, cyl(0.02, 0.02, 0.35, 6), M(C.muted), 0, 2.6, 0);
    add(bot, sphere(0.06, 12), M(C.muted), 0, 2.8, 0);
    add(bot, box(0.2, 0.2, 0.7), botMat, -0.55, 1.5, 0.3);
    const cassette = group(R, 2.5, 1.55, 0.6);
    add(cassette, box(0.9, 0.55, 0.14), M(C.text));
    const reels = [-0.22, 0.22].map((x) => {
      const r = add(cassette, cyl(0.13, 0.13, 0.05, 16), M(C.line), x, 0.02, 0.08);
      r.rotation.x = Math.PI / 2;
      return r;
    });
    ctx.label("proveedor falso", "tag", [3.4, 3.25, 0]);
    ctx.label("respuestas grabadas", "tag mini", [2.5, 0.95, 0.6]);
    const fixed = ctx.labelsSince();

    const A = V(2.0, 1.6, 0.6), B = V(-2.85, 2.2, 0);
    const N = 13;
    const segs = [];
    for (let i = 0; i < N; i++) {
      const m = add(R, box(0.02, 0.12, 0.3), M(C.metal, { roughness: 0.4 }));
      m.userData.off = V((Math.random() - 0.5) * 2.6, Math.random() * 2.2 - 0.6, (Math.random() - 0.5) * 2);
      m.userData.rot = (Math.random() - 0.5) * 6;
      segs.push(m);
    }
    const shredTag = ctx.label("trozos al azar", "tag", [0, 4.1, 0]);
    const okTag = ctx.label("reconstruido ✓", "tag ok", [0, 4.1, 0]);
    const offline = ctx.label("sin internet · sin claves · sin coste", "tag ok big-tag", [0, 4.9, 0]);

    return function update(s, dt, t, since) {
      core.update(1, dt, t);
      reels.forEach((r) => { r.rotation.y = t * 3; });
      fixed.forEach((l) => { l.on = true; });
      let sc = 0;
      if (s.shred) {
        const c = (since("shred") % 3.6) / 3.6;
        sc = c < 0.35 ? smooth(c / 0.35) : c < 0.7 ? 1 - smooth((c - 0.35) / 0.35) : 0;
        shredTag.on = c < 0.6;
        okTag.on = c >= 0.72;
      } else {
        shredTag.on = okTag.on = false;
      }
      segs.forEach((m, i) => {
        const u = (i / N + t * 0.07) % 1;
        m.position.lerpVectors(A, B, u).addScaledVector(m.userData.off, sc);
        m.lookAt(tmpV.copy(B));
        m.rotation.z += m.userData.rot * sc;
      });
      offline.on = !!s.offline;
    };
  };

  // Lo que queda
  WORLD.pendiente = function (ctx) {
    const R = ctx.root;
    add(R, box(28, 0.1, 20), M(0x0b0e13, { roughness: 1 }), 0, -0.05, 0);
    const grid = new THREE.GridHelper(28, 28, C.line, C.surf);
    grid.position.y = 0.01;
    R.add(grid);

    // Lo recorrido
    const PP = [V(-8.2, 0, 3.6), V(-7, 0, 1.2), V(-5.6, 0, -1.0), V(-3.8, 0, -2.6), V(-1.8, 0, -3.6), V(0.3, 0, -4.1)];
    PP.forEach((p, i) => {
      add(R, cyl(0.45, 0.45, 0.12, 32), E(C.lime, 0.6), p.x, 0.06, p.z);
      ctx.label(String(i + 1), "tag mini", [p.x, 0.75, p.z]);
    });
    const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(PP.map((p) => p.clone().setY(0.08))), 80, 0.05, 8);
    add(R, tube, E(C.lime, 0.5));
    ctx.label("lo recorrido", "tag ok", [-5.6, 1.4, -1.0]);
    const pathLabels = ctx.labelsSince();

    // Islas por explorar
    const IS = [V(2.6, 0, 3.6), V(5.6, 0, 2.4), V(7.8, 0, -0.2), V(6.2, 0, -3.2), V(3.0, 0, -1.2)];
    const NAMES = ["Evals", "Entrevista inicial", "Más control", "Búsqueda por significado", "Coste"];
    const icons = [
      (g, m) => { // balanza
        add(g, cyl(0.05, 0.05, 1.1, 8), m, 0, 0.55, 0);
        add(g, box(1.3, 0.06, 0.06), m, 0, 1.1, 0);
        [-0.6, 0.6].forEach((x) => { add(g, cyl(0.01, 0.01, 0.4, 4), m, x, 0.9, 0); add(g, cyl(0.26, 0.2, 0.05, 20), m, x, 0.7, 0); });
      },
      (g, m) => { // silla
        add(g, box(0.7, 0.08, 0.7), m, 0, 0.55, 0);
        add(g, box(0.7, 0.75, 0.08), m, 0, 0.95, -0.31);
        [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]].forEach(([x, z]) => add(g, box(0.07, 0.5, 0.07), m, x, 0.27, z));
      },
      (g, m) => { // botones
        [-0.45, 0, 0.45].forEach((x) => add(g, cyl(0.18, 0.18, 0.14, 24), m, x, 0.35, 0));
        add(g, box(0.06, 0.16, 0.02), M(C.bg), -0.49, 0.43, 0.0).rotation.x = Math.PI / 2;
        add(g, box(0.06, 0.16, 0.02), M(C.bg), -0.41, 0.43, 0.0).rotation.x = Math.PI / 2;
      },
      (g, m) => { // lupa
        const lens = add(g, new THREE.TorusGeometry(0.34, 0.07, 10, 32), m, 0, 0.95, 0);
        lens.rotation.y = 0.4;
        add(g, cyl(0.06, 0.06, 0.6, 8), m, 0.32, 0.45, 0).rotation.z = 0.7;
      },
      (g, m) => { // monedas
        [0, 1, 2, 3].forEach((i) => add(g, cyl(0.3, 0.3, 0.08, 28), m, (i % 2) * 0.05, 0.2 + i * 0.09, 0));
        add(g, cyl(0.3, 0.3, 0.08, 28), m, 0.55, 0.2, 0.2);
      },
    ];
    const islands = IS.map((p, i) => {
      const g = group(R, p.x, 0, p.z);
      add(g, cyl(1.0, 1.0, 0.25, 6), M(C.surf2), 0, 0.12, 0);
      const ring = add(g, new THREE.TorusGeometry(1.02, 0.03, 6, 6), E(C.lime, 0.8), 0, 0.26, 0);
      ring.rotation.x = Math.PI / 2;
      ring.rotation.z = Math.PI / 6;
      ring.userData.s = 0;
      ring.scale.setScalar(1e-4);
      const iconG = group(g, 0, 0.25, 0);
      const mat = M(C.dim);
      icons[i](iconG, mat);
      const fog = glow(g, 4.2, 0xa6afbc, 0.5);
      fog.position.y = 1.0;
      fog.material.blending = THREE.NormalBlending;
      return { g, ring, iconG, mat, fog, label: ctx.label(NAMES[i], "tag", [p.x, 2.1, p.z]) };
    });

    // A2A
    const gym = group(R, -1.6, 4.4, 4.6);
    const gymCore = makeCore(gym, 0.45);
    const cart = group(R, 4.6, 3.4, 4.6);
    const cartLines = new THREE.LineSegments(new THREE.EdgesGeometry(box(1.1, 0.7, 0.75)), new THREE.LineBasicMaterial({ color: C.text }));
    cartLines.position.y = 0.45;
    cart.add(cartLines);
    add(cart, box(1.1, 0.03, 0.75), M(C.line), 0, 0.1, 0);
    [[-0.4, -0.3], [0.4, -0.3], [-0.4, 0.3], [0.4, 0.3]].forEach(([x, z]) => add(cart, cyl(0.1, 0.1, 0.06, 16), M(C.muted), x, -0.05, z).rotation.x = Math.PI / 2);
    add(cart, cyl(0.03, 0.03, 0.6, 6), M(C.muted), -0.75, 0.9, 0).rotation.z = 0.6;
    const cartCore = add(cart, sphere(0.22), E(C.text, 0.6), 0, 1.35, 0);
    glow(cart, 1.6, C.text, 0.35).position.y = 1.35;
    const broccoli = group(cart, 0, 0.45, 0);
    add(broccoli, cyl(0.06, 0.08, 0.35, 8), M(0x7fb069), 0, 0, 0);
    [[0, 0.25, 0], [0.13, 0.2, 0.05], [-0.13, 0.2, -0.04], [0.04, 0.22, -0.13], [-0.05, 0.23, 0.13]].forEach((p) => add(broccoli, sphere(0.13, 12), M(0x3f7d3a, { roughness: 0.9 }), ...p));
    const a2aBeam = makeBeam(R);
    const pk = [makePacket(R), makePacket(R, C.text)];
    const G0 = V(-1.6, 4.4, 4.6), G1 = V(4.6, 4.75, 4.6);
    const a2aTag = ctx.label("A2A", "tag ok", [1.5, 5.15, 4.6]);
    const cartAsk = ctx.label("¿Calorías? ¿Proteína? ¿Gustos?", "bubble", [4.6, 5.8, 4.6]);
    const gymAnswer = ctx.label("2.200 kcal · 140 g proteína · sin brócoli", "bubble ok-b", [-1.6, 5.6, 4.6]);

    let pa = 0;
    return function update(s, dt, t, since) {
      pathLabels.forEach((l) => { l.on = !s.a2a; });
      islands.forEach((x, i) => {
        const lit = (s.lit || 0) > i;
        x.fog.material.opacity = damp(x.fog.material.opacity, lit ? 0 : 0.5, 3, dt);
        scaleTo(x.ring, lit ? 1 : 0, dt, 5);
        colorTo(x.mat, lit ? C.text : C.dim, dt, 4);
        x.iconG.rotation.y = lit ? Math.sin(t * 0.6 + i) * 0.3 : 0;
        x.label.on = lit && !s.a2a;
      });
      scaleTo(gym, s.a2a ? 1 : 0, dt, 4);
      scaleTo(cart, s.a2a ? 1 : 0, dt, 4);
      gymCore.update(1, dt, t);
      cartCore.rotation.y = t;
      pa = damp(pa, s.a2a ? 1 : 0, 2, dt);
      a2aBeam.set(G0, G1, s.a2a ? smooth((since("a2a") - 0.6) / 0.8) : 0);
      a2aTag.on = s.a2a && since("a2a") > 1.2;
      const kc = s.cart ? since("cart") : 0;
      pk[0].visible = !!s.cart && kc < 1.6;
      pk[0].position.lerpVectors(G1, G0, smooth(kc / 1.4));
      pk[1].visible = !!s.cart && kc > 1.6 && kc < 3.2;
      pk[1].position.lerpVectors(G0, G1, smooth((kc - 1.7) / 1.4));
      cartAsk.on = !!s.cart && !s.broccoli;
      gymAnswer.on = s.cart && kc > 1.7;

      if (s.broccoli) {
        const k = since("broccoli");
        const p = smooth(k / 1.4);
        broccoli.position.set(2.6 * p, 0.45 + Math.sin(p * Math.PI) * 2.2 - 1.3 * p, 1.4 * p);
        broccoli.rotation.set(p * 5, p * 3, 0);
        broccoli.scale.setScalar(Math.max(1 - smooth((k - 1.1) / 0.5), 1e-3));
        broccoli.visible = k < 1.7;
      } else {
        broccoli.position.set(0, 0.45, 0);
        broccoli.rotation.set(0, 0, 0);
        broccoli.scale.setScalar(1);
        broccoli.visible = true;
      }
    };
  };

  window.WORLD = WORLD;
  window.WORLD_COLORS = C;
})();
