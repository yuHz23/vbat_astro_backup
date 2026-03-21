import { fetchAPI } from '../utils/api';

export function registerNewsletter(Alpine) {
  Alpine.data('newsletter', () => ({
    email: '',
    status: '',
    message: '',
    submitting: false,

    async subscribe() {
      if (!this.email) return;
      this.submitting = true;
      this.status = '';
      try {
        await fetchAPI('/newsletter-subscribers', {
          method: 'POST',
          body: JSON.stringify({
            data: { email: this.email, subscribedAt: new Date().toISOString() },
          }),
        });
        this.status = 'success';
        this.message = 'Đăng ký thành công! Cảm ơn bạn.';
        this.email = '';
      } catch (e) {
        this.status = 'error';
        this.message = 'Email đã được đăng ký hoặc có lỗi xảy ra.';
      } finally {
        this.submitting = false;
      }
    },
  }));
}
