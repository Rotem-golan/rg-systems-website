// ---- Intro video ----
(function () {
  const overlay = document.getElementById('intro-overlay');
  const video   = document.getElementById('intro-video');
  const iLogo   = document.getElementById('intro-logo');
  if (!overlay || !video) return;

  document.body.style.overflow = 'hidden';

  function skip() {
    overlay.style.transition = 'opacity 0.5s ease';
    overlay.style.opacity    = '0';
    document.body.style.overflow = '';
    setTimeout(() => overlay.remove(), 500);
  }

  function endIntro() {
    // Phase 1 — brief hold on video's last frame (200ms), then fade video to black
    setTimeout(() => {
      video.style.transition = 'opacity 0.45s ease';
      video.style.opacity    = '0';

      // Phase 2 — black screen: fade the logo in centered
      setTimeout(() => {
        iLogo.style.transition = 'opacity 0.35s ease';
        iLogo.style.opacity    = '1';

        // Phase 3 — fly logo from center to nav corner
        setTimeout(() => {
          const navLogo = document.querySelector('.logo-img');
          if (navLogo) {
            const r     = navLogo.getBoundingClientRect();
            const dx    = (r.left + r.width  / 2) - window.innerWidth  / 2;
            const dy    = (r.top  + r.height / 2) - window.innerHeight / 2;
            const scale = r.width / 160;
            iLogo.style.transition = 'transform 0.85s cubic-bezier(0.4,0,0.2,1), opacity 0.3s ease 0.65s';
            iLogo.style.transform  = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(${scale})`;
            iLogo.style.opacity    = '0';
          }

          // Phase 4 — fade out overlay, reveal site
          setTimeout(() => {
            overlay.classList.add('fade-out');
            document.body.style.overflow = '';
            setTimeout(() => overlay.remove(), 750);
          }, 600);
        }, 320); // logo visible briefly before flying
      }, 480); // wait for video fade-to-black
    }, 200);   // hold on last frame
  }

  // Fallback: if intro hasn't finished within 6s (mobile autoplay blocked), skip
  const fallbackTimer = setTimeout(skip, 6000);

  function endIntroOnce() {
    clearTimeout(fallbackTimer);
    endIntro();
  }

  video.addEventListener('ended', endIntroOnce);
  video.addEventListener('error', skip);
  overlay.addEventListener('click', skip);

  // If video doesn't start playing within 1.5s (mobile block), skip immediately
  setTimeout(() => {
    if (video.paused && video.currentTime === 0) skip();
  }, 1500);
})();

// Sticky nav shadow
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 20);
}, { passive: true });

// Mobile nav toggle
const navToggle = document.getElementById('nav-toggle');
const navLinks  = document.querySelector('.nav-links');
navToggle.addEventListener('click', () => {
  navLinks.classList.toggle('open');
  navToggle.classList.toggle('active');
});
navLinks.querySelectorAll('a').forEach(a => {
  a.addEventListener('click', () => {
    navLinks.classList.remove('open');
    navToggle.classList.remove('active');
  });
});

// Scroll-reveal
const observer = new IntersectionObserver(entries => {
  entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
}, { threshold: 0.1 });
document.querySelectorAll('.reveal').forEach(el => {
  // Immediately mark elements already in the viewport (above-fold content)
  if (el.getBoundingClientRect().top < window.innerHeight) {
    el.classList.add('visible');
  } else {
    observer.observe(el);
  }
});

// ---- Cursor glow ----
(function () {
  if (window.matchMedia('(pointer: coarse)').matches) return; // skip on touch
  const glow = document.createElement('div');
  glow.className = 'cursor-glow';
  document.body.appendChild(glow);

  let mouseX = 0, mouseY = 0;
  document.addEventListener('mousemove', e => {
    mouseX = e.clientX; mouseY = e.clientY;
    glow.style.left = mouseX + 'px';
    glow.style.top  = mouseY + 'px';
    glow.style.opacity = '1';
  }, { passive: true });
  document.addEventListener('mouseleave', () => { glow.style.opacity = '0'; });
})();

// ---- Stat counter animation ----
(function () {
  function easeOutExpo(t) {
    return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
  }
  function animateCount(el, target, suffix, duration) {
    const start = performance.now();
    function tick(now) {
      const elapsed  = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const value    = Math.round(easeOutExpo(progress) * target);
      el.textContent = value + suffix;
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  const counterObs = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el     = entry.target;
      const target = parseInt(el.dataset.target, 10);
      const suffix = el.dataset.suffix || '';
      if (!isNaN(target)) {
        animateCount(el, target, suffix, 1800);
        counterObs.unobserve(el);
      }
    });
  }, { threshold: 0.6 });

  document.querySelectorAll('.stat-number[data-target]').forEach(el => counterObs.observe(el));
})();

// ---- 3D card tilt ----
(function () {
  function addTilt(selector, maxDeg) {
    document.querySelectorAll(selector).forEach(card => {
      card.addEventListener('mouseenter', () => {
        card.style.transition = 'transform 0.15s ease, border-color 0.2s, background 0.2s, box-shadow 0.2s';
      });
      card.addEventListener('mousemove', e => {
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left)  / r.width  - 0.5;
        const y = (e.clientY - r.top)   / r.height - 0.5;
        card.style.transform = `perspective(900px) rotateY(${x * maxDeg * 2}deg) rotateX(${-y * maxDeg * 2}deg) translateZ(6px)`;
      });
      card.addEventListener('mouseleave', () => {
        card.style.transition = 'transform 0.55s ease, border-color 0.2s, background 0.2s, box-shadow 0.2s';
        card.style.transform  = '';
      });
    });
  }
  addTilt('.card',         4);
  addTilt('.testimonial',  2.5);
  addTilt('.service-card', 3.5);
})();

// ---- Theme toggle + background video ----
(function () {
  const html    = document.documentElement;
  const btn     = document.getElementById('theme-toggle');
  const bgVideo = document.getElementById('bg-video');
  if (!btn || !bgVideo) return;

  const VIDEOS = {
    dark:  'assets/RG Systems - Dark mode.mp4',
    light: 'assets/RG Systems - Light mode.mp4',
  };

  function applyTheme(theme, animate) {
    html.dataset.theme = theme;
    localStorage.setItem('rg-theme', theme);

    const src = VIDEOS[theme];
    if (!animate) {
      bgVideo.src = src;
      bgVideo.load();
      bgVideo.play().catch(() => {});
      return;
    }

    // Crossfade: fade out → swap source → fade in
    bgVideo.style.opacity = '0';
    setTimeout(() => {
      bgVideo.src = src;
      bgVideo.load();
      bgVideo.play().catch(() => {});
      bgVideo.style.opacity = ''; // restores CSS value (0.32 or 0.20)
    }, 480);
  }

  // Graceful fallback if video can't load/play
  bgVideo.addEventListener('error', () => {
    bgVideo.style.display = 'none';
  });

  // Init — honour saved preference (default: dark)
  const saved = localStorage.getItem('rg-theme') || 'dark';
  applyTheme(saved, false);

  btn.addEventListener('click', () => {
    const next = html.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(next, true);
  });
})();
