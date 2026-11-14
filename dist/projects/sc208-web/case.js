(() => {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  // Reveal individual content blocks, so long case sections unfold as they scroll into view.
  if ('IntersectionObserver' in window && !reduced.matches) {
    const targets = [];
    const blockSelector = '.case-intro,.panel:not(.business-section):not(.jobs),.case-picture,.case-image,.website-mockup,.mobile-video,.note,.summary-intro,h2,h3,h4,p';
    function collectBlocks(element) {
      if (element.matches(blockSelector)) {
        targets.push(element);
        return; // Never animate both a container and its contents.
      }
      [...element.children].forEach(collectBlocks);
    }
    collectBlocks(document.querySelector('.case'));
    function reveal(element, delay = 0) {
      element.style.setProperty('--case-reveal-delay', `${delay}ms`);
      element.classList.add('is-visible', 'is-revealing');
      observer.unobserve(element);
    }
    const observer = new IntersectionObserver(entries => {
      entries.filter(entry => entry.isIntersecting).forEach(({ target }, index) => {
        reveal(target, Math.min(index * 60, 180));
      });
    }, { threshold: .01, rootMargin: '0px 0px -24px 0px' });
    targets.forEach(element => {
      // Keep content above a restored scroll position readable immediately.
      if (element.getBoundingClientRect().bottom <= 0 && element.getClientRects().length) return;
      element.classList.add('case-reveal');
      element.addEventListener('transitionend', event => {
        if (event.target === element && event.propertyName === 'transform') {
          element.classList.remove('is-revealing');
          element.style.removeProperty('--case-reveal-delay');
        }
      });
      observer.observe(element);
    });
    document.addEventListener('focusin', event => {
      const block = event.target.closest('.case-reveal:not(.is-visible)');
      if (block) reveal(block);
    });
    reduced.addEventListener('change', () => {
      if (!reduced.matches) return;
      observer.disconnect();
      targets.forEach(element => {
        element.classList.remove('case-reveal', 'is-revealing');
        element.style.removeProperty('--case-reveal-delay');
      });
    });
  }
  document.querySelectorAll('.website-mockup,.mobile-video').forEach(mockup => {
    const canvas = mockup.querySelector('.mockup-canvas');
    const videos = [...mockup.querySelectorAll('video')];
    function resizeMockup() {
      if (!canvas) return;
      canvas.style.setProperty('--mockup-scale', mockup.clientWidth / (Number(canvas.dataset.width) || 1200));
    }
    if (canvas) canvas.setAttribute('aria-hidden', 'true');
    resizeMockup();
    if ('ResizeObserver' in window) new ResizeObserver(resizeMockup).observe(mockup);
    else window.addEventListener('resize', resizeMockup, { passive: true });
    function syncVideo(video) {
      video.muted = true;
      video.defaultMuted = true;
      video.loop = true;
      if (reduced.matches || document.hidden || video.dataset.inView !== 'true') {
        video.pause();
        return;
      }
      if (!video.getAttribute('src')) {
        video.src = video.dataset.src;
        video.load();
      }
      video.play().catch(() => { /* Keep the poster visible if autoplay is restricted. */ });
    }
    const syncAll = () => videos.forEach(syncVideo);
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(entries => {
        entries.forEach(({ target, isIntersecting }) => {
          target.dataset.inView = String(isIntersecting);
          syncVideo(target);
        });
      }, { rootMargin: '100px 0px', threshold: .01 });
      videos.forEach(video => observer.observe(video));
    } else videos.forEach(video => { video.dataset.inView = 'true'; syncVideo(video); });
    reduced.addEventListener('change', syncAll);
    document.addEventListener('visibilitychange', syncAll);
    document.addEventListener('pointerdown', syncAll, { once: true });
  });

  const toast = document.querySelector('.case-toast');
  let toastTimer;
  document.querySelector('.case-nav-next').addEventListener('click', event => {
    const project = window.portfolioProjects?.[event.currentTarget.dataset.project];
    if (project?.url) {
      location.href = new URL(project.url, new URL('../../', location.href)).href;
      return;
    }
    clearTimeout(toastTimer);
    toast.textContent = `${project?.name || 'Следующий проект'} — кейс готовится к публикации`;
    toast.classList.add('is-visible');
    toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 3500);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') toast.classList.remove('is-visible');
  });
})();
