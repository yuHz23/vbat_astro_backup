export function registerCartStore(Alpine) {
  Alpine.store('cart', {
    items: Alpine.$persist([]).as('cart_items'),
    isOpen: false,

    get count() {
      return this.items.reduce((sum, item) => sum + item.quantity, 0);
    },

    get total() {
      return this.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    },

    add(product, quantity = 1, variant = null) {
      const key = variant ? `${product.id}-${variant}` : `${product.id}`;
      const existing = this.items.find(i => i.key === key);

      if (existing) {
        existing.quantity += quantity;
      } else {
        this.items.push({
          key,
          id: product.id,
          name: product.name,
          price: product.price,
          image: product.image,
          slug: product.slug,
          variant,
          quantity,
        });
      }
      this.isOpen = true;
    },

    remove(key) {
      this.items = this.items.filter(i => i.key !== key);
    },

    updateQuantity(key, qty) {
      const item = this.items.find(i => i.key === key);
      if (item) {
        if (qty <= 0) this.remove(key);
        else item.quantity = qty;
      }
    },

    clear() {
      this.items = [];
    },

    toggle() {
      this.isOpen = !this.isOpen;
    },
  });
}
