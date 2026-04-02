export default {
  routes: [
    {
      method: 'GET',
      path: '/orders/my-orders',
      handler: 'order.myOrders',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
