import { syncProductPrices } from '../../../utils/sync-product-prices';

async function verifyAdminToken(ctx): Promise<boolean> {
  const authHeader = ctx.request.header?.authorization;
  if (!authHeader?.startsWith('Bearer ')) return false;
  const token = authHeader.substring(7);
  try {
    const { default: jwt } = await import('jsonwebtoken');
    const secret = strapi.config.get('admin.auth.secret');
    const decoded = jwt.verify(token, secret as string) as any;
    return !!decoded?.userId;
  } catch {
    return false;
  }
}

export default {
  // GET /api/admin-products - list all products with prices
  async find(ctx) {
    if (!(await verifyAdminToken(ctx))) {
      return ctx.unauthorized('Không có quyền truy cập.');
    }

    const products = await strapi.documents('api::product.product').findMany({
      sort: 'sortOrder:asc',
      populate: {
        category: { fields: ['name', 'slug'] },
        images: { fields: ['url', 'name', 'width', 'height'] },
      },
      limit: 200,
    });

    return ctx.send({ data: products });
  },

  // PUT /api/admin-products/:documentId - update product (price, status, etc)
  async update(ctx) {
    if (!(await verifyAdminToken(ctx))) {
      return ctx.unauthorized('Không có quyền truy cập.');
    }

    const { documentId } = ctx.params;
    const { price, compareAtPrice, status, name, productType, subCategory } = ctx.request.body;

    const updateData: any = {};
    if (price !== undefined) updateData.price = price;
    if (compareAtPrice !== undefined) updateData.compareAtPrice = compareAtPrice;
    if (status !== undefined) updateData.status = status;
    if (name !== undefined) updateData.name = name;
    if (productType !== undefined) updateData.productType = productType;
    if (subCategory !== undefined) updateData.subCategory = subCategory;

    const updated = await strapi.documents('api::product.product').update({
      documentId,
      data: updateData,
    });

    if (!updated) {
      return ctx.notFound('Sản phẩm không tìm thấy.');
    }

    return ctx.send({ data: updated });
  },

  // POST /api/admin-products - create a new product
  async create(ctx) {
    if (!(await verifyAdminToken(ctx))) {
      return ctx.unauthorized('Không có quyền truy cập.');
    }

    const { name, sku, price, compareAtPrice, status, karatType, goldWeight, productType, subCategory, sortOrder, description } = ctx.request.body;

    if (!name || price === undefined) {
      return ctx.badRequest('Tên và giá sản phẩm là bắt buộc.');
    }

    // Generate slug from name
    const slug = name
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd').replace(/Đ/g, 'D')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const createData: any = {
      name,
      slug,
      price: Number(price),
      status: status || 'available',
    };
    if (sku) createData.sku = sku;
    if (compareAtPrice !== undefined) createData.compareAtPrice = Number(compareAtPrice) || null;
    if (karatType) createData.karatType = karatType;
    if (goldWeight !== undefined) createData.goldWeight = Number(goldWeight) || null;
    if (productType) createData.productType = productType;
    if (subCategory) createData.subCategory = subCategory;
    if (sortOrder !== undefined) createData.sortOrder = Number(sortOrder);
    if (description) createData.description = description;

    const created = await strapi.documents('api::product.product').create({
      data: createData,
    });

    return ctx.send({ data: created });
  },

  // DELETE /api/admin-products/:documentId - delete a product
  async delete(ctx) {
    if (!(await verifyAdminToken(ctx))) {
      return ctx.unauthorized('Không có quyền truy cập.');
    }

    const { documentId } = ctx.params;

    const existing = await strapi.documents('api::product.product').findOne({
      documentId,
    });

    if (!existing) {
      return ctx.notFound('Sản phẩm không tìm thấy.');
    }

    await strapi.documents('api::product.product').delete({
      documentId,
    });

    return ctx.send({ data: { id: existing.id, documentId, deleted: true } });
  },

  // POST /api/admin-products/sync-prices - trigger manual price sync
  async syncPrices(ctx) {
    if (!(await verifyAdminToken(ctx))) {
      return ctx.unauthorized('Không có quyền truy cập.');
    }

    await syncProductPrices(strapi);
    return ctx.send({ success: true, message: 'Đã đồng bộ giá sản phẩm theo giá thị trường.' });
  },
};
