export function registerCartStore(Alpine) {
  // Get cart key based on current user
  function getCartKey() {
    try {
      const v = localStorage.getItem('user');
      if (v && v !== 'undefined') {
        const user = JSON.parse(v);
        if (user?.id) return `cart_items_user_${user.id}`;
      }
    } catch {}
    return 'cart_items_guest';
  }

  function loadCart() {
    const key = getCartKey();
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : [];
    } catch { return []; }
  }

  function saveCart(items) {
    const key = getCartKey();
    localStorage.setItem(key, JSON.stringify(items));
  }

  Alpine.store('cart', {
    items: loadCart(),
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
      saveCart(this.items);
      this.isOpen = true;
    },

    remove(key) {
      this.items = this.items.filter(i => i.key !== key);
      saveCart(this.items);
    },

    updateQuantity(key, qty) {
      const item = this.items.find(i => i.key === key);
      if (item) {
        if (qty <= 0) this.remove(key);
        else {
          item.quantity = qty;
          saveCart(this.items);
        }
      }
    },

    clear() {
      this.items = [];
      saveCart(this.items);
    },

    toggle() {
      this.isOpen = !this.isOpen;
    },

    // Reload cart for current user (call after login/logout)
    // Merge guest cart into user cart on login
    reloadForUser() {
      const guestItems = (() => {
        try {
          const v = localStorage.getItem('cart_items_guest');
          return v ? JSON.parse(v) : [];
        } catch { return []; }
      })();

      const userItems = loadCart();

      // Merge guest items into user cart
      if (guestItems.length > 0) {
        for (const gItem of guestItems) {
          const existing = userItems.find(i => i.key === gItem.key);
          if (existing) {
            existing.quantity += gItem.quantity;
          } else {
            userItems.push(gItem);
          }
        }
        // Clear guest cart
        localStorage.removeItem('cart_items_guest');
      }

      this.items = userItems;
      saveCart(this.items);
    },
  });
}
