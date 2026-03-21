import { fetchAPI } from '../utils/api';

export function registerStoreLocator(Alpine) {
  Alpine.data('storeLocator', () => ({
    stores: [],
    loading: true,

    async init() {
      try {
        const res = await fetchAPI('/store-locations', {
          params: { 'pagination[pageSize]': '50' },
        });
        this.stores = res.data || [];
      } catch (e) {
        console.error('Failed to fetch stores:', e);
      } finally {
        this.loading = false;
      }
    },
  }));
}
