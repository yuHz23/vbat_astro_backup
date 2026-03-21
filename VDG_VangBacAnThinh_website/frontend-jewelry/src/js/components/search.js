import { fetchAPI, getStrapiMedia, formatPriceVND } from '../utils/api';

export function registerSearch(Alpine) {
  Alpine.data('searchComponent', () => ({
    query: '',
    results: [],
    loading: false,
    debounceTimer: null,

    search() {
      clearTimeout(this.debounceTimer);
      if (this.query.length < 2) {
        this.results = [];
        return;
      }
      this.debounceTimer = setTimeout(() => this.doSearch(), 300);
    },

    async doSearch() {
      this.loading = true;
      try {
        const res = await fetchAPI('/products', {
          params: {
            'filters[name][$containsi]': this.query,
            'populate': 'images',
            'pagination[pageSize]': '8',
          },
        });
        this.results = res.data || [];
      } catch {
        this.results = [];
      } finally {
        this.loading = false;
      }
    },

    goToSearch() {
      if (this.query) {
        window.location.href = `/tim-kiem.html?q=${encodeURIComponent(this.query)}`;
      }
    },

    getStrapiMedia,
    formatPriceVND,
  }));
}
