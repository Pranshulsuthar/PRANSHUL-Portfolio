/* ============================================================
   PRANSHUL SUTHAR — PORTFOLIO JS
   Vanilla · GPU-friendly · rAF-driven
   ============================================================ */
(() => {
'use strict';

const $  = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp  = (a, b, t) => a + (b - a) * t;

const isTouch  = matchMedia('(hover:none),(pointer:coarse)').matches;
const isMobile = () => innerWidth < 900;
const reduced  = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ============================================================
   1. PRELOADER
   ============================================================ */
function initPreloader() {
  const pre   = $('#preloader');
  const count = $('#preCount');
  const bar   = $('#preBar');
  const hero  = $('#hero');

  document.body.classList.add('no-scroll');

  let n = 0;
  const finish = () => {
    pre.classList.add('done');
    document.body.classList.remove('no-scroll');
    hero.classList.add('ready');
    setTimeout(() => {
      $$('.hero .reveal-fade, .hero .reveal-up').forEach((el, i) => {
        el.style.transitionDelay = (0.45 + i * 0.12) + 's';
        el.classList.add('in-view');
      });
    }, 120);
    setTimeout(() => pre.remove(), 900);
  };

  if (reduced) { count.textContent = '100'; bar.style.width = '100%'; finish(); return; }

  const tick = () => {
    n += Math.max(1, Math.round((100 - n) * 0.06 + Math.random() * 3));
    if (n >= 100) { n = 100; }
    count.textContent = String(n).padStart(2, '0');
    bar.style.width = n + '%';
    if (n < 100) setTimeout(tick, 34 + Math.random() * 45);
    else setTimeout(finish, 420);
  };
  tick();
}

/* ============================================================
   2. CURSOR — default system cursor (no custom cursor)
   ============================================================ */
function initCursor() {
  // intentionally disabled: normal browser cursor everywhere
}

/* ============================================================
   3. NAV + SCROLL PROGRESS + MENU
   ============================================================ */
function initNav() {
  const nav  = $('#nav');
  const prog = $('#scrollProgress');
  const btn  = $('#menuBtn');
  const ov   = $('#menuOverlay');
  const timeEl = $('#menuTime');

  $$('.menu-item').forEach((el, i) => el.style.setProperty('--i', i));

  const onScroll = () => {
    const y = scrollY;
    nav.classList.toggle('scrolled', y > 40);
    const h = document.documentElement.scrollHeight - innerHeight;
    prog.style.transform = `scaleX(${h > 0 ? y / h : 0})`;
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const openMenu = () => {
    ov.classList.add('open'); btn.classList.add('open');
    document.body.classList.add('no-scroll');
    $('.menu-btn-text', btn).textContent = 'CLOSE';
  };
  const closeMenu = () => {
    ov.classList.remove('open'); btn.classList.remove('open');
    document.body.classList.remove('no-scroll');
    $('.menu-btn-text', btn).textContent = 'MENU';
  };
  btn.addEventListener('click', () =>
    ov.classList.contains('open') ? closeMenu() : openMenu());
  $$('.menu-item').forEach(a => a.addEventListener('click', closeMenu));
  addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });

  const tickTime = () => {
    if (!timeEl) return;
    timeEl.textContent = new Date().toLocaleTimeString('en-GB',
      { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) + ' IST';
  };
  tickTime(); setInterval(tickTime, 20000);

  // smooth anchors
  $$('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const id = a.getAttribute('href');
      if (id.length < 2) return;
      const t = document.querySelector(id);
      if (!t) return;
      e.preventDefault();
      window.scrollTo({ top: t.getBoundingClientRect().top + scrollY, behavior: reduced ? 'auto' : 'smooth' });
    });
  });
}

/* ============================================================
   4. SCROLL REVEALS + LINE SPLIT
   ============================================================ */
function splitLines() {
  $$('.split-lines').forEach(el => {
    if (el.dataset.split) return;
    el.dataset.split = '1';
    const words = el.textContent.trim().split(/\s+/);
    el.textContent = '';
    const span = document.createElement('span');
    span.className = 'sl-line';
    const inner = document.createElement('span');
    inner.className = 'sl-inner';
    inner.textContent = words.join(' ');
    span.appendChild(inner);
    el.appendChild(span);
  });
}

function initReveals() {
  splitLines();
  const targets = $$(
    '.section-head, .reveal-up, .reveal-fade, .split-lines, ' +
    '.timeline-item, .contact-title, .gh-card, .about-card, ' +
    '.about-photo, .reveal-portrait, .project'
  );
  if (reduced || !('IntersectionObserver' in window)) {
    targets.forEach(t => t.classList.add('in-view'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach(en => {
      if (en.isIntersecting) { en.target.classList.add('in-view'); io.unobserve(en.target); }
    });
  }, { threshold: 0.16, rootMargin: '0px 0px -8% 0px' });
  targets.forEach(t => io.observe(t));
}

/* ============================================================
   5. COUNTERS
   ============================================================ */
function initCounters() {
  const nums = $$('[data-count]');
  if (!nums.length) return;
  const io = new IntersectionObserver(es => {
    es.forEach(en => {
      if (!en.isIntersecting) return;
      const el = en.target, end = +el.dataset.count;
      let s = null;
      const step = ts => {
        if (!s) s = ts;
        const p = clamp((ts - s) / 1100, 0, 1);
        el.textContent = Math.round(end * (1 - Math.pow(1 - p, 3)));
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
      io.unobserve(el);
    });
  }, { threshold: .5 });
  nums.forEach(n => io.observe(n));
}

/* ============================================================
   6. HERO — mouse parallax + scroll fade
   ============================================================ */
function initHero() {
  const hero = $('#hero');
  const title = $('.hero-title');
  const lines = $$('.hero-title .line');
  const portrait = $('#heroPortrait');
  const portraitImg = $('#portraitImg');

  let tx = 0, ty = 0, cx = 0, cy = 0;
  if (!isTouch && !reduced) {
    addEventListener('mousemove', e => {
      tx = (e.clientX / innerWidth - .5);
      ty = (e.clientY / innerHeight - .5);
    }, { passive: true });
  }

  const render = () => {
    cx = lerp(cx, tx, .06);
    cy = lerp(cy, ty, .06);
    lines.forEach(l => {
      const f = parseFloat(l.dataset.parallax || 0.02) * 100;
      l.style.translate = `${cx * f}px ${cy * f * .5}px`;
    });

    // portrait counter-parallax + subtle scale
    if (portrait && !reduced) {
      portrait.style.translate = `${cx * -22}px ${cy * -16}px`;
    }
    if (portraitImg && !reduced) {
      portraitImg.style.translate = `${cx * -10}px ${cy * -8}px`;
    }

    const rect = hero.getBoundingClientRect();
    const p = clamp(-rect.top / Math.max(rect.height, 1), 0, 1);
    if (title && !reduced) {
      title.style.opacity = String(1 - p * 1.25);
      title.style.transform = `scale(${1 - p * .12}) translateY(${p * -40}px)`;
    }
    if (portrait && !reduced) {
      portrait.style.opacity = String(clamp(1 - p * 1.4, 0, 1));
      portrait.style.scale = String(1 - p * .06);
    }
    requestAnimationFrame(render);
  };
  render();

  // portrait hover: extra lift handled by CSS; add gentle tilt
  if (portrait && !isTouch && !reduced) {
    portrait.addEventListener('mousemove', e => {
      const r = portrait.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - .5;
      const py = (e.clientY - r.top) / r.height - .5;
      const shot = portrait.querySelector('.portrait-mask');
      if (shot) shot.style.transform = `perspective(900px) rotateY(${px * 7}deg) rotateX(${py * -6}deg)`;
    });
    portrait.addEventListener('mouseleave', () => {
      const shot = portrait.querySelector('.portrait-mask');
      if (shot) shot.style.transform = 'perspective(900px) rotateY(0) rotateX(0)';
    });
  }
}

/* ============================================================
   7. MAGNETIC BUTTONS
   ============================================================ */
function initMagnetic() {
  if (isTouch || reduced) return;
  $$('.magnetic').forEach(el => {
    let rx = 0, ry = 0, tx = 0, ty = 0, active = false, raf = null;

    const loop = () => {
      rx = lerp(rx, tx, .16); ry = lerp(ry, ty, .16);
      el.style.transform = `translate(${rx}px, ${ry}px)`;
      if (Math.abs(rx - tx) > .1 || Math.abs(ry - ty) > .1 || active) raf = requestAnimationFrame(loop);
      else { el.style.transform = 'translate(0,0)'; raf = null; }
    };
    const start = () => { if (!raf) raf = requestAnimationFrame(loop); };

    el.addEventListener('mouseenter', () => { active = true; start(); });
    el.addEventListener('mousemove', e => {
      const r = el.getBoundingClientRect();
      tx = (e.clientX - r.left - r.width / 2) * .28;
      ty = (e.clientY - r.top - r.height / 2) * .38;
      start();
    });
    el.addEventListener('mouseleave', () => { active = false; tx = 0; ty = 0; start(); });
  });
}

/* ============================================================
   8. TILT CARDS
   ============================================================ */
function initTilt() {
  if (isTouch || reduced) return;
  $$('[data-tilt]').forEach(el => {
    const inner = $('.project-visual-inner', el) || el;
    el.addEventListener('mousemove', e => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      const rx = (0.5 - py) * 9;
      const ry = (px - 0.5) * 11;
      inner.style.transform =
        (inner.classList.contains('project-visual-inner') ? 'scale(1.045) ' : '') +
        `rotateX(${rx}deg) rotateY(${ry}deg)`;
      el.style.setProperty('--mx', (px * 100) + '%');
      el.style.setProperty('--my', (py * 100) + '%');
    });
    el.addEventListener('mouseleave', () => {
      inner.style.transform = inner.classList.contains('project-visual-inner')
        ? 'scale(1) rotateX(0) rotateY(0)'
        : 'rotateX(0) rotateY(0)';
    });
  });
}

/* ============================================================
   9. HORIZONTAL WORK SCROLL
   ============================================================ */
function initWork() {
  const section = $('#work');
  const track   = $('#workTrack');
  const bar     = $('#workProgress');
  if (!section || !track) return;

  let current = 0, target = 0, maxShift = 0;

  const measure = () => {
    if (isMobile()) { track.style.transform = ''; maxShift = 0; return; }
    maxShift = Math.max(0, track.scrollWidth - track.parentElement.clientWidth + 40);
  };

  const onScroll = () => {
    if (isMobile()) { if (bar) bar.style.width = '100%'; return; }
    const rect = section.getBoundingClientRect();
    const total = section.offsetHeight - innerHeight;
    const p = clamp(-rect.top / Math.max(total, 1), 0, 1);
    target = -p * maxShift;
    if (bar) bar.style.width = (p * 100) + '%';
  };

  const loop = () => {
    if (!isMobile() && maxShift > 0) {
      current = lerp(current, target, 0.1);
      track.style.transform = `translate3d(${current.toFixed(2)}px,0,0)`;
    }
    requestAnimationFrame(loop);
  };

  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', () => { measure(); onScroll(); });
  measure(); onScroll(); loop();
}

/* ============================================================
   10. TIMELINE DRAW
   ============================================================ */
function initTimeline() {
  const tl = $('#timeline'), fill = $('#timelineFill');
  if (!tl || !fill) return;

  $$('.timeline-content li').forEach((li, i) => li.style.setProperty('--n', i % 6));

  const draw = () => {
    const r = tl.getBoundingClientRect();
    const start = innerHeight * 0.8;
    const p = clamp((start - r.top) / Math.max(r.height * 0.85, 1), 0, 1);
    fill.style.height = (p * 100) + '%';
  };
  addEventListener('scroll', draw, { passive: true });
  addEventListener('resize', draw);
  draw();
}

/* ============================================================
   11. TAGS — float + mouse repel
   ============================================================ */
function initTags() {
  const field = $('#tagsField');
  if (!field) return;
  const tags = $$('.tag', field);
  const desc = $('#tagDesc');
  const state = tags.map(() => ({ x: 0, y: 0, tx: 0, ty: 0, vx: 0, vy: 0, ph: Math.random() * 6.28 }));

  tags.forEach((t, i) => {
    t.addEventListener('mouseenter', () => {
      desc.textContent = t.dataset.desc || '';
      desc.classList.add('show');
    });
    t.addEventListener('mouseleave', () => desc.classList.remove('show'));
  });

  if (isTouch || reduced) return;

  let mx = -9999, my = -9999;
  addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; }, { passive: true });

  const loop = (ts) => {
    const t = ts * 0.001;
    tags.forEach((el, i) => {
      const s = state[i];
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2 + s.x;
      const cy = r.top + r.height / 2 + s.y;

      // floating idle
      s.tx = Math.sin(t * 0.7 + s.ph) * 6;
      s.ty = Math.cos(t * 0.55 + s.ph) * 7;

      // mouse repel
      const dx = cx - mx, dy = cy - my;
      const dist = Math.hypot(dx, dy);
      const R = 170;
      if (dist < R && dist > 0.01) {
        const f = (1 - dist / R) * 46;
        s.tx += (dx / dist) * f;
        s.ty += (dy / dist) * f;
      }

      s.x = lerp(s.x, s.tx, 0.09);
      s.y = lerp(s.y, s.ty, 0.09);
      el.style.transform = `translate3d(${s.x.toFixed(2)}px,${s.y.toFixed(2)}px,0)`;
    });
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

/* ============================================================
   12. GITHUB PROFILE (live API + graceful fallback)
   ============================================================ */
async function initGithub() {
  const card = $('#ghCard');
  if (!card) return;

  // glow position on card
  if (!isTouch && !reduced) {
    card.addEventListener('mousemove', e => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--gx', ((e.clientX - r.left) / r.width * 100) + '%');
      card.style.setProperty('--gy', ((e.clientY - r.top) / r.height * 100) + '%');
    });
  }

  const fill = (user, repos) => {
    const set = (id, v) => { const el = $('#' + id); if (el) el.textContent = v; };
    set('ghRepos', user.public_repos ?? '—');
    set('ghFollowers', user.followers ?? '—');
    set('ghFollowing', user.following ?? '—');

    if (repos && repos.length) {
      const list = $('#ghReposList');
      if (list) {
        list.innerHTML = repos.slice(0, 3).map(r =>
          `<li><span class="gh-repo-name">${escapeHtml(r.name)}</span>` +
          `<span class="gh-repo-meta">${escapeHtml((r.language || 'Code'))}</span></li>`
        ).join('');
      }
    }
  };

  try {
    const [uRes, rRes] = await Promise.all([
      fetch('https://api.github.com/users/Pranshulsuthar'),
      fetch('https://api.github.com/users/Pranshulsuthar/repos?sort=updated&per_page=6')
    ]);
    if (!uRes.ok) throw new Error('user fetch failed');
    const user = await uRes.json();
    const repos = rRes.ok ? await rRes.json() : [];
    fill(user, repos);
  } catch (_) {
    // static fallback already in HTML — leave as-is
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ============================================================
   12b. FLOATING PROJECT PREVIEW — removed
   ============================================================ */
function initFloatPreview() {
  // disabled: no cursor-following previews
}

/* ============================================================
   12c. PROJECT IMAGE SCROLL TRANSITIONS
   ============================================================ */
function initProjectMotion() {
  const projects = $$('.project');
  if (!projects.length) return;
  if (!('IntersectionObserver' in window)) {
    projects.forEach(p => p.classList.add('is-active'));
    return;
  }
  const io = new IntersectionObserver(es => {
    es.forEach(en => {
      en.target.classList.toggle('is-active', en.isIntersecting && en.intersectionRatio > .35);
    });
  }, { threshold: [0, .35, .7] });
  projects.forEach(p => io.observe(p));
}

/* ============================================================
   12d. MAGNETIC SOCIAL ROWS
   ============================================================ */
function initSocialMagnetic() {
  if (isTouch || reduced) return;
  $$('.magnetic-row').forEach(el => {
    const label = el.querySelector('.social-label-inner');
    let rx = 0, tx = 0, raf = null, active = false;

    const loop = () => {
      rx = lerp(rx, tx, .14);
      el.style.transform = `translate3d(${rx.toFixed(2)}px,0,0)`;
      if (Math.abs(rx - tx) > .15 || active) raf = requestAnimationFrame(loop);
      else { el.style.transform = 'translate3d(0,0,0)'; raf = null; }
    };
    const start = () => { if (!raf) raf = requestAnimationFrame(loop); };

    el.addEventListener('mouseenter', () => { active = true; start(); });
    el.addEventListener('mousemove', e => {
      const r = el.getBoundingClientRect();
      tx = (e.clientX - r.left - r.width / 2) * .04;
      start();
      if (label) {
        const lx = (e.clientX - r.left) * .06;
        label.style.transform = `translateX(${lx.toFixed(1)}px)`;
      }
    });
    el.addEventListener('mouseleave', () => {
      active = false; tx = 0; start();
      if (label) label.style.transform = 'translateX(0)';
    });
  });
}

/* ============================================================
   13. SKILL HOVER — push neighbours
   ============================================================ */
function initSkillPush() {
  if (isTouch || reduced) return;
  $$('.skill-list').forEach(list => {
    const items = $$('.skill', list);
    items.forEach(item => {
      item.addEventListener('mouseenter', () => {
        items.forEach(o => {
          if (o === item) return;
          const dir = items.indexOf(o) > items.indexOf(item) ? -1 : 1;
          o.style.transform = `translateX(${dir * 6}px)`;
          o.style.opacity = '.55';
        });
      });
      item.addEventListener('mouseleave', () => {
        items.forEach(o => { o.style.transform = ''; o.style.opacity = ''; });
      });
    });
  });
}

/* ============================================================
   14. SECTION TRANSITION FLASH
   ============================================================ */
function initSectionFlash() {
  if (reduced) return;
  const flash = document.createElement('div');
  Object.assign(flash.style, {
    position: 'fixed', inset: '0', background: '#fff',
    opacity: '0', pointerEvents: 'none', zIndex: '9500',
    transition: 'opacity .18s ease'
  });
  document.body.appendChild(flash);

  // subtle flash when jumping via menu / anchors
  $$('a[href^="#"]').forEach(a => {
    a.addEventListener('click', () => {
      if (a.getAttribute('href') === '#') return;
      flash.style.opacity = '.05';
      setTimeout(() => flash.style.opacity = '0', 160);
    });
  });
}

/* ============================================================
   BOOT
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  initPreloader();
  initCursor();
  initNav();
  initReveals();
  initCounters();
  initHero();
  initMagnetic();
  initTilt();
  initWork();
  initTimeline();
  initTags();
  initGithub();
  initFloatPreview();
  initProjectMotion();
  initSocialMagnetic();
  initSkillPush();
  initSectionFlash();
});

})();
