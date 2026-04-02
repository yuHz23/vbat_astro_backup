export default {
  routes: [
    {
      method: 'GET',
      path: '/admin-orders',
      handler: 'admin-orders.find',
      config: { auth: false },
    },
    {
      method: 'PUT',
      path: '/admin-orders/:id',
      handler: 'admin-orders.update',
      config: { auth: false },
    },
  ],
};
