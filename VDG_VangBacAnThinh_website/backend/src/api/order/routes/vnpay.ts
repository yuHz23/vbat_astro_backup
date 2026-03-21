export default {
    routes: [
        {
            method: 'GET',
            path: '/orders/vnpay-ipn',
            handler: 'order.vnpayIpn',
            config: {
                auth: false,
            },
        },
    ],
};
