export function formatPriceVND(price) {
  if (!price && price !== 0) return '—';
  return new Intl.NumberFormat('vi-VN').format(price) + ' ₫';
}
