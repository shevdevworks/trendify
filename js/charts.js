/**
 * @file charts.js
 * @description Hand-rolled SVG charts. Each chart is a small stateful instance
 * that keeps its DOM between updates, so filter changes animate from the
 * previous state instead of redrawing from scratch.
 */

import { formatCompactMoney, formatPrice, formatSignedPercent, prefersReducedMotion } from './format.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const ANIMATION_MS = 800;
let chartUid = 0;

function svgEl(tag, attrs = {}) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  return node;
}

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const lerp = (a, b, t) => a + (b - a) * t;
const lerpArray = (from, to, t) => to.map((v, i) => lerp(from[i] ?? 0, v, t));

// Match point counts before morphing between day/week/month axes.
const resample = (values, length) => values && Array.from({ length }, (_, i) => {
  const position = length === 1 ? 0 : i * (values.length - 1) / (length - 1);
  const left = Math.floor(position);
  return lerp(values[left], values[Math.min(left + 1, values.length - 1)], position - left);
});

/** Rounds the axis maximum up to a "nice" value split into 4 even steps. */
function niceAxisMax(value) {
  if (value <= 0) return 4;
  const rawStep = value / 4;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const fraction = rawStep / magnitude;
  const niceFraction = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10;
  return niceFraction * magnitude * 4;
}

/* ------------------------------------------------------------
   Shared tooltip
   ------------------------------------------------------------ */
let tooltipEl = null;
const tooltipResetters = new Set();

function getTooltip() {
  if (!tooltipEl) {
    tooltipEl = document.createElement('div');
    tooltipEl.className = 'chart-tooltip';
    tooltipEl.setAttribute('role', 'status');
    document.body.appendChild(tooltipEl);

    // A fixed-position tooltip would drift away from its point while scrolling
    const hideAll = () => tooltipResetters.forEach(fn => fn());
    window.addEventListener('scroll', hideAll, { passive: true });
    window.addEventListener('resize', hideAll, { passive: true });
  }
  return tooltipEl;
}

function placeTooltip(anchorX, anchorY) {
  const tip = getTooltip();
  tip.classList.add('chart-tooltip--visible');

  const margin = 8;
  const { offsetWidth: w, offsetHeight: h } = tip;
  const left = Math.min(Math.max(anchorX, w / 2 + margin), window.innerWidth - w / 2 - margin);
  const below = anchorY - h - 16 < margin;

  tip.classList.toggle('chart-tooltip--below', below);
  tip.style.left = `${left}px`;
  tip.style.top = `${below ? anchorY + 16 : anchorY - 16}px`;
}

/* ------------------------------------------------------------
   Trend line chart
   ------------------------------------------------------------ */

/**
 * @param {HTMLElement} container
 */
export function createTrendChart(container) {
  const uid = ++chartUid;
  const PAD = { top: 14, right: 18, bottom: 28, left: 50 };
  const GRID_STEPS = 4;

  let dom = null;
  let target = null;   // last data passed to update()
  let shown = null;    // { values, ghost, yMax } as currently drawn
  let size = { w: 0, h: 0 };
  let rafId = 0;
  let activeIndex = -1;

  const plotW = () => size.w - PAD.left - PAD.right;
  const plotH = () => size.h - PAD.top - PAD.bottom;
  const xAt = (i, n) => PAD.left + (n <= 1 ? plotW() / 2 : (i * plotW()) / (n - 1));
  const yAt = (v, yMax) => PAD.top + plotH() - (v / yMax) * plotH();

  const isMounted = () => dom !== null && container.contains(dom.svg);

  function buildPath(values, yMax) {
    const pts = values.map((v, i) => [xAt(i, values.length), yAt(v, yMax)]);
    let d = `M ${pts[0][0]} ${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[i + 1];
      const dx = (x1 - x0) / 3;
      d += ` C ${x0 + dx} ${y0}, ${x1 - dx} ${y1}, ${x1} ${y1}`;
    }
    return d;
  }

  function build(labels) {
    cancelAnimationFrame(rafId);
    container.innerHTML = '';
    size = { w: container.clientWidth, h: container.clientHeight };

    const svg = svgEl('svg', {
      class: 'trend-svg',
      width: size.w,
      height: size.h,
      viewBox: `0 0 ${size.w} ${size.h}`,
      role: 'img',
      'aria-label': 'Revenue chart. Use left and right arrow keys to explore values. Home and End jump to the first and last point.',
      tabindex: '0'
    });

    const gradId = `trend-grad-${uid}`;
    const defs = svgEl('defs');
    const grad = svgEl('linearGradient', { id: gradId, x1: 0, y1: 0, x2: 0, y2: 1 });
    const stopTop = svgEl('stop', { offset: '0%', 'stop-opacity': 0.28 });
    const stopBottom = svgEl('stop', { offset: '100%', 'stop-opacity': 0 });
    grad.append(stopTop, stopBottom);
    defs.appendChild(grad);
    const clip = svgEl('clipPath', { id: `trend-clip-${uid}` });
    const revealRect = svgEl('rect', { x: 0, y: 0, width: size.w + 10, height: size.h });
    clip.append(revealRect);
    defs.append(clip);
    svg.appendChild(defs);

    const gridLabels = [];
    for (let i = 0; i <= GRID_STEPS; i++) {
      const y = PAD.top + (i * plotH()) / GRID_STEPS;
      svg.appendChild(svgEl('line', {
        class: 'trend-grid', x1: PAD.left, y1: y, x2: size.w - PAD.right, y2: y
      }));
      const label = svgEl('text', { class: 'trend-axis trend-axis--y', x: PAD.left - 8, y: y + 3.5, 'text-anchor': 'end' });
      svg.appendChild(label);
      gridLabels.push(label);
    }

    // Skip x labels when they'd collide on narrow screens
    const n = labels.length;
    const step = Math.max(1, Math.ceil((n * 48) / plotW()));
    labels.forEach((text, i) => {
      if (i !== n - 1 && (i % step !== 0 || n - 1 - i < step * .65)) return;
      const label = svgEl('text', {
        class: 'trend-axis', x: xAt(i, n), y: size.h - 8, 'text-anchor': 'middle'
      });
      label.textContent = text;
      svg.appendChild(label);
    });

    const guide = svgEl('line', { class: 'trend-guide', x1: 0, x2: 0, y1: PAD.top, y2: PAD.top + plotH() });
    const area = svgEl('path', { class: 'trend-area', fill: `url(#${gradId})` });
    const ghost = svgEl('path', { class: 'trend-ghost' });
    const line = svgEl('path', { class: 'trend-line' });
    const dotsGroup = svgEl('g');
    const dots = labels.map(() => {
      const dot = svgEl('circle', { class: 'trend-dot', r: 3.5 });
      dotsGroup.appendChild(dot);
      return dot;
    });

    const series = svgEl('g', { 'clip-path': `url(#trend-clip-${uid})` });
    series.append(area, ghost, line, dotsGroup);
    svg.append(guide, series);
    container.appendChild(svg);

    dom = { svg, gridLabels, guide, area, ghost, line, dots, stopTop, stopBottom, revealRect };
    attachPointer(svg);
  }

  function draw(frame) {
    const { values, ghost, yMax } = frame;
    const n = values.length;

    dom.gridLabels.forEach((label, i) => {
      label.textContent = formatCompactMoney((yMax * (GRID_STEPS - i)) / GRID_STEPS);
    });

    const linePath = buildPath(values, yMax);
    const baseY = PAD.top + plotH();
    dom.line.setAttribute('d', linePath);
    dom.area.setAttribute('d', `${linePath} L ${xAt(n - 1, n)} ${baseY} L ${xAt(0, n)} ${baseY} Z`);

    if (ghost) {
      dom.ghost.setAttribute('d', buildPath(ghost, yMax));
      dom.ghost.style.display = '';
    } else {
      dom.ghost.style.display = 'none';
    }

    dom.dots.forEach((dot, i) => {
      dot.setAttribute('cx', xAt(i, n));
      dot.setAttribute('cy', yAt(values[i], yMax));
    });
  }

  function applyColor(color) {
    dom.line.style.stroke = color;
    dom.stopTop.style.stopColor = color;
    dom.stopBottom.style.stopColor = color;
    dom.dots.forEach(dot => { dot.style.stroke = color; });
    container.style.setProperty('--series-color', color);
  }

  function animate(from, to) {
    cancelAnimationFrame(rafId);
    dom.revealRect.setAttribute('width', size.w + 10);
    if (prefersReducedMotion()) {
      shown = to;
      draw(to);
      return;
    }

    const start = performance.now();
    const tick = (now) => {
      const t = easeOutCubic(Math.min(1, (now - start) / ANIMATION_MS));
      const fromGhost = from.ghost ?? from.values;
      const toGhost = to.ghost ?? to.values;
      const frame = {
        values: lerpArray(from.values, to.values, t),
        // Keep the ghost visible while it merges back into the main line
        ghost: from.ghost || to.ghost ? lerpArray(fromGhost, toGhost, t) : null,
        yMax: lerp(from.yMax, to.yMax, t)
      };
      shown = t === 1 ? to : frame;
      draw(t === 1 ? to : frame);
      if (t < 1) rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
  }

  function reveal(frame) {
    shown = frame;
    draw(frame);
    if (prefersReducedMotion()) return;
    dom.revealRect.setAttribute('width', PAD.left);
    const start = performance.now();
    const tick = now => {
      const progress = Math.min(1, (now - start) / 1350);
      // A steady pen stroke, with a gentle deceleration at the end.
      const eased = 1 - Math.pow(1 - progress, 1.7);
      dom.revealRect.setAttribute('width', PAD.left + (size.w + 10 - PAD.left) * eased);
      if (progress < 1) rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
  }

  /* ---------- Interaction ---------- */

  function setActive(index) {
    if (!target || !dom) return;
    activeIndex = index;
    const n = target.values.length;
    const yMax = shown?.yMax ?? target.yMax;

    dom.dots.forEach((dot, i) => {
      dot.classList.toggle('trend-dot--active', i === index);
      dot.setAttribute('r', i === index ? 6 : 3.5);
    });

    const x = xAt(index, n);
    dom.guide.setAttribute('x1', x);
    dom.guide.setAttribute('x2', x);
    dom.guide.classList.add('trend-guide--visible');

    const value = target.values[index];
    const tip = getTooltip();
    let html = `<strong>${target.labels[index]}</strong>
      <span class="chart-tooltip__row"><i style="background:${target.color}"></i>${target.seriesName}<b>${formatPrice(value)}</b></span>`;
    if (target.ghost) {
      const previous = target.ghost[index];
      const difference = previous > 0 ? formatSignedPercent((value / previous - 1) * 100) : '—';
      html += `<span class="chart-tooltip__row chart-tooltip__row--muted"><i class="is-ghost"></i>Previous period<b>${formatPrice(previous)}</b></span>
        <span class="chart-tooltip__share" style="color:${value < previous ? 'var(--negative)' : 'var(--positive)'}">${difference} vs ${target.comparisonName}</span>`;
    }
    tip.innerHTML = html;

    const rect = dom.svg.getBoundingClientRect();
    placeTooltip(rect.left + x, rect.top + yAt(value, yMax));
  }

  function resetActive() {
    if (activeIndex === -1) return;
    activeIndex = -1;
    tooltipEl?.classList.remove('chart-tooltip--visible');
    if (!dom) return;
    dom.guide.classList.remove('trend-guide--visible');
    dom.dots.forEach(dot => {
      dot.classList.remove('trend-dot--active');
      dot.setAttribute('r', 3.5);
    });
  }
  tooltipResetters.add(resetActive);

  function indexFromClientX(clientX) {
    const rect = dom.svg.getBoundingClientRect();
    const n = target.values.length;
    const ratio = (clientX - rect.left - PAD.left) / plotW();
    return Math.min(n - 1, Math.max(0, Math.round(ratio * (n - 1))));
  }

  function attachPointer(svg) {
    svg.addEventListener('focus', () => { if (target) setActive(0); });
    svg.addEventListener('blur', resetActive);
    svg.addEventListener('keydown', e => {
      if (!target) return;
      const last = target.values.length - 1;
      let index;
      if (e.key === 'ArrowRight') index = Math.min(last, activeIndex + 1);
      else if (e.key === 'ArrowLeft') index = Math.max(0, activeIndex - 1);
      else if (e.key === 'Home') index = 0;
      else if (e.key === 'End') index = last;
      else if (e.key === 'Escape') { resetActive(); return; }
      else return;
      e.preventDefault();
      setActive(index);
    });
    const track = (e) => {
      if (!target) return;
      const index = indexFromClientX(e.clientX);
      if (index !== activeIndex) setActive(index);
    };
    svg.addEventListener('pointerdown', track);
    svg.addEventListener('pointermove', track);
    svg.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') resetActive(); });
    svg.addEventListener('pointercancel', resetActive);
  }

  // On touch the tooltip stays after lifting the finger; tapping elsewhere closes it
  document.addEventListener('pointerdown', (e) => {
    if (dom && !dom.svg.contains(e.target)) resetActive();
  });

  return {
    /**
     * @param {Object} data
     * @param {string} data.key - structural key (e.g. period); a change rebuilds axes
     * @param {string[]} data.labels
     * @param {number[]} data.values - filtered series
     * @param {number[]|null} data.ghost - previous-period series for the same channels
     * @param {string} data.color
     * @param {string} data.seriesName
     */
    update(data) {
      const yMax = niceAxisMax(Math.max(...data.values, ...(data.ghost ?? []), 0));
      const next = { values: data.values, ghost: data.ghost, yMax };

      const needsBuild = !isMounted()
        || !target
        || target.key !== data.key
        || size.w !== container.clientWidth
        || size.h !== container.clientHeight;

      resetActive();
      const previous = shown;
      target = { ...data, yMax };

      if (needsBuild) {
        build(data.labels);
        applyColor(data.color);
        if (!previous) reveal(next);
        else animate({
          values: resample(previous.values, data.values.length),
          ghost: resample(previous.ghost, data.values.length),
          yMax: previous.yMax
        }, next);
      } else {
        applyColor(data.color);
        animate(previous, next);
      }
    },

    /** Redraws at the new container size without replaying the animation. */
    resize() {
      if (!target || !isMounted()) return;
      if (size.w === container.clientWidth && size.h === container.clientHeight) return;
      resetActive();
      build(target.labels);
      applyColor(target.color);
      shown = { values: target.values, ghost: target.ghost, yMax: target.yMax };
      draw(shown);
    },

    /** Forgets the current DOM so the next update() rebuilds (after skeleton/empty states). */
    detach() {
      cancelAnimationFrame(rafId);
      resetActive();
      dom = null;
      shown = null;
      target = null;
    }
  };
}

/* ------------------------------------------------------------
   Platform donut chart
   ------------------------------------------------------------ */

/**
 * @param {HTMLElement} container
 * @param {{ onSelect?: (platform: string) => void }} options
 */
export function createDonutChart(container, { onSelect } = {}) {
  const RADIUS = 46;
  const STROKE = 12;
  const C = 2 * Math.PI * RADIUS;
  const GAP = 2.5;

  let dom = null;
  let revision = 0;
  let latest = null;

  function highlight(name) {
    if (!dom || !latest) return;
    const selected = latest.items.find(item => item.name === name && item.enabled);
    const focus = selected ? name : latest.focus;
    Object.entries(dom.segments).forEach(([key, segment]) => {
      segment.classList.toggle('donut__segment--focused', key === focus);
      segment.classList.toggle('donut__segment--dimmed', focus !== 'all' && key !== focus);
      dom.legendItems[key].classList.toggle('is-dimmed', focus !== 'all' && key !== focus);
    });
    const value = selected ? `${selected.share}%` : latest.centerValue;
    if (dom.centerValue.textContent !== value && !prefersReducedMotion()) {
      dom.centerValue.getAnimations().forEach(animation => animation.cancel());
      dom.centerValue.animate([{ opacity: .25, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 350, easing: 'cubic-bezier(.22,1,.36,1)' });
    }
    dom.centerValue.textContent = value;
    dom.centerCaption.textContent = selected ? name : latest.centerCaption;
  }

  const isMounted = () => dom !== null && container.contains(dom.root);

  function build(names) {
    container.innerHTML = '';

    const root = document.createElement('div');
    root.className = 'donut';

    const figure = document.createElement('div');
    figure.className = 'donut__figure';

    const svg = svgEl('svg', { class: 'donut__svg', viewBox: '0 0 120 120', 'aria-hidden': 'true' });
    const group = svgEl('g', { transform: 'rotate(-90 60 60)' });
    group.appendChild(svgEl('circle', {
      class: 'donut__track', cx: 60, cy: 60, r: RADIUS, 'stroke-width': STROKE
    }));

    const segments = {};
    names.forEach(name => {
      const seg = svgEl('circle', {
        class: 'donut__segment', cx: 60, cy: 60, r: RADIUS,
        'stroke-width': STROKE, 'stroke-dasharray': `0 ${C}`, 'stroke-dashoffset': 0
      });
      group.appendChild(seg);
      segments[name] = seg;
    });
    svg.appendChild(group);

    const center = document.createElement('div');
    center.className = 'donut__center';
    center.innerHTML = '<span class="donut__center-value"></span><span class="donut__center-caption"></span>';

    figure.append(svg, center);

    const legend = document.createElement('ul');
    legend.className = 'donut__legend';
    const legendItems = {};
    names.forEach(name => {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'donut__legend-item';
      btn.dataset.platform = name;
      btn.innerHTML = `
        <i class="donut__swatch"></i>
        <span class="donut__legend-name">${name}</span>
        <span class="donut__legend-value"></span>
        <span class="donut__legend-share"></span>
        <span class="donut__bar" aria-hidden="true"></span>`;
      btn.addEventListener('click', () => onSelect?.(name));
      btn.addEventListener('pointerenter', () => { if (!btn.disabled) highlight(name); });
      btn.addEventListener('pointerleave', () => highlight(null));
      btn.addEventListener('focus', () => highlight(name));
      btn.addEventListener('blur', () => highlight(null));
      li.appendChild(btn);
      legend.appendChild(li);
      legendItems[name] = btn;
    });

    root.append(figure, legend);
    container.appendChild(root);

    dom = {
      root,
      segments,
      legendItems,
      centerValue: center.querySelector('.donut__center-value'),
      centerCaption: center.querySelector('.donut__center-caption')
    };
  }

  return {
    /**
     * @param {Object} data
     * @param {{ name: string, value: number, share: number, enabled: boolean, color: string }[]} data.items
     * @param {string} data.focus - 'all' or a platform name
     * @param {string} data.centerValue
     * @param {string} data.centerCaption
     */
    update({ items, focus, centerValue, centerCaption }) {
      latest = { items, focus, centerValue, centerCaption };
      const currentRevision = ++revision;
      const fresh = !isMounted();
      if (fresh) build(items.map(i => i.name));

      const apply = () => {
        if (!dom || currentRevision !== revision) return;
        let offset = 0;
        items.forEach(item => {
          const seg = dom.segments[item.name];
          const len = (item.share / 100) * C;
          const visible = Math.max(0, len - (len > GAP * 2 ? GAP : 0));
          const isFocused = focus === item.name;
          const isDimmed = focus !== 'all' && !isFocused;

          seg.style.stroke = item.color;
          seg.setAttribute('stroke-dasharray', `${visible} ${C}`);
          seg.setAttribute('stroke-dashoffset', -offset);
          seg.classList.toggle('donut__segment--focused', isFocused);
          seg.classList.toggle('donut__segment--dimmed', isDimmed);
          offset += len;

          const btn = dom.legendItems[item.name];
          btn.style.setProperty('--swatch', item.color);
          btn.style.setProperty('--share', `${item.share}%`);
          btn.disabled = !item.enabled;
          btn.classList.toggle('is-focused', isFocused);
          btn.classList.toggle('is-dimmed', isDimmed);
          btn.setAttribute('aria-pressed', String(isFocused));
          btn.setAttribute('aria-label', `${item.name}: ${item.enabled ? `${formatPrice(item.value)}, ${item.share}% of revenue. Filter by ${item.name}` : 'not included'}`);
          btn.querySelector('.donut__legend-value').textContent = item.enabled ? formatCompactMoney(item.value) : 'Off';
          btn.querySelector('.donut__legend-share').textContent = item.enabled ? `${item.share}%` : '';
        });

        highlight(null);
      };

      // Let the browser paint the empty ring first so segments grow in
      if (fresh && !prefersReducedMotion()) requestAnimationFrame(() => requestAnimationFrame(apply));
      else apply();
    },

    detach() {
      revision++;
      dom = null;
      latest = null;
    }
  };
}
