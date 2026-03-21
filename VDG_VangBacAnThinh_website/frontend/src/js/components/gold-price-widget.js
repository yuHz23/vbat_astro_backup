import { fetchAPI, formatPrice } from '../utils/api';

export function registerGoldPriceWidget(Alpine) {
  Alpine.data('goldPriceWidget', () => ({
    prices: [],
    loading: true,
    lastUpdated: null,
    pollInterval: null,

    async init() {
      await this.fetchPrices();
      this.pollInterval = setInterval(() => this.fetchPrices(), 30000);
    },

    destroy() {
      if (this.pollInterval) clearInterval(this.pollInterval);
    },

    async fetchPrices() {
      try {
        const res = await fetchAPI('/gold-prices', {
          params: {
            'filters[isActive][$eq]': 'true',
            'sort[0]': 'sortOrder:asc',
            'pagination[pageSize]': '20',
          },
        });
        this.prices = res.data || [];
        this.lastUpdated = new Date().toLocaleTimeString('vi-VN');
      } catch (e) {
        console.error('Failed to fetch gold prices:', e);
      } finally {
        this.loading = false;
      }
    },

    formatPrice,
  }));
}
