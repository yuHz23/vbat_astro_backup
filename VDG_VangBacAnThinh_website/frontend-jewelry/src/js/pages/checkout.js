import { fetchAPI, formatPriceVND } from '../utils/api';

export function registerCheckoutPage(Alpine) {
  Alpine.data('checkoutPage', () => ({
    contactName: '',
    contactPhone: '',
    contactZalo: '',
    notes: '',
    submitting: false,
    submitted: false,
    orderNumber: '',
    error: '',

    get isKyc() {
      return Alpine.store('auth').isKycVerified;
    },

    get cartItems() {
      return Alpine.store('cart').items;
    },

    get cartTotal() {
      return Alpine.store('cart').total;
    },

    async submitOrder() {
      if (!this.contactName || !this.contactPhone) {
        this.error = 'Vui lòng điền đầy đủ họ tên và số điện thoại.';
        return;
      }
      this.submitting = true;
      this.error = '';

      try {
        const orderNum = 'VAT-' + Date.now();
        const items = this.cartItems.map(item => ({
          product: item.id,
          quantity: item.quantity,
          unitPrice: item.price,
          variantInfo: item.variant || '',
        }));

        const response = await fetchAPI('/orders', {
          method: 'POST',
          auth: Alpine.store('auth').isLoggedIn,
          body: JSON.stringify({
            data: {
              orderNumber: orderNum,
              items,
              totalAmount: this.cartTotal,
              status: 'pending',
              contactName: this.contactName,
              contactPhone: this.contactPhone,
              notes: this.notes,
              user: Alpine.store('auth').user?.id || null,
            },
          }),
        });

        Alpine.store('cart').clear();

        if (response.vnpayUrl) {
          localStorage.setItem('last_order_number', orderNum);
          window.location.href = response.vnpayUrl;
          return;
        }

        this.orderNumber = orderNum;
        this.submitted = true;
      } catch (e) {
        this.error = 'Đã có lỗi xảy ra. Vui lòng thử lại hoặc liên hệ hotline 0363778889.';
      } finally {
        this.submitting = false;
      }
    },

    formatPriceVND,
  }));
}
