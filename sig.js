/* Revive · signature build
   One idea runs through the page: vast → los.
   A shared canvas "fibre" renderer draws the wordmark as rows of muscle fibre: knotted (tension), pushed by the pointer (pressure).
   Section 02 draws the body as contour lines with a renderer that plugs into the same loop. */
(() => {
  const html = document.documentElement;
  const still = html.classList.contains('still');
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  const hasGsap = !!window.gsap;
  const fine = matchMedia('(pointer:fine)').matches;

  document.querySelectorAll('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });

  /* ---------------------------------------------------------------- fibre engine */
  class Fibers {
    constructor(canvas, opts = {}) {
      this.cv = canvas;
      this.ctx = canvas.getContext('2d');
      this.o = Object.assign({ gap: 6, step: 5, lw: 1.4, bgGap: 0, bgStep: 10, bgA: 0.06, rgb: [227, 200, 143], radius: 90, push: 14 }, opts);
      this.segs = []; this.knots = []; this.heat = []; this.trail = [];
      this.T = 0; this.t = 0; this.spread = 0; this.alpha = 1; this.cx = 0; this.cy = 0; this.dirty = true;
    }
    size() {
      const r = this.cv.getBoundingClientRect();
      this.w = Math.round(r.width); this.h = Math.round(r.height);
      this.cv.width = this.w * DPR; this.cv.height = this.h * DPR;
      this.ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
    build(drawMask) {
      const { w, h, o } = this;
      if (!w || !h) return false;
      const off = document.createElement('canvas');
      off.width = w; off.height = h;
      const c = off.getContext('2d', { willReadFrequently: true });
      drawMask(c, w, h);
      let d;
      try { d = c.getImageData(0, 0, w, h).data; } catch (e) { return false; }
      const segs = [];
      const scan = (gap, step, inside, kind, start) => {
        for (let y = Math.round(start); y < h; y += gap) {
          const row = y * w * 4; let run = -1;
          for (let x = 0; x <= w; x++) {
            const on = x < w && (d[row + x * 4 + 3] > 110) === inside;
            if (on && run < 0) run = x;
            else if (!on && run >= 0) { if (x - 1 - run >= 2) segs.push(seg(run, x - 1, y, step, kind)); run = -1; }
          }
        }
      };
      scan(o.gap, o.step, true, 0, o.gap / 2);
      if (o.bgGap) scan(o.bgGap, o.bgStep, false, 1, o.bgGap / 2 + 1);
      this.segs = segs; this.dirty = true;
      return true;
    }
    press(x, y) {
      const tr = this.trail, l = tr[tr.length - 1];
      if (l && Math.hypot(l.x - x, l.y - y) < 5) return;
      tr.push({ x, y, life: 1 });
      if (tr.length > 30) tr.shift();
    }
    needs() { return this.dirty || this.T > 0.002 || this.trail.length > 0 || this.heat.some((z) => z.v > 0.004); }
    draw(dt) {
      const { ctx, w, h, o } = this;
      this.t += dt;
      const t = this.t, T = this.T, tr = this.trail, knots = this.knots, heat = this.heat;
      const had = tr.length;
      for (let i = tr.length - 1; i >= 0; i--) { tr[i].life -= dt * 1.5; if (tr[i].life <= 0) tr.splice(i, 1); }
      ctx.clearRect(0, 0, w, h);
      this.dirty = had > 0 && tr.length === 0;
      if (this.alpha <= 0.01) return;
      ctx.globalAlpha = this.alpha; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const R = o.radius, P = o.push, sp = this.spread, cy = this.cy;
      const [r0, g0, b0] = o.rgb;
      for (const s of this.segs) {
        const fg = s.kind === 0, xs = s.xs, n = xs.length;
        let glow = 0, hv = 0;
        if (fg && heat.length) {
          const mx = (xs[0] + xs[n - 1]) / 2;
          for (const z of heat) {
            if (z.v <= 0.004) continue;
            const dx = mx - z.x, dy = s.y - z.y;
            hv = Math.max(hv, Math.exp(-(dx * dx + dy * dy) / (z.r * z.r)) * z.v);
          }
        }
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
          let x = xs[i], y = s.y;
          if (T > 0.002) {
            for (const k of knots) {
              const dx = x - k.x, dy = y - k.y, f = Math.exp(-(dx * dx + dy * dy) / (k.r * k.r));
              if (f < 0.003) continue;
              const a = T * k.a * f * (1 + 0.18 * Math.sin(t * 1.4 + k.x)), c = Math.cos(a), sn = Math.sin(a);
              x = k.x + dx * c - dy * sn; y = k.y + dx * sn + dy * c;
            }
          }
          if (hv > 0.02) {
            for (const z of heat) {
              const dx = x - z.x, dy = y - z.y, f = Math.exp(-(dx * dx + dy * dy) / (z.r * z.r * 0.8));
              if (f < 0.01 || z.v < 0.01) continue;
              const a = z.v * 0.9 * f * Math.sin(t * 2.2 + z.x * 0.1), c = Math.cos(a), sn = Math.sin(a);
              x = z.x + dx * c - dy * sn; y = z.y + dx * sn + dy * c;
            }
          }
          const jit = T * 1.3 + hv * 0.9;
          if (jit > 0.02) y += jit * Math.sin(t * 13 + x * 0.09 + s.seed);
          for (let j = 0; j < tr.length; j++) {
            const p = tr[j], dy = y - p.y;
            if (dy > R || dy < -R) continue;
            const dx = x - p.x;
            if (dx > R || dx < -R) continue;
            const d = Math.sqrt(dx * dx + dy * dy) + 0.001;
            if (d < R) { const v = Math.exp((-d * d) / (R * R * 0.22)) * p.life; x += (dx / d) * v * P * 0.35; y += (dy / d) * v * P; if (v > glow) glow = v; }
          }
          if (sp) y = cy + (y - cy) * (1 + sp);
          if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
        }
        if (fg) {
          const gl = Math.min(1, glow * 1.8);
          let r = r0 + (239 - r0) * gl, g = g0 + (233 - g0) * gl, b = b0 + (221 - b0) * gl;
          if (hv > 0) { r += (227 - r) * hv; g += (176 - g) * hv; b += (92 - b) * hv; }
          ctx.strokeStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
          ctx.lineWidth = o.lw * (1 + gl * 0.5);
        } else {
          ctx.strokeStyle = `rgba(239,233,221,${o.bgA + glow * 0.35})`;
          ctx.lineWidth = 0.8;
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }
  function seg(x0, x1, y, step, kind) {
    const n = Math.max(2, Math.ceil((x1 - x0) / step) + 1), xs = new Float32Array(n);
    for (let i = 0; i < n; i++) xs[i] = x0 + ((x1 - x0) * i) / (n - 1);
    return { xs, y, kind, seed: Math.random() * 6.283 };
  }

  /* one loop drives every visible fibre field */
  const active = new Set();
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    for (const f of active) { if (f.pre) f.pre(dt); if (f.needs()) f.draw(dt); }
    requestAnimationFrame(loop);
  }
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    const f = e.target.__fib; if (!f) return;
    if (e.isIntersecting) { active.add(f); f.dirty = true; } else active.delete(f);
  }), { rootMargin: '80px 0px' });
  function watch(f) { f.cv.__fib = f; io.observe(f.cv); }
  function pointerOn(el, f) {
    if (still) return;
    const go = (e) => { const r = f.cv.getBoundingClientRect(); f.press(e.clientX - r.left, e.clientY - r.top); };
    el.addEventListener('pointermove', go, { passive: true });
    el.addEventListener('pointerdown', go, { passive: true });
  }
  const loadMask = () => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = './assets/revive-mask.webp'; });
  const rel = (el, cv) => { const a = el.getBoundingClientRect(), b = cv.getBoundingClientRect(); return { L: a.left - b.left, T: a.top - b.top, W: a.width, H: a.height }; };
  const wordKnots = (L, T, W, H) => [
    { x: L + W * 0.12, y: T + H * 0.55, r: H * 0.72, a: 2.7 },
    { x: L + W * 0.37, y: T + H * 0.42, r: H * 0.78, a: -3.0 },
    { x: L + W * 0.62, y: T + H * 0.6, r: H * 0.72, a: 2.8 },
    { x: L + W * 0.88, y: T + H * 0.46, r: H * 0.66, a: -2.5 },
  ];

  /* ---------------------------------------------------------------- smooth scroll */
  let lenis = null;
  if (hasGsap && window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);
  if (!still && window.Lenis && hasGsap) {
    lenis = new Lenis({ lerp: 0.1, autoRaf: false });
    lenis.on('scroll', () => window.ScrollTrigger && ScrollTrigger.update());
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  const scrollToHash = (hash) => {
    const target = hash === '#' ? 0 : $(hash);
    if (target === null) return;
    if (lenis) lenis.scrollTo(target, { offset: hash === '#' ? 0 : -76, duration: 1.4 });
    else if (target === 0) scrollTo({ top: 0 }); else target.scrollIntoView();
  };
  $$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
    const h = a.getAttribute('href');
    if (h.length > 1 && !$(h)) return;
    e.preventDefault(); closeMenu(); scrollToHash(h);
    if (h.length > 1) history.replaceState(null, '', h);
  }));

  /* ---------------------------------------------------------------- header + menu (nav.js) */
  const closeMenu = () => window.reviveNav && window.reviveNav.close();
  document.addEventListener('revive:menu', (e) => { if (lenis) e.detail.open ? lenis.stop() : lenis.start(); });

  /* ---------------------------------------------------------------- 01 hero */
  const heroEl = $('.hero'), heroCv = $('.hero-fibers'), heroStatic = $('.hero-static');
  const hero = new Fibers(heroCv, { rgb: [227, 200, 143] });
  const tensionEl = $('[data-tension]');
  let mask = null, introDone = still, userPressed = false;

  function layoutHero() {
    hero.size();
    const { L, T, W, H } = rel(heroStatic, heroCv);
    const gap = Math.max(3, Math.round(H / 58));
    Object.assign(hero.o, { gap, step: Math.max(3, gap * 0.8), lw: Math.max(0.9, gap * 0.34), bgGap: gap * 3, bgStep: 12, radius: Math.max(56, H * 0.3), push: Math.max(7, H * 0.045) });
    hero.cx = L + W / 2; hero.cy = T + H / 2;
    hero.knots = wordKnots(L, T, W, H);
    hero.box = { L, T, W, H };
    return hero.build((c) => c.drawImage(mask, L, T, W, H));
  }

  // Under reduced motion the intro drops its extras (no ghost stroke afterwards).
  const calmIntro = matchMedia('(prefers-reduced-motion: reduce)').matches && !/[?&]motion=on/.test(location.search);

  // ~2s in total, between the original 3.3s and the 1.4s that felt rushed. The tagline and buttons are never hidden.
  function heroIntro() {
    if (still || !hasGsap) { hero.T = 0; hero.dirty = true; introDone = true; tensionEl.textContent = '0'; tensionEl.parentElement.classList.add('calm'); return; }
    hero.T = 1; hero.alpha = 0;
    gsap.timeline({ delay: 0.05 })
      .to(hero, { alpha: 1, duration: 0.6, ease: 'power1.out', onUpdate: () => (hero.dirty = true) })
      .to(hero, {
        T: 0, duration: 1.9, ease: 'power3.inOut',
        onUpdate: () => { tensionEl.textContent = Math.round(hero.T * 100); },
        onComplete: () => { tensionEl.parentElement.classList.add('calm'); introDone = true; if (!calmIntro) setTimeout(ghostStroke, 500); },
      }, 0.1);
  }

  // If nobody has touched the fibres yet, one slow stroke shows that they can be pressed.
  function ghostStroke() {
    if (userPressed || !hero.box) return;
    const { L, W } = hero.box, p = { v: 0 };
    gsap.to(p, {
      v: 1, duration: 1.4, ease: 'sine.inOut',
      onUpdate: () => { if (!userPressed) hero.press(L + W * (0.04 + 0.92 * p.v), hero.cy + Math.sin(p.v * Math.PI * 2.5) * hero.box.H * 0.18); },
    });
  }

  if (!still) {
    const mark = () => { userPressed = true; };
    heroEl.addEventListener('pointermove', (e) => { if (introDone) { mark(); const r = heroCv.getBoundingClientRect(); hero.press(e.clientX - r.left, e.clientY - r.top); } }, { passive: true });
    heroEl.addEventListener('pointerdown', mark, { passive: true });
  }

  /* ---------------------------------------------------------------- 02 waar zit het vast: five panels */
  // Five tall close-ups of the body (front or back), drawn as contour lines like a relief map.
  // The panel you point at (or tap) widens, its zone turns gold and it shows the treatments that suit it.
  // Treatments can be combined; the choice is guidance only (Optios opens without a preselection).
  // Zone copy is our wording: check it with Glenn.
  const TREAT = {
    bovenlichaam: { name: 'Sportmassage bovenlichaam', min: 30 },
    fullbody: { name: 'Sportmassage full body', min: 60 },
    benen: { name: 'Sportmassage benen', min: 30 },
    deep: { name: 'Deep tissue', min: 60 },
    cupping: { name: 'Cupping therapie', min: 30 },
  };
  const T_ORDER = ['bovenlichaam', 'fullbody', 'benen', 'deep', 'cupping'];
  // zone spots in a 240×520 figure space
  const ZONES = {
    nek: { spots: [[120, 76]], r: 20 }, schouders: { spots: [[68, 122], [172, 122]], r: 24 },
    bovenrug: { spots: [[120, 158]], r: 32 }, onderrug: { spots: [[120, 234]], r: 32 },
    onderarmen: { spots: [[25, 252], [215, 252]], r: 19 }, bilspieren: { spots: [[98, 292], [142, 292]], r: 26 },
    hamstrings: { spots: [[97, 362], [143, 362]], r: 24 }, kuiten: { spots: [[94, 440], [146, 440]], r: 21 },
    voorschouders: { spots: [[62, 124], [178, 124]], r: 20 }, borst: { spots: [[96, 148], [144, 148]], r: 26 },
    armen: { spots: [[40, 174], [200, 174]], r: 18 }, buik: { spots: [[120, 222]], r: 28 },
    heupbuigers: { spots: [[100, 278], [140, 278]], r: 20 }, bovenbenen: { spots: [[97, 352], [143, 352]], r: 24 },
    scheenbenen: { spots: [[95, 442], [145, 442]], r: 18 },
  };
  // view = horizontal centre of the crop in figure space, span = how much figure height fits in a panel
  const PANELS = {
    front: [
      { label: 'Borst & schouders', copy: 'Bankdrukken, zwemmen, duwen of veel achter het stuur.', fit: ['bovenlichaam', 'cupping'], zones: ['voorschouders', 'borst'], view: 120, span: 210 },
      { label: 'Armen', copy: 'Krachttraining, tillen, dragen en grijpen.', fit: ['bovenlichaam', 'fullbody'], zones: ['armen'], view: 42, span: 220 },
      { label: 'Buik & core', copy: 'Core-training, roeien, veel draaien en buigen.', fit: ['fullbody', 'deep'], zones: ['buik'], view: 120, span: 210 },
      { label: 'Heupbuigers', copy: 'Lang zitten, sprinten of fietsen.', fit: ['benen', 'deep'], zones: ['heupbuigers'], view: 120, span: 210 },
      { label: 'Benen', copy: 'Bovenbenen en schenen na fietsen, squatten of hardlopen op harde grond.', fit: ['benen', 'fullbody'], zones: ['bovenbenen', 'scheenbenen'], view: 120, span: 230 },
    ],
    back: [
      { label: 'Nek & schouders', copy: 'Schermwerk, stress, zwemmen of tillen boven je hoofd.', fit: ['bovenlichaam', 'cupping', 'deep'], zones: ['nek', 'schouders'], view: 120, span: 190 },
      { label: 'Rug', copy: 'Lang voorovergebogen zitten, tillen of zwaar fysiek werk.', fit: ['bovenlichaam', 'deep', 'fullbody'], zones: ['bovenrug', 'onderrug'], view: 120, span: 210 },
      { label: 'Armen', copy: 'Grijpen, klimmen, judo of werken met je handen.', fit: ['bovenlichaam', 'fullbody'], zones: ['onderarmen'], view: 40, span: 230 },
      { label: 'Heupen & bilspieren', copy: 'Lopen, fietsen, zware squats of uren stilzitten.', fit: ['benen', 'deep', 'fullbody'], zones: ['bilspieren'], view: 120, span: 200 },
      { label: 'Benen', copy: 'Hamstrings en kuiten na het lopen, voetbal of een dag rechtstaan.', fit: ['benen', 'cupping'], zones: ['hamstrings', 'kuiten'], view: 120, span: 230 },
    ],
  };
  const FIRST = { front: 0, back: 1 };

  // the figure as a white mask (k = scale to px, tx/ty = offset in px)
  function drawBody(c, side, k, tx, ty) {
    c.save(); c.translate(tx, ty); c.scale(k, k);
    c.fillStyle = c.strokeStyle = '#fff'; c.lineCap = 'round';
    const cap = (x1, y1, x2, y2, r) => { c.lineWidth = r * 2; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); };
    const ell = (x, y, rx, ry) => { c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, 7); c.fill(); };
    const poly = (p) => { c.beginPath(); p.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.fill(); };
    const both = (fn) => { fn((x) => x); fn((x) => 240 - x); };
    const curve = (m, x0, y0, cx, cy, x1, y1) => { c.beginPath(); c.moveTo(m(x0), y0); c.quadraticCurveTo(m(cx), cy, m(x1), y1); c.stroke(); };
    ell(120, 38, 23, 29);
    cap(120, 60, 120, 96, 14);
    poly([[104, 82], [136, 82], [182, 106], [190, 124], [50, 124], [58, 106]]);
    poly([[56, 112], [184, 112], [176, 190], [164, 262], [76, 262], [64, 190]]);
    both((m) => { ell(m(58), 128, 20, 20); cap(m(46), 136, m(32), 212, 14); cap(m(32), 212, m(22), 290, 11); ell(m(19), 310, 10, 16); });
    ell(98, 292, 31, 36); ell(142, 292, 31, 36); ell(120, 280, 50, 30);
    both((m) => { cap(m(98), 312, m(95), 404, 24); cap(m(95), 404, m(95), 488, 14); ell(m(93), 438, 18, 32); ell(m(95), 503, 13, 9); });
    c.globalCompositeOperation = 'destination-out';
    cap(120, 334, 120, 520, 3);
    c.lineWidth = 1.6;
    if (side === 'back') {
      cap(120, 104, 120, 252, 1.1);
      cap(120, 282, 120, 326, 1.2);
      both((m) => curve(m, 86, 130, 80, 162, 102, 180));
    } else {
      both((m) => curve(m, 112, 104, 88, 100, 64, 112));
      both((m) => curve(m, 70, 152, 90, 184, 118, 172));
      cap(120, 120, 120, 168, 0.9);
      cap(120, 190, 120, 250, 0.9);
    }
    c.restore();
  }

  // Contour renderer: same interface as Fibers (size, build, heat, press, needs, draw) so the shared loop drives it.
  // A distance field (how deep each point lies inside the body) is cut into iso-lines with marching squares.
  const C_BASE = [150, 143, 131], C_BONE = [239, 233, 221], C_GOLD = [227, 176, 92];
  const cmix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const MS = [[], [[3, 0]], [[0, 1]], [[3, 1]], [[1, 2]], [[3, 0], [1, 2]], [[0, 2]], [[3, 2]], [[2, 3]], [[0, 2]], [[0, 1], [2, 3]], [[1, 2]], [[1, 3]], [[0, 1]], [[3, 0]], []];
  class Contour {
    constructor(canvas) { this.cv = canvas; this.ctx = canvas.getContext('2d'); this.heat = []; this.trail = []; this.dirty = true; this.w = 0; this.h = 0; }
    size() {
      const r = this.cv.getBoundingClientRect();
      this.w = Math.round(r.width); this.h = Math.round(r.height);
      this.cv.width = this.w * DPR; this.cv.height = this.h * DPR;
      this.ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
    build(drawMask) {
      const { w, h } = this, cell = 3;
      if (!w || !h) return false;
      const off = document.createElement('canvas');
      off.width = w; off.height = h;
      const c = off.getContext('2d', { willReadFrequently: true });
      drawMask(c);
      let data;
      try { data = c.getImageData(0, 0, w, h).data; } catch (e) { return false; }
      const cols = Math.ceil(w / cell) + 1, rows = Math.ceil(h / cell) + 1, d = new Float32Array(cols * rows), S = Math.SQRT2;
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) d[j * cols + i] = data[(Math.min(h - 1, j * cell) * w + Math.min(w - 1, i * cell)) * 4 + 3] > 110 ? 1e9 : 0;
      // two-pass chamfer distance, then two 3×3 box passes against the pixel staircase
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        const k = j * cols + i; let v = d[k]; if (!v) continue;
        if (i > 0) v = Math.min(v, d[k - 1] + 1);
        if (j > 0) { v = Math.min(v, d[k - cols] + 1); if (i > 0) v = Math.min(v, d[k - cols - 1] + S); if (i < cols - 1) v = Math.min(v, d[k - cols + 1] + S); }
        d[k] = v;
      }
      for (let j = rows - 1; j >= 0; j--) for (let i = cols - 1; i >= 0; i--) {
        const k = j * cols + i; let v = d[k]; if (!v) continue;
        if (i < cols - 1) v = Math.min(v, d[k + 1] + 1);
        if (j < rows - 1) { v = Math.min(v, d[k + cols] + 1); if (i < cols - 1) v = Math.min(v, d[k + cols + 1] + S); if (i > 0) v = Math.min(v, d[k + cols - 1] + S); }
        d[k] = v;
      }
      for (let k = 0; k < d.length; k++) d[k] = d[k] > 1e8 ? 0 : d[k] * cell;
      const tmp = new Float32Array(d.length);
      for (let pass = 0; pass < 2; pass++) {
        for (let j = 1; j < rows - 1; j++) for (let i = 1; i < cols - 1; i++) {
          const k = j * cols + i;
          tmp[k] = (d[k - cols - 1] + d[k - cols] + d[k - cols + 1] + d[k - 1] + d[k] + d[k + 1] + d[k + cols - 1] + d[k + cols] + d[k + cols + 1]) / 9;
        }
        for (let j = 1; j < rows - 1; j++) for (let i = 1; i < cols - 1; i++) d[j * cols + i] = tmp[j * cols + i];
      }
      const L = Math.max(6, Math.round(h / 80)), first = cell * 0.9, segs = [], lev = [];
      const lerp = (a, b, v) => (b === a ? 0.5 : (v - a) / (b - a));
      for (let j = 0; j < rows - 1; j++) for (let i = 0; i < cols - 1; i++) {
        const k = j * cols + i, v0 = d[k], v1 = d[k + 1], v2 = d[k + cols + 1], v3 = d[k + cols], hi = Math.max(v0, v1, v2, v3);
        if (hi < first) continue;
        const lo = Math.min(v0, v1, v2, v3), x0 = i * cell, y0 = j * cell;
        for (let n = Math.max(0, Math.ceil((lo - first) / L)); first + n * L <= hi; n++) {
          const lv = first + n * L, cs = (v0 > lv) | ((v1 > lv) << 1) | ((v2 > lv) << 2) | ((v3 > lv) << 3);
          if (!cs || cs === 15) continue;
          const pt = (e) => (e === 0 ? [x0 + cell * lerp(v0, v1, lv), y0] : e === 1 ? [x0 + cell, y0 + cell * lerp(v1, v2, lv)] : e === 2 ? [x0 + cell * lerp(v3, v2, lv), y0 + cell] : [x0, y0 + cell * lerp(v0, v3, lv)]);
          for (const [a, b] of MS[cs]) { const p = pt(a), q = pt(b); segs.push(p[0], p[1], q[0], q[1]); lev.push(n); }
        }
      }
      this.segs = new Float32Array(segs); this.lev = lev; this.R = Math.max(50, h * 0.12); this.dirty = true;
      return true;
    }
    hv(x, y) {
      let m = 0;
      for (const z of this.heat) { if (z.v <= 0.004) continue; const dx = x - z.x, dy = y - z.y; m = Math.max(m, Math.exp(-(dx * dx + dy * dy) / (z.r * z.r * 1.6)) * z.v); }
      return Math.min(1, m * 1.5);
    }
    pv(x, y) {
      let m = 0; const R = this.R;
      for (const p of this.trail) { const dx = x - p.x, dy = y - p.y; if (dx > R || dx < -R || dy > R || dy < -R) continue; m = Math.max(m, Math.exp(-(dx * dx + dy * dy) / (R * R * 0.25)) * p.life); }
      return m;
    }
    press(x, y) {
      const tr = this.trail, l = tr[tr.length - 1];
      if (l && Math.hypot(l.x - x, l.y - y) < 5) return;
      tr.push({ x, y, life: 1 });
      if (tr.length > 24) tr.shift();
    }
    needs() { return this.dirty || this.trail.length > 0; }
    draw(dt) {
      const tr = this.trail, had = tr.length;
      for (let i = tr.length - 1; i >= 0; i--) { tr[i].life -= dt * 1.5; if (tr[i].life <= 0) tr.splice(i, 1); }
      this.dirty = had > 0 && tr.length === 0;
      const { ctx, segs, lev } = this;
      ctx.clearRect(0, 0, this.w, this.h);
      if (!segs) return;
      // bucket segments by tone (outline / gold heat / pointer) so each tone is one stroke
      const buckets = new Map();
      for (let s = 0, n = lev.length; s < n; s++) {
        const mx = (segs[s * 4] + segs[s * 4 + 2]) / 2, my = (segs[s * 4 + 1] + segs[s * 4 + 3]) / 2;
        const key = Math.round(this.hv(mx, my) * 6) * 100 + (tr.length ? Math.round(this.pv(mx, my) * 4) : 0) * 10 + (lev[s] === 0 ? 1 : 0);
        let b = buckets.get(key); if (!b) buckets.set(key, (b = []));
        b.push(segs[s * 4], segs[s * 4 + 1], segs[s * 4 + 2], segs[s * 4 + 3]);
      }
      ctx.lineCap = 'round';
      for (const [key, b] of buckets) {
        const hq = Math.floor(key / 100), pq = Math.floor(key / 10) % 10, oq = key % 10;
        const col = cmix(cmix(cmix(C_BASE, C_BONE, oq ? 0.45 : 0), C_GOLD, hq / 6), C_BONE, (pq / 4) * 0.8);
        ctx.strokeStyle = `rgb(${col[0] | 0},${col[1] | 0},${col[2] | 0})`;
        ctx.lineWidth = oq ? 1.5 : 1.1 + hq * 0.14;
        ctx.beginPath();
        for (let i = 0; i < b.length; i += 4) { ctx.moveTo(b[i], b[i + 1]); ctx.lineTo(b[i + 2], b[i + 3]); }
        ctx.stroke();
      }
    }
  }

  // treatment menu: all five items, the ones that suit the zone marked; two or more is fine
  const chosen = new Set();
  const menuHTML = (fit, label) => `<div class="rv-menu"><p class="rv-menu-k"><span>Kies je behandeling</span><span class="rv-menu-fit">past bij ${label.toLowerCase()}</span></p><ul>`
    + T_ORDER.map((id) => `<li><button type="button" class="rv-opt${fit.includes(id) ? ' fit' : ''}" data-t="${id}" aria-pressed="${chosen.has(id)}"><span class="rv-n">${TREAT[id].name}</span><small>${TREAT[id].min} min</small><i aria-hidden="true"></i></button></li>`).join('')
    + '</ul></div>';
  const mapEl = $('.vc'), row = $('.vc-row', mapEl), trayEl = $('.rv-tray', mapEl), sumEl = $('[data-rv-sum]', mapEl);
  function syncMenus() {
    $$('.rv-opt', mapEl).forEach((b) => b.setAttribute('aria-pressed', String(chosen.has(b.dataset.t))));
    const on = T_ORDER.filter((id) => chosen.has(id)), min = on.reduce((t, id) => t + TREAT[id].min, 0);
    sumEl.textContent = on.length ? `${on.map((id) => TREAT[id].name).join(' + ')} · ${min} min` : 'Nog niets gekozen. Meerdere mag.';
    trayEl.classList.toggle('has', on.length > 0);
  }
  mapEl.addEventListener('click', (e) => {
    const b = e.target.closest('.rv-opt');
    if (!b) return;
    if (chosen.has(b.dataset.t)) chosen.delete(b.dataset.t); else chosen.add(b.dataset.t);
    syncMenus();
  });

  const pad2 = (n) => String(n).padStart(2, '0');
  let side = 'front', panels = [], panelsReady = false, panelsWatched = false;

  function buildPanels() {
    row.innerHTML = '';
    panels = PANELS[side].map((p, i) => {
      const el = document.createElement('div');
      el.className = 'vc-panel';
      el.innerHTML = `<canvas aria-hidden="true"></canvas><button class="vc-hit" type="button" aria-expanded="false" aria-label="${p.label}"></button>`
        + `<span class="vc-no" aria-hidden="true">${pad2(i + 1)}</span><span class="vc-label" aria-hidden="true">${p.label}</span>`
        + `<div class="vc-body"><h3>${p.label}</h3><p>${p.copy}</p>${menuHTML(p.fit, p.label)}</div>`;
      row.appendChild(el);
      const it = { p, el, f: new Contour($('canvas', el)), k: 1, tx: 0, ty: 0, v: 0 };
      if (fine) el.addEventListener('pointerenter', () => openPanel(i));
      $('.vc-hit', el).addEventListener('click', () => openPanel(i));
      pointerOn(el, it.f);
      return it;
    });
  }

  function panelHeat(it) {
    it.f.heat = it.v > 0.004 ? it.p.zones.flatMap((id) => ZONES[id].spots.map(([x, y]) => ({ x: x * it.k + it.tx, y: y * it.k + it.ty, r: ZONES[id].r * it.k, v: it.v }))) : [];
    it.f.dirty = true;
    if (still && html.classList.contains('fib-ready')) it.f.draw(0);
  }

  function openPanel(i) {
    panels.forEach((it, j) => {
      const on = j === i, to = on ? 1 : 0;
      it.el.classList.toggle('on', on);
      $('.vc-hit', it.el).setAttribute('aria-expanded', String(on));
      $('.vc-body', it.el).toggleAttribute('inert', !on);
      if (hasGsap && !still) gsap.to(it, { v: to, duration: on ? 0.9 : 0.4, delay: on ? 0.25 : 0, ease: 'power2.out', overwrite: 'auto', onUpdate: () => panelHeat(it) });
      else { it.v = to; panelHeat(it); }
    });
  }

  // every canvas is drawn at the panel's OPEN size and centred, so widening only reveals more of it;
  // the zone sits in the top quarter, clear of the text in the lower half of an open panel
  function layoutPanels() {
    const mobile = innerWidth <= 760, rw = row.clientWidth, gap = 10, n = panels.length;
    const W = mobile ? rw : Math.round(((rw - gap * (n - 1)) * 3.4) / (3.4 + n - 1));
    const H = mobile ? Math.round(Math.min(640, innerHeight * 0.88)) : row.clientHeight;
    let ok = true;
    panels.forEach((it) => {
      it.f.cv.style.width = W + 'px'; it.f.cv.style.height = H + 'px';
      it.f.size();
      const k = H / it.p.span, fy = it.p.zones.reduce((t, id) => t + ZONES[id].spots[0][1], 0) / it.p.zones.length;
      it.k = k; it.tx = W / 2 - it.p.view * k; it.ty = H * 0.25 - fy * k;
      ok = it.f.build((c) => drawBody(c, side, k, it.tx, it.ty)) && ok;
      panelHeat(it);
    });
    panelsReady = true;
    return ok;
  }

  function setSide(next) {
    if (next === side) return;
    $$('[data-side]', mapEl).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.side === next)));
    $('.vc-side', mapEl).dataset.on = next;
    const swap = () => {
      side = next;
      buildPanels(); openPanel(FIRST[next]);
      if (panelsReady) layoutPanels();
      if (panelsWatched) panels.forEach((it) => watch(it.f));
      if (still) panels.forEach((it) => it.f.draw(0));
    };
    if (!hasGsap || still) { swap(); return; }
    gsap.timeline()
      .to(panels.map((it) => it.el), { opacity: 0, y: 14, duration: 0.28, ease: 'power2.in', stagger: 0.03 })
      .add(() => { swap(); gsap.fromTo(panels.map((it) => it.el), { opacity: 0, y: -14 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out', stagger: 0.05 }); });
  }
  $$('[data-side]', mapEl).forEach((b) => b.addEventListener('click', () => setSide(b.dataset.side)));
  buildPanels(); openPanel(FIRST.front); syncMenus();

  /* ---------------------------------------------------------------- 07 footer wordmark */
  const footMark = $('.foot-mark'), footCv = $('.foot-fibers'), footStatic = $('.foot-static');
  const foot = new Fibers(footCv, { rgb: [194, 154, 85] });
  function layoutFoot() {
    foot.size();
    const { L, T, W, H } = rel(footStatic, footCv);
    const gap = Math.max(3, Math.round(H / 52));
    Object.assign(foot.o, { gap, step: Math.max(3, gap * 0.8), lw: Math.max(0.9, gap * 0.36), radius: Math.max(50, H * 0.3), push: Math.max(7, H * 0.045) });
    foot.cy = T + H / 2; foot.knots = wordKnots(L, T, W, H);
    return foot.build((c) => c.drawImage(mask, L, T, W, H));
  }
  pointerOn(footMark, foot);

  /* ---------------------------------------------------------------- boot */
  function layoutAll() {
    const ok = layoutHero() & layoutPanels() & layoutFoot();
    return ok;
  }
  loadMask().then(async (img) => {
    mask = img;
    if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch (e) { /* fonts optional */ } }
    if (!layoutAll()) return; // canvas unreadable (file://): the flat wordmarks stay visible
    html.classList.add('fib-ready');
    [hero, foot].forEach(watch); panels.forEach((it) => watch(it.f)); panelsWatched = true;
    if (still) { [hero, foot, ...panels.map((it) => it.f)].forEach((f) => f.draw(0)); return; }
    requestAnimationFrame(loop);
    heroIntro();
    if (hasGsap && window.ScrollTrigger) {
      ScrollTrigger.create({ trigger: heroEl, start: 'top top', end: 'bottom top', scrub: true,
        onUpdate: (st) => { hero.spread = st.progress * 0.9; hero.alpha = introDone ? 1 - st.progress * 0.9 : hero.alpha; hero.dirty = true; } });
      foot.T = 0.85;
      ScrollTrigger.create({ trigger: footMark, start: 'top 85%', once: true,
        onEnter: () => gsap.to(foot, { T: 0, duration: 1.9, ease: 'power3.inOut' }) }); // same release as the hero intro
    }
  }).catch(() => {});

  let lastW = innerWidth;
  addEventListener('resize', () => {
    if (Math.abs(innerWidth - lastW) < 2 && innerWidth <= 900) return; // mobile URL bar
    lastW = innerWidth;
    clearTimeout(window.__rz);
    window.__rz = setTimeout(() => { if (mask) { layoutAll(); [hero, foot].forEach((f) => (f.dirty = true)); if (still) [hero, foot, ...panels.map((it) => it.f)].forEach((f) => f.draw(0)); } if (window.ScrollTrigger) ScrollTrigger.refresh(); }, 160);
  });

  /* ---------------------------------------------------------------- 03 treatments: the cup */
  const rows = $$('.t-row'), rowList = $('.t-rows'), cup = $('.cup'), cupImg = $('.cup-img');
  if (hasGsap && !still && fine && cup) {
    gsap.set(cup, { scale: 0.4, opacity: 0 });
    const xTo = gsap.quickTo(cup, 'x', { duration: 0.55, ease: 'power3' }), yTo = gsap.quickTo(cup, 'y', { duration: 0.55, ease: 'power3' });
    addEventListener('pointermove', (e) => { xTo(e.clientX); yTo(e.clientY); }, { passive: true });
    rows.forEach((r) => r.addEventListener('pointerenter', () => {
      if (innerWidth <= 640) return;
      cupImg.style.backgroundImage = `url(${r.dataset.img})`;
      rowList.classList.add('cupping');
      gsap.to(cup, { opacity: 1, scale: 1, duration: 0.6, ease: 'back.out(1.7)', overwrite: 'auto' });
      gsap.fromTo(cupImg, { scale: 1.25 }, { scale: 1, duration: 0.9, ease: 'power3.out' });
    }));
    rowList.addEventListener('pointerleave', () => { rowList.classList.remove('cupping'); gsap.to(cup, { opacity: 0, scale: 0.4, duration: 0.35, ease: 'power2.in', overwrite: 'auto' }); });
    rowList.addEventListener('pointerdown', () => gsap.to(cupImg, { scale: 1.14, duration: 0.25, ease: 'power2.out' }));
    addEventListener('pointerup', () => gsap.to(cupImg, { scale: 1, duration: 0.5, ease: 'elastic.out(1,.5)' }));
  }

  /* ---------------------------------------------------------------- scroll choreography */
  if (hasGsap && window.ScrollTrigger && !still) {
    $$('.h-big').forEach((h) => {
      if (h.closest('.hero')) return;
      gsap.from(h, { yPercent: 18, opacity: 0, duration: 1.1, ease: 'power3.out', scrollTrigger: { trigger: h, start: 'top 88%' } });
    });
    gsap.from('.vc-panel', { opacity: 0, y: 40, duration: 1, ease: 'power3.out', stagger: 0.08, scrollTrigger: { trigger: '.vc-row', start: 'top 80%' } });
    gsap.from('.t-row', { opacity: 0, y: 40, duration: 1, ease: 'power3.out', stagger: 0.12, scrollTrigger: { trigger: '.t-rows', start: 'top 82%' } });
    gsap.from('.first-steps li', { opacity: 0, y: 24, duration: 0.9, ease: 'power3.out', stagger: 0.1, scrollTrigger: { trigger: '.first', start: 'top 85%' } });

    // Glenn: his sports light up one by one, ending at the table
    $$('.sports li').forEach((li) => ScrollTrigger.create({ trigger: li, start: 'top 72%', onEnter: () => li.classList.add('on'), onLeaveBack: () => li.classList.remove('on') }));
    gsap.fromTo('.glenn-photo img', { clipPath: 'inset(100% 0 0 0)', scale: 1.18 }, { clipPath: 'inset(0% 0 0 0)', scale: 1, duration: 1.5, ease: 'power4.out', scrollTrigger: { trigger: '.glenn-photo', start: 'top 80%' } });

    // Reviews: each quote arrives compressed and in brass, and relaxes as it reaches the reader
    $$('.q').forEach((q) => {
      gsap.fromTo(q, { scaleX: 0.72, color: '#c29a55', opacity: 0.35 }, { scaleX: 1, color: '#efe9dd', opacity: 1, ease: 'none', scrollTrigger: { trigger: q, start: 'top 95%', end: 'top 52%', scrub: 0.6 } });
    });
    gsap.from('.foot-cols > div', { opacity: 0, y: 24, duration: 0.9, stagger: 0.1, ease: 'power3.out', scrollTrigger: { trigger: '.foot-cols', start: 'top 90%' } });
  } else {
    $$('.sports li').forEach((li) => li.classList.add('on'));
  }
})();
