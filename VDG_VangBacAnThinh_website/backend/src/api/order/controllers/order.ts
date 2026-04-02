import { factories } from '@strapi/strapi';
import { generateVNPayUrl, verifyVNPayIPN } from '../../../utils/vnpay';

export default factories.createCoreController('api::order.order', ({ strapi }) => ({
    async create(ctx) {
        // Remove user from payload to avoid validation error
        const userData = ctx.state.user;
        if (ctx.request.body?.data?.user) {
            delete ctx.request.body.data.user;
        }

        const response = await super.create(ctx);

        // Link user to order after creation
        if (userData && response.data?.documentId) {
            await strapi.db.query('api::order.order').update({
                where: { documentId: response.data.documentId },
                data: { user: userData.id },
            });
        }

        if (userData && userData.kycStatus === 'verified') {
            const amount = response.data?.totalAmount || ctx.request.body?.data?.totalAmount || 0;
            const orderNumber = response.data?.orderNumber || ctx.request.body?.data?.orderNumber || Date.now().toString();
            if (amount > 0) {
                const vnpayUrl = generateVNPayUrl(ctx.request, { orderNumber }, amount);
                return { ...response, vnpayUrl };
            }
        }
        return response;
    },

    async myOrders(ctx) {
        const user = ctx.state.user;
        if (!user) {
            return ctx.unauthorized('Vui lòng đăng nhập.');
        }

        const orders = await strapi.db.query('api::order.order').findMany({
            where: { user: user.id },
            orderBy: { createdAt: 'desc' },
            populate: { items: true },
        });

        return ctx.send({ data: orders });
    },

    // Payment webhook - receives bank transfer notifications from VCB API/Casso
    // or can be called manually to confirm payment
    // POST /api/orders/payment-webhook
    // VCB API format: { data: [{ Description, Amount, ... }] }
    // Casso format: { data: [{ description, amount, ... }] }
    async paymentWebhook(ctx) {
        try {
            const body = ctx.request.body;
            let transactions = [];

            // VCB Business API webhook format
            // { data: [{ TransactionDate, Description, Amount, ReferenceNumber, ... }] }
            if (body?.data && Array.isArray(body.data)) {
                transactions = body.data.map(t => ({
                    content: t.Description || t.description || '',
                    amount: t.Amount || t.amount || 0,
                }));
                strapi.log.info(`[payment-webhook] VCB/Casso: ${transactions.length} transaction(s)`);
            }
            // Simple format for testing
            else if (body?.orderNumber) {
                transactions = [{
                    content: body.orderNumber,
                    amount: body.amount || 0,
                }];
            }

            let confirmed = 0;

            for (const tx of transactions) {
                // Extract order number from transfer content
                // Bank webhook may strip the dash: "VAT1234567890" or "VAT-1234567890"
                const match = tx.content.match(/VAT-?(\d+)/i);
                if (!match) continue;

                const orderNumber = 'VAT-' + match[1];

                const orders = await strapi.db.query('api::order.order').findMany({
                    where: { orderNumber },
                });

                if (orders.length === 0) continue;

                const order = orders[0];

                // Only confirm pending orders
                if (order.orderStatus !== 'pending') continue;

                // Verify amount matches - must pay at least full amount
                if (tx.amount > 0 && tx.amount < order.totalAmount) {
                    strapi.log.warn(`[payment-webhook] Order ${orderNumber}: paid ${tx.amount} but total is ${order.totalAmount}. Insufficient amount.`);

                    // Notify via Telegram about insufficient payment
                    const botToken = process.env.TELEGRAM_BOT_TOKEN;
                    const chatId = process.env.TELEGRAM_CHAT_ID;
                    if (botToken && chatId) {
                        const msg = `⚠️ *THANH TOAN THIEU*\n- Ma don: ${orderNumber}\n- Can: ${new Intl.NumberFormat('vi-VN').format(order.totalAmount)} VND\n- Nhan: ${new Intl.NumberFormat('vi-VN').format(tx.amount)} VND\n- Thieu: ${new Intl.NumberFormat('vi-VN').format(order.totalAmount - tx.amount)} VND\n- Khach: ${order.contactName} - ${order.contactPhone}`;
                        fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ chat_id: chatId, text: msg, parse_mode: 'Markdown' }),
                        }).catch(() => {});
                    }
                    continue;
                }

                await strapi.db.query('api::order.order').update({
                    where: { id: order.id },
                    data: { orderStatus: 'paid' },
                });

                strapi.log.info(`[payment-webhook] Order ${orderNumber} confirmed as paid (amount: ${tx.amount})`);

                // Send Telegram notification
                const botToken = process.env.TELEGRAM_BOT_TOKEN;
                const chatId = process.env.TELEGRAM_CHAT_ID;
                if (botToken && chatId) {
                    const msg = `✅ *ĐÃ NHẬN THANH TOÁN*\n- Mã đơn: ${orderNumber}\n- Khách: ${order.contactName}\n- SĐT: ${order.contactPhone}\n- Số tiền: ${new Intl.NumberFormat('vi-VN').format(tx.amount || order.totalAmount)} VND`;
                    fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ chat_id: chatId, text: msg, parse_mode: 'Markdown' }),
                    }).catch(() => {});
                }
                confirmed++;
            }

            return ctx.send({ success: true, confirmed });
        } catch (err) {
            strapi.log.error('[payment-webhook] Error:', err);
            return ctx.send({ success: false, error: err.message }, 500);
        }
    },

    // Public order status check - only returns status, no sensitive data
    async checkStatus(ctx) {
        const { orderNumber } = ctx.params;
        if (!orderNumber) return ctx.badRequest('Missing orderNumber');

        const orders = await strapi.db.query('api::order.order').findMany({
            where: { orderNumber },
            select: ['orderStatus'],
        });

        if (orders.length === 0) return ctx.notFound('Order not found');
        return ctx.send({ status: orders[0].orderStatus, orderNumber });
    },

    // Quick confirm endpoint for testing: POST /api/orders/confirm-test/:orderNumber
    async confirmTest(ctx) {
        const { orderNumber } = ctx.params;
        if (!orderNumber) {
            return ctx.badRequest('Missing orderNumber');
        }

        const orders = await strapi.db.query('api::order.order').findMany({
            where: { orderNumber },
        });

        if (orders.length === 0) {
            return ctx.notFound('Order not found');
        }

        await strapi.db.query('api::order.order').update({
            where: { id: orders[0].id },
            data: { orderStatus: 'paid' },
        });

        strapi.log.info(`[confirm-test] Order ${orderNumber} manually confirmed as paid`);
        return ctx.send({ success: true, orderNumber, orderStatus: 'paid' });
    },

    async vnpayIpn(ctx) {
        let vnp_Params = ctx.query;
        let isSecure = verifyVNPayIPN({ ...vnp_Params });

        if (isSecure) {
            let orderId = vnp_Params['vnp_TxnRef'];
            let rspCode = vnp_Params['vnp_ResponseCode'];

            const orders = await strapi.entityService.findMany('api::order.order', {
                filters: { orderNumber: orderId },
            });

            if (orders && orders.length > 0) {
                const order = orders[0];
                if (rspCode === '00') {
                    await strapi.db.query('api::order.order').update({
                        where: { id: order.id },
                        data: { orderStatus: 'paid' },
                    });
                }
                return ctx.send({ RspCode: '00', Message: 'Confirm Success' });
            }
            return ctx.send({ RspCode: '01', Message: 'Order not found' });
        } else {
            return ctx.send({ RspCode: '97', Message: 'Checksum failed' });
        }
    }
}));
