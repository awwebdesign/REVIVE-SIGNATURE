/* Revive · signature build
   One idea runs through the page: vast → los.
   A shared canvas "fibre" renderer draws shapes (the wordmark, a body) as rows of muscle fibre.
   Fibres can be knotted (tension), pushed by the pointer (pressure) and heated (a sore zone). */
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
          if (hv > 0) { r += (210 - r) * hv; g += (85 - g) * hv; b += (42 - b) * hv; }
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

  /* ---------------------------------------------------------------- header + menu */
  const top = $('.top'), burger = $('.top-burger'), menu = $('#menu');
  const onScroll = () => top.classList.toggle('solid', (lenis ? lenis.scroll : scrollY) > 40);
  if (lenis) lenis.on('scroll', onScroll); else addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  function closeMenu() {
    if (!html.classList.contains('menu-open')) return;
    html.classList.remove('menu-open'); menu.inert = true;
    burger.setAttribute('aria-expanded', 'false'); burger.setAttribute('aria-label', 'Menu openen');
    if (lenis) lenis.start();
  }
  burger.addEventListener('click', () => {
    if (html.classList.contains('menu-open')) return closeMenu();
    html.classList.add('menu-open'); menu.inert = false;
    burger.setAttribute('aria-expanded', 'true'); burger.setAttribute('aria-label', 'Menu sluiten');
    if (lenis) lenis.stop();
  });
  addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });

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

  function heroIntro() {
    const foot = $$('.hero-foot > *, .hero-meta');
    if (still || !hasGsap) { hero.T = 0; tensionEl.textContent = '0'; tensionEl.parentElement.classList.add('calm'); return; }
    hero.T = 1; hero.alpha = 0;
    gsap.set(foot, { opacity: 0, y: 18 });
    const tl = gsap.timeline({ delay: 0.15 });
    tl.to(hero, { alpha: 1, duration: 0.9, ease: 'power1.out', onUpdate: () => (hero.dirty = true) })
      .to(hero, {
        T: 0, duration: 2.7, ease: 'power3.inOut',
        onUpdate: () => { tensionEl.textContent = Math.round(hero.T * 100); },
        onComplete: () => { tensionEl.parentElement.classList.add('calm'); introDone = true; setTimeout(ghostStroke, 900); },
      }, 0.35)
      .to(foot, { opacity: 1, y: 0, duration: 1, ease: 'power3.out', stagger: 0.08 }, 2.1);
  }

  // If nobody has touched the fibres yet, one slow stroke shows that they can be pressed.
  function ghostStroke() {
    if (userPressed || !hero.box) return;
    const { L, W } = hero.box, p = { v: 0 };
    gsap.to(p, {
      v: 1, duration: 1.9, ease: 'sine.inOut',
      onUpdate: () => { if (!userPressed) hero.press(L + W * (0.04 + 0.92 * p.v), hero.cy + Math.sin(p.v * Math.PI * 2.5) * hero.box.H * 0.18); },
    });
  }

  if (!still) {
    const mark = () => { userPressed = true; };
    heroEl.addEventListener('pointermove', (e) => { if (introDone) { mark(); const r = heroCv.getBoundingClientRect(); hero.press(e.clientX - r.left, e.clientY - r.top); } }, { passive: true });
    heroEl.addEventListener('pointerdown', mark, { passive: true });
  }

  /* ---------------------------------------------------------------- 02 body map */
  const ZONES = {
    nek: { label: 'Nek', title: 'Vast in je nek?', when: 'Lange dagen achter een scherm, stress die zich vastzet, zwaar trek- en duwwerk.', fit: ['sportmassage', 'deep-tissue'], quote: ['Geblokkeerde schouder/nek volledig verholpen.', 'Kim d’Haenens'], spots: [[120, 76]], r: 20 },
    schouders: { label: 'Schouders', title: 'Vast in je schouders?', when: 'Overhead trainen, zwemmen, vechtsport of werken boven je hoofd.', fit: ['sportmassage', 'cupping'], quote: ['Geblokkeerde schouder/nek volledig verholpen.', 'Kim d’Haenens'], spots: [[68, 122], [172, 122]], r: 24 },
    bovenrug: { label: 'Bovenrug', title: 'Vast tussen je schouderbladen?', when: 'Veel zitten, rijden of tillen, en een houding die je de hele dag aanhoudt.', fit: ['deep-tissue', 'cupping'], spots: [[120, 158]], r: 32 },
    onderrug: { label: 'Onderrug', title: 'Vast in je onderrug?', when: 'Tillen op de werf, deadlifts, lang rechtstaan of net lang stilzitten.', fit: ['deep-tissue', 'sportmassage'], quote: ['Sinds ik mijn rug laat behandelen gaat alles stukken beter.', 'Mille Pelacuer'], spots: [[120, 234]], r: 32 },
    heupen: { label: 'Heupen & bilspieren', title: 'Vast in je heupen?', when: 'Lopen, fietsen, squatten of uren in de auto.', fit: ['sportmassage', 'deep-tissue'], spots: [[98, 292], [142, 292]], r: 26 },
    hamstrings: { label: 'Hamstrings', title: 'Vast achter je dijen?', when: 'Sprinten, voetbal, lopen, en spieren die kort aanvoelen na een dag zitten.', fit: ['sportmassage'], spots: [[97, 362], [143, 362]], r: 24 },
    kuiten: { label: 'Kuiten', title: 'Vast in je kuiten?', when: 'Kilometers lopen, springen of de hele dag rechtstaan.', fit: ['sportmassage', 'cupping'], spots: [[94, 440], [146, 440]], r: 21 },
    onderarmen: { label: 'Onderarmen', title: 'Vast in je onderarmen?', when: 'Grip en klimwerk, gereedschap, typen en de muis.', fit: ['sportmassage', 'deep-tissue'], spots: [[25, 252], [215, 252]], r: 19 },
  };
  const TNAME = { sportmassage: 'Sportmassage', 'deep-tissue': 'Deep tissue', cupping: 'Cupping' };
  const bodyFig = $('.body-fig'), bodyCv = $('.body-fibers'), dotsEl = $('.body-dots'), listEl = $('.zone-list');
  const hintEl = $('[data-hint]'), hintWrap = $('.body-hint');
  const body = new Fibers(bodyCv, { rgb: [227, 200, 143] });
  const panelEmpty = $('.zone-empty'), card = $('.zone-card'), zf = (k) => $(`[data-z="${k}"]`, card);
  const rub = fine ? 'Masseer het los met je muis' : 'Wrijf het los met je vinger';
  let cur = null, curId = null, loose = false;

  function drawBody(c, w) {
    const s = w / 240;
    c.save(); c.scale(s, s);
    c.fillStyle = c.strokeStyle = '#fff'; c.lineCap = 'round';
    const cap = (x1, y1, x2, y2, r) => { c.lineWidth = r * 2; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); };
    const ell = (x, y, rx, ry) => { c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, 7); c.fill(); };
    const poly = (p) => { c.beginPath(); p.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.fill(); };
    const both = (fn) => { fn((x) => x); fn((x) => 240 - x); };
    ell(120, 38, 23, 29);
    cap(120, 60, 120, 96, 14);
    poly([[104, 82], [136, 82], [182, 106], [190, 124], [50, 124], [58, 106]]);
    poly([[56, 112], [184, 112], [176, 190], [164, 262], [76, 262], [64, 190]]);
    both((m) => { ell(m(58), 128, 20, 20); cap(m(46), 136, m(32), 212, 14); cap(m(32), 212, m(22), 290, 11); ell(m(19), 310, 10, 16); });
    ell(98, 292, 31, 36); ell(142, 292, 31, 36); ell(120, 280, 50, 30);
    both((m) => { cap(m(98), 312, m(95), 404, 24); cap(m(95), 404, m(95), 488, 14); ell(m(93), 438, 18, 32); ell(m(95), 503, 13, 9); });
    c.globalCompositeOperation = 'destination-out';
    cap(120, 104, 120, 252, 1.1);
    cap(120, 282, 120, 326, 1.2);
    cap(120, 334, 120, 520, 3);
    c.lineWidth = 1.6;
    both((m) => { c.beginPath(); c.moveTo(m(86), 130); c.quadraticCurveTo(m(80), 162, m(102), 180); c.stroke(); });
    c.restore();
  }

  function layoutBody() {
    body.size();
    const gap = Math.max(3, Math.round(body.w / 82));
    Object.assign(body.o, { gap, step: 3, lw: Math.max(0.9, gap * 0.42), radius: Math.max(26, body.w * 0.11), push: Math.max(4, body.w * 0.02) });
    body.s = body.w / 240;
    if (cur) setHeat(true);
    return body.build((c, w) => drawBody(c, w));
  }

  function setHeat(keep) {
    const s = body.s;
    body.heat = cur.spots.map(([x, y]) => ({ x: x * s, y: y * s, r: cur.r * s, v: 0, h: keep ? 1 : 0, c: 0 }));
    if (!keep && hasGsap && !still) gsap.to(body.heat, { h: 1, duration: 1, ease: 'power2.out' });
    else body.heat.forEach((z) => { z.h = 1; z.v = still ? 1 : 0; });
  }

  function select(id, fromUser) {
    curId = id; cur = ZONES[id]; loose = false;
    $$('button', dotsEl).concat($$('button', listEl)).forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.zone === id)); b.classList.remove('loose');
    });
    zf('label').classList.remove('loose');
    setHeat(false); body.dirty = true;
    if (still && html.classList.contains('fib-ready')) body.draw(0);
    zf('label').textContent = cur.label;
    zf('title').textContent = cur.title;
    zf('when').textContent = cur.when;
    zf('start').innerHTML = cur.fit.map((k) => `<a href="#${k}">${TNAME[k]}</a>`).join('');
    const q = zf('quote');
    if (cur.quote) { q.hidden = false; q.innerHTML = `“${cur.quote[0]}”<cite>${cur.quote[1]} · Google-review</cite>`; } else q.hidden = true;
    zf('start').querySelectorAll('a').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); scrollToHash(a.getAttribute('href')); }));
    panelEmpty.hidden = true; card.hidden = false;
    card.classList.remove('enter'); void card.offsetWidth; card.classList.add('enter');
    hintEl.textContent = still ? cur.label : rub; hintWrap.classList.remove('loose');
    if (fromUser && innerWidth <= 900) { /* keep the panel in view on phones */ }
  }

  // rubbing over a hot zone cools it; when it's cool, the zone is "los"
  body.pre = (dt) => {
    if (!cur || loose || !body.heat.length) return;
    let warm = 0;
    for (const z of body.heat) {
      for (const p of body.trail) {
        if (p.life < 0.6) continue;
        const d = Math.hypot(p.x - z.x, p.y - z.y);
        if (d < z.r * 1.5) z.c = Math.min(1, z.c + dt * 0.55 * (1 - d / (z.r * 1.5)) * 2.2);
      }
      z.v = z.h * (1 - z.c);
      warm = Math.max(warm, z.v);
    }
    if (body.heat.every((z) => z.h > 0.95) && warm < 0.06) {
      loose = true; body.heat.forEach((z) => (z.v = 0)); body.dirty = true;
      hintEl.textContent = 'Los. Nu nog in het echt.'; hintWrap.classList.add('loose');
      $$(`button[data-zone="${curId}"]`, listEl).concat($$(`button[data-zone="${curId}"]`, dotsEl)).forEach((b) => b.classList.add('loose'));
      const lab = zf('label'); lab.textContent = `${cur.label} · los`; lab.classList.add('loose');
    }
  };

  function buildZoneUI() {
    Object.entries(ZONES).forEach(([id, z]) => {
      z.spots.forEach(([x, y], i) => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'dot'; b.dataset.zone = id;
        b.style.left = (x / 240) * 100 + '%'; b.style.top = (y / 520) * 100 + '%';
        b.setAttribute('aria-pressed', 'false');
        if (i) { b.tabIndex = -1; b.setAttribute('aria-hidden', 'true'); } else b.setAttribute('aria-label', z.label);
        b.addEventListener('click', () => select(id, true));
        dotsEl.appendChild(b);
      });
      const li = document.createElement('li'), b = document.createElement('button');
      b.type = 'button'; b.dataset.zone = id; b.textContent = z.label; b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', () => select(id, true));
      li.appendChild(b); listEl.appendChild(li);
    });
  }
  buildZoneUI();
  pointerOn(bodyFig, body);

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
    const ok = layoutHero() & layoutBody() & layoutFoot();
    return ok;
  }
  loadMask().then(async (img) => {
    mask = img;
    if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch (e) { /* fonts optional */ } }
    if (!layoutAll()) return; // canvas unreadable (file://): the flat wordmarks stay visible
    html.classList.add('fib-ready');
    [hero, body, foot].forEach(watch);
    if (still) { [hero, body, foot].forEach((f) => f.draw(0)); return; }
    requestAnimationFrame(loop);
    heroIntro();
    if (hasGsap && window.ScrollTrigger) {
      ScrollTrigger.create({ trigger: heroEl, start: 'top top', end: 'bottom top', scrub: true,
        onUpdate: (st) => { hero.spread = st.progress * 0.9; hero.alpha = introDone ? 1 - st.progress * 0.9 : hero.alpha; hero.dirty = true; } });
      foot.T = 0.85;
      ScrollTrigger.create({ trigger: footMark, start: 'top 85%', once: true,
        onEnter: () => gsap.to(foot, { T: 0, duration: 2.2, ease: 'power3.inOut' }) });
    }
  }).catch(() => {});

  let lastW = innerWidth;
  addEventListener('resize', () => {
    if (Math.abs(innerWidth - lastW) < 2 && innerWidth <= 900) return; // mobile URL bar
    lastW = innerWidth;
    clearTimeout(window.__rz);
    window.__rz = setTimeout(() => { if (mask) { layoutAll(); [hero, body, foot].forEach((f) => (f.dirty = true)); if (still) [hero, body, foot].forEach((f) => f.draw(0)); } if (window.ScrollTrigger) ScrollTrigger.refresh(); }, 160);
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
    gsap.from('.t-row', { opacity: 0, y: 40, duration: 1, ease: 'power3.out', stagger: 0.12, scrollTrigger: { trigger: '.t-rows', start: 'top 82%' } });
    gsap.from('.first-steps li', { opacity: 0, y: 24, duration: 0.9, ease: 'power3.out', stagger: 0.1, scrollTrigger: { trigger: '.first', start: 'top 85%' } });

    // Glenn: his sports light up one by one, ending at the table
    $$('.sports li').forEach((li) => ScrollTrigger.create({ trigger: li, start: 'top 72%', onEnter: () => li.classList.add('on'), onLeaveBack: () => li.classList.remove('on') }));
    gsap.fromTo('.glenn-photo img', { clipPath: 'inset(100% 0 0 0)', scale: 1.18 }, { clipPath: 'inset(0% 0 0 0)', scale: 1, duration: 1.5, ease: 'power4.out', scrollTrigger: { trigger: '.glenn-photo', start: 'top 80%' } });

    // Reviews: each quote arrives compressed and in heat colour, and relaxes as it reaches the reader
    $$('.q').forEach((q) => {
      gsap.fromTo(q, { scaleX: 0.72, color: '#d2552a', opacity: 0.35 }, { scaleX: 1, color: '#efe9dd', opacity: 1, ease: 'none', scrollTrigger: { trigger: q, start: 'top 95%', end: 'top 52%', scrub: 0.6 } });
    });
    gsap.from('.foot-cols > div', { opacity: 0, y: 24, duration: 0.9, stagger: 0.1, ease: 'power3.out', scrollTrigger: { trigger: '.foot-cols', start: 'top 90%' } });
  } else {
    $$('.sports li').forEach((li) => li.classList.add('on'));
  }
})();
