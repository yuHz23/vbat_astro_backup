/**
 * Auto-sync product prices from Phú Quý official API.
 * Fetches individual product prices via search-product endpoint.
 * Maps productCode (Phú Quý) → sku (our system).
 */

const PHU_QUY_SEARCH_API = 'https://be.phuquy.com.vn/jewelry/product-payment-service/api/products/search-product';

const HEADERS = {
  'Accept': 'application/json',
  'Content-Type': 'application/json',
  'Origin': 'https://phuquy.com.vn',
  'Referer': 'https://phuquy.com.vn/',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
};

// Map Phú Quý productCode → our SKU (where they differ)
const CODE_TO_SKU: Record<string, string> = {
  'BM1OZ': 'BM1.006',     // Buffalo Matte
  'BM1OZ02': 'BM1.007',   // Buffalo Proof
  'BM10G01': 'BDR10G',    // Pamp Dragon 10g
  'BM1OZ03': 'BP1.001',   // Britannia
  'BM1OZ04': 'BP1.002',   // Kangaroo
  'BM1OZ05': 'BP1.003',   // Maple Leaf
  'BM1OZ06': 'BP1.005',   // American Eagle
  'BPQRAN1L': 'BRN1L',    // Bạc miếng Rắn
};

interface PhuQuyProduct {
  productCode: string;
  productName: string;
  priceIn: number;
  priceOut: number;
  stockStatus: number;
}

export async function syncProductPrices(strapi: any) {
  try {
    // Fetch all 3 product types: 1=Vàng tích trữ, 3=Bạc mỹ nghệ, 4=Bạc tích trữ
    const body = {
      productMaterialIds: null,
      sortByPrice: null,
      weightFilter: null,
      productTypePageReqList: [
        { productTypeId: 1, pageReq: { pageNum: 0, pageSize: 50 } },  // Vàng tích trữ
        { productTypeId: 3, pageReq: { pageNum: 0, pageSize: 50 } },  // Bạc mỹ nghệ
        { productTypeId: 4, pageReq: { pageNum: 0, pageSize: 50 } },  // Bạc tích trữ
      ],
      pageNum: 0,
      pageSize: 100,
    };

    const res = await fetch(PHU_QUY_SEARCH_API, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      strapi.log.error(`[price-sync] Phú Quý API returned ${res.status}`);
      return;
    }

    const json = await res.json() as any;
    if (json.errorCode !== '0' || !json.data?.productSearchResponses) {
      strapi.log.error('[price-sync] Phú Quý API error:', json.message);
      return;
    }

    // Build price map: SKU → { priceIn, priceOut, stockStatus }
    const priceMap: Record<string, PhuQuyProduct> = {};
    for (const group of json.data.productSearchResponses) {
      for (const p of (group.content || [])) {
        const code = p.productCode;
        // Use mapped SKU if exists, otherwise use productCode directly
        const sku = CODE_TO_SKU[code] || code;
        priceMap[sku] = {
          productCode: code,
          productName: p.productName,
          priceIn: p.priceIn || 0,
          priceOut: p.priceOut || 0,
          stockStatus: p.stockStatus,
        };
      }
    }

    strapi.log.info(`[price-sync] Fetched ${Object.keys(priceMap).length} products from Phú Quý`);

    // Update existing products
    const products = await strapi.db.query('api::product.product').findMany({});
    let updated = 0;

    for (const product of products) {
      const sku = product.sku;
      if (!sku) continue;

      const pqPrice = priceMap[sku];
      if (!pqPrice || pqPrice.priceOut <= 0) continue;

      const newPrice = Math.round(pqPrice.priceOut);
      const newCompareAtPrice = Math.round(pqPrice.priceIn);
      // stockStatus: 1=còn hàng, 2=đặt hàng (vẫn bán), 3=hết hàng
      const newStatus = pqPrice.stockStatus === 3 ? 'out_of_stock' : 'available';

      const needsUpdate =
        product.price !== newPrice ||
        product.compareAtPrice !== newCompareAtPrice ||
        product.status !== newStatus;

      if (needsUpdate) {
        await strapi.db.query('api::product.product').update({
          where: { id: product.id },
          data: {
            price: newPrice,
            compareAtPrice: newCompareAtPrice,
            status: newStatus,
          },
        });
        updated++;
      }
    }

    strapi.log.info(`[price-sync] Updated ${updated} product prices from Phú Quý`);
  } catch (err: any) {
    strapi.log.error('[price-sync] Failed:', err?.message || err);
  }
}
