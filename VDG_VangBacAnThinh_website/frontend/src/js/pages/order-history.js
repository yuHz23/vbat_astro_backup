import { fetchAPI, formatPriceVND } from '../utils/api';

export function registerOrderHistory(Alpine) {
  Alpine.data('orderHistoryPage', () => ({
    orders: [],
    loading: true,
    _interval: null,

    async init() {
      if (!Alpine.store('auth').isLoggedIn) {
        window.location.href = '/dang-nhap';
        return;
      }
      await this.loadOrders();
      // Auto-refresh every 15 seconds to catch status updates
      this._interval = setInterval(() => this.loadOrders(true), 15000);
    },

    destroy() {
      if (this._interval) clearInterval(this._interval);
    },

    async loadOrders(silent = false) {
      if (!silent) this.loading = true;
      try {
        const res = await fetchAPI('/orders/my-orders', { auth: true });
        this.orders = res.data || [];
      } catch (e) {
        console.error('Failed to load orders:', e);
      } finally {
        this.loading = false;
      }
    },

    formatPrice: formatPriceVND,
  }));
}
