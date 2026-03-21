import { fetchAPI, getStrapiMedia, formatPriceVND } from '../utils/api';

export function registerProductDetail(Alpine) {
  Alpine.data('productDetail', () => ({
    product: null,
    relatedProducts: [],
    loading: true,
    selectedImage: 0,
    selectedVariant: null,
    quantity: 1,

    async init() {
      const urlParams = new URLSearchParams(window.location.search);
      const slug = urlParams.get('slug');
      if (slug) await this.fetchProduct(slug);
    },

    async fetchProduct(slug) {
      this.loading = true;
      try {
        const res = await fetchAPI('/products', {
          params: {
            'filters[slug][$eq]': slug,
            'populate': '*',
          },
        });
        this.product = res.data?.[0] || null;
        if (this.product?.category) {
          await this.fetchRelated(this.product.category.id, this.product.id);
        }
      } catch (e) {
        console.error('Failed to fetch product:', e);
      } finally {
        this.loading = false;
      }
    },

    async fetchRelated(categoryId, excludeId) {
      try {
        const res = await fetchAPI('/products', {
          params: {
            'filters[category][id][$eq]': categoryId,
            'filters[id][$ne]': excludeId,
            'populate': '*',
            'pagination[pageSize]': '4',
          },
        });
        this.relatedProducts = res.data || [];
      } catch { /* ignore */ }
    },

    get currentPrice() {
      if (!this.product) return 0;
      let price = this.product.price;
      if (this.selectedVariant) {
        const variant = this.product.variants?.find(v => v.variantName === this.selectedVariant);
        if (variant) price += variant.additionalPrice || 0;
      }
      return price;
    },

    selectImage(index) {
      this.selectedImage = index;
    },

    addToCart() {
      if (!this.product) return;
      Alpine.store('cart').add({
        id: this.product.id,
        name: this.product.name,
        price: this.currentPrice,
        slug: this.product.slug,
        image: this.product.images?.length ? getStrapiMedia(this.product.images[0].url) : '/placeholder.jpg',
      }, this.quantity, this.selectedVariant);
    },

    getStrapiMedia,
    formatPriceVND,
  }));
}
