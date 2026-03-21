/**
 * gold-history router
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::gold-history.gold-history', {
    config: {
        create: {
            auth: false,
        },
        find: {
            auth: false,
        }
    }
});
