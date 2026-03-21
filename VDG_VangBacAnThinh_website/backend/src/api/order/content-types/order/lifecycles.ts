export default {
    async afterCreate(event) {
        const { result } = event;
        try {
            const botToken = process.env.TELEGRAM_BOT_TOKEN;
            const chatId = process.env.TELEGRAM_CHAT_ID;

            if (!botToken || !chatId) {
                strapi.log.warn('Telegram bot token or chat ID is missing. Skipping notification.');
                return;
            }

            // Format the message
            const message = `🚨 *CÓ ĐƠN HÀNG MỚI (CHỜ TƯ VẤN)* 🚨\n- Mã đơn: ${result.orderNumber}\n- Khách hàng: ${result.contactName}\n- Điện thoại: ${result.contactPhone}\n${result.contactZalo ? `- Zalo: ${result.contactZalo}\n` : ''}- Tổng tiền: ${new Intl.NumberFormat('vi-VN').format(result.totalAmount)} VND\n- Ghi chú: ${result.notes || 'Không có'}`;

            // Send via Telegram API
            fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: message,
                    parse_mode: 'Markdown'
                })
            }).catch(err => strapi.log.error('Failed to send Telegram notification', err));

        } catch (err) {
            strapi.log.error('Error in order afterCreate lifecycle', err);
        }
    }
};
