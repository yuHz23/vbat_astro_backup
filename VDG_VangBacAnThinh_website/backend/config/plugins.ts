export default ({ env }) => ({
  'users-permissions': {
    config: {
      jwtSecret: env('JWT_SECRET', '40d8294a6538d7ae1f7b0b699e19d5c8'),
    },
  },
});
