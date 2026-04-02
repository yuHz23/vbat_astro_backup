import { addOrderRow, updateCustomerSpending, updateOrderStatus } from '../../../../utils/google-sheets';

export default {
    async afterCreate(event) {
        const { result } = event;
        try {
            const botToken = process.env.TELEGRAM_BOT_TOKEN;
            const chatId = process.env.TELEGRAM_CHAT_ID;

            if (botToken && chatId) {
                const message = `🚨 *CÓ ĐƠN HÀNG MỚI (CHỜ TƯ VẤN)* 🚨\n- Mã đơn: ${result.orderNumber}\n- Khách hàng: ${result.contactName}\n- Điện thoại: ${result.contactPhone}\n- Tổng tiền: ${new Intl.NumberFormat('vi-VN').format(result.totalAmount)} VND\n- Ghi chú: ${result.notes || 'Không có'}`;

                fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: chatId,
                        text: message,
                        parse_mode: 'Markdown'
                    })
                }).catch(err => strapi.log.error('Failed to send Telegram notification', err));
            }

            // Sync to Google Sheets (non-blocking)
            // Get user email if logged in
            let userEmail = '';
            if (result.user) {
                try {
                    const user = await strapi.db.query('plugin::users-permissions.user').findOne({
                        where: { id: typeof result.user === 'object' ? result.user.id : result.user },
                    });
                    userEmail = user?.email || '';
                } catch {}
            }

            // Format items summary
            const items = Array.isArray(result.items)
                ? result.items.map((i: any) => `${i.name || i.productName} x${i.quantity}`).join(', ')
                : '';
            const totalQty = Array.isArray(result.items)
                ? result.items.reduce((sum: number, i: any) => sum + (i.quantity || 1), 0)
                : 1;

            addOrderRow({
                orderNumber: result.orderNumber || '',
                contactName: result.contactName || '',
                contactPhone: result.contactPhone || '',
                email: userEmail,
                items,
                totalQuantity: totalQty,
                totalAmount: result.totalAmount || 0,
                status: result.orderStatus || 'pending',
                createdAt: new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
            }).catch(err => strapi.log.error('[google-sheets] Failed to add order:', err));

        } catch (err) {
            strapi.log.error('Error in order afterCreate lifecycle', err);
        }
    },

    async afterUpdate(event) {
        try {
            const { result } = event;
            if (!result) return;

            const orderNumber = result.orderNumber || result.order_number || '';
            const newStatus = result.orderStatus || '';
            const phone = result.contactPhone || result.contact_phone || '';
            const amount = result.totalAmount || result.total_amount || 0;

            // Update order status in Google Sheets
            if (orderNumber && newStatus) {
                updateOrderStatus(orderNumber, newStatus)
                    .catch(err => strapi.log.error('[google-sheets] Failed to update order status:', err));
            }

            // When order is confirmed/paid, update customer spending
            if (newStatus === 'paid' && phone && amount > 0) {
                updateCustomerSpending(phone, amount)
                    .catch(err => strapi.log.error('[google-sheets] Failed to update spending:', err));
            }
        } catch (err) {
            strapi.log.error('Error in order afterUpdate lifecycle', err);
        }
    }
};
