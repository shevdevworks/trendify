/**
 * @file charts.js
 * @description SVG chart rendering module. Optimized for performance and conflict-free DOM updates.
 */

let tooltipEl = null;
let isScrollListenerAdded = false;

/**
 * Globally resets the chart's interactive elements on scroll.
 * Prevents the tooltip from getting "stuck" while the page is scrolled.
 * @returns {void}
 */
const globalResetTracking = () => {
  if (tooltipEl) {
    tooltipEl.classList.remove('chart-tooltip--visible');
  }
  document.querySelectorAll('.chart-dot').forEach(dot => {
    dot.setAttribute('r', window.innerWidth <= 768 ? '4' : '5');
    dot.setAttribute('fill', '#0a0a0a');
  });
};

/**
 * Renders the interactive line SVG chart for the sales trend.
 * @param {HTMLElement | null} container - Container to mount the SVG into
 * @param {number[]} points - Array of numeric data values
 * @param {string[]} labels - Array of x-axis labels
 * @param {string} currentPeriod - Currently selected period ('day' | 'week' | 'month')
 * @returns {void}
 */
export function renderTrendChart(container, points, labels, currentPeriod) {
  if (!container) return;
  container.innerHTML = '';

  // Lazily create the single shared tooltip element in the DOM
  if (!tooltipEl) {
    tooltipEl = document.createElement('div');
    tooltipEl.className = 'chart-tooltip';
    document.body.appendChild(tooltipEl);
  }

  // Memory-leak guard: attach the scroll listener to window exactly once
  if (!isScrollListenerAdded) {
    window.addEventListener('scroll', globalResetTracking, { passive: true });
    isScrollListenerAdded = true;
  }

  const viewBoxWidth = 500;
  const viewBoxHeight = 160;
  const padding = 20;
  const paddingLeft = 36; // extra room on the left for y-axis value labels

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${viewBoxWidth} ${viewBoxHeight}`);
  svg.style.width = '100%';
  svg.style.height = '100%';
  svg.style.overflow = 'visible';

  // Compute the Y-axis scale with a little headroom above and below
  const minVal = Math.min(...points) * 0.9;
  const maxVal = Math.max(...points) * 1.05;
  const valRange = maxVal - minVal || 1;

  // Map the raw data points into SVG coordinate space
  const coords = points.map((p, index) => {
    const x = paddingLeft + (index * (viewBoxWidth - paddingLeft - padding)) / (points.length - 1);
    const y = viewBoxHeight - padding - ((p - minVal) / valRange) * (viewBoxHeight - padding * 2);
    return { x, y, val: p, label: labels[index] };
  });

  // Build the gradient used to fill the area under the line
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  defs.innerHTML = `
    <linearGradient id="chart-grad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FF5A00" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="#FF5A00" stop-opacity="0.0"/>
    </linearGradient>
  `;
  svg.appendChild(defs);

  // Draw the horizontal gridlines with a value label on the left
  const formatAxisValue = (val) => (maxVal >= 10 ? Math.round(val).toString() : val.toFixed(1));
  for (let i = 0; i <= 3; i++) {
    const yGrid = padding + (i * (viewBoxHeight - padding * 2)) / 3;
    const gridValue = maxVal - (i * (maxVal - minVal)) / 3;

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', paddingLeft.toString());
    line.setAttribute('y1', yGrid.toString());
    line.setAttribute('x2', (viewBoxWidth - padding).toString());
    line.setAttribute('y2', yGrid.toString());
    line.setAttribute('stroke', 'rgba(255,255,255,0.02)');
    line.setAttribute('stroke-width', '1');
    svg.appendChild(line);

    const axisLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    axisLabel.setAttribute('x', (paddingLeft - 8).toString());
    axisLabel.setAttribute('y', (yGrid + 2.5).toString());
    axisLabel.setAttribute('fill', '#5a5a5e');
    axisLabel.setAttribute('font-size', '7');
    axisLabel.setAttribute('text-anchor', 'end');
    axisLabel.textContent = formatAxisValue(gridValue);
    svg.appendChild(axisLabel);
  }

  // Build the smooth cubic Bezier path
  let dPath = `M ${coords[0].x} ${coords[0].y}`;
  for (let i = 0; i < coords.length - 1; i++) {
    const p0 = coords[i];
    const p1 = coords[i + 1];
    const cpX1 = p0.x + (p1.x - p0.x) / 3;
    const cpY1 = p0.y;
    const cpX2 = p0.x + (2 * (p1.x - p0.x)) / 3;
    const cpY2 = p1.y;
    dPath += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${p1.x} ${p1.y}`;
  }

  // Stroke the trend line
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', dPath);
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', '#FF5A00');
  path.setAttribute('stroke-width', '2.5');
  path.setAttribute('stroke-linecap', 'round');
  path.style.filter = 'drop-shadow(0 0 6px rgba(255,90,0,0.3))';

  // Fill the area under the line with the gradient
  const fillPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  fillPath.setAttribute('d', `${dPath} L ${coords[coords.length - 1].x} ${viewBoxHeight - padding} L ${coords[0].x} ${viewBoxHeight - padding} Z`);
  fillPath.setAttribute('fill', 'url(#chart-grad)');

  svg.appendChild(fillPath);
  svg.appendChild(path);

  // Draw the interactive data point dots and x-axis labels
  coords.forEach((coord) => {
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', coord.x.toString());
    text.setAttribute('y', (viewBoxHeight - 4).toString());
    text.setAttribute('fill', '#7e7e82');
    text.setAttribute('font-size', '7');
    text.setAttribute('text-anchor', 'middle');
    text.textContent = coord.label;
    svg.appendChild(text);

    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('cx', coord.x.toString());
    dot.setAttribute('cy', coord.y.toString());
    dot.setAttribute('r', window.innerWidth <= 768 ? '4' : '5');
    dot.setAttribute('fill', '#0a0a0a');
    dot.setAttribute('stroke', '#FF5A00');
    dot.setAttribute('stroke-width', '1.5');
    dot.setAttribute('class', 'chart-dot');
    svg.appendChild(dot);
  });

  container.appendChild(svg);

  /**
   * Finds the nearest data point to the cursor/touch position and updates the tooltip.
   * @param {number} clientX - Cursor's clientX coordinate
   */
  const processTracking = (clientX) => {
    const rect = svg.getBoundingClientRect();
    const normalizedX = ((clientX - rect.left) / rect.width) * viewBoxWidth;

    let closestPoint = coords[0];
    let minDistance = Math.abs(coords[0].x - normalizedX);
    let closestIndex = 0;

    coords.forEach((coord, index) => {
      const distance = Math.abs(coord.x - normalizedX);
      if (distance < minDistance) {
        minDistance = distance;
        closestPoint = coord;
        closestIndex = index;
      }
    });

    svg.querySelectorAll('.chart-dot').forEach((dot, index) => {
      if (index === closestIndex) {
        dot.setAttribute('r', '7');
        dot.setAttribute('fill', '#FF5A00');
      } else {
        dot.setAttribute('r', window.innerWidth <= 768 ? '4' : '5');
        dot.setAttribute('fill', '#0a0a0a');
      }
    });

    const dots = svg.querySelectorAll('.chart-dot');
    const activeDotRect = dots[closestIndex].getBoundingClientRect();
    const suffix = currentPeriod === 'day' ? ' Sales' : 'M';
    const prefix = currentPeriod === 'day' ? '' : '$';

    tooltipEl.innerHTML = `<strong>${closestPoint.label}</strong><br/>Value: ${prefix}${closestPoint.val}${suffix}`;
    tooltipEl.classList.add('chart-tooltip--visible');
    tooltipEl.style.left = `${activeDotRect.left + activeDotRect.width / 2}px`;
    tooltipEl.style.top = `${activeDotRect.top - 12}px`;
  };

  const resetTracking = () => {
    if (tooltipEl) tooltipEl.classList.remove('chart-tooltip--visible');
    svg.querySelectorAll('.chart-dot').forEach(d => {
      d.setAttribute('r', window.innerWidth <= 768 ? '4' : '5');
      d.setAttribute('fill', '#0a0a0a');
    });
  };

  // Register interactive events (desktop + mobile)
  svg.addEventListener('mousemove', (e) => processTracking(e.clientX));
  svg.addEventListener('mouseleave', resetTracking);
  svg.addEventListener('touchstart', (e) => { if (e.touches.length > 0) processTracking(e.touches[0].clientX); }, { passive: true });
  svg.addEventListener('touchmove', (e) => { if (e.touches.length > 0) processTracking(e.touches[0].clientX); }, { passive: true });
  svg.addEventListener('touchend', resetTracking);
  svg.addEventListener('touchcancel', resetTracking);
}

/**
 * Renders the donut chart showing the marketplace distribution split.
 * @param {HTMLElement | null} container - Container to mount the SVG into
 * @param {number[]} distribution - Percentage distribution [Amazon, eBay, AliExpress]
 * @returns {void}
 */
export function renderPlatformChart(container, distribution) {
  if (!container) return;
  container.innerHTML = '';

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 200 120');
  svg.style.width = '100%';
  svg.style.height = '100%';

  const radius = 35;
  const cx = 60;
  const cy = 60;
  const strokeWidth = 8;
  const circumference = 2 * Math.PI * radius;

  const colors = ['#FF5A00', '#F5F5F7', '#6b6b70'];
  const labels = ['Amazon', 'eBay', 'AliExpress'];
  let currentOffset = 0;

  // Background track: gives the ring a visible outline even where a dark
  // segment (e.g. AliExpress) would otherwise blend into the page background
  const track = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  track.setAttribute('cx', cx.toString());
  track.setAttribute('cy', cy.toString());
  track.setAttribute('r', radius.toString());
  track.setAttribute('fill', 'none');
  track.setAttribute('stroke', 'rgba(255,255,255,0.06)');
  track.setAttribute('stroke-width', strokeWidth.toString());
  svg.appendChild(track);

  distribution.forEach((pct, index) => {
    const strokeLength = (pct / 100) * circumference;
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');

    circle.setAttribute('cx', cx.toString());
    circle.setAttribute('cy', cy.toString());
    circle.setAttribute('r', radius.toString());
    circle.setAttribute('fill', 'none');
    circle.setAttribute('stroke', colors[index]);
    circle.setAttribute('stroke-width', strokeWidth.toString());
    circle.setAttribute('stroke-dasharray', `${strokeLength} ${circumference}`);
    circle.setAttribute('stroke-dashoffset', (-currentOffset).toString());
    circle.setAttribute('transform', `rotate(-90 ${cx} ${cy})`);
    circle.style.transition = 'stroke-dashoffset 0.5s ease';

    svg.appendChild(circle);
    currentOffset += strokeLength;

    // Build the custom legend directly inside the SVG
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('transform', `translate(120, ${25 + index * 22})`);

    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    marker.setAttribute('width', '8');
    marker.setAttribute('height', '8');
    marker.setAttribute('rx', '2');
    marker.setAttribute('fill', colors[index]);

    const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    txt.setAttribute('x', '14');
    txt.setAttribute('y', '8');
    txt.setAttribute('fill', '#F5F5F7');
    txt.setAttribute('font-size', '8');
    txt.style.fontFamily = 'system-ui, -apple-system, sans-serif';
    txt.textContent = `${labels[index]} (${pct}%)`;

    g.appendChild(marker);
    g.appendChild(txt);
    svg.appendChild(g);
  });

  container.appendChild(svg);
}