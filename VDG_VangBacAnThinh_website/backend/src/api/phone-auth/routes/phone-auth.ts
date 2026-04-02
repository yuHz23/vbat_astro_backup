export default {
  routes: [
    {
      method: 'POST',
      path: '/phone-auth/register',
      handler: 'phone-auth.register',
      config: { auth: false },
    },
    {
      method: 'POST',
      path: '/phone-auth/login',
      handler: 'phone-auth.login',
      config: { auth: false },
    },
    {
      method: 'PUT',
      path: '/phone-auth/update-profile',
      handler: 'phone-auth.updateProfile',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
