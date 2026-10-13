export const PLATFORM_COLORS = { Amazon: '#ff831f', eBay: '#aa88ff', AliExpress: '#2fe0b6' };
const moneyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const priceFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const dateTimeFormatter = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
export const formatMoney = value => moneyFormatter.format(value);
export const formatPrice = value => priceFormatter.format(value);
export const formatInteger = value => Math.round(value).toLocaleString('en-US');
export const formatPercent = (value, digits = 1) => `${value.toFixed(digits)}%`;
export function formatSignedPercent(value, suffix = '%') {
  const rounded = Number(value.toFixed(1));
  return `${rounded > 0 ? '+' : ''}${rounded.toFixed(1)}${suffix}`;
}
export function formatCompactMoney(value) {
  const abs = Math.abs(value);
  if (abs >= 1e6) return `$${Number((value / 1e6).toFixed(1))}M`;
  if (abs >= 1e3) return `$${Number((value / 1e3).toFixed(abs >= 1e5 ? 0 : 1))}k`;
  return `$${Math.round(value)}`;
}
export const formatDate = value => dateFormatter.format(new Date(value));
export const formatDateTime = value => dateTimeFormatter.format(new Date(value));
export const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export const escapeHtml = value => String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
