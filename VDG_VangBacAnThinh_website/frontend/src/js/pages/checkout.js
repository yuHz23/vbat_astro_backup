import { fetchAPI, formatPriceVND } from '../utils/api';

export function registerCheckoutPage(Alpine) {
  Alpine.data('checkoutPage', () => ({
    contactName: '',
    contactPhone: '',
    notes: '',
    submitting: false,
    submitted: false,
    orderNumber: '',
    savedTotal: 0,
    error: '',

    init() {
      const user = Alpine.store('auth').user;
      if (user) {
        this.contactName = user.fullName || '';
        this.contactPhone = user.phone || user.username || '';
      }
    },

    get cartItems() {
      return Alpine.store('cart').items;
    },

    get cartTotal() {
      return Alpine.store('cart').total;
    },

    get isKycVerified() {
      return Alpine.store('auth').user?.kycStatus === 'verified';
    },

    get kycStatus() {
      return Alpine.store('auth').user?.kycStatus || null;
    },

    async submitOrder() {
      // KYC enforcement
      if (!this.isKycVerified) {
        if (this.kycStatus === 'pending') {
          this.error = 'Hồ sơ KYC của bạn đang chờ xác minh. Vui lòng đợi admin duyệt trước khi mua hàng.';
        } else if (this.kycStatus === 'rejected') {
          this.error = 'Hồ sơ KYC đã bị từ chối. Vui lòng cập nhật lại CCCD trong trang tài khoản.';
        } else {
          this.error = 'Bạn cần xác minh CCCD trước khi mua hàng. Vui lòng vào trang Tài khoản để tải lên ảnh CCCD.';
        }
        return;
      }

      if (!this.contactName || !this.contactPhone) {
        this.error = 'Vui lòng điền đầy đủ họ tên và số điện thoại.';
        return;
      }
      this.submitting = true;
      this.error = '';

      try {
        const orderNum = 'VAT-' + Date.now();
        const items = this.cartItems.map(item => ({
          quantity: item.quantity,
          unitPrice: item.price,
          variantInfo: item.variant ? `${item.name} - ${item.variant}` : item.name,
        }));

        const isLoggedIn = Alpine.store('auth').isLoggedIn;

        const orderData = {
          orderNumber: orderNum,
          items,
          totalAmount: this.cartTotal,
          orderStatus: 'pending',
          contactName: this.contactName,
          contactPhone: this.contactPhone,
          notes: this.notes,
        };

        await fetchAPI('/orders', {
          method: 'POST',
          auth: isLoggedIn,
          body: JSON.stringify({ data: orderData }),
        });

        this.savedTotal = this.cartTotal;
        Alpine.store('cart').clear();
        Alpine.store('cart').isOpen = false;
        this.orderNumber = orderNum;
        this.submitted = true;
      } catch (e) {
        this.error = e.message || 'Đã có lỗi xảy ra. Vui lòng thử lại hoặc liên hệ hotline 0363778889.';
      } finally {
        this.submitting = false;
      }
    },

    formatPriceVND,
  }));
}
