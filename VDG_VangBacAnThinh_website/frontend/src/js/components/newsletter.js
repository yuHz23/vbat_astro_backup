import { fetchAPI } from '../utils/api';

// Telegram Bot config - replace with your bot token and chat ID
const TELEGRAM_BOT_TOKEN = ''; // TODO: Add your bot token from @BotFather
const TELEGRAM_CHAT_ID = ''; // TODO: Add your chat/group ID

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
        // 1. Save to Strapi
        await fetchAPI('/newsletter-subscribers', {
          method: 'POST',
          body: JSON.stringify({
            data: { email: this.email, subscribedAt: new Date().toISOString() },
          }),
        });

        // 2. Notify Telegram bot
        if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
          const text = `📧 Đăng ký nhận tin mới!\n\nEmail: ${this.email}\nThời gian: ${new Date().toLocaleString('vi-VN')}`;
          await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text, parse_mode: 'HTML' }),
          }).catch(() => {}); // Don't block if Telegram fails
        }

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
