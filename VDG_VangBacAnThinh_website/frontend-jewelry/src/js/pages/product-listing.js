import { fetchAPI, getStrapiMedia, formatPriceVND } from '../utils/api';

export function registerProductListing(Alpine) {
  Alpine.data('productListing', () => ({
    products: [],
    categories: [],
    loading: true,
    currentPage: 1,
    pageSize: 12,
    totalPages: 1,
    totalItems: 0,
    selectedCategory: '',
    sortBy: 'createdAt:desc',
    priceRange: [0, 999999999],
    karatFilter: '',

    async init() {
      const urlParams = new URLSearchParams(window.location.search);
      this.selectedCategory = urlParams.get('category') || '';
      await Promise.all([this.fetchProducts(), this.fetchCategories()]);
    },

    async fetchProducts() {
      this.loading = true;
      try {
        const params = {
          'populate': '*',
          'pagination[page]': this.currentPage.toString(),
          'pagination[pageSize]': this.pageSize.toString(),
          'sort[0]': this.sortBy,
        };
        if (this.selectedCategory) {
          params['filters[category][slug][$eq]'] = this.selectedCategory;
        }
        if (this.karatFilter) {
          params['filters[karatType][$eq]'] = this.karatFilter;
        }
        const res = await fetchAPI('/products', { params });
        this.products = res.data || [];
        this.totalPages = res.meta?.pagination?.pageCount || 1;
        this.totalItems = res.meta?.pagination?.total || 0;
      } catch (e) {
        console.error('Failed to fetch products:', e);
      } finally {
        this.loading = false;
      }
    },

    async fetchCategories() {
      try {
        const res = await fetchAPI('/product-categories', {
          params: { 'sort[0]': 'sortOrder:asc', 'populate': '*' },
        });
        this.categories = res.data || [];
      } catch (e) {
        console.error('Failed to fetch categories:', e);
      }
    },

    async goToPage(page) {
      this.currentPage = page;
      await this.fetchProducts();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    async applyFilter() {
      this.currentPage = 1;
      await this.fetchProducts();
    },

    getStrapiMedia,
    formatPriceVND,
  }));
}
