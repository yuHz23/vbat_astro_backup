const STRAPI_URL = import.meta.env.PUBLIC_STRAPI_URL || '';
const API_URL = `${STRAPI_URL}/api`;

export async function fetchAPI(endpoint, options = {}) {
  const { params = {}, auth = false } = options;

  const queryString = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach(v => queryString.append(key, v));
    } else if (value !== undefined && value !== null) {
      queryString.append(key, value);
    }
  });

  const url = `${API_URL}${endpoint}${queryString.toString() ? '?' + queryString.toString() : ''}`;

  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = localStorage.getItem('jwt');
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, { ...options, headers: { ...headers, ...options.headers } });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error?.error?.message || `API Error: ${res.status}`);
  }
  return res.json();
}

export function getStrapiMedia(url) {
  if (!url) return '/placeholder.jpg';
  if (url.startsWith('http')) return url;
  if (STRAPI_URL) return `${STRAPI_URL}${url}`;
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1' || /^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    return `${window.location.protocol}//${host}:1337${url}`;
  }
  return `${window.location.protocol}//admin.${host}${url}`;
}

export function formatPrice(price) {
  if (!price && price !== 0) return '—';
  return new Intl.NumberFormat('vi-VN').format(price);
}

export function formatPriceVND(price) {
  if (!price && price !== 0) return '—';
  return new Intl.NumberFormat('vi-VN').format(price) + ' ₫';
}
