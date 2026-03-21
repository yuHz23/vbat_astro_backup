import { factories } from '@strapi/strapi';
import { generateVNPayUrl, verifyVNPayIPN } from '../../../utils/vnpay';

export default factories.createCoreController('api::order.order', ({ strapi }) => ({
    async create(ctx) {
        const response = await super.create(ctx);
        const user = ctx.state.user;
        if (user && user.kycStatus === 'verified') {
            const amount = response.data?.totalAmount || ctx.request.body?.data?.totalAmount || 0;
            const orderNumber = response.data?.orderNumber || ctx.request.body?.data?.orderNumber || Date.now().toString();
            if (amount > 0) {
                const vnpayUrl = generateVNPayUrl(ctx.request, { orderNumber }, amount);
                return { ...response, vnpayUrl };
            }
        }
        return response;
    },

    async vnpayIpn(ctx) {
        let vnp_Params = ctx.query;
        let isSecure = verifyVNPayIPN({ ...vnp_Params }); // clone to avoid modifying original

        if (isSecure) {
            let orderId = vnp_Params['vnp_TxnRef'];
            let rspCode = vnp_Params['vnp_ResponseCode'];

            // Find order
            const orders = await strapi.entityService.findMany('api::order.order', {
                filters: { orderNumber: orderId },
            });

            if (orders && orders.length > 0) {
                const order = orders[0];

                // Handle payment success or failure
                if (rspCode === '00') {
                    await strapi.entityService.update('api::order.order', order.id, {
                        data: { status: 'paid' },
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
