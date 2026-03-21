export function registerContactPage(Alpine) {
  Alpine.data('contactPage', () => ({
    name: '',
    phone: '',
    email: '',
    message: '',
    submitted: false,
    error: '',

    async submit() {
      if (!this.name || !this.phone || !this.message) {
        this.error = 'Vui lòng điền đầy đủ thông tin.';
        return;
      }

      try {
        const STRAPI_URL = import.meta.env.PUBLIC_STRAPI_URL || 'http://localhost:1337';
        const res = await fetch(`${STRAPI_URL}/api/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            data: {
              name: this.name,
              phone: this.phone,
              email: this.email,
              message: this.message,
            }
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData?.error?.message || 'Có lỗi xảy ra, vui lòng thử lại sau.');
        }

        this.submitted = true;
        this.error = '';
      } catch (err) {
        this.error = err.message || 'Có lỗi xảy ra khi gửi tin nhắn.';
      }
    },
  }));
}
