export default {
    routes: [
        {
            method: 'GET',
            path: '/orders/check-status/:orderNumber',
            handler: 'order.checkStatus',
            config: {
                auth: false,
            },
        },
        {
            method: 'POST',
            path: '/orders/payment-webhook',
            handler: 'order.paymentWebhook',
            config: {
                auth: false, // Webhooks from VCB API/Casso don't have auth
            },
        },
        {
            method: 'POST',
            path: '/orders/confirm-test/:orderNumber',
            handler: 'order.confirmTest',
            config: {
                auth: false, // For testing only - should be secured in production
            },
        },
    ],
};
