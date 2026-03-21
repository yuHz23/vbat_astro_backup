import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::gold-price.gold-price', ({ strapi }) => ({
    // Proxy live data from vang.today directly to browser
    async live(ctx: any) {
        try {
            const res = await fetch('https://www.vang.today/api/prices');
            if (!res.ok) throw new Error(`Upstream HTTP ${res.status}`);
            const data = await res.json();
            ctx.body = data;
        } catch (e: any) {
            ctx.status = 502;
            ctx.body = { error: 'Could not fetch live gold prices', detail: e?.message };
        }
    },
}));

