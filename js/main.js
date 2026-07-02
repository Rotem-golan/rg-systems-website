
// Background video
(function () {
  const v = document.getElementById('bg-video');
  if (!v) return;
  v.play().catch(() => { v.style.display = 'none'; });
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

