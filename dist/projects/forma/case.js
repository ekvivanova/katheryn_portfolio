(() => {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  document.querySelectorAll('.media-carousel').forEach(carousel => {
    const track = carousel.querySelector('.media-track');
    const pages = [...carousel.querySelectorAll('.media-page')];
    let current = 0;
    let frame = 0;
    let drag = null;
    let trackWidth = 0;
    const scrollable = () => track.clientWidth > 0 && track.scrollWidth > track.clientWidth + 1;
    function update() {
      if (!track.clientWidth) return;
      current = Math.max(0, Math.min(pages.length - 1, Math.round(track.scrollLeft / track.clientWidth)));
      pages.forEach((page, index) => {
        if (index === current) page.setAttribute('aria-current', 'true');
        else page.removeAttribute('aria-current');
      });
    }
    function goTo(index, instant = false) {
      if (!scrollable()) return;
      const next = Math.max(0, Math.min(pages.length - 1, index));
      track.scrollTo({left: next * track.clientWidth, behavior: instant || reduced.matches ? 'instant' : 'smooth'});
    }
    pages.forEach((page, index) => page.addEventListener('click', () => goTo(index)));
    track.addEventListener('scroll', () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    }, {passive:true});
    track.addEventListener('keydown', event => {
      const direction = {ArrowLeft:-1, ArrowRight:1}[event.key];
      if (!direction || !scrollable()) return;
      event.preventDefault();
      goTo(current + direction);
    });
    track.addEventListener('pointerdown', event => {
      if (event.pointerType !== 'mouse' || event.button !== 0 || !scrollable()) return;
      drag = {pointer:event.pointerId, x:event.clientX, left:track.scrollLeft, start:current};
      track.setPointerCapture(event.pointerId);
      track.classList.add('is-dragging');
    });
    track.addEventListener('pointermove', event => {
      if (drag && event.pointerId === drag.pointer) track.scrollLeft = drag.left + drag.x - event.clientX;
    });
    function endDrag(event) {
      if (!drag || event.pointerId !== drag.pointer) return;
      const distance = drag.x - event.clientX;
      const next = event.type === 'pointercancel' ? drag.start : drag.start + (Math.abs(distance) > Math.min(60, track.clientWidth * .15) ? Math.sign(distance) : 0);
      if (track.hasPointerCapture(event.pointerId)) track.releasePointerCapture(event.pointerId);
      drag = null;
      track.classList.remove('is-dragging');
      goTo(next);
    }
    track.addEventListener('pointerup', endDrag);
    track.addEventListener('pointercancel', endDrag);
    const resize = () => {
      const width = track.clientWidth;
      if (!width || width === trackWidth) return;
      trackWidth = width;
      track.tabIndex = scrollable() ? 0 : -1;
      goTo(current, true);
      update();
    };
    if ('ResizeObserver' in window) new ResizeObserver(resize).observe(track);
    else window.addEventListener('resize', resize, {passive:true});
    resize();
  });
})();
