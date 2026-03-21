/**
 * Custom route: GET /api/gold-price/live
 * Proxies live gold price data from vang.today
 */
export default {
    routes: [
        {
            method: 'GET',
            path: '/gold-price/live',
            handler: 'gold-price.live',
            config: {
                auth: false,
                policies: [],
                middlewares: [],
            },
        },
    ],
};
