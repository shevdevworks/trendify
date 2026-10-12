import { prefersReducedMotion } from './format.js';

const EASE = 'cubic-bezier(.22,1,.36,1)';
const dialogMotions = new WeakMap();

/** A single entrance sequence. Final styles stay in CSS, even if motion is disabled. */
export function enterWorkspace() {
  if (prefersReducedMotion()) return;
  ['.page-heading', '.chart-card--trend', '.chart-card--channels'].forEach((selector, i) => {
    document.querySelector(selector)?.animate([
      { opacity: 0, transform: 'translateY(24px)' },
      { opacity: 1, transform: 'translateY(0)' }
    ], { duration: 850, delay: i * 90, easing: EASE, fill: 'backwards' });
  });
  const orders = document.querySelector('.table-section');
  const observer = new IntersectionObserver(entries => {
    if (!entries.some(entry => entry.isIntersecting)) return;
    orders.animate([{ opacity: .15, transform: 'translateY(28px)' }, { opacity: 1, transform: 'none' }],
      { duration: 750, easing: EASE });
    observer.disconnect();
  }, { threshold: .08 });
  observer.observe(orders);
}

/** Move the selection itself so controls read as a continuous state change. */
export function syncSelectionTracks() {
  document.querySelectorAll('.segmented, .channel-list').forEach(group => {
    const selected = group.querySelector('[aria-pressed="true"]');
    if (!selected || !group.getClientRects().length) return;
    let track = group.querySelector('.selection-track');
    if (!track) {
      track = document.createElement('span');
      track.className = 'selection-track';
      track.setAttribute('aria-hidden', 'true');
      group.prepend(track);
    }
    const first = !track.style.width;
    if (first) track.style.transition = 'none';
    track.style.width = `${selected.offsetWidth}px`;
    track.style.height = `${selected.offsetHeight}px`;
    track.style.transform = `translate(${selected.offsetLeft}px, ${selected.offsetTop}px)`;
    if (first) requestAnimationFrame(() => { track.style.transition = ''; });
  });
}

export function animateRows(tbody, previous) {
  if (prefersReducedMotion()) return;
  [...tbody.querySelectorAll('.data-table__row')].forEach((row, i) => {
    const before = previous.get(row.dataset.row);
    const distance = before === undefined ? 16 : before - row.getBoundingClientRect().top;
    if (Math.abs(distance) < 1) return;
    row.animate([
      { opacity: before === undefined ? 0 : 1, transform: `translateY(${distance}px)` },
      { opacity: 1, transform: 'translateY(0)' }
    ], { duration: 500, delay: before === undefined ? i * 35 : 0, easing: EASE, fill: 'backwards' });
  });
}

export function openDialog(dialog) {
  const pending = dialogMotions.get(dialog);
  pending?.animation.cancel();
  dialogMotions.delete(dialog);
  dialog.classList.remove('is-closing');
  if (!dialog.open) dialog.showModal();
  if (prefersReducedMotion()) return;
  const drawer = dialog.classList.contains('order-dialog');
  const animation = dialog.animate([
    { opacity: drawer ? .6 : 0, transform: drawer ? 'translateX(100%)' : 'translateY(20px) scale(.96)' },
    { opacity: 1, transform: 'none' }
  ], { duration: drawer ? 600 : 400, easing: EASE });
  dialogMotions.set(dialog, { animation, closing: false });
  dialog.querySelectorAll('.order-detail__product, .order-detail__info > div, .order-detail__status').forEach((el, i) => {
    el.animate([{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }],
      { duration: 480, delay: 100 + i * 40, easing: EASE, fill: 'backwards' });
  });
}

export async function closeDialog(dialog) {
  if (!dialog?.open || dialogMotions.get(dialog)?.closing) return;
  const old = dialogMotions.get(dialog);
  const start = { opacity: getComputedStyle(dialog).opacity, transform: getComputedStyle(dialog).transform };
  old?.animation.cancel();
  dialog.classList.add('is-closing');
  if (!prefersReducedMotion()) {
    const animation = dialog.animate([start, {
      opacity: 0,
      transform: dialog.classList.contains('order-dialog') ? 'translateX(105%)' : 'translateY(12px) scale(.98)'
    }], { duration: 260, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' });
    dialogMotions.set(dialog, { animation, closing: true });
    try { await animation.finished; } catch { return; }
    dialog.close();
    animation.cancel();
  } else dialog.close();
  dialog.classList.remove('is-closing');
  dialogMotions.delete(dialog);
}
