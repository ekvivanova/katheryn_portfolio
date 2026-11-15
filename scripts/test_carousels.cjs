const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const source = fs.readFileSync(`${__dirname}/../dist/assets/carousels.js`, 'utf8');

function fixture(count = 3) {
  let time = 0, id = 0, resize;
  const frames = new Map(), timers = new Map(), listeners = {};
  const pages = Array.from({ length: count }, () => ({
    attrs: {},
    addEventListener(type, fn) { this[type] = fn; },
    setAttribute(name, value) { this.attrs[name] = value; },
    removeAttribute(name) { delete this.attrs[name]; }
  }));
  const track = {
    clientWidth: 1000, scrollWidth: count * 1000, scrollLeft: 0,
    classList: { add() {}, remove() {} },
    addEventListener(type, fn) { listeners[type] = fn; },
    setPointerCapture() {}, hasPointerCapture() { return true; }, releasePointerCapture() {}
  };
  const reduced = { matches: false, addEventListener(type, fn) { this.change = fn; } };
  const context = {
    window: {}, matchMedia: () => reduced,
    requestAnimationFrame(fn) { frames.set(++id, fn); return id; },
    cancelAnimationFrame(key) { frames.delete(key); },
    setTimeout(fn, delay) { timers.set(++id, { fn, at: time + delay }); return id; },
    clearTimeout(key) { timers.delete(key); },
    ResizeObserver: class { constructor(fn) { resize = fn; } observe() {} }
  };
  context.window.ResizeObserver = context.ResizeObserver;
  vm.runInNewContext(source, context);
  context.window.initPortfolioCarousel({ querySelector: () => track, querySelectorAll: () => pages }, '.track', '.page');
  function advance(duration) {
    const values = [];
    for (let elapsed = 0; elapsed < duration; elapsed += 16) {
      const previous = track.scrollLeft;
      time += 16;
      for (const [key, item] of [...timers]) if (time >= item.at) { timers.delete(key); item.fn(); }
      for (const [key, fn] of [...frames]) { frames.delete(key); fn(time); }
      if (track.scrollLeft !== previous) listeners.scroll();
      values.push(track.scrollLeft);
    }
    return values;
  }
  return { track, pages, reduced, advance, resize: () => resize(), event: (type, data = {}) => listeners[type](data) };
}

test('pagination glides monotonically to the selected media without a final jump', () => {
  const f = fixture();
  f.pages[1].click();
  assert.equal(f.track.scrollLeft, 0);
  const values = f.advance(1000);
  assert.equal(values.at(-1), 1000);
  assert.ok(values.every((x, i) => i === 0 || x >= values[i - 1]));
  assert.ok(values.every((x, i) => i === 0 || x - values[i - 1] < 50));
  assert.equal(f.pages[1].attrs['aria-current'], 'true');
  f.advance(500);
  assert.equal(f.track.scrollLeft, 1000);
});

test('a new selection interrupts motion from its current position', () => {
  const f = fixture();
  f.pages[2].click();
  f.advance(320);
  const before = f.track.scrollLeft;
  f.pages[0].click();
  assert.equal(f.track.scrollLeft, before);
  const values = f.advance(1100);
  assert.ok(values.every((x, i) => i === 0 || x <= values[i - 1]));
  assert.equal(values.at(-1), 0);
});

test('mouse release settles smoothly and a height-only resize does not reset motion', () => {
  const f = fixture();
  f.event('pointerdown', { pointerType: 'mouse', button: 0, pointerId: 1, clientX: 900 });
  f.event('pointermove', { pointerId: 1, clientX: 700 });
  assert.equal(f.track.scrollLeft, 200);
  f.event('pointerup', { pointerId: 1, clientX: 700, type: 'pointerup' });
  assert.equal(f.track.scrollLeft, 200);
  f.advance(200);
  const position = f.track.scrollLeft;
  f.resize();
  assert.equal(f.track.scrollLeft, position);
  f.advance(900);
  assert.equal(f.track.scrollLeft, 1000);
});

test('touch momentum finishes before alignment; vertical page scrolling does not interrupt media', () => {
  const f = fixture();
  f.event('pointerdown', { pointerType: 'touch', button: 0 });
  f.track.scrollLeft = 700;
  f.event('scroll');
  f.advance(300);
  assert.equal(f.track.scrollLeft, 700);
  f.event('pointerup');
  f.advance(100);
  assert.equal(f.track.scrollLeft, 700);
  // Simulate more native momentum before the idle interval ends.
  f.track.scrollLeft = 800;
  f.event('scroll');
  f.advance(100);
  assert.equal(f.track.scrollLeft, 800);
  f.advance(1000);
  assert.equal(f.track.scrollLeft, 1000);
  f.pages[0].click();
  f.advance(200);
  f.event('wheel', { deltaX: 0, deltaY: 120 });
  f.advance(900);
  assert.equal(f.track.scrollLeft, 0);
});

test('keyboard, viewport resizing and reduced motion preserve the selected media', () => {
  const f = fixture();
  f.event('keydown', { key: 'ArrowRight', preventDefault() {} });
  f.event('keydown', { key: 'ArrowRight', preventDefault() {} });
  f.advance(100);
  f.track.clientWidth = 360;
  f.track.scrollWidth = 1080;
  f.resize();
  assert.equal(f.track.scrollLeft, 720);
  assert.equal(f.pages[2].attrs['aria-current'], 'true');
  f.reduced.matches = true;
  f.reduced.change();
  f.pages[0].click();
  assert.equal(f.track.scrollLeft, 0);
});
