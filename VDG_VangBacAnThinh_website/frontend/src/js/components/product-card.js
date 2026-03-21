import { getStrapiMedia, formatPriceVND } from '../utils/api';

export function registerProductCard(Alpine) {
  Alpine.data('productCard', () => ({
    getStrapiMedia,
    formatPriceVND,

    addToCart(product) {
      const cartItem = {
        id: product.id,
        name: product.name,
        price: product.price,
        slug: product.slug,
        image: product.images?.length ? getStrapiMedia(product.images[0].url) : '/placeholder.jpg',
      };
      Alpine.store('cart').add(cartItem);
    },
  }));
}
