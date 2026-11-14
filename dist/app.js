(() => {
  'use strict';
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine) and (min-width: 701px)');
  const cards = [...document.querySelectorAll('.project')];
  const videos = [...document.querySelectorAll('video')];
  const toast = document.querySelector('.toast');
  const cursor = document.querySelector('.project-cursor');
  let toastTimer;

  // Reveals are only enabled once the observer is ready; the page works without JS.
  if ('IntersectionObserver' in window && !reducedMotion.matches) {
    document.documentElement.classList.add('motion-ready');
    const reveal = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting);
      visible.forEach((entry, index) => {
        entry.target.style.setProperty('--reveal-delay', `${Math.min(index * 65, 260)}ms`);
        entry.target.classList.add('is-visible');
        reveal.unobserve(entry.target);
      });
    }, { threshold: .06 });
    document.querySelectorAll('[data-reveal]').forEach((node) => reveal.observe(node));
  }

  function playVisibleVideo(video) {
    video.muted = true;
    video.defaultMuted = true;
    if (video.dataset.inView !== 'true' || reducedMotion.matches || document.hidden) return;
    if (!video.getAttribute('src')) {
      video.src = video.dataset.src;
      video.load();
    }
    video.play().catch(() => { /* A poster remains visible when autoplay is restricted. */ });
  }

  if ('IntersectionObserver' in window) {
    const playback = new IntersectionObserver((entries) => {
      entries.forEach(({ target: video, isIntersecting }) => {
        video.dataset.inView = String(isIntersecting);
        if (isIntersecting && !reducedMotion.matches) playVisibleVideo(video);
        else video.pause();
      });
    }, { rootMargin: '100px 0px', threshold: 0 });
    videos.forEach((video) => playback.observe(video));
  } else {
    videos.forEach((video) => { video.dataset.inView = 'true'; playVisibleVideo(video); });
  }

  document.addEventListener('visibilitychange', () => {
    videos.forEach((video) => document.hidden ? video.pause() : playVisibleVideo(video));
    if (document.hidden) hideCursor();
  });
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) document.documentElement.classList.remove('motion-ready');
    videos.forEach((video) => reducedMotion.matches ? video.pause() : playVisibleVideo(video));
  });
  // Retry autoplay after the first real interaction, for browsers with stricter policies.
  document.addEventListener('pointerdown', () => videos.forEach(playVisibleVideo), { once: true });

  cards.forEach((card) => {
    card.addEventListener('click', () => {
      const project = window.portfolioProjects[card.dataset.project];
      if (project?.url) { window.location.assign(project.url); return; }
      clearTimeout(toastTimer);
      toast.textContent = `${project?.name || 'Проект'} — кейс готовится к публикации`;
      toast.classList.add('is-visible');
      toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 3500);
    });
  });

  let pointerX = 0, pointerY = 0, cursorX = 0, cursorY = 0, activeCard = null, frame = 0;
  function renderCursor() {
    const ease = reducedMotion.matches ? 1 : .24;
    cursorX += (pointerX - cursorX) * ease;
    cursorY += (pointerY - cursorY) * ease;
    cursor.style.transform = `translate3d(${cursorX}px, ${cursorY}px, 0)`;
    if (activeCard) frame = requestAnimationFrame(renderCursor);
  }
  function hideCursor() {
    activeCard = null;
    cursor.classList.remove('is-visible', 'is-pressed');
    document.documentElement.classList.remove('cursor-enabled');
    cancelAnimationFrame(frame);
  }
  function updatePointer(event) {
    const margin = cursor.offsetWidth / 2 + 12;
    pointerX = Math.min(window.innerWidth - margin, Math.max(margin, event.clientX));
    pointerY = Math.min(window.innerHeight - 34, Math.max(34, event.clientY));
  }
  cards.forEach((card) => {
    card.addEventListener('pointerenter', (event) => {
      if (!finePointer.matches || event.pointerType === 'touch') return;
      activeCard = card;
      document.documentElement.classList.add('cursor-enabled');
      updatePointer(event);
      cursorX = pointerX; cursorY = pointerY;
      cancelAnimationFrame(frame);
      renderCursor();
      cursor.classList.add('is-visible');
    });
    card.addEventListener('pointermove', (event) => { if (activeCard === card) updatePointer(event); });
    card.addEventListener('pointerleave', hideCursor);
    card.addEventListener('pointerdown', () => cursor.classList.add('is-pressed'));
    card.addEventListener('pointercancel', hideCursor);
  });
  window.addEventListener('pointerup', () => cursor.classList.remove('is-pressed'));
  window.addEventListener('blur', hideCursor);
  window.addEventListener('scroll', hideCursor, { passive: true });
  finePointer.addEventListener('change', hideCursor);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Tab') hideCursor();
    if (event.key === 'Escape') { hideCursor(); toast.classList.remove('is-visible'); }
  });
})();
