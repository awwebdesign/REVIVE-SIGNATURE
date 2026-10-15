/* Revive · shared navbar (homepage and legal pages)
   - solid background once you leave the top
   - slides away while scrolling down, slides back as soon as you scroll up
   - burger opens the full-screen menu; pages hear 'revive:menu' to pause their smooth scroll */
(() => {
  const html = document.documentElement;
  const top = document.querySelector('.top'), burger = document.querySelector('.top-burger'), menu = document.getElementById('menu');
  if (!top) return;

  let lastY = scrollY, ticking = false;
  function update() {
    ticking = false;
    const y = Math.max(0, scrollY), dy = y - lastY;
    top.classList.toggle('solid', y > 40);
    if (html.classList.contains('menu-open') || y < 120) top.classList.remove('away');
    else if (dy > 6) top.classList.add('away');
    else if (dy < -6) top.classList.remove('away');
    if (Math.abs(dy) > 6 || y < 120) lastY = y;
  }
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  update();

  if (!burger || !menu) return;
  const setMenu = (open) => {
    html.classList.toggle('menu-open', open);
    menu.inert = !open;
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Menu sluiten' : 'Menu openen');
    top.classList.remove('away');
    document.dispatchEvent(new CustomEvent('revive:menu', { detail: { open } }));
  };
  const close = () => { if (html.classList.contains('menu-open')) setMenu(false); };
  burger.addEventListener('click', () => setMenu(!html.classList.contains('menu-open')));
  menu.querySelectorAll('a').forEach((a) => a.addEventListener('click', close));
  addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  matchMedia('(min-width: 1081px)').addEventListener('change', (e) => { if (e.matches) close(); });
  window.reviveNav = { close };
})();
