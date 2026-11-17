(() => {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const root = document.documentElement;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const LINKEDIN_URL = "https://www.linkedin.com/in/william-wo-535298276";

  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
  const seg = (t, a, b) => ease((t - a) / (b - a));
  const rng = (seed) => () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  const hash = (a, b, c) => { const x = Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453; return x - Math.floor(x); };
  const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));

  /* ---------- Palettes ---------- */
  // Every colour is light enough to carry ink text, so any of them can back a plate.
  const PALETTES = [
    ["#ff5a36", "#ffd60a", "#5b8cff", "#ff9fcf"],
    ["#2fd6a3", "#ffb59e", "#c4a4ff", "#f1ee4b"],
    ["#ff7ab6", "#ff8a1f", "#49c6ff", "#d3ee4a"],
    ["#f2f2ee", "#ffd60a", "#b9b9b4", "#ff5a36"],
  ];
  let paletteIndex = 0;
  const hexToRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);

  function applyPalette(i) {
    paletteIndex = i % PALETTES.length;
    PALETTES[paletteIndex].forEach((c, k) => root.style.setProperty(`--c${k + 1}`, c));
    const meta = $('meta[name="theme-color"]');
    if (meta) meta.content = PALETTES[paletteIndex][0];
    paint && paint.setPalette(PALETTES[paletteIndex]);
  }

  /* ---------- Paint: posterised, domain-warped noise that the pointer stirs ---------- */
  const FRAG = `
#ifdef GL_OES_standard_derivatives
#extension GL_OES_standard_derivatives : enable
#endif
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uScroll;
uniform vec2 uMouse;
uniform float uSwirl;
uniform vec3 uPal[4];
uniform vec4 uSplash[8];

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.03 + vec2(13.7, 7.1); a *= 0.5; }
  return v;
}
vec3 pal(float i) {
  if (i < 0.5) return uPal[0];
  if (i < 1.5) return uPal[1];
  if (i < 2.5) return uPal[2];
  return uPal[3];
}
void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  // Ripples: rings travel out from each splash, bending the paint under them like a pool surface.
  float shade = 0.0;
  vec2 bend = vec2(0.0);
  for (int i = 0; i < 8; i++) {
    float age = uTime - uSplash[i].z;
    if (age > 0.0 && age < 3.6) {
      vec2 rd = p - (uSplash[i].xy + vec2(0.0, uScroll));
      float rr = length(rd);
      float behind = age * 0.34 - rr;
      float env = smoothstep(-0.015, 0.03, behind) * exp(-max(behind, 0.0) * 4.5) * exp(-age * 0.8) * uSplash[i].w;
      float wv = sin(behind * 58.0) * env;
      bend += (rd / max(rr, 0.001)) * wv * 0.045;
      shade += wv;
    }
  }
  p += bend;
  vec2 d = p - uMouse;
  float r = length(d);
  float a = uSwirl * exp(-r * r * 7.0);
  float ca = cos(a), sa = sin(a);
  p = uMouse + mat2(ca, -sa, sa, ca) * d;
  p.y -= uScroll * 0.35;

  float t = uTime;
  vec2 q = vec2(fbm(p * 1.3 + t * 0.05), fbm(p * 1.3 + vec2(5.2, 1.3) - t * 0.04));
  vec2 w = vec2(fbm(p + 3.0 * q + vec2(1.7, 9.2) + t * 0.07), fbm(p + 3.0 * q + vec2(8.3, 2.8) - t * 0.05));
  float v = fbm(p * 0.9 + 2.6 * w);

  float bands = v * 9.0 + t * 0.05;
  float i0 = mod(floor(bands), 4.0);
  float f = fract(bands);

  // Mixing: the upper part of every band bleeds into the next colour along fine, stirred streaks,
  // so between any two paints there is a marbled zone of in-between hues.
  float grain = fbm(p * 5.0 + 4.0 * w + vec2(t * 0.03, 0.0));
  float blend = smoothstep(0.38, 1.0, f + 0.42 * (grain - 0.5));
  vec3 base = pal(i0), next = pal(mod(i0 + 1.0, 4.0));
  vec3 col = mix(base, next, blend * 0.85);
  // Mixed paint goes a little deeper and more saturated than either parent, as real pigment does.
  float mixed = sin(blend * 3.14159);
  col = mix(vec3(dot(col, vec3(0.3, 0.59, 0.11))), col, 1.0 + 0.7 * mixed);
  col *= 1.0 - 0.05 * mixed;

  // Range: threads of pale, thinned paint and of dense, dark pigment run through everything.
  float pale = smoothstep(0.58, 0.8, fbm(p * 2.6 + 5.0 * q + vec2(9.1, 3.3)));
  float dense = smoothstep(0.6, 0.85, fbm(p * 3.4 - 4.0 * w + vec2(2.7, 8.4)));
  col = mix(col, mix(col, vec3(1.0), 0.55), pale * 0.6);
  col = mix(col, col * vec3(0.74, 0.66, 0.86), dense * 0.42);

  // Depth: a slow, broad field of shallows and deeps. Deep paint is darker and cooler.
  float depth = fbm(p * 0.55 + 1.4 * q - vec2(t * 0.015, t * 0.01));
  float deep = smoothstep(0.62, 0.22, depth);
  col = mix(col, col * vec3(0.6, 0.55, 0.8), deep * 0.42);
  col *= 1.0 + 0.12 * smoothstep(0.45, 0.8, depth);

  // The surface is lit as wet paint: band edges and ripples catch the light.
  float surf = v * 2.4 + 0.25 * shade;
#ifdef GL_OES_standard_derivatives
  vec2 slope = vec2(dFdx(surf), dFdy(surf)) * uRes.y * 0.022;
  vec3 n = normalize(vec3(-slope, 1.0));
  vec3 l = normalize(vec3(-0.45, 0.6, 0.66));
  float diff = dot(n, l) - l.z;
  col *= 1.0 + 0.42 * diff;
  float spec = pow(max(dot(n, normalize(l + vec3(0.0, 0.0, 1.0))), 0.0), 60.0);
  col += 0.38 * smoothstep(0.86, 1.0, spec) * (1.0 - 0.6 * deep);
#endif
  // Each band still sits on the one below like cut paper: a soft shadow just inside its lower edge.
  col *= 1.0 - 0.13 * smoothstep(0.14, 0.0, f) * (1.0 - blend);
  col *= 1.0 + 0.3 * clamp(shade, -1.2, 0.0);
  col = mix(col, vec3(1.0), 0.3 * clamp(shade, 0.0, 1.2));
  col = mix(vec3(dot(col, vec3(0.3, 0.59, 0.11))), col, 1.15);
  col += (hash(gl_FragCoord.xy + fract(t) * 91.0) - 0.5) * 0.05;
  gl_FragColor = vec4(col, 1.0);
}`;

  function initPaint() {
    const canvas = $(".paint");
    const gl = canvas.getContext("webgl", { antialias: false, alpha: false, powerPreference: "low-power" });
    if (!gl) { root.classList.add("no-gl"); return null; }
    gl.getExtension("OES_standard_derivatives");

    const compile = (type, src) => {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
      return sh;
    };
    let prog;
    try {
      prog = gl.createProgram();
      gl.attachShader(prog, compile(gl.VERTEX_SHADER, "attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }"));
      gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    } catch (err) {
      console.error(err);
      root.classList.add("no-gl");
      return null;
    }
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.bindAttribLocation(prog, 0, "p");
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    const U = {};
    ["uRes", "uTime", "uScroll", "uMouse", "uSwirl", "uPal", "uSplash"].forEach((n) => (U[n] = gl.getUniformLocation(prog, n)));

    const palNow = new Float32Array(12);
    const palTo = new Float32Array(12);
    const splashes = new Float32Array(32).fill(-99);
    const splashListeners = new Set();
    let splashAt = 0;
    const mouse = { x: 0, y: 0, tx: 0, ty: 0, swirl: 0, angle: 0 };
    let visible = true, running = false, t0 = performance.now(), last = t0;

    const toShader = (x, y) => [(x - innerWidth / 2) / innerHeight, (innerHeight / 2 - y) / innerHeight];

    function resize() {
      const dpr = Math.min(devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(innerWidth * dpr);
      canvas.height = Math.round(innerHeight * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
      draw();
    }

    function draw() {
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const k = 1 - Math.pow(0.001, dt);
      for (let i = 0; i < 12; i++) palNow[i] = lerp(palNow[i], palTo[i], reduce ? 1 : k * 0.6);
      mouse.x = lerp(mouse.x, mouse.tx, k * 0.5);
      mouse.y = lerp(mouse.y, mouse.ty, k * 0.5);
      mouse.swirl *= Math.pow(0.25, dt);
      mouse.angle = lerp(mouse.angle, mouse.swirl, k);

      gl.uniform2f(U.uRes, canvas.width, canvas.height);
      gl.uniform1f(U.uTime, reduce ? 12 : (now - t0) / 1000);
      gl.uniform1f(U.uScroll, scrollY / innerHeight);
      gl.uniform2f(U.uMouse, mouse.x, mouse.y);
      gl.uniform1f(U.uSwirl, mouse.angle);
      gl.uniform3fv(U.uPal, palNow);
      gl.uniform4fv(U.uSplash, splashes);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    function loop() {
      if (!visible || reduce || document.hidden) { running = false; return; }
      draw();
      requestAnimationFrame(loop);
    }
    const start = () => { if (!running && visible && !reduce) { running = true; last = performance.now(); requestAnimationFrame(loop); } };

    const seen = new Set();
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => (e.isIntersecting ? seen.add(e.target) : seen.delete(e.target)));
      visible = seen.size > 0;
      start();
    });
    $$("[data-paint]").forEach((el) => io.observe(el));
    document.addEventListener("visibilitychange", start);
    addEventListener("resize", resize);

    addEventListener("pointermove", (e) => {
      const [x, y] = toShader(e.clientX, e.clientY);
      const speed = Math.hypot(x - mouse.tx, y - mouse.ty);
      mouse.swirl = clamp(mouse.swirl + speed * 14 * Math.sign(x - mouse.tx || 1), -3.2, 3.2);
      mouse.tx = x; mouse.ty = y;
    }, { passive: true });

    function splash(clientX, clientY, strength = 1) {
      const [x, y] = toShader(clientX, clientY);
      const i = (splashAt++ % 8) * 4;
      splashes[i] = x;
      splashes[i + 1] = y - scrollY / innerHeight;
      splashes[i + 2] = (performance.now() - t0) / 1000;
      splashes[i + 3] = strength;
      splashListeners.forEach((listen) => listen(clientX, clientY, strength));
    }
    $$("[data-paint]").forEach((el) =>
      el.addEventListener("pointerdown", (e) => { if (!e.target.closest("a, button, .ch, .floatie, .contact-letter")) splash(e.clientX, e.clientY, 1.4); })
    );

    const api = {
      onSplash(listen) { splashListeners.add(listen); },
      setPalette(hexes) {
        hexes.forEach((h, i) => palTo.set(hexToRgb(h), i * 3));
        if (palNow.every((v) => v === 0)) palNow.set(palTo);
        if (reduce) draw();
      },
      splash,
      resize,
    };
    return api;
  }

  const paint = initPaint();
  applyPalette(0);
  paint && paint.resize();

  $(".repaint").addEventListener("click", (e) => {
    applyPalette(paletteIndex + 1);
    const r = e.currentTarget.getBoundingClientRect();
    paint && paint.splash(r.left + r.width / 2, r.top + r.height / 2, 1.6);
  });

  /* ---------- Hero: the name floats in a pool of paint ----------
     Letters and pool floats are bodies on the surface, each built from circles so
     they collide properly at any angle. Every letter has a resting spot, a little
     off its place in the line and a little turned, that pulls it back gently. The
     floats have none and go where they like. Sweeping the pointer through the pool
     pushes things, poking a body dunks it and sends out a ripple, and anything can
     be dragged and thrown. */
  function initPool() {
    const hero = $(".hero"), name = $(".name");
    const physics = window.PoolPhysics;
    const letters = [];
    $$(".name-line").forEach((line) => {
      const text = line.textContent.trim();
      line.textContent = "";
      [...text].forEach((ch) => {
        const el = document.createElement("span");
        el.className = "ch";
        el.setAttribute("aria-hidden", "true");
        el.textContent = ch;
        line.append(el);
        letters.push({ el, ch, letter: true, i: letters.length });
      });
    });
    if (reduce) return null;

    const INK = "#0e0e10";
    const wedges = [0, 1, 2, 3, 4, 5].map((k) => {
      const a0 = (k / 6) * Math.PI * 2, a1 = ((k + 1) / 6) * Math.PI * 2;
      const pt = (a) => `${(50 + 46 * Math.cos(a)).toFixed(2)} ${(50 + 46 * Math.sin(a)).toFixed(2)}`;
      return `<path d="M50 50L${pt(a0)}A46 46 0 0 1 ${pt(a1)}Z" style="fill:${k % 2 ? "#fff" : `var(--c${(k / 2) + 1})`}"/>`;
    }).join("");
    const FLOATIES = [
      { cls: "flamingo", w: 1.25, h: 1.5625, cx: 0.5, cy: 2 / 3, rad: 0.5, at: [0.2, 0.84],
        parts: [{ x: 0.14, y: -0.45, rad: 0.18 }, { x: 0.29, y: -0.71, rad: 0.18 }, { x: 0.12, y: -0.84, rad: 0.16 }, { x: -0.12, y: -0.66, rad: 0.15 }],
        svg: `<svg viewBox="0 0 120 150">
        <circle cx="60" cy="100" r="34" fill="none" stroke="${INK}" stroke-width="28"/>
        <circle cx="60" cy="100" r="34" fill="none" stroke="#ff7ab8" stroke-width="22"/>
        <path d="M33 112q8 14 22 17M87 112q-8 14-22 17" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>
        <path d="M60 72C60 46 88 48 88 28C88 10 64 8 60 24" fill="none" stroke="${INK}" stroke-width="23" stroke-linecap="round"/>
        <path d="M60 72C60 46 88 48 88 28C88 10 64 8 60 24" fill="none" stroke="#ff7ab8" stroke-width="17" stroke-linecap="round"/>
        <path d="M54 22L40 44L64 32Z" fill="#fff" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
        <path d="M40 44L46 34L52 38Z" fill="${INK}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
        <circle cx="66" cy="20" r="2.8" fill="${INK}"/></svg>` },
      { cls: "ring", w: 1, h: 1, cx: 0.5, cy: 0.5, rad: 0.48, at: [0.9, 0.14], svg: `<svg viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="33" fill="none" stroke="${INK}" stroke-width="30"/>
        <circle cx="50" cy="50" r="33" fill="none" stroke="#fff" stroke-width="24"/>
        <circle cx="50" cy="50" r="33" fill="none" stroke="#ff3d2e" stroke-width="24" stroke-dasharray="25.92 25.92"/></svg>` },
      { cls: "ball", w: 0.8, h: 0.8, cx: 0.5, cy: 0.5, rad: 0.37, at: [0.3, 0.1], svg: `<svg viewBox="0 0 100 100">
        <g stroke="${INK}" stroke-width="2.5" stroke-linejoin="round">${wedges}</g>
        <circle cx="50" cy="50" r="46" fill="none" stroke="${INK}" stroke-width="4"/>
        <circle cx="50" cy="50" r="8" fill="#fff" stroke="${INK}" stroke-width="3"/></svg>` },
    ];

    // Socials float in the pool too. They are real links: a click or tap opens them, a drag does not.
    const GH = "M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12";
    const disc = (fill, inner) => `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="${fill}" stroke="${INK}" stroke-width="5"/>${inner}</svg>`;
    const SOCIALS = [
      { cls: "github", href: "https://github.com/FuriousZen", label: "GitHub: FuriousZen", at: [0.74, 0.1],
        svg: disc("#fff", `<path transform="translate(14 14) scale(3)" fill="${INK}" d="${GH}"/>`) },
      { cls: "gmail", href: "mailto:william.wo2006@gmail.com", label: "Email: william.wo2006@gmail.com", at: [0.42, 0.88],
        svg: disc("#fff", `<path d="M24 34h52v34H24z" fill="#fff" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><path d="M27 66V38l23 18 23-18v28" fill="none" stroke="#ea4335" stroke-width="8" stroke-linejoin="round" stroke-linecap="round"/>`) },
      { cls: "linkedin", href: LINKEDIN_URL, label: "LinkedIn", at: [0.08, 0.5],
        svg: disc("#0a66c2", `<path fill="#fff" d="M28 42h11v32H28zM33.500 26a6.500 6.500 0 1 1 0 13 6.500 6.500 0 0 1 0-13zM46 42h10.500v4.500c2-3.300 5.500-5.500 10.500-5.500 9 0 11 6 11 14v19H67V57c0-4-1-7-5-7s-5.500 3-5.500 7v17H46z"/>`) },
    ].filter((d) => d.href);
    SOCIALS.forEach((d) => FLOATIES.push({ w: 0.93, h: 0.93, cx: 0.5, cy: 0.5, rad: 0.445, ...d }));

    const layer = document.createElement("div");
    layer.className = "pool";
    hero.prepend(layer);
    // Every letter's extrusion is a twin drawn in this lower layer, so it falls on the paint and
    // under the other letters and floats instead of across their faces.
    root.classList.add("has-pool");
    letters.forEach((b) => {
      b.shade = document.createElement("span");
      b.shade.className = "shade";
      b.shade.textContent = b.ch;
      b.ex = b.ey = 0; b.sx = b.sy = 99;
      layer.append(b.shade);
    });
    const floaties = FLOATIES.map((def, k) => {
      const el = document.createElement(def.href ? "a" : "div");
      if (def.href) {
        el.href = def.href;
        el.setAttribute("aria-label", def.label);
        el.draggable = false;
        if (!def.href.startsWith("mailto:")) { el.target = "_blank"; el.rel = "noopener"; }
      } else el.setAttribute("aria-hidden", "true");
      el.className = `floatie floatie-${def.cls}`;
      el.innerHTML = def.svg;
      el.style.transformOrigin = `${def.cx * 100}% ${def.cy * 100}%`;
      layer.append(el);
      return { el, def, i: letters.length + k };
    });
    const bodies = [...letters, ...floaties];
    const RAD = Math.PI / 180;
    const t0 = performance.now() + 250;
    bodies.forEach((b) => {
      const r0 = b.letter ? (b.i % 2 ? 1 : -1) * (4 + 8 * hash(b.i, 3, 7)) : (hash(b.i, 3, 7) - 0.5) * 60;
      Object.assign(b, { x: 0, y: 0, vx: 0, vy: 0, r: r0, r0, vr: 0, z: 1, vz: 0, m: 1, size: 1, circles: [],
        s: hash(b.i, 9, 4) * 40, held: false, moved: 0, cool: 0, live: false,
        start: t0 + (b.letter ? b.i * 80 : 800 + b.i * 60) });
    });

    let E = 100, W = 1, H = 1, S = 100;
    function measure() {
      E = parseFloat(getComputedStyle(name).fontSize) || 100;
      W = hero.clientWidth; H = hero.clientHeight;
      letters.forEach((b) => {
        const w = b.el.offsetWidth, h = b.el.offsetHeight;
        const lx = name.offsetLeft + b.el.offsetLeft + w / 2, ly = name.offsetTop + b.el.offsetTop + h / 2;
        const hx = lx + (hash(b.i, 1, 1) - 0.5) * E * 0.08;
        const hy = ly + (b.i % 2 ? 1 : -1) * E * (0.03 + 0.07 * hash(b.i, 2, 2));
        if (b.hx === undefined) { b.x = hx; b.y = hy; } else { b.x += hx - b.hx; b.y += hy - b.hy; }
        b.hx = hx; b.hy = hy; b.lx = lx; b.ly = ly;
        b.shade.style.fontSize = `${E}px`;
        b.shade.style.left = `${lx - w / 2}px`; b.shade.style.top = `${ly - h / 2}px`;
        // The inked part of the glyph: lowercase without an ascender only fills the lower part of its box.
        const top = "amo".includes(b.ch) ? 0.27 : 0.02;
        const iw = w * 0.92, ih = h * (0.98 - top), cy = ((top + 0.98) / 2 - 0.5) * h;
        b.circles = [];
        if (iw >= ih) {
          const rad = ih / 2, n = Math.max(1, Math.ceil((iw / ih) * 1.4));
          for (let k = 0; k < n; k++) b.circles.push({ x: n === 1 ? 0 : lerp(-iw / 2 + rad, iw / 2 - rad, k / (n - 1)), y: cy, rad });
        } else {
          const rad = iw / 2, n = Math.max(2, Math.ceil((ih / iw) * 1.4));
          for (let k = 0; k < n; k++) b.circles.push({ x: 0, y: cy + lerp(-ih / 2 + rad, ih / 2 - rad, k / (n - 1)), rad });
        }
        b.box = physics.letterBox(b.ch, w, h, E);
        b.size = physics.radius(b);
        b.m = Math.max(0.3, (iw * ih) / (E * E));
      });
      S = clamp(E * 0.62, 70, 200);
      floaties.forEach((b, i) => {
        b.el.style.width = `${S * b.def.w}px`; b.el.style.height = `${S * b.def.h}px`;
        b.m = 0.2;
        b.circles = [{ x: 0, y: 0, rad: S * b.def.rad }, ...(b.def.parts || []).map((p) => ({ x: p.x * S, y: p.y * S, rad: p.rad * S }))];
        b.size = physics.radius(b);
        if (!b.placed) { b.x = b.def.at[0] * W; b.y = b.def.at[1] * H; b.placed = true; }
        physics.settle(b, [...letters, ...floaties.slice(0, i)], W, H);
      });
      bodies.forEach(place);
    }

    function place(b) {
      const sc = physics.visualScale(b).toFixed(3);
      const dx = b.letter ? b.x - b.lx : b.x - S * b.def.w * b.def.cx, dy = b.letter ? b.y - b.ly : b.y - S * b.def.h * b.def.cy;
      b.el.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) rotate(${b.r.toFixed(2)}deg) scale(${sc})`;
      if (b.shade) b.shade.style.transform = b.el.style.transform;
    }

    // Ripples are kept here too, in hero coordinates, so the bodies can ride the same rings the shader draws.
    const ripples = [];
    const addRipple = (clientX, clientY, s) => {
      const hr = hero.getBoundingClientRect();
      ripples.push({ x: clientX - hr.left, y: clientY - hr.top, t: performance.now() / 1000, s });
      if (ripples.length > 8) ripples.shift();
      wake();
    };
    if (paint) paint.onSplash(addRipple);
    const drop = (x, y, s) => (paint ? paint.splash(x, y, s) : addRipple(x, y, s));

    // The same wave the shader draws, evaluated at one point: surface height, its slope, and the
    // outward surge carried by each ring. Bodies slide down the slope, get carried by the surge,
    // and rise and fall with the height.
    const F = { h: 0, gx: 0, gy: 0, px: 0, py: 0 };
    const SPAN = [{ x: -0.7, y: 0 }, { x: 0.7, y: 0 }];
    function field(x, y, t) {
      F.h = F.gx = F.gy = F.px = F.py = 0;
      const vh = innerHeight;
      for (const rp of ripples) {
        const age = t - rp.t;
        if (age <= 0) continue;
        const rx = (x - rp.x) / vh, ry = (y - rp.y) / vh, r = Math.hypot(rx, ry) || 1e-4;
        const behind = age * 0.34 - r;
        if (behind < -0.015 || behind > 1.1) continue;
        const rise = clamp((behind + 0.015) / 0.045);
        const env = rise * rise * (3 - 2 * rise) * Math.exp(-4.5 * Math.max(behind, 0)) * Math.exp(-0.8 * age) * rp.s;
        const ph = behind * 58, slope = -58 * Math.cos(ph) * env;
        F.h += Math.sin(ph) * env;
        F.gx += (slope * rx) / r; F.gy += (slope * ry) / r;
        F.px += (env * rx) / r; F.py += (env * ry) / r;
      }
    }

    function plunge(b, strength, now) {
      if (!b.live || now < b.cool) return;
      b.cool = now + 650;
      b.vz += 2.6 * strength;
      const hr = hero.getBoundingClientRect();
      drop(hr.left + b.x, hr.top + b.y, strength);
    }

    bodies.forEach((b) => {
      let gx = 0, gy = 0, lastT = 0;
      b.el.addEventListener("pointerdown", (e) => {
        if (e.pointerType === "touch" || e.button !== 0 || !b.live) return;
        e.preventDefault();
        try { b.el.setPointerCapture(e.pointerId); } catch (err) { /* synthetic pointers cannot be captured */ }
        const hr = hero.getBoundingClientRect();
        b.held = true; b.moved = 0;
        gx = b.x - (e.clientX - hr.left); gy = b.y - (e.clientY - hr.top);
        b.vx = b.vy = b.vr = 0; lastT = e.timeStamp;
        b.el.classList.add("is-held");
        // Taking hold of something pushes it into the paint: the ripple starts here, not on release.
        b.grabbed = true; b.cool = 0;
        plunge(b, 1.3, performance.now());
        wake();
      });
      b.el.addEventListener("pointermove", (e) => {
        if (!b.held) return;
        const hr = hero.getBoundingClientRect();
        b.tx = e.clientX - hr.left + gx; b.ty = e.clientY - hr.top + gy;
        b.moved += Math.abs(e.movementX || 0) + Math.abs(e.movementY || 0) + 0.01;
        lastT = e.timeStamp;
      });
      const release = (e) => {
        if (!b.held) return;
        b.held = false; b.tx = undefined;
        b.el.classList.remove("is-held");
        const cap = b.letter ? 900 : 1500, sp = Math.hypot(b.vx, b.vy);
        if (sp > cap) { b.vx *= cap / sp; b.vy *= cap / sp; }
      };
      b.el.addEventListener("pointerup", release);
      b.el.addEventListener("pointercancel", release);
      b.el.addEventListener("click", (e) => {
        const grabbed = b.grabbed;
        b.grabbed = false;
        if (b.moved > 6) { b.moved = 0; e.preventDefault(); return; }
        // A mouse press has already made its ripple on the way down. A tap or keyboard activation has not.
        if (grabbed) return;
        b.cool = 0;
        plunge(b, 1.3, performance.now());
      });
    });

    // One contact between two bodies: push them apart, bounce, and let an off-centre hit turn them.
    function resolve(a, b, ia, ib, nx, ny, pen, cx, cy) {
      const tot = ia + ib;
      a.x -= nx * pen * 0.85 * (ia / tot); a.y -= ny * pen * 0.85 * (ia / tot);
      b.x += nx * pen * 0.85 * (ib / tot); b.y += ny * pen * 0.85 * (ib / tot);
      const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (rv >= 0) return;
      const j = (-1.45 * rv) / tot;
      a.vx -= j * ia * nx; a.vy -= j * ia * ny;
      b.vx += j * ib * nx; b.vy += j * ib * ny;
      const turn = (body, inv, sign) => {
        if (!inv) return;
        const cross = (cx - body.x) * ny - (cy - body.y) * nx;
        body.vr += clamp((sign * cross * j * inv * 28) / (body.size * body.size), -90, 90);
      };
      turn(a, ia, -1); turn(b, ib, 1);
    }
    function collide(a, b) {
      const ia = a.held ? 0 : 1 / a.m, ib = b.held ? 0 : 1 / b.m;
      if (!ia && !ib) return;
      const hit = physics.contact(a, b);
      if (hit) resolve(a, b, ia, ib, hit.nx, hit.ny, hit.depth, hit.x, hit.y);
    }
    const ptr = { x: 0, y: 0, vx: 0, vy: 0, t: 0, on: false };
    hero.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse") return;
      const hr = hero.getBoundingClientRect();
      const x = e.clientX - hr.left, y = e.clientY - hr.top;
      if (ptr.on) {
        const dt = clamp((e.timeStamp - ptr.t) / 1000, 0.008, 0.1);
        ptr.vx = lerp(ptr.vx, clamp((x - ptr.x) / dt, -1600, 1600), 0.4);
        ptr.vy = lerp(ptr.vy, clamp((y - ptr.y) / dt, -1600, 1600), 0.4);
      }
      ptr.x = x; ptr.y = y; ptr.t = e.timeStamp; ptr.on = true;
    });
    hero.addEventListener("pointerleave", () => { ptr.on = false; ptr.vx = ptr.vy = 0; });

    let visible = true, running = false, last = 0;
    function step(dt, now) {
      const t = now / 1000, reach = 0.5 * E;
      const stir = Math.hypot(ptr.vx, ptr.vy);
      bodies.forEach((b) => {
        if (now < b.start) return;
        if (!b.live) {
          b.live = true;
          if (b.letter && b.i % 3 === 0) { const hr = hero.getBoundingClientRect(); drop(hr.left + b.x, hr.top + b.y, 0.7); }
        }
        b.vz += (-70 * b.z - 8 * b.vz) * dt;
        b.z += b.vz * dt;
        if (b.held) {
          // A held body is carried toward the pointer rather than teleported, so it shoves what is in its way.
          if (b.tx !== undefined) {
            const cap = b.letter ? 1400 : 2000;
            b.vx = clamp((b.tx - b.x) / Math.max(dt, 0.008) * 0.5, -cap, cap);
            b.vy = clamp((b.ty - b.y) / Math.max(dt, 0.008) * 0.5, -cap, cap);
            b.x += b.vx * dt; b.y += b.vy * dt;
          }
          return;
        }
        const A = (b.letter ? 0.12 : 0.34) * E;
        let ax = A * 0.5 * (Math.sin(t * 0.37 + b.s) + Math.sin(t * 0.83 + b.s * 2.3));
        let ay = A * 0.5 * (Math.sin(t * 0.31 + b.s * 1.7) + Math.sin(t * 0.71 + b.s * 3.1));
        let ar = (b.letter ? 16 : 34) * Math.sin(t * 0.5 + b.s * 4.1);
        if (b.letter) {
          const dx = b.x - b.hx, dy = b.y - b.hy, d = Math.hypot(dx, dy), R = E * 0.22;
          ax -= 3.2 * dx; ay -= 3.2 * dy;
          if (d > R) { const k2 = (30 * (d - R)) / d; ax -= k2 * dx; ay -= k2 * dy; }
          // Rotation is free. A soft pull, as gentle as the one on position, turns the letter back the short way round.
          if (b.r - b.r0 > 180) b.r -= 360; else if (b.r - b.r0 < -180) b.r += 360;
          ar -= 4 * (b.r - b.r0);
        }
        // Sample the wave field at several points on the body. The mean force moves it; the
        // difference between the points turns it, the way a wave front swings a long float round.
        const pts = b.letter ? b.circles : SPAN;
        const cr = Math.cos(b.r * RAD), sr = Math.sin(b.r * RAD);
        const push = b.letter ? 1150 : 820, slide = b.letter ? 50 : 60;
        let wave = 0, torque = 0;
        for (const p of pts) {
          const ox = (p.x * cr - p.y * sr) * (b.letter ? 1 : b.size), oy = (p.x * sr + p.y * cr) * (b.letter ? 1 : b.size);
          field(b.x + ox, b.y + oy, t);
          const fx = push * F.px - slide * F.gx, fy = push * F.py - slide * F.gy;
          ax += fx / pts.length; ay += fy / pts.length;
          torque += (ox * fy - oy * fx) / pts.length;
          wave += F.h / pts.length;
        }
        ar += (torque / (b.size * b.size)) * 57.3 * (b.letter ? 5 : 2.2);
        b.wave = wave;
        if (ptr.on && stir > 20) {
          const dx = b.x - ptr.x, dy = b.y - ptr.y, d = Math.hypot(dx, dy) || 1;
          const f = Math.exp(-(d * d) / (reach * reach));
          if (f > 0.01) {
            const k = b.letter ? 2.2 : 2.8;
            ax += f * k * (ptr.vx + (dx / d) * stir * 0.6);
            ay += f * k * (ptr.vy + (dy / d) * stir * 0.6);
            ar += (f * k * 0.6 * (dx * ptr.vy - dy * ptr.vx)) / b.size;
          }
        }
        b.vx += ax * dt; b.vy += ay * dt; b.vr += ar * dt;
        const drag = Math.exp(-(b.letter ? 1.7 : 0.9) * dt), rdrag = Math.exp(-(b.letter ? 1.4 : 0.8) * dt);
        b.vx *= drag; b.vy *= drag; b.vr *= rdrag;
        const cap = b.letter ? 900 : 1500, sp = Math.hypot(b.vx, b.vy);
        if (sp > cap) { b.vx *= cap / sp; b.vy *= cap / sp; }
        b.vr = clamp(b.vr, -400, 400);
        b.x += b.vx * dt; b.y += b.vy * dt; b.r += b.vr * dt;
      });
      for (let pass = 0; pass < 5; pass++) {
        for (let i = 0; i < bodies.length; i++) {
          const a = bodies[i];
          if (!a.live) continue;
          for (let k = i + 1; k < bodies.length; k++) if (bodies[k].live) collide(a, bodies[k]);
          if (a.letter) continue;
          const edge = physics.bounds(a);
          if (edge.left < 0) { a.x -= edge.left; a.vx = Math.abs(a.vx) * 0.6; } else if (edge.right > W) { a.x -= edge.right - W; a.vx = -Math.abs(a.vx) * 0.6; }
          if (edge.top < 0) { a.y -= edge.top; a.vy = Math.abs(a.vy) * 0.6; } else if (edge.bottom > H) { a.y -= edge.bottom - H; a.vy = -Math.abs(a.vy) * 0.6; }
        }
      }
    }
    function frame(now) {
      if (!visible || document.hidden) { running = false; return; }
      const dt = Math.min(0.032, (now - last) / 1000 || 0.016);
      last = now;
      const t = now / 1000;
      for (let k = ripples.length - 1; k >= 0; k--) if (t - ripples[k].t > 3.6) ripples.splice(k, 1);
      step(dt / 2, now); step(dt / 2, now);
      const calm = Math.exp(-7 * dt);
      ptr.vx *= calm; ptr.vy *= calm;
      bodies.forEach(place);
      // The pointer is the light. Each letter throws its own extrusion directly away from it, longer the
      // further off it is, so letters either side of the pointer lean in opposite directions.
      letters.forEach((b) => {
        let tx = 0.085 * E, ty = 0.085 * E;
        if (ptr.on) {
          const dx = b.x - ptr.x, dy = b.y - ptr.y, d = Math.hypot(dx, dy) || 1;
          const len = (0.17 * E * d) / Math.hypot(d, 0.45 * E);
          tx = (dx / d) * len; ty = (dy / d) * len;
        }
        b.ex = lerp(b.ex, tx, 0.14); b.ey = lerp(b.ey, ty, 0.14);
        // The shade turns with its letter, so the offset is turned back to stay pointing the right way on screen.
        const c = Math.cos(-b.r * RAD), s = Math.sin(-b.r * RAD);
        const lx = b.ex * c - b.ey * s, ly = b.ex * s + b.ey * c;
        if (Math.abs(lx - b.sx) + Math.abs(ly - b.sy) > 0.25) {
          b.sx = lx; b.sy = ly;
          b.shade.style.setProperty("--ex", `${lx.toFixed(1)}px`);
          b.shade.style.setProperty("--ey", `${ly.toFixed(1)}px`);
        }
      });
      requestAnimationFrame(frame);
    }
    function wake() { if (!running && visible && !document.hidden) { running = true; last = performance.now(); requestAnimationFrame(frame); } }
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; wake(); }).observe(hero);
    document.addEventListener("visibilitychange", wake);

    return { measure };
  }
  const pool = initPool();

  /* ---------- Contact: buoyant type and a paper plane over the same paint ---------- */
  function initContact() {
    const section = $(".contact"), stage = $(".contact-stage"), word = $(".contact-word");
    if (!section || !stage || !word) return null;
    const plane = $(".contact-plane"), dock = $(".contact-plane-dock");
    const droplets = $(".contact-droplets");
    const letters = $$(".contact-letter").map((el, i) => ({ el, i, x: 0, y: 0, vx: 0, vy: 0, r: 0, vr: 0, hx: 0, hy: 0, held: false }));
    const pointer = { x: 0, y: 0, on: false };
    const ripples = [];
    let visible = false, entered = false, typeSize = 100, width = 1, height = 1, home = { x: 0, y: 0 }, flight = null;

    const copy = $(".contact-copy"), copyLabel = $("span", copy), copyStatus = $(".contact-copy-status");
    const emailLink = $(".contact-email > a");
    const email = emailLink.getAttribute("href").slice(7);
    let copyTimer;
    copy.hidden = false;
    copy.addEventListener("click", async () => {
      clearTimeout(copyTimer);
      try {
        await navigator.clipboard.writeText(email);
        copy.classList.add("is-copied");
        copyLabel.textContent = "Copied!";
        copyStatus.textContent = "Email address copied.";
      } catch {
        const range = document.createRange(), selection = getSelection();
        range.selectNodeContents(emailLink.firstElementChild);
        if (selection) { selection.removeAllRanges(); selection.addRange(range); }
        copyLabel.textContent = "Select";
        copyStatus.textContent = "Select and copy the email address, or click it to write to me.";
      }
      copyTimer = setTimeout(() => {
        copy.classList.remove("is-copied");
        copyLabel.textContent = "Copy";
        copyStatus.textContent = "";
      }, 5000);
    });

    function measure() {
      word.style.fontSize = "100px";
      const natural = letters.reduce((sum, b) => {
        const style = getComputedStyle(b.el);
        return sum + b.el.offsetWidth + parseFloat(style.marginLeft) + parseFloat(style.marginRight);
      }, 0);
      typeSize = Math.min(430, ((word.clientWidth - 24) * 90) / Math.max(1, natural));
      word.style.fontSize = `${typeSize.toFixed(1)}px`;
      const sr = stage.getBoundingClientRect(), wr = word.getBoundingClientRect(), dr = dock.getBoundingClientRect();
      width = stage.clientWidth; height = stage.clientHeight;
      home = { x: dr.left - sr.left + dr.width / 2, y: dr.top - sr.top + plane.offsetHeight / 2 };
      letters.forEach((b) => {
        b.hx = wr.left - sr.left + b.el.offsetLeft + b.el.offsetWidth / 2;
        b.hy = wr.top - sr.top + b.el.offsetTop + b.el.offsetHeight * 0.65;
      });
      flight = null;
      plane.style.transform = "";
      plane.classList.remove("is-flying");
    }

    function addRipple(clientX, clientY, strength) {
      if (!visible || reduce) return;
      const r = stage.getBoundingClientRect();
      const x = clientX - r.left, y = clientY - r.top;
      if (x < -100 || x > width + 100 || y < -160 || y > height + 160) return;
      ripples.push({ x, y, strength, t: performance.now() / 1000 });
      if (ripples.length > 8) ripples.shift();
    }
    if (paint) paint.onSplash(addRipple);
    const splash = (x, y, strength = 1) => paint ? paint.splash(x, y, strength) : addRipple(x, y, strength);

    function splatter(x, y, count = 14) {
      if (reduce) return;
      for (let i = 0; i < count; i++) {
        const drop = document.createElement("i"), angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
        const reach = 34 + Math.random() * Math.min(width * 0.16, 140);
        drop.className = "contact-drop";
        drop.style.cssText = `left:${x}px;top:${y}px;--size:${6 + Math.random() * 12}px;--dx:${Math.cos(angle) * reach}px;--dy:${Math.sin(angle) * reach + 25}px;--drop-color:var(--c${i % 4 + 1})`;
        drop.addEventListener("animationend", () => drop.remove(), { once: true });
        droplets.append(drop);
      }
      while (droplets.children.length > 70) droplets.firstElementChild.remove();
    }

    if (!reduce) {
      section.classList.add("has-contact-motion");
      dock.hidden = false;
      plane.hidden = false;
      letters.forEach((b) => {
        b.el.addEventListener("pointerdown", (e) => {
          if (e.button !== 0) return;
          b.vy -= typeSize * 0.8;
          splash(e.clientX, e.clientY, 1.2);
          if (e.pointerType !== "mouse") return;
          e.preventDefault();
          b.held = true;
          b.grabX = e.clientX; b.grabY = e.clientY; b.originX = b.x; b.originY = b.y;
          b.tx = b.x; b.ty = b.y;
          b.el.setPointerCapture(e.pointerId);
          b.el.classList.add("is-held");
        });
        b.el.addEventListener("pointermove", (e) => {
          if (!b.held) return;
          b.tx = clamp(b.originX + e.clientX - b.grabX, -typeSize * 0.4, typeSize * 0.4);
          b.ty = clamp(b.originY + e.clientY - b.grabY, -typeSize * 0.3, typeSize * 0.3);
        });
        const release = (e) => {
          if (!b.held) return;
          b.held = false;
          b.el.classList.remove("is-held");
          if (b.el.hasPointerCapture(e.pointerId)) b.el.releasePointerCapture(e.pointerId);
          const r = stage.getBoundingClientRect();
          splash(r.left + b.hx + b.x, r.top + b.hy + b.y, 0.9);
        };
        b.el.addEventListener("pointerup", release);
        b.el.addEventListener("pointercancel", release);
        b.el.addEventListener("lostpointercapture", release);
      });
      stage.addEventListener("pointermove", (e) => {
        if (e.pointerType !== "mouse") return;
        const r = stage.getBoundingClientRect();
        pointer.x = e.clientX - r.left; pointer.y = e.clientY - r.top; pointer.on = true;
      }, { passive: true });
      stage.addEventListener("pointerleave", () => { pointer.on = false; });
      plane.addEventListener("click", () => {
        if (flight) return;
        flight = { start: performance.now(), splashed: false };
        plane.classList.add("is-flying");
        const r = stage.getBoundingClientRect();
        splash(r.left + home.x, r.top + home.y, 1.2);
        splatter(home.x, home.y, 10);
      });
    }

    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      section.classList.toggle("is-contact-visible", visible);
      if (visible && !entered && !reduce) {
        entered = true;
        letters.forEach((b) => { b.y = (b.i % 2 ? -1 : 1) * typeSize * 0.09; b.vy = -typeSize * 0.3; });
      }
      if (!visible) {
        pointer.on = false;
        flight = null;
        plane.style.transform = "";
        plane.classList.remove("is-flying");
      }
    }).observe(section);

    const bezier = (t, a, b, c, d) => {
      const s = 1 - t;
      const x = s * s * s * a.x + 3 * s * s * t * b.x + 3 * s * t * t * c.x + t * t * t * d.x;
      const y = s * s * s * a.y + 3 * s * s * t * b.y + 3 * s * t * t * c.y + t * t * t * d.y;
      const dx = 3 * s * s * (b.x - a.x) + 6 * s * t * (c.x - b.x) + 3 * t * t * (d.x - c.x);
      const dy = 3 * s * s * (b.y - a.y) + 6 * s * t * (c.y - b.y) + 3 * t * t * (d.y - c.y);
      return { x, y, angle: Math.atan2(dy, dx) * 180 / Math.PI + 45 };
    };

    function update(dt, now) {
      if (reduce || !visible || document.hidden) return;
      const t = now / 1000;
      while (ripples.length && t - ripples[0].t > 3.6) ripples.shift();
      letters.forEach((b) => {
        if (b.held) {
          b.vx = (b.tx - b.x) * 14; b.vy = (b.ty - b.y) * 14;
        } else {
          let ax = -32 * b.x - 10 * b.vx;
          let ay = -32 * b.y - 10 * b.vy + Math.sin(t * 1.2 + b.i * 1.8) * typeSize * 0.35;
          let ar = -28 * b.r - 8 * b.vr + Math.sin(t * 0.9 + b.i) * 16;
          if (pointer.on) {
            const dx = b.hx + b.x - pointer.x, dy = b.hy + b.y - pointer.y, d = Math.hypot(dx, dy) || 1;
            const force = Math.exp(-d * d / (typeSize * typeSize * 0.3));
            ax += dx / d * force * typeSize * 5;
            ay += dy / d * force * typeSize * 5;
            ar += dx / d * force * 90;
          }
          ripples.forEach((r) => {
            const age = t - r.t, d = Math.hypot(b.hx - r.x, b.hy - r.y) / innerHeight;
            const behind = age * 0.34 - d;
            if (behind < 0 || behind > 1) return;
            const wave = Math.sin(behind * 58) * Math.exp(-behind * 4.5 - age * 0.8) * r.strength;
            ay += wave * typeSize * 7; ar += wave * 55;
          });
          b.vx += ax * dt; b.vy += ay * dt; b.vr += ar * dt;
        }
        b.x = clamp(b.x + b.vx * dt, -typeSize * 0.4, typeSize * 0.4);
        b.y = clamp(b.y + b.vy * dt, -typeSize * 0.3, typeSize * 0.3);
        b.r = clamp(b.r + b.vr * dt, -20, 20);
        b.el.style.setProperty("--float-x", `${b.x.toFixed(2)}px`);
        b.el.style.setProperty("--float-y", `${b.y.toFixed(2)}px`);
        b.el.style.setProperty("--float-r", `${b.r.toFixed(2)}deg`);
      });

      if (!flight) return;
      const progress = clamp((now - flight.start) / 2400), u = ease(progress);
      const turn = { x: width * 0.52, y: height * 0.12 };
      const point = u < 0.5
        ? bezier(u * 2, home, { x: width * 0.38, y: height * 0.9 }, { x: width * 0.1, y: height * 0.15 }, turn)
        : bezier((u - 0.5) * 2, turn, { x: width * 1.08, y: height * 0.05 }, { x: width * 0.5, y: height * 1.16 }, home);
      let angle = lerp(-12, point.angle, seg(progress, 0, 0.12));
      angle = lerp(angle, -12, seg(progress, 0.88, 1));
      plane.style.transform = `translate(${(point.x - home.x).toFixed(1)}px, ${(point.y - home.y).toFixed(1)}px) rotate(${angle.toFixed(1)}deg)`;
      if (progress > 0.38 && !flight.splashed) {
        flight.splashed = true;
        const r = stage.getBoundingClientRect();
        splash(r.left + point.x, r.top + point.y, 1);
        splatter(point.x, point.y, 10);
      }
      if (progress === 1) {
        flight = null;
        plane.style.transform = "";
        plane.classList.remove("is-flying");
        const r = stage.getBoundingClientRect();
        splash(r.left + home.x, r.top + home.y, 1.8);
        splatter(home.x, home.y, 18);
      }
    }
    return { measure, update };
  }
  const contact = initContact();

  /* ---------- Generative plates ---------- */
  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  // predexec: a decision tree grows, one path is chosen, the rest falls away,
  // and what is left is a single line that a request crosses once and back.
  function artTree(c, w, h, t, C) {
    const T = 9.5, cycle = Math.floor(t / T), tt = t % T, s = Math.min(w, h);
    const D = 4, padX = w * 0.1, H = h * 0.8;
    const path = [0];
    for (let l = 1; l <= D; l++) path[l] = path[l - 1] * 2 + (hash(cycle, l, 1) < 0.5 ? 0 : 1);
    const onPath = (l, i) => path[l] === i;
    const straight = seg(tt, 3.7, 4.9);
    const fall = Math.max(0, tt - 3.4);
    const fade = 1 - seg(tt, 3.5, 4.7);
    const out = 1 - seg(tt, 8.6, 9.5);
    const P = (l, i) => {
      const x = padX + (l / D) * (w - 2 * padX);
      const y = h / 2 + ((i + 0.5) / (1 << l) - 0.5) * H;
      if (onPath(l, i)) return [x, lerp(y, h / 2, straight)];
      const k = hash(l, i, cycle);
      return [x + fall * fall * (k - 0.5) * s * 0.12, y + fall * fall * h * (0.35 + k * 0.7)];
    };
    c.lineCap = "round";
    c.lineJoin = "round";

    for (let l = 1; l <= D; l++) {
      for (let i = 0; i < 1 << l; i++) {
        const grow = seg(tt, (l - 1) * 0.5, (l - 1) * 0.5 + 0.6);
        if (grow <= 0) continue;
        const main = onPath(l, i);
        const [x0, y0] = P(l - 1, i >> 1), [x1, y1] = P(l, i);
        const ex = lerp(x0, x1, grow), ey = lerp(y0, y1, grow);
        c.globalAlpha = (main ? 1 : fade) * out;
        if (c.globalAlpha <= 0.01) continue;
        const hi = main ? seg(tt, 2.3 + l * 0.22, 2.6 + l * 0.22) : 0;
        if (hi > 0) {
          c.strokeStyle = C.ink; c.lineWidth = s * (0.012 + 0.036 * hi);
          c.beginPath(); c.moveTo(x0, y0); c.lineTo(ex, ey); c.stroke();
          c.strokeStyle = C.paper; c.lineWidth = s * 0.026 * hi;
          c.beginPath(); c.moveTo(x0, y0); c.lineTo(ex, ey); c.stroke();
        } else {
          c.strokeStyle = C.ink; c.lineWidth = s * 0.012;
          c.beginPath(); c.moveTo(x0, y0); c.lineTo(ex, ey); c.stroke();
        }
      }
    }
    for (let l = 0; l <= D; l++) {
      for (let i = 0; i < 1 << l; i++) {
        const grow = l === 0 ? 1 : seg(tt, (l - 1) * 0.5 + 0.3, (l - 1) * 0.5 + 0.8);
        if (grow <= 0) continue;
        const main = onPath(l, i);
        c.globalAlpha = (main ? 1 : fade) * out;
        if (c.globalAlpha <= 0.01) continue;
        const [x, y] = P(l, i);
        const hi = main ? seg(tt, 2.3 + l * 0.22, 2.6 + l * 0.22) : 0;
        c.beginPath(); c.arc(x, y, s * (0.02 + 0.014 * hi) * grow, 0, Math.PI * 2);
        c.fillStyle = hi > 0.5 ? C.paper : C.ink; c.fill();
        if (hi > 0.5) { c.strokeStyle = C.ink; c.lineWidth = s * 0.01; c.stroke(); }
      }
    }
    if (tt > 4.9 && tt < 8.6) {
      const u = (tt - 4.9) / 3.4;
      const tri = u < 0.5 ? ease(u * 2) : ease((1 - u) * 2);
      const x = lerp(padX, w - padX, tri);
      c.globalAlpha = out;
      c.beginPath(); c.arc(x, h / 2, s * 0.05, 0, Math.PI * 2);
      c.fillStyle = C.accent; c.fill();
      c.strokeStyle = C.ink; c.lineWidth = s * 0.012; c.stroke();
    }
    c.globalAlpha = 1;
  }

  // Evenue: scattered listings, the cross-posted copies fold into their originals,
  // and what survives snaps into one tidy grid.
  const mergeScene = (() => {
    const R = rng(4242);
    const cols = 6, rows = 4, U = cols * rows, DUPS = 20;
    const uniques = [], dups = [];
    for (let k = 0; k < U; k++) uniques.push({ x: 0.08 + R() * 0.84, y: 0.1 + R() * 0.8, rot: (R() - 0.5) * 1.5, col: (R() * 3) | 0, ph: R() * 6.28 });
    for (let k = 0; k < DUPS; k++) dups.push({ src: (R() * U) | 0, x: 0.08 + R() * 0.84, y: 0.1 + R() * 0.8, rot: (R() - 0.5) * 1.5, ph: R() * 6.28 });
    return { cols, rows, uniques, dups };
  })();

  function artMerge(c, w, h, t, C) {
    const T = 10.5, tt = t % T, s = Math.min(w, h);
    const { cols, rows, uniques, dups } = mergeScene;
    const gw = w * 0.8, gh = h * 0.74, cellW = gw / cols, cellH = gh / rows;
    const cw = cellW * 0.8, ch = cellH * 0.66;
    const fills = [C.paper, C.accent, C.bg];
    const back = seg(tt, 8.8, 10.5);

    const chip = (x, y, rot, scale, fill) => {
      if (scale <= 0.01) return;
      c.save();
      c.translate(x, y); c.rotate(rot); c.scale(scale, scale);
      roundRect(c, -cw / 2, -ch / 2, cw, ch, ch * 0.18);
      c.fillStyle = fill; c.fill();
      c.strokeStyle = C.ink; c.lineWidth = s * 0.008; c.stroke();
      c.fillStyle = C.ink;
      c.fillRect(-cw * 0.36, -ch * 0.2, cw * 0.5, ch * 0.14);
      c.fillRect(-cw * 0.36, ch * 0.1, cw * 0.3, ch * 0.1);
      c.restore();
    };

    const now = uniques.map((u, k) => {
      const g = seg(tt, 4.7 + k * 0.035, 5.7 + k * 0.035) * (1 - back);
      const loose = 1 - g;
      const sx = u.x * w + Math.sin(t * 0.7 + u.ph) * s * 0.012 * loose;
      const sy = u.y * h + Math.cos(t * 0.6 + u.ph) * s * 0.012 * loose;
      const gx = (w - gw) / 2 + ((k % cols) + 0.5) * cellW;
      const gy = (h - gh) / 2 + (Math.floor(k / cols) + 0.5) * cellH;
      return { x: lerp(sx, gx, g), y: lerp(sy, gy, g), rot: u.rot * loose, pop: 0 };
    });

    dups.forEach((d, k) => {
      const src = now[d.src];
      const ox = d.x * w + Math.sin(t * 0.7 + d.ph) * s * 0.012;
      const oy = d.y * h + Math.cos(t * 0.6 + d.ph) * s * 0.012;
      const fill = fills[uniques[d.src].col];
      if (tt < 8.8) {
        const m = seg(tt, 1.8 + k * 0.11, 2.6 + k * 0.11);
        const scale = 1 - ease((m - 0.7) / 0.3);
        if (m > 0.7 && m < 1) src.pop = Math.max(src.pop, Math.sin(((m - 0.7) / 0.3) * Math.PI));
        chip(lerp(ox, src.x, m), lerp(oy, src.y, m), lerp(d.rot, uniques[d.src].rot, m), scale, fill);
      } else {
        chip(lerp(src.x, ox, back), lerp(src.y, oy, back), d.rot * back, back, fill);
      }
    });
    now.forEach((n, k) => chip(n.x, n.y, n.rot, 1 + n.pop * 0.22, fills[uniques[k].col]));
  }

  // Midwest Solar: past installations plotted over a row of panels. A regression
  // line swings into the best fit, then a small sun rides it to read off a prediction.
  const solarScene = (() => {
    const R = rng(907);
    const n = 26, pts = [];
    for (let k = 0; k < n; k++) {
      const x = 0.05 + 0.9 * ((k + R() * 0.8) / n);
      pts.push({ x, y: clamp(0.1 + 0.68 * x + (R() - 0.5) * 0.3, 0.04, 0.96), o: R() });
    }
    const mx = pts.reduce((a, p) => a + p.x, 0) / n, my = pts.reduce((a, p) => a + p.y, 0) / n;
    const m = pts.reduce((a, p) => a + (p.x - mx) * (p.y - my), 0) / pts.reduce((a, p) => a + (p.x - mx) ** 2, 0);
    return { pts, m, b: my - m * mx, my };
  })();

  function artSun(c, w, h, t, C) {
    const T = 11, tt = t % T, s = Math.min(w, h);
    const { pts, m, b, my } = solarScene;
    const horizon = h * 0.8, x0 = w * 0.09, x1 = w * 0.93, yLo = horizon - s * 0.07, yHi = h * 0.1;
    const X = (u) => lerp(x0, x1, u), Y = (v) => lerp(yLo, yHi, v);
    const out = 1 - seg(tt, 9.8, 11);
    const fit = seg(tt, 2.7, 4.6);
    const lineIn = seg(tt, 2.3, 2.8) * out;
    const line = (u) => lerp(my, m * u + b, fit);
    const p = clamp((tt - 5) / 4.2);
    const predicting = tt > 5 && tt < 9.8;
    const up = lerp(0.03, 0.97, ease(p));

    const cx = w * 0.17, cy = h * 0.2, R0 = s * 0.085, rays = 14, bw = s * 0.02;
    for (let i = 0; i < rays; i++) {
      const len = R0 * (0.35 + 0.75 * (0.5 + 0.5 * Math.sin(t * 0.9 + i * 1.7) * Math.cos(t * 0.43 + i * 0.61)));
      c.save();
      c.translate(cx, cy); c.rotate((i / rays) * Math.PI * 2 + t * 0.07);
      c.fillStyle = i % 2 ? C.paper : C.ink;
      c.fillRect(R0 * 1.25, -bw / 2, len, bw);
      c.restore();
    }
    c.beginPath(); c.arc(cx, cy, R0, 0, Math.PI * 2);
    c.fillStyle = C.accent; c.fill();
    c.strokeStyle = C.ink; c.lineWidth = s * 0.012; c.stroke();

    c.fillStyle = C.ink;
    c.fillRect(0, horizon, w, h - horizon);
    const panels = 7, pw = (x1 - x0) / panels, ph = (h - horizon) * 0.5, skew = pw * 0.2;
    for (let k = 0; k < panels; k++) {
      const x = x0 + k * pw, y = horizon + (h - horizon - ph) / 2;
      c.beginPath();
      c.moveTo(x + skew, y); c.lineTo(x + pw * 0.86 + skew, y); c.lineTo(x + pw * 0.86, y + ph); c.lineTo(x, y + ph); c.closePath();
      c.strokeStyle = C.paper; c.lineWidth = s * 0.006; c.stroke();
      const lit = predicting ? clamp(up * panels - k) * out : 0;
      if (lit > 0) {
        c.save(); c.clip();
        c.fillStyle = C.paper;
        c.fillRect(x, y, (pw * 0.86 + skew) * lit, ph);
        c.restore();
      }
    }

    c.lineCap = "round";
    if (lineIn > 0.01) {
      c.globalAlpha = lineIn * (1 - 0.7 * fit);
      c.strokeStyle = C.ink; c.lineWidth = s * 0.005;
      pts.forEach((q) => { c.beginPath(); c.moveTo(X(q.x), Y(q.y)); c.lineTo(X(q.x), Y(line(q.x))); c.stroke(); });
      c.globalAlpha = lineIn;
      c.strokeStyle = C.ink; c.lineWidth = s * 0.034;
      c.beginPath(); c.moveTo(X(0), Y(line(0))); c.lineTo(X(1), Y(line(1))); c.stroke();
      c.strokeStyle = C.paper; c.lineWidth = s * 0.014;
      c.beginPath(); c.moveTo(X(0), Y(line(0))); c.lineTo(X(1), Y(line(1))); c.stroke();
    }
    pts.forEach((q) => {
      const pop = seg(tt, q.o * 2, q.o * 2 + 0.3);
      if (pop <= 0) return;
      c.globalAlpha = out;
      c.beginPath(); c.arc(X(q.x), Y(q.y), s * 0.017 * (pop + 0.5 * Math.sin(pop * Math.PI)), 0, Math.PI * 2);
      c.fillStyle = C.ink; c.fill();
    });
    if (predicting) {
      const px = X(up), py = Y(line(up));
      c.globalAlpha = out;
      c.strokeStyle = C.ink; c.lineWidth = s * 0.008;
      c.setLineDash([s * 0.02, s * 0.022]);
      c.beginPath(); c.moveTo(px, py); c.lineTo(px, horizon); c.stroke();
      c.setLineDash([]);
      c.beginPath(); c.arc(px, py, s * 0.042, 0, Math.PI * 2);
      c.fillStyle = C.accent; c.fill();
      c.lineWidth = s * 0.012; c.stroke();
    }
    c.globalAlpha = 1;
  }

  // fitr: the weather changes, three reels of the wardrobe spin (tops, bottoms, shoes) and stop one
  // after another on the outfit for that weather, inside the phone.
  const GARMENTS = [
    [ // tops: tee, jacket, tank, sweater
      (c) => { c.moveTo(-0.28, -0.7); c.lineTo(-0.78, -0.45); c.lineTo(-0.62, -0.08); c.lineTo(-0.42, -0.2); c.lineTo(-0.42, 0.7); c.lineTo(0.42, 0.7); c.lineTo(0.42, -0.2); c.lineTo(0.62, -0.08); c.lineTo(0.78, -0.45); c.lineTo(0.28, -0.7); c.quadraticCurveTo(0, -0.42, -0.28, -0.7); },
      (c) => { c.moveTo(-0.28, -0.7); c.lineTo(-0.72, -0.5); c.lineTo(-0.98, 0.42); c.lineTo(-0.7, 0.52); c.lineTo(-0.44, -0.08); c.lineTo(-0.42, 0.7); c.lineTo(0.42, 0.7); c.lineTo(0.44, -0.08); c.lineTo(0.7, 0.52); c.lineTo(0.98, 0.42); c.lineTo(0.72, -0.5); c.lineTo(0.28, -0.7); c.quadraticCurveTo(0, -0.42, -0.28, -0.7); },
      (c) => { c.moveTo(-0.34, -0.7); c.lineTo(-0.18, -0.7); c.quadraticCurveTo(0, -0.25, 0.18, -0.7); c.lineTo(0.34, -0.7); c.lineTo(0.46, -0.05); c.lineTo(0.42, 0.7); c.lineTo(-0.42, 0.7); c.lineTo(-0.46, -0.05); },
      (c) => { c.moveTo(-0.28, -0.7); c.lineTo(-0.72, -0.5); c.lineTo(-0.98, 0.42); c.lineTo(-0.7, 0.52); c.lineTo(-0.44, -0.08); c.lineTo(-0.42, 0.7); c.lineTo(0.42, 0.7); c.lineTo(0.44, -0.08); c.lineTo(0.7, 0.52); c.lineTo(0.98, 0.42); c.lineTo(0.72, -0.5); c.lineTo(0.28, -0.7); c.quadraticCurveTo(0, -0.42, -0.28, -0.7); },
    ],
    [ // bottoms: shorts, trousers, skirt, wide trousers
      (c) => { c.moveTo(-0.5, -0.45); c.lineTo(0.5, -0.45); c.lineTo(0.62, 0.4); c.lineTo(0.1, 0.4); c.lineTo(0, -0.05); c.lineTo(-0.1, 0.4); c.lineTo(-0.62, 0.4); },
      (c) => { c.moveTo(-0.42, -0.7); c.lineTo(0.42, -0.7); c.lineTo(0.5, 0.7); c.lineTo(0.12, 0.7); c.lineTo(0, -0.25); c.lineTo(-0.12, 0.7); c.lineTo(-0.5, 0.7); },
      (c) => { c.moveTo(-0.36, -0.5); c.lineTo(0.36, -0.5); c.lineTo(0.68, 0.45); c.lineTo(-0.68, 0.45); },
      (c) => { c.moveTo(-0.42, -0.7); c.lineTo(0.42, -0.7); c.lineTo(0.78, 0.7); c.lineTo(0.2, 0.7); c.lineTo(0, -0.25); c.lineTo(-0.2, 0.7); c.lineTo(-0.78, 0.7); },
    ],
    [ // shoes: trainer, boot, slide, high-top
      (c) => { c.moveTo(-0.75, 0.42); c.lineTo(-0.75, -0.25); c.lineTo(-0.35, -0.25); c.lineTo(-0.1, 0); c.lineTo(0.5, 0.05); c.quadraticCurveTo(0.8, 0.1, 0.8, 0.42); },
      (c) => { c.moveTo(-0.65, 0.42); c.lineTo(-0.65, -0.8); c.lineTo(-0.15, -0.8); c.lineTo(-0.15, -0.05); c.lineTo(0.45, 0); c.quadraticCurveTo(0.75, 0.05, 0.75, 0.42); },
      (c) => { c.moveTo(-0.75, 0.42); c.lineTo(-0.75, 0.18); c.lineTo(-0.2, 0.18); c.quadraticCurveTo(0.1, -0.35, 0.4, 0.18); c.lineTo(0.8, 0.18); c.lineTo(0.8, 0.42); },
      (c) => { c.moveTo(-0.7, 0.42); c.lineTo(-0.7, -0.6); c.lineTo(-0.25, -0.6); c.lineTo(-0.1, -0.05); c.lineTo(0.5, 0.05); c.quadraticCurveTo(0.8, 0.1, 0.8, 0.42); },
    ],
  ];
  const OUTFITS = [[0, 0, 0], [1, 1, 1], [3, 3, 3]]; // sun, rain, snow

  function artFit(c, w, h, t, C) {
    const T = 7.5, n = Math.floor(t / T), tt = t - n * T, s = Math.min(w, h);
    const weather = ((n % 3) + 3) % 3, prev = (((n - 1) % 3) + 3) % 3;
    const cx = w * 0.54, cell = w * 0.2;
    const rows = [h * 0.27, h * 0.55, h * 0.81], units = [h * 0.115, h * 0.115, h * 0.085];
    const fills = [C.accent, C.bg, C.paper, C.bg];
    c.lineJoin = "round"; c.lineCap = "round";

    // the phone
    const pw = cell * 1.25, top = h * 0.06, ph = h * 0.88;
    roundRect(c, cx - pw / 2 + s * 0.02, top + s * 0.022, pw, ph, pw * 0.16);
    c.fillStyle = C.ink; c.fill();
    roundRect(c, cx - pw / 2, top, pw, ph, pw * 0.16);
    c.fillStyle = C.paper; c.fill();
    c.strokeStyle = C.ink; c.lineWidth = s * 0.014; c.stroke();
    roundRect(c, cx - pw * 0.17, top + ph * 0.022, pw * 0.34, ph * 0.026, ph * 0.013);
    c.fillStyle = C.ink; c.fill();

    // the reels
    let settled = 0;
    rows.forEach((y, k) => {
      const stop = 2.3 + k * 0.85, u = clamp((tt - 0.5) / (stop - 0.5));
      const back = 1 + 2.4 * Math.pow(u - 1, 3) + 1.4 * Math.pow(u - 1, 2);
      const from = OUTFITS[prev][k], to = OUTFITS[weather][k] + 8 + k * 4;
      const pos = from + (to - from) * back;
      const land = seg(tt, stop - 0.05, stop + 0.25);
      settled += land / 3;
      for (let j = Math.floor(pos) - 2; j <= Math.floor(pos) + 3; j++) {
        const off = j - pos, type = ((j % 4) + 4) % 4, near = 1 - clamp(Math.abs(off));
        const x = cx + off * cell;
        if (x < -cell || x > w + cell) continue;
        const sc = units[k] * (0.7 + 0.3 * near) * (1 + 0.14 * near * Math.sin(land * Math.PI));
        c.save();
        c.translate(x, y); c.scale(sc, sc);
        c.globalAlpha = 0.45 + 0.55 * near;
        c.beginPath(); GARMENTS[k][type](c); c.closePath();
        c.fillStyle = k === 0 && type === 3 ? C.accent : fills[type]; c.fill();
        c.strokeStyle = C.ink; c.lineWidth = (s * 0.011) / sc; c.stroke();
        c.beginPath();
        if (k === 0 && type === 1) { c.moveTo(0, -0.5); c.lineTo(0, 0.7); }
        if (k === 0 && type === 3) { c.moveTo(-0.42, 0.12); c.lineTo(0.42, 0.12); c.moveTo(-0.42, 0.4); c.lineTo(0.42, 0.4); }
        if (k === 2) { c.moveTo(-0.75, 0.27); c.lineTo(0.8, 0.27); }
        c.stroke();
        c.restore();
      }
    });
    c.globalAlpha = 1;

    // the weather it is dressing for
    const bx = w * 0.14, by = h * 0.2, br = s * 0.1 * (0.6 + 0.4 * seg(tt, 0, 0.35) + 0.12 * Math.sin(seg(tt, 0, 0.5) * Math.PI));
    c.beginPath(); c.arc(bx + s * 0.012, by + s * 0.014, br, 0, Math.PI * 2); c.fillStyle = C.ink; c.fill();
    c.beginPath(); c.arc(bx, by, br, 0, Math.PI * 2); c.fillStyle = C.paper; c.fill();
    c.strokeStyle = C.ink; c.lineWidth = s * 0.012; c.stroke();
    c.save();
    c.translate(bx, by); c.scale(br, br);
    c.lineWidth = 0.1; c.strokeStyle = C.ink; c.fillStyle = C.ink;
    if (weather === 0) {
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + t * 0.6; c.beginPath(); c.moveTo(Math.cos(a) * 0.5, Math.sin(a) * 0.5); c.lineTo(Math.cos(a) * 0.72, Math.sin(a) * 0.72); c.stroke(); }
      c.beginPath(); c.arc(0, 0, 0.33, 0, Math.PI * 2); c.fillStyle = C.accent; c.fill(); c.stroke();
    } else {
      c.beginPath(); c.arc(-0.25, -0.12, 0.24, 0, Math.PI * 2); c.arc(0.05, -0.25, 0.3, 0, Math.PI * 2); c.arc(0.32, -0.08, 0.22, 0, Math.PI * 2); c.rect(-0.25, -0.12, 0.57, 0.26); c.fill();
      for (let i = 0; i < 3; i++) {
        const fall = (t * 1.3 + i * 0.37) % 1, x = -0.28 + i * 0.28, y = 0.26 + fall * 0.4;
        c.globalAlpha = 1 - fall;
        c.beginPath();
        if (weather === 1) { c.moveTo(x, y); c.lineTo(x - 0.06, y + 0.16); c.stroke(); } else { c.arc(x, y + 0.06, 0.07, 0, Math.PI * 2); c.fill(); }
      }
    }
    c.restore();
    c.globalAlpha = 1;

    // matched
    const ok = seg(tt, 4.3, 4.6) * (1 - seg(tt, T - 0.5, T));
    if (ok > 0.01) {
      const mx = w * 0.88, my = h * 0.52, mr = s * 0.075 * (ok + 0.25 * Math.sin(ok * Math.PI));
      c.beginPath(); c.arc(mx, my, mr, 0, Math.PI * 2); c.fillStyle = C.accent; c.fill();
      c.strokeStyle = C.ink; c.lineWidth = s * 0.012; c.stroke();
      c.beginPath(); c.moveTo(mx - mr * 0.42, my + mr * 0.02); c.lineTo(mx - mr * 0.1, my + mr * 0.34); c.lineTo(mx + mr * 0.45, my - mr * 0.32);
      c.lineWidth = s * 0.02; c.stroke();
    }
  }

  const ARTS = { predexec: artTree, evenue: artMerge, fitr: artFit, solar: artSun };
  // predexec is published and only tracks new harness versions now, so it reads as shipped like the rest.
  const STATUS = (s) => (s || "").replace("still climbing", "shipped").replace(/^sent\b/, "shipped");
  const DATE = (s) => (s || "").replace(/^set\s+/, "");

  const KINDS = {
    predexec: "AI agent tooling", evenue: "Cloud platform", fitr: "Full-stack mobile", solar: "Machine learning",
    treejit: "AI infrastructure", webify: "Full-stack AI", atlas: "AI research tool", connector: "Full-stack web",
  };
  const SHAPES = [
    '<rect x="4" y="4" width="16" height="16"/>',
    '<circle cx="12" cy="12" r="9"/>',
    '<path d="M12 1l3 7 8 1-6 5 2 8-7-4-7 4 2-8-6-5 8-1z"/>',
    '<path d="M12 3l10 18H2z"/>',
  ];
  const stacked = matchMedia("(max-width: 899px)");
  let vols = [];

  // On the wide layout one project is always open. On the stacked layout a tap also closes it.
  function openVol(id, toggle) {
    vols.forEach((v) => {
      const on = v.id === id && !(toggle && stacked.matches && v.el.classList.contains("is-open"));
      v.el.classList.toggle("is-open", on);
      v.spine.setAttribute("aria-expanded", String(on));
      v.page.inert = !on;
    });
  }

  // The name is sized so its longer line, plus the extrusion, spans the hero.
  function fitName() {
    const name = $(".name"), line = $(".name-line");
    if (!name || !line || !line.firstElementChild) return;
    name.style.fontSize = "100px";
    const a = line.firstElementChild, b = line.lastElementChild;
    const perPx = (b.offsetLeft + b.offsetWidth - a.offsetLeft) / 100 + 0.09;
    const cap = innerHeight * (stacked.matches ? 0.3 : 0.36);
    name.style.fontSize = `${Math.min(cap, name.clientWidth / perPx).toFixed(1)}px`;
  }

  function setShelf() {
    const shelf = $(".shelf");
    if (!vols.length) return;
    shelf.style.setProperty("--page-w", `${Math.max(0, shelf.clientWidth - vols.length * vols[0].spine.offsetWidth)}px`);
  }

  function buildShelf() {
    const host = $(".shelf");
    const routes = window.ROUTES || [];
    host.innerHTML = routes.map((r, i) => {
      const cv = (k) => `var(--c${((i + k) % 4) + 1})`;
      const art = `<div class="plate-art" role="img" aria-label="Animated illustration for ${esc(r.name)}"><canvas data-art="${esc(r.id)}"></canvas></div>`;
      const facts = (r.facts || []).map((f) => `<div><dt>${esc(f.n)}</dt><dd>${esc(f.label)}</dd></div>`).join("");
      return `
<article class="vol" id="${esc(r.id)}" style="--bg:${cv(0)};--bg2:${cv(1)};--bg3:${cv(2)}">
  <button class="vol-spine" type="button" id="spine-${esc(r.id)}" aria-expanded="false" aria-controls="page-${esc(r.id)}">
    <svg viewBox="0 0 24 24" aria-hidden="true">${SHAPES[i % SHAPES.length]}</svg>
    <span class="spine-label">
      <span class="spine-name">${esc(r.short || r.name)}</span>
      <span class="spine-kind">${esc(KINDS[r.id] || DATE(r.set))}</span>
    </span>
    <span class="spine-plus" aria-hidden="true"></span>
  </button>
  <div class="vol-page" id="page-${esc(r.id)}" role="region" aria-labelledby="spine-${esc(r.id)}"><div class="vol-clip"><div class="vol-in">
    <h3 class="plate-name" aria-hidden="true"><span class="fit" data-fit-max="0.13">${esc(r.short || r.name)}</span></h3>
    <div class="plate-grid">
      ${art}
      <div class="plate-text">
        <p class="plate-meta">${KINDS[r.id] ? `<span class="tag tag-kind">${esc(KINDS[r.id])}</span>` : ""}<span class="tag">${esc(DATE(r.set))}</span>${r.status ? `<span class="tag">${esc(STATUS(r.status))}</span>` : ""}</p>
        <p class="plate-blurb">${esc(r.blurb)}</p>
        <p class="plate-body">${esc(r.body)}</p>
        ${facts ? `<dl class="facts">${facts}</dl>` : ""}
        <ul class="stack" aria-label="Built with">${r.stack.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>
        ${r.link ? `<a class="btn" href="${esc(r.link)}" target="_blank" rel="noopener">View ${esc(r.name)} on GitHub</a>` : ""}
      </div>
    </div>
  </div></div></div>
</article>`;
    }).join("");

    vols = $$(".vol", host).map((el) => ({ el, id: el.id, spine: $(".vol-spine", el), page: $(".vol-page", el) }));
    vols.forEach((v, i) => {
      v.spine.addEventListener("click", () => {
        openVol(v.id, true);
        if (stacked.matches && v.el.classList.contains("is-open")) {
          setTimeout(() => { if (v.el.getBoundingClientRect().top < 0) v.el.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" }); }, 540);
        }
      });
      v.spine.addEventListener("keydown", (e) => {
        const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
        if (!step) return;
        e.preventDefault();
        const next = vols[(i + step + vols.length) % vols.length];
        next.spine.focus();
        if (!stacked.matches) openVol(next.id);
      });
    });
    const fromHash = () => vols.find((v) => `#${v.id}` === location.hash);
    openVol((fromHash() || vols[0] || {}).id);
    addEventListener("hashchange", () => { const v = fromHash(); if (v) openVol(v.id); });
  }

  function buildRows() {
    $(".rows").innerHTML = (window.MORE_ROUTES || []).map((r, i) => `
<details class="row" style="--row:var(--c${(i % 4) + 1})">
  <summary>
    <span class="row-name">${esc(r.name)}</span>
    <span class="row-info">${KINDS[r.id] ? `<span class="tag tag-kind">${esc(KINDS[r.id])}</span>` : ""}<span class="row-blurb">${esc(r.blurb)}</span></span>
    <span class="row-plus" aria-hidden="true"></span>
  </summary>
  <div class="row-panel"><div class="row-body">
    <p>${esc(r.body)}</p>
    <ul class="stack" aria-label="Built with">${r.stack.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>
    ${r.link ? `<a class="btn" href="${esc(r.link)}" target="_blank" rel="noopener">View ${esc(r.name)} on GitHub</a>` : ""}
  </div></div>
</details>`).join("");
    $$(".row").forEach((row) => {
      const summary = $("summary", row), panel = $(".row-panel", row);
      let animation = null, expanded = row.open;
      summary.addEventListener("click", (event) => {
        event.preventDefault();
        expanded = !expanded;
        const height = row.open ? panel.getBoundingClientRect().height : 0;
        const opacity = row.open ? getComputedStyle(panel).opacity : "0";
        if (animation) { animation.cancel(); animation = null; }
        row.open = true;
        panel.inert = !expanded;
        if (reduce) { row.open = expanded; return; }
        const next = panel.animate([
          { height: `${height}px`, opacity },
          { height: `${expanded ? panel.scrollHeight : 0}px`, opacity: expanded ? 1 : 0 },
        ], { duration: 450, easing: "cubic-bezier(0.2, 0.9, 0.2, 1)" });
        animation = next;
        next.onfinish = () => {
          if (animation !== next) return;
          row.open = expanded;
          animation = null;
          next.cancel();
        };
      });
    });
  }

  const SKILLS = [
    ["Languages", "Python, JavaScript/TypeScript, Java, Swift, Kotlin, Go, SQL, R, HTML/CSS"],
    ["Full-stack", "React, Next.js, Node, FastAPI, Django, Flask, REST, GraphQL, WebSockets, Vitest, JUnit, pytest"],
    ["AI/ML", "LangGraph, LlamaIndex, Mastra, FastMCP, vLLM, PyTorch, TensorFlow, scikit-learn, XGBoost, Optuna, MLflow"],
    ["Cloud", "AWS, Firebase, Docker, Kubernetes, Helm, nginx, Kafka, Grafana, k6"],
    ["Data", "PostgreSQL, MongoDB, Redis, Firestore, DynamoDB, Cassandra, Elasticsearch, Qdrant"],
  ];
  const marquees = [];

  function buildMarquees() {
    const host = $(".marquees");
    const widths = [135, 85, 110, 75, 120];
    host.innerHTML = SKILLS.map(([label, list], i) => {
      const items = list.split(", ").map((s) => `<span>${esc(s)}</span><i></i>`).join("");
      const group = (hidden) => `<div class="mq-group"${hidden ? ' aria-hidden="true"' : ""} style="font-variation-settings:'wdth' ${widths[i]}, 'wght' 900"><b>${esc(label)}</b><i></i>${items}</div>`;
      return `<div class="mq" style="--bg:var(--c${(i % 4) + 1})"><div class="mq-track">${group(false)}${group(true)}${group(true)}</div></div>`;
    }).join("");
    $$(".mq-track", host).forEach((track, i) => marquees.push({ track, dir: i % 2 ? 1 : -1, x: 0, w: 0, speed: 40 + i * 9 }));
  }

  function measureMarquees() {
    marquees.forEach((m) => { m.w = m.track.firstElementChild.getBoundingClientRect().width; });
  }

  /* ---------- Text fitted to its container at its widest font setting ---------- */
  function fitAll() {
    const probe = document.createElement("span");
    probe.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;font-family:"Anybody",sans-serif;font-size:100px;letter-spacing:-0.02em;font-variation-settings:"wdth" 125,"wght" 900';
    document.body.append(probe);
    $$(".fit").forEach((el) => {
      const box = el.parentElement;
      probe.textContent = el.textContent;
      const max = innerHeight * parseFloat(el.dataset.fitMax || "0.22");
      const size = Math.min(max, (box.clientWidth / probe.getBoundingClientRect().width) * 100 * 0.985);
      box.style.fontSize = `${Math.max(34, size).toFixed(1)}px`;
    });
    probe.remove();
  }

  /* ---------- Rail: paint runs down the navigation as the page scrolls ----------
     The leading edge is a row of springs. It lags behind fast scrolling, stretches
     into drips, sheds drops, and sloshes when the pointer drags across it. */
  function initRail() {
    const rail = $(".rail"), cv = $(".rail-paint");
    if (!rail || !cv) return null;
    const ctx = cv.getContext("2d");
    const links = $$(".rail-nav a", rail);
    const secs = links.map((a) => document.getElementById(a.hash.slice(1)));
    const TINT = [1, 3, 0, 2, 1];
    const N = 16;
    const cols = Array.from({ length: N + 1 }, (_, i) => ({ h: 0, v: 0, lag: 0.2 + 0.6 * hash(i, 5, 2) }));
    const drops = [];
    const rgb = [255, 255, 255];
    const lastPointer = { a: 0, on: false };
    let horiz = false, W = 0, H = 0, L = 0, X = 0, S = [0, 1], M = [0, 1], level = -1, active = -1, stretch = 0;

    const rest = (i) => {
      const u = i / N;
      const drip = (c, wd, len) => len * Math.exp(-((u - c) ** 2) / wd);
      return (horiz ? 0.45 : 1) * (1 + stretch * 1.5) * (3 * Math.sin(i * 1.3 + 1) + drip(0.27, 0.012, 15) + drip(0.72, 0.018, 26));
    };
    const pt = (a, c) => (horiz ? [a, c] : [c, a]);

    function measure() {
      const cr = cv.getBoundingClientRect();
      const dpr = Math.min(devicePixelRatio || 1, 2);
      W = cr.width; H = cr.height;
      horiz = W > H;
      L = horiz ? W : H; X = horiz ? H : W;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      M = links.map((a) => { const b = a.getBoundingClientRect(); return horiz ? b.right - cr.left : b.bottom - cr.top; });
      M.push(L + 60);
      const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
      S = secs.map((s, i) => (i && s ? clamp(s.getBoundingClientRect().top + scrollY - innerHeight * 0.4, 0, max) : 0));
      S.push(max);
      for (let i = 1; i < S.length; i++) S[i] = Math.max(S[i], S[i - 1]);
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      const pts = cols.map((c, i) => pt(level + rest(i) + c.h, (i / N) * X));
      ctx.beginPath();
      ctx.moveTo(...pt(-6, -6));
      ctx.lineTo(...pt(level + rest(0) + cols[0].h, -6));
      ctx.lineTo(...pts[0]);
      for (let i = 1; i < N; i++) ctx.quadraticCurveTo(pts[i][0], pts[i][1], (pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2);
      ctx.lineTo(...pts[N]);
      ctx.lineTo(...pt(level + rest(N) + cols[N].h, X + 6));
      ctx.lineTo(...pt(-6, X + 6));
      ctx.closePath();
      ctx.fillStyle = `rgb(${rgb.map((v) => Math.round(v)).join(",")})`;
      ctx.fill();
      ctx.strokeStyle = "#0e0e10"; ctx.lineWidth = 3; ctx.lineJoin = "round";
      ctx.stroke();
      drops.forEach((d) => {
        ctx.beginPath();
        ctx.ellipse(d.c, d.a, d.r, d.r * (1 + Math.min(0.8, d.v / 900)), 0, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
      });
    }

    function update(dt, vel) {
      const y = scrollY;
      let i = 0;
      while (i < links.length - 1 && y >= S[i + 1]) i++;
      const span = S[i + 1] - S[i];
      const target = lerp(M[i], M[i + 1], span > 0 ? clamp((y - S[i]) / span) : 1);
      if (level < 0 || reduce) level = target;
      const prev = level;
      level = lerp(level, target, 1 - Math.pow(0.00002, dt));
      const dl = level - prev;

      if (i !== active) {
        active = i;
        links.forEach((a, k) => {
          a.classList.toggle("is-active", k === i);
          if (k === i) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current");
        });
      }
      const to = hexToRgb(PALETTES[paletteIndex][TINT[active] || 0]);
      for (let k = 0; k < 3; k++) rgb[k] = lerp(rgb[k], to[k] * 255, reduce ? 1 : 0.08);

      if (reduce) {
        cols.forEach((c) => { c.h = 0; c.v = 0; });
      } else {
        stretch = lerp(stretch, clamp(Math.abs(vel) / 2600), 0.08);
        cols.forEach((c) => { c.h = clamp(c.h - dl * c.lag, -70, 70); });
        for (let k = 0; k <= N; k++) {
          const c = cols[k], a = cols[Math.max(0, k - 1)].h, b = cols[Math.min(N, k + 1)].h;
          c.v += (-90 * c.h - 9 * c.v + 260 * (a + b - 2 * c.h)) * dt;
        }
        cols.forEach((c) => { c.h += c.v * dt; });
        if (!horiz && vel > 900 && drops.length < 7 && Math.random() < dt * 6) {
          const k = Math.random() < 0.5 ? Math.round(N * 0.27) : Math.round(N * 0.72);
          drops.push({ c: (k / N) * X, a: level + rest(k) + cols[k].h, v: 140, r: 3 + Math.random() * 4 });
        }
        for (let k = drops.length - 1; k >= 0; k--) {
          const d = drops[k];
          d.v += 1500 * dt; d.a += d.v * dt;
          if (d.a > L + 12) drops.splice(k, 1);
        }
      }
      draw();
    }

    rail.addEventListener("pointermove", (e) => {
      const cr = cv.getBoundingClientRect();
      const a = horiz ? e.clientX - cr.left : e.clientY - cr.top;
      const c = horiz ? e.clientY - cr.top : e.clientX - cr.left;
      if (lastPointer.on && Math.abs(a - level) < 80) {
        const da = clamp(a - lastPointer.a, -40, 40);
        cols.forEach((col, i) => { const d = (i / N) * X - c; col.v += da * 14 * Math.exp(-(d * d) / 400); });
      }
      lastPointer.a = a; lastPointer.on = true;
    }, { passive: true });
    rail.addEventListener("pointerleave", () => { lastPointer.on = false; });

    return { measure, update };
  }

  buildShelf();
  const rail = initRail();
  buildRows();
  buildMarquees();

  /* ---------- Statement: words ink in as the paragraph moves up the screen ---------- */
  const statement = $(".statement");
  const words = [];
  if (statement && !reduce) {
    const text = statement.textContent.trim().split(/\s+/);
    statement.setAttribute("aria-label", text.join(" "));
    statement.innerHTML = text.map((w) => `<span class="w" aria-hidden="true">${esc(w)}</span>`).join(" ");
    words.push(...$$(".w", statement));
  }

  /* ---------- Timeline: every stop is driven by how far it has scrolled up the screen ---------- */
  const stops = reduce ? [] : $$(".stop").map((el) => {
    const year = $(".stop-year", el), title = $("h3", el), paintEl = $(".stop-paint", el);
    const digits = year.textContent.trim();
    year.setAttribute("aria-label", digits);
    year.innerHTML = [...digits].map((d, k) => {
      const n = 9 + k * 5;
      const strip = Array.from({ length: n }, (_, j) => `<i>${(((+d - (n - 1 - j)) % 10) + 10) % 10}</i>`).join("");
      return `<span class="reel" aria-hidden="true"><span class="reel-strip" style="--k:${k};--n:${n}">${strip}</span></span>`;
    }).join("");
    const text = title.textContent.trim();
    title.setAttribute("aria-label", text);
    let at = 0;
    title.innerHTML = text.split(" ").map((word) => `<span class="kw" aria-hidden="true">${[...word].map((ch) => {
      const i = at++;
      return `<span class="kc" style="--i:${i};--tw:${((hash(i, 4, 2) - 0.5) * 70).toFixed(0)}deg">${esc(ch)}</span>`;
    }).join("")}</span>`).join(" ");
    el.style.setProperty("--p", "0");
    return { el, paintEl, stamp: $(".stop-stamp", el), p: 0, shown: -1, done: false };
  });
  function updateStops() {
    stops.forEach((s) => {
      const r = s.el.getBoundingClientRect();
      if (r.bottom < -200 || r.top > innerHeight + 200) { if (s.p === 0 || s.p === 1) return; }
      const target = clamp((innerHeight * 0.94 - r.top) / (innerHeight * 0.5));
      s.p = Math.abs(target - s.p) < 0.001 ? target : lerp(s.p, target, 0.1);
      if (Math.abs(s.p - s.shown) < 0.0008) return;
      s.shown = s.p;
      s.el.style.setProperty("--p", s.p.toFixed(4));
      // The swipe of colour has a wet, uneven leading edge that straightens out as it finishes.
      const edge = s.p * 122 - 10, pts = ["0% 0%"];
      for (let i = 0; i <= 8; i++) pts.push(`${(edge + (1 - s.p) * (5 * Math.sin(i * 2.1 + s.p * 13) + 3 * Math.sin(i * 4.3 - s.p * 7))).toFixed(2)}% ${(i * 12.5).toFixed(1)}%`);
      pts.push("0% 100%");
      s.paintEl.style.clipPath = s.p >= 1 ? "none" : `polygon(${pts.join(",")})`;
      const done = s.p > 0.985;
      if (done && !s.done) {
        const a = s.el.getBoundingClientRect(), b = s.stamp.getBoundingClientRect();
        for (let k = 0; k < 9; k++) {
          const f = document.createElement("i"), ang = (k / 9) * Math.PI * 2 + Math.random(), reach = 50 + Math.random() * 70;
          f.className = "fleck";
          f.style.cssText = `left:${b.left + b.width / 2 - a.left}px;top:${b.top + b.height / 2 - a.top}px;--s:${8 + Math.random() * 12}px;--dx:${Math.cos(ang) * reach}px;--dy:${Math.sin(ang) * reach}px;--fc:var(--c${(k % 4) + 1})`;
          f.addEventListener("animationend", () => f.remove());
          s.el.append(f);
        }
      }
      if (done !== s.done) { s.done = done; s.el.classList.toggle("is-done", done); }
    });
  }

  /* ---------- Canvas artworks: sized to their frame, drawn only while on screen ---------- */
  const arts = $$("canvas[data-art]").map((canvas) => ({ canvas, ctx: canvas.getContext("2d"), fn: ARTS[canvas.dataset.art], plate: canvas.closest(".vol"), visible: false, w: 0, h: 0 }));
  const artIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => { const a = arts.find((x) => x.canvas === e.target); if (a) a.visible = e.isIntersecting; });
  });
  const sizeArt = (a) => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    a.w = a.canvas.offsetWidth; a.h = a.canvas.offsetHeight;
    a.canvas.width = Math.round(a.w * dpr);
    a.canvas.height = Math.round(a.h * dpr);
    a.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  const drawArt = (a, t) => {
    if (!a.w) return;
    const cs = getComputedStyle(a.plate);
    const C = { ink: "#0e0e10", paper: "#ffffff", bg: cs.getPropertyValue("--bg").trim(), accent: cs.getPropertyValue("--bg3").trim() };
    a.ctx.clearRect(0, 0, a.w, a.h);
    a.fn(a.ctx, a.w, a.h, t, C);
  };
  arts.forEach((a) => artIO.observe(a.canvas));

  /* ---------- Cursor ---------- */
  const cursor = $(".cursor");
  if (finePointer && !reduce) {
    root.classList.add("has-cursor");
    addEventListener("pointermove", (e) => {
      // Position goes on `translate`, which applies outside `scale`. As a transform it sat inside the
      // hover scale, so growing the blob also multiplied its offset and threw it across the screen.
      cursor.style.translate = `${e.clientX}px ${e.clientY}px`;
      cursor.classList.add("is-live");
      cursor.classList.toggle("is-big", !!e.target.closest("a, button, summary, .ch, .floatie, .contact-letter"));
    }, { passive: true });
  }

  /* ---------- Layout and the frame loop ---------- */
  function layout() {
    setShelf();
    fitName();
    pool && pool.measure();
    fitAll();
    contact && contact.measure();
    arts.forEach(sizeArt);
    measureMarquees();
    rail && rail.measure();
    if (reduce) arts.forEach((a) => drawArt(a, { predexec: 6.2, evenue: 7.4, fitr: 5.5, solar: 7.6 }[a.canvas.dataset.art] || 3));
  }
  layout();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
  addEventListener("load", layout);
  let resizeTimer;
  addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(layout, 120); });

  let lastY = scrollY, vel = 0, lastT = performance.now();
  function tick(now) {
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    const dy = scrollY - lastY;
    lastY = scrollY;
    vel = lerp(vel, dy / Math.max(dt, 0.001), 0.12);

    rail && rail.update(dt, vel);
    contact && contact.update(dt, now);
    updateStops();
    if (!reduce) {
      arts.forEach((a) => { if (a.visible && a.plate.classList.contains("is-open")) drawArt(a, now / 1000); });
      marquees.forEach((m) => {
        if (!m.w) return;
        m.x = (m.x + m.dir * (m.speed + Math.abs(vel) * 0.35) * dt) % m.w;
        m.track.style.transform = `translate3d(${(m.x > 0 ? m.x - m.w : m.x).toFixed(1)}px, 0, 0) skewX(${clamp(vel * -0.004, -9, 9).toFixed(2)}deg)`;
      });
    }
    if (words.length) {
      const r = statement.getBoundingClientRect();
      const p = clamp((innerHeight * 0.88 - r.top) / (r.height + innerHeight * 0.35));
      const lit = Math.round(p * words.length);
      words.forEach((w, i) => w.classList.toggle("is-on", i < lit));
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
