export default ({ env }) => ({
  auth: {
    secret: env('ADMIN_JWT_SECRET', '40d8294a6538d7ae1f7b0b699e19d5c8'),
  },
  apiToken: {
    salt: env('API_TOKEN_SALT', '40d8294a6538d7ae1f7b0b699e19d5c8'),
  },
  transfer: {
    token: {
      salt: env('TRANSFER_TOKEN_SALT', '40d8294a6538d7ae1f7b0b699e19d5c8'),
    },
  },
  flags: {
    nps: env.bool('FLAG_NPS', true),
    promoteEE: env.bool('FLAG_PROMOTE_EE', true),
  },
});
