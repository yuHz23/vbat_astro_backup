export default {
  routes: [
    {
      method: 'GET',
      path: '/admin-products',
      handler: 'admin-products.find',
      config: { auth: false },
    },
    {
      method: 'POST',
      path: '/admin-products',
      handler: 'admin-products.create',
      config: { auth: false },
    },
    {
      method: 'PUT',
      path: '/admin-products/:documentId',
      handler: 'admin-products.update',
      config: { auth: false },
    },
    {
      method: 'DELETE',
      path: '/admin-products/:documentId',
      handler: 'admin-products.delete',
      config: { auth: false },
    },
    {
      method: 'POST',
      path: '/admin-products/sync-prices',
      handler: 'admin-products.syncPrices',
      config: { auth: false },
    },
  ],
};
