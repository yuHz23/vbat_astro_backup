// ===== vang.today price sync mapping =====
const VANG_TODAY_TYPES: Record<string, { goldName: string; unit: string }> = {
  SJL1L10: { goldName: 'Vàng SJC 9999 (1 Lượng)', unit: 'VNĐ/lượng' },
  SJ9999: { goldName: 'Nhẫn SJC 9999', unit: 'VNĐ/lượng' },
  BTSJC: { goldName: 'Bảo Tín SJC', unit: 'VNĐ/lượng' },
  BT9999NTT: { goldName: 'Bảo Tín 9999', unit: 'VNĐ/lượng' },
  DOHNL: { goldName: 'DOJI Hà Nội', unit: 'VNĐ/lượng' },
  DOHCML: { goldName: 'DOJI HCM', unit: 'VNĐ/lượng' },
  DOJINHTV: { goldName: 'DOJI Nữ Trang', unit: 'VNĐ/lượng' },
  PQHNVM: { goldName: 'PNJ Hà Nội', unit: 'VNĐ/lượng' },
  PQHN24NTT: { goldName: 'PNJ 24K', unit: 'VNĐ/lượng' },
  VNGSJC: { goldName: 'VN Gold SJC', unit: 'VNĐ/lượng' },
  VIETTINMSJC: { goldName: 'Viettin SJC', unit: 'VNĐ/lượng' },
  XAUUSD: { goldName: 'Vàng Thế Giới (XAU/USD)', unit: 'USD/oz' },
};

const SORT_ORDER: Record<string, number> = {
  SJL1L10: 1, SJ9999: 2, BTSJC: 3, BT9999NTT: 4,
  DOHNL: 5, DOHCML: 6, DOJINHTV: 7,
  PQHNVM: 8, PQHN24NTT: 9,
  VNGSJC: 10, VIETTINMSJC: 11, XAUUSD: 12,
};

async function syncGoldPricesFromVangToday(strapi: any) {
  try {
    const res = await fetch('https://www.vang.today/api/prices');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json() as any;
    if (!json.success || !json.prices) throw new Error('Invalid response');

    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const now = new Date().toISOString();

    let syncCount = 0;
    for (const [code, info] of Object.entries(VANG_TODAY_TYPES)) {
      const raw = json.prices[code];
      if (!raw) continue;

      const buyPrice = raw.buy || 0;
      const sellPrice = raw.sell || 0;
      const sortOrder = SORT_ORDER[code] || 99;

      // Upsert gold-price record
      const existing = await strapi.db.query('api::gold-price.gold-price').findOne({ where: { goldType: code } });
      if (existing) {
        await strapi.db.query('api::gold-price.gold-price').update({
          where: { id: existing.id },
          data: { buyPrice, sellPrice },
        });
      } else {
        await strapi.db.query('api::gold-price.gold-price').create({
          data: {
            goldType: code,
            goldName: VANG_TODAY_TYPES[code].goldName,
            buyPrice,
            sellPrice,
            unit: VANG_TODAY_TYPES[code].unit,
            sortOrder,
            isActive: true,
          },
        });
      }

      // Save snapshot to gold-history (only once per day per type)
      const existingHistory = await strapi.db.query('api::gold-history.gold-history').findOne({
        where: { goldType: code, recordDate: today },
      });
      if (!existingHistory) {
        await strapi.db.query('api::gold-history.gold-history').create({
          data: {
            goldType: code,
            goldName: VANG_TODAY_TYPES[code].goldName,
            buyPrice,
            sellPrice,
            unit: VANG_TODAY_TYPES[code].unit,
            recordDate: today,
          },
        });
      }
      syncCount++;
    }
    strapi.log.info(`[vang.today sync] Updated ${syncCount} gold types at ${now}`);
  } catch (e: any) {
    strapi.log.error('[vang.today sync] Failed:', e?.message || e);
  }
}

export default {
  register({ strapi }) {
    // Dynamically extend users-permissions user schema to avoid overwriting base fields
    const userSchema = strapi.plugin('users-permissions').contentType('user').schema;
    if (userSchema) {
      userSchema.attributes.kycStatus = {
        type: 'enumeration',
        enum: ['pending', 'verified', 'rejected']
      };
      userSchema.attributes.kycImages = {
        type: 'media',
        multiple: true,
        allowedTypes: ['images']
      };
    }
  },
  async bootstrap({ strapi }: { strapi: any }) {
    try {
      // 1. Give Public role access to products
      const publicRole = await strapi.db.query('plugin::users-permissions.role').findOne({ where: { type: 'public' } });
      if (publicRole) {
        const actions = [
          'api::product.product.find',
          'api::product.product.findOne',
          'api::product-category.product-category.find',
          'api::product-category.product-category.findOne',
          'api::order.order.create',
          'api::order.order.vnpayIpn',
          'api::testimonial.testimonial.find',
          'api::testimonial.testimonial.findOne',
          'api::article.article.find',
          'api::article.article.findOne',
          'api::gold-price.gold-price.find',
          'api::gold-price.gold-price.findOne',
          'api::gold-history.gold-history.find',
          'api::gold-history.gold-history.findOne',
          'api::banner.banner.find',
          'api::banner.banner.findOne',
          'api::product.product.update',
          'plugin::upload.content-api.upload',
          'plugin::upload.content-api.find',
          'plugin::upload.content-api.findOne'
        ];
        for (const action of actions) {
          const exists = await strapi.db.query('plugin::users-permissions.permission').count({ where: { role: publicRole.id, action } });
          if (!exists) {
            await strapi.db.query('plugin::users-permissions.permission').create({ data: { role: publicRole.id, action } });
          }
        }
      }

      // 1b. Give Authenticated role access to KYC and Uploads
      const authRole = await strapi.db.query('plugin::users-permissions.role').findOne({ where: { type: 'authenticated' } });
      if (authRole) {
        const actions = [
          'api::kyc.kyc.submit',
          'plugin::upload.content-api.upload',
          'api::order.order.create',
          'api::order.order.find',
          'api::order.order.findOne'
        ];
        for (const action of actions) {
          const exists = await strapi.db.query('plugin::users-permissions.permission').count({ where: { role: authRole.id, action } });
          if (!exists) {
            await strapi.db.query('plugin::users-permissions.permission').create({ data: { role: authRole.id, action } });
          }
        }
      }

      // 2. Seed default categories if none
      const catCount = await strapi.db.query('api::product-category.product-category').count();
      if (catCount === 0) {
        const categories = ['Nhẫn', 'Dây chuyền', 'Vòng tay', 'Bông tai', 'Vàng miếng'];
        for (let i = 0; i < categories.length; i++) {
          const name = categories[i];
          const slug = name.toLowerCase().replace(/ /g, '-').replace(/ă|â/g, 'a').replace(/đ/g, 'd').replace(/ê/g, 'e').replace(/ô/g, 'o').replace(/ư/g, 'u').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          await strapi.documents('api::product-category.product-category').create({
            data: { name, slug, sortOrder: i + 1 },
            status: 'published'
          });
        }
      }

      // 3. Seed categories: VÀNG, BẠC TÍCH TRỮ, BẠC MỸ NGHỆ
      const newCats = [
        { name: 'VÀNG', slug: 'vang', sortOrder: 10 },
        { name: 'BẠC TÍCH TRỮ', slug: 'bac-tich-tru', sortOrder: 11 },
        { name: 'BẠC MỸ NGHỆ', slug: 'bac-my-nghe', sortOrder: 12 },
      ];
      const catDocIds: Record<string, string> = {};
      for (const c of newCats) {
        let existing = await strapi.db.query('api::product-category.product-category').findOne({ where: { name: c.name } });
        if (!existing) {
          const created = await strapi.documents('api::product-category.product-category').create({
            data: c, status: 'published'
          });
          catDocIds[c.name] = created.documentId;
          strapi.log.info(`Created category: ${c.name}`);
        } else {
          catDocIds[c.name] = existing.documentId;
        }
      }

      // 4. Seed scraped products
      const allProducts = [
        { name: 'Nhẫn tròn trơn 999.9 (0.5)', sku: 'NPQ0.5', price: 8775000, compareAtPrice: 8625000, karatType: 'Vàng 999,9', goldWeight: 1.875, description: 'Sản phẩm vàng nhỏ gọn cho ngân sách thấp.', status: 'available', cat: 'VÀNG' },
        { name: 'Nhẫn tròn trơn 999.9 (1)', sku: 'NPQ1.0', price: 17550000, compareAtPrice: 17250000, karatType: 'Vàng 999,9', goldWeight: 3.75, description: 'Sản phẩm vàng tích trữ phổ biến, dễ dàng mua bán.', status: 'available', cat: 'VÀNG' },
        { name: 'Nhẫn tròn trơn 999.9 (2)', sku: 'NPQ2', price: 35100000, compareAtPrice: 34500000, karatType: 'Vàng 999,9', goldWeight: 7.5, description: 'Nhẫn vàng tích trữ loại 2 chỉ.', status: 'available', cat: 'VÀNG' },
        { name: 'Nhẫn tròn trơn 999.9 (3)', sku: 'NPQ3', price: 52650000, compareAtPrice: 51750000, karatType: 'Vàng 999,9', goldWeight: 11.25, description: 'Nhẫn vàng tích trữ loại trung bình.', status: 'available', cat: 'VÀNG' },
        { name: 'Nhẫn tròn trơn 999.9 (5)', sku: 'NPQ5', price: 87750000, compareAtPrice: 86250000, karatType: 'Vàng 999,9', goldWeight: 18.75, description: 'Nhẫn vàng tích trữ loại 5 chỉ.', status: 'available', cat: 'VÀNG' },
        { name: 'Nhẫn tròn trơn 999.9 (10)', sku: 'NPQ10', price: 175500000, compareAtPrice: 172500000, karatType: 'Vàng 999,9', goldWeight: 37.5, description: 'Biểu tượng của sự thịnh vượng và tài lộc.', status: 'available', cat: 'VÀNG' },
        { name: 'Thần tài Phú Quý 1 chỉ (999.9)', sku: 'TPQ1C', price: 17550000, compareAtPrice: 17250000, karatType: 'Vàng 999,9', goldWeight: 3.75, description: 'Sản phẩm may mắn cho ngày vía Thần tài.', status: 'available', cat: 'VÀNG' },
        { name: 'Phú Quý 1 Lượng 999.9', sku: 'TPQ1L', price: 175500000, compareAtPrice: 172500000, karatType: 'Vàng 999,9', goldWeight: 37.5, description: 'Bản vàng miếng tiêu chuẩn cho việc tích trữ giá trị cao.', status: 'available', cat: 'VÀNG' },
        { name: 'Vàng rồng Phú Quý 999.9 1L', sku: 'VRPQ1L', price: 175500000, compareAtPrice: 172500000, karatType: 'Vàng 999,9', goldWeight: 37.5, description: 'Vàng miếng rồng vàng biểu tượng quyền quý.', status: 'available', cat: 'VÀNG' },
        { name: 'Vàng con giáp 1 chỉ (999.9)', sku: 'CNG1.0', price: 17550000, compareAtPrice: 17250000, karatType: 'Vàng 999,9', goldWeight: 3.75, description: 'Bộ sưu tập vàng con giáp theo tuổi.', status: 'available', cat: 'VÀNG' },
        { name: 'Bạc Thanh Long Phú Quý 999 1KG', sku: 'BTL1KG', price: 73466483, compareAtPrice: 71253155, karatType: 'Bạc 999', goldWeight: 1000, description: 'Bạc thỏi Thanh Long Phú Quý 999 khối lượng 1KG.', status: 'available', cat: 'BẠC TÍCH TRỮ' },
        { name: 'Bạc Thanh Long Phú Quý 999 1KG -M', sku: 'BTL1KGM', price: 73466483, compareAtPrice: 71253155, karatType: 'Bạc 999', goldWeight: 1000, description: 'Bạc thỏi Thanh Long Phú Quý 999 khối lượng 1KG - bề mặt mờ.', status: 'available', cat: 'BẠC TÍCH TRỮ' },
        { name: 'Bạc Thanh Long Phú Quý 999 5L', sku: 'BTL5L', price: 13775000, compareAtPrice: 13360000, karatType: 'Bạc 999', goldWeight: 187.5, description: 'Bạc thỏi Thanh Long Phú Quý 999 khối lượng 5 lượng.', status: 'available', cat: 'BẠC TÍCH TRỮ' },
        { name: 'Bạc Thanh Long Phú Quý 999 1L', sku: 'BTLPQ1L', price: 2755000, compareAtPrice: 2672000, karatType: 'Bạc 999', goldWeight: 37.5, description: 'Bạc thỏi Thanh Long Phú Quý 999 khối lượng 1 lượng.', status: 'available', cat: 'BẠC TÍCH TRỮ' },
        { name: 'Bạc thỏi Phú Quý 999 1KG', sku: 'BPQ1KG', price: 73466483, compareAtPrice: 71253155, karatType: 'Bạc 999', goldWeight: 1000, description: 'Bạc thỏi Phú Quý 999 khối lượng 1KG.', status: 'out_of_stock', cat: 'BẠC TÍCH TRỮ' },
        { name: 'Bạc miếng Phú Quý 999 1L', sku: 'BPQ1L', price: 2755000, compareAtPrice: 2672000, karatType: 'Bạc 999', goldWeight: 37.5, description: 'Bạc miếng Phú Quý 999 khối lượng 1 lượng.', status: 'out_of_stock', cat: 'BẠC TÍCH TRỮ' },
        { name: 'Bạc thỏi Phú Quý 999 5L', sku: 'BPQ5L', price: 13775000, compareAtPrice: 13360000, karatType: 'Bạc 999', goldWeight: 187.5, description: 'Bạc thỏi Phú Quý 999 khối lượng 5 lượng.', status: 'out_of_stock', cat: 'BẠC TÍCH TRỮ' },
        { name: 'Bạch mã phi thiên 999 5L', sku: 'BBM5L', price: 13775000, compareAtPrice: 13360000, karatType: 'Bạc 999', goldWeight: 187.5, description: 'Bạc miếng Bạch mã phi thiên 999 khối lượng 5 lượng.', status: 'out_of_stock', cat: 'BẠC TÍCH TRỮ' },
        { name: 'Ngân mã chiêu tài 999 1L', sku: 'BNM1L', price: 2755000, compareAtPrice: 2672000, karatType: 'Bạc 999', goldWeight: 37.5, description: 'Bạc miếng Ngân mã chiêu tài 999 khối lượng 1 lượng.', status: 'out_of_stock', cat: 'BẠC TÍCH TRỮ' },
        { name: 'Đồng bạc Liên Hoa Bồ Đề Phú Quý 1 Lượng', sku: 'BM1.001', price: 3148000, compareAtPrice: 2676000, karatType: 'Bạc 999', goldWeight: 37.5, description: 'Đồng bạc mỹ nghệ Liên Hoa Bồ Đề Phú Quý 1 Lượng.', status: 'available', cat: 'BẠC MỸ NGHỆ' },
        { name: 'Đồng bạc Buffalo Matte 1 OZ Phú Quý', sku: 'BM1.006', price: 2612840, compareAtPrice: 2221080, karatType: 'Bạc 999.9', goldWeight: 31.1, description: 'Đồng bạc Buffalo Matte 1 OZ Phú Quý, bề mặt mờ.', status: 'available', cat: 'BẠC MỸ NGHỆ' },
        { name: 'Đồng bạc Buffalo Proof 1 OZ Phú Quý', sku: 'BM1.007', price: 2612840, compareAtPrice: 2221080, karatType: 'Bạc 999.9', goldWeight: 31.1, description: 'Đồng bạc Buffalo Proof 1 OZ Phú Quý, bề mặt bóng gương.', status: 'available', cat: 'BẠC MỸ NGHỆ' },
        { name: 'Miếng bạc Pamp Dragon 10g 2024', sku: 'BDR10G', price: 1955511, compareAtPrice: 713422, karatType: 'Bạc 999', goldWeight: 10, description: 'Miếng bạc PAMP Suisse hình rồng 10g năm 2024.', status: 'available', cat: 'BẠC MỸ NGHỆ' },
        { name: 'Bạc miếng Phú Quý 999 RAN1L', sku: 'BRN1L', price: 2755000, compareAtPrice: 2672000, karatType: 'Bạc 999', goldWeight: 37.5, description: 'Bạc miếng Phú Quý 999 hình rắn 1 lượng.', status: 'out_of_stock', cat: 'BẠC MỸ NGHỆ' },
        { name: 'Đồng bạc Britannia 1 OZ', sku: 'BP1.001', price: 2612840, compareAtPrice: 2221080, karatType: 'Bạc 999.9', goldWeight: 31.1, description: 'Đồng bạc Britannia 1 OZ - The Royal Mint.', status: 'out_of_stock', cat: 'BẠC MỸ NGHỆ' },
        { name: 'Đồng bạc Kangaroo 1 OZ', sku: 'BP1.002', price: 2612840, compareAtPrice: 2221080, karatType: 'Bạc 999.9', goldWeight: 31.1, description: 'Đồng bạc Kangaroo 1 OZ - Perth Mint Úc.', status: 'out_of_stock', cat: 'BẠC MỸ NGHỆ' },
        { name: 'Đồng bạc Maple Leaf 1 OZ', sku: 'BP1.003', price: 2612840, compareAtPrice: 2221080, karatType: 'Bạc 999.9', goldWeight: 31.1, description: 'Đồng bạc Maple Leaf 1 OZ - Royal Canadian Mint.', status: 'out_of_stock', cat: 'BẠC MỸ NGHỆ' },
        { name: 'Đồng bạc Philharmonia 1 OZ', sku: 'BP1.004', price: 2612840, compareAtPrice: 2221080, karatType: 'Bạc 999.9', goldWeight: 31.1, description: 'Đồng bạc Philharmonia 1 OZ - Austrian Mint.', status: 'out_of_stock', cat: 'BẠC MỸ NGHỆ' },
        { name: 'Đồng bạc American Eagle 1 OZ', sku: 'BP1.005', price: 2612840, compareAtPrice: 2221080, karatType: 'Bạc 999.9', goldWeight: 31.1, description: 'Đồng bạc American Eagle 1 OZ - US Mint.', status: 'out_of_stock', cat: 'BẠC MỸ NGHỆ' },
        { name: 'Đồng bạc Niue Turtle 1 OZ', sku: 'BP1.006', price: 2612840, compareAtPrice: 2221080, karatType: 'Bạc 999.9', goldWeight: 31.1, description: 'Đồng bạc Niue Turtle 1 OZ - NZ Mint.', status: 'out_of_stock', cat: 'BẠC MỸ NGHỆ' },
        { name: 'Đồng bạc Somalia Elephant 1 OZ', sku: 'BP1.007', price: 2612840, compareAtPrice: 2221080, karatType: 'Bạc 999.9', goldWeight: 31.1, description: 'Đồng bạc Somalia Elephant 1 OZ - Bavarian State Mint.', status: 'out_of_stock', cat: 'BẠC MỸ NGHỆ' },
      ];

      for (const p of allProducts) {
        const exists = await strapi.db.query('api::product.product').findOne({ where: { sku: p.sku } });
        if (!exists && catDocIds[p.cat]) {
          const slug = p.name.toLowerCase()
            .replace(/đ/g, 'd').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-');
          await strapi.documents('api::product.product').create({
            data: {
              name: p.name, slug: `${slug}-${p.sku.toLowerCase()}`, sku: p.sku,
              price: p.price, compareAtPrice: p.compareAtPrice,
              karatType: p.karatType, goldWeight: p.goldWeight,
              description: p.description, status: p.status,
              category: catDocIds[p.cat],
            },
            status: 'published'
          });
          strapi.log.info(`Seeded product: ${p.name}`);
        }
      }

      // 4b. Seed 1 year history if empty
      const historyCount = await strapi.db.query('api::gold-history.gold-history').count();
      if (historyCount < 4000) {
        strapi.log.info("Seeding 1 year of gold history...");
        try {
          const liveRes = await fetch('https://www.vang.today/api/prices');
          if (liveRes.ok) {
            const jsonData = (await liveRes.json()) as any;
            const liveData = jsonData.prices;
            const records: any[] = [];
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            for (const [code, info] of Object.entries(VANG_TODAY_TYPES)) {
              const raw = liveData[code];
              if (!raw) continue;

              let currentBuy = raw.buy || 0;
              let currentSell = raw.sell || 0;

              for (let i = 1; i <= 365; i++) {
                const d = new Date(today);
                d.setDate(d.getDate() - i);

                // Add random walk: +/- 0.5%, slightly biased so it looks naturally trending
                const changePercent = (Math.random() - 0.45) * 0.01;
                currentBuy = Math.round(currentBuy * (1 - changePercent));
                currentSell = Math.round(currentSell * (1 - changePercent));

                records.push({
                  goldType: code,
                  goldName: info.goldName,
                  buyPrice: currentBuy,
                  sellPrice: currentSell,
                  unit: info.unit,
                  recordDate: d.toISOString().slice(0, 10),
                });
              }
            }

            // Insert in chunks to avoid sqlite variables limit
            for (let i = 0; i < records.length; i += 100) {
              await strapi.db.query('api::gold-history.gold-history').createMany({
                data: records.slice(i, i + 100)
              });
            }
            strapi.log.info("Seeding 1 year history complete!");
          }
        } catch (e) {
          strapi.log.error("Failed to seed history", e);
        }
      }

      // 5. Start vang.today price sync
      // Run immediately on startup
      await syncGoldPricesFromVangToday(strapi);
      // Then sync every 5 minutes
      setInterval(() => syncGoldPricesFromVangToday(strapi), 5 * 60 * 1000);
      strapi.log.info('[vang.today sync] Scheduled sync every 5 minutes');

    } catch (e) {
      strapi.log.error('Bootstrap error', e);
    }
  },
  destroy(/* { strapi } */) { },
};
// Trigger reload
