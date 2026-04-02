import { fetchAPI, getStrapiMedia } from '../utils/api';

export function registerSilverPage(Alpine) {
  Alpine.data('silverPage', () => ({
    tichTruProducts: [],
    myNgheProducts: [],
    loadingTichTru: true,
    loadingMyNghe: true,
    tichTruTotal: 0,
    myNgheTotal: 0,
    tichTruTotalPages: 1,
    myNgheTotalPages: 1,

    async init() {
      await Promise.all([
        this.fetchTichTru(),
        this.fetchMyNghe(),
      ]);
    },

    async fetchTichTru() {
      this.loadingTichTru = true;
      try {
        const res = await fetchAPI('/products', {
          params: {
            'populate': '*',
            'filters[productType][$eq]': 'silver',
            'filters[subCategory][$eq]': 'tich-tru',
            'pagination[pageSize]': '50',
            'sort[0]': 'sortOrder:asc',
          },
        });
        this.tichTruProducts = res.data || [];
        this.tichTruTotal = res.meta?.pagination?.total || 0;
        this.tichTruTotalPages = res.meta?.pagination?.pageCount || 1;
      } catch (e) {
        console.error('Failed to fetch tich tru products:', e);
      } finally {
        this.loadingTichTru = false;
      }
    },

    async fetchMyNghe() {
      this.loadingMyNghe = true;
      try {
        const res = await fetchAPI('/products', {
          params: {
            'populate': '*',
            'filters[productType][$eq]': 'silver',
            'filters[subCategory][$eq]': 'my-nghe',
            'pagination[pageSize]': '50',
            'sort[0]': 'sortOrder:asc',
          },
        });
        this.myNgheProducts = res.data || [];
        this.myNgheTotal = res.meta?.pagination?.total || 0;
        this.myNgheTotalPages = res.meta?.pagination?.pageCount || 1;
      } catch (e) {
        console.error('Failed to fetch my nghe products:', e);
      } finally {
        this.loadingMyNghe = false;
      }
    },

    getStrapiMedia,
  }));
}
