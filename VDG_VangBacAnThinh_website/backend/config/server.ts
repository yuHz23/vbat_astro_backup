export default ({ env }) => ({
  host: env('HOST', '0.0.0.0'),
  port: env.int('PORT', 1337),
  app: {
    keys: env.array('APP_KEYS', ['WMyv8a6y0r/1l/e/sI+Wzw==', 'YcI1pB4f5S6g7H8j9K0L1M2==']),
  },
});
