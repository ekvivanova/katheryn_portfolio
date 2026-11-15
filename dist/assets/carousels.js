(() => {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');

  window.initPortfolioCarousel = (carousel, trackSelector, pageSelector) => {
    const track = carousel.querySelector(trackSelector);
    const pages = [...carousel.querySelectorAll(pageSelector)];
    if (!track || pages.length < 2) return;

    let current = 0;
    let animation = null;
    let frame = 0;
    let settleTimer = 0;
    let drag = null;
    let touching = false;
    let width = 0;
    const clamp = index => Math.max(0, Math.min(pages.length - 1, index));
    const scrollable = () => track.clientWidth > 0 && track.scrollWidth > track.clientWidth + 1;
    const nearest = () => clamp(Math.round(track.scrollLeft / (track.clientWidth || 1)));
    const update = () => {
      current = nearest();
      pages.forEach((page, index) => {
        if (index === current) page.setAttribute('aria-current', 'true');
        else page.removeAttribute('aria-current');
      });
    };
    const stop = () => {
      cancelAnimationFrame(frame);
      clearTimeout(settleTimer);
      animation = null;
    };

    function goTo(index, instant = false) {
      stop();
      if (!scrollable()) return;
      const next = clamp(index);
      const start = track.scrollLeft;
      const end = Math.min(next * track.clientWidth, track.scrollWidth - track.clientWidth);
      const distance = end - start;
      if (instant || reduced.matches || Math.abs(distance) < 1) {
        track.scrollLeft = end;
        update();
        return;
      }
      const duration = Math.min(900, 520 + 200 * Math.abs(distance) / track.clientWidth);
      animation = { index: next, started: null };
      function tick(time) {
        if (!animation) return;
        if (animation.started === null) animation.started = time;
        const progress = Math.min(1, (time - animation.started) / duration);
        // Smooth acceleration and deceleration, including at both endpoints.
        const eased = progress ** 3 * (10 - 15 * progress + 6 * progress ** 2);
        track.scrollLeft = start + distance * eased;
        update();
        if (progress < 1) frame = requestAnimationFrame(tick);
        else animation = null;
      }
      frame = requestAnimationFrame(tick);
    }

    function settle() {
      clearTimeout(settleTimer);
      if (animation || drag || touching || !scrollable()) return;
      // Let native touch/trackpad momentum finish before aligning the slide.
      settleTimer = setTimeout(() => goTo(nearest()), 160);
    }

    // Native snap remains the fallback when JavaScript is unavailable.
    track.classList.add('is-enhanced');
    pages.forEach((page, index) => page.addEventListener('click', () => goTo(index)));
    track.addEventListener('scroll', () => {
      update();
      settle();
    }, { passive: true });
    track.addEventListener('wheel', event => {
      if (!event.deltaX) return;
      stop();
      settle();
    }, { passive: true });
    track.addEventListener('keydown', event => {
      const direction = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
      if (!direction || !scrollable()) return;
      event.preventDefault();
      goTo((animation?.index ?? nearest()) + direction);
    });
    track.addEventListener('pointerdown', event => {
      if (!scrollable() || event.button !== 0) return;
      stop();
      if (event.pointerType !== 'mouse') {
        touching = true;
        return;
      }
      drag = { pointer: event.pointerId, x: event.clientX, left: track.scrollLeft, start: nearest() };
      track.setPointerCapture(event.pointerId);
      track.classList.add('is-dragging');
    });
    track.addEventListener('pointermove', event => {
      if (drag && event.pointerId === drag.pointer) track.scrollLeft = drag.left + drag.x - event.clientX;
    });
    function release(event) {
      if (!drag || event.pointerId !== drag.pointer) {
        touching = false;
        settle();
        return;
      }
      const distance = drag.x - event.clientX;
      let next = nearest();
      if (event.type === 'pointercancel') next = drag.start;
      else if (next === drag.start && Math.abs(distance) > Math.min(60, track.clientWidth * .15)) {
        next += Math.sign(distance);
      }
      if (track.hasPointerCapture(event.pointerId)) track.releasePointerCapture(event.pointerId);
      drag = null;
      track.classList.remove('is-dragging');
      goTo(next);
    }
    track.addEventListener('pointerup', release);
    track.addEventListener('pointercancel', release);

    function resize() {
      const nextWidth = track.clientWidth;
      if (!nextWidth || nextWidth === width) return;
      const selected = animation?.index ?? current;
      width = nextWidth;
      stop();
      track.tabIndex = scrollable() ? 0 : -1;
      if (scrollable()) goTo(selected, true);
      update();
    }
    if ('ResizeObserver' in window) new ResizeObserver(resize).observe(track);
    else window.addEventListener('resize', resize, { passive: true });
    reduced.addEventListener('change', () => {
      if (reduced.matches) goTo(animation?.index ?? nearest(), true);
    });
    resize();
  };
})();
