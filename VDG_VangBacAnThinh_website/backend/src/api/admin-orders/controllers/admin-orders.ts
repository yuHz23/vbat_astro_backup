async function verifyAdminToken(ctx): Promise<boolean> {
  const authHeader = ctx.request.header?.authorization;
  if (!authHeader?.startsWith('Bearer ')) return false;
  const token = authHeader.substring(7);

  try {
    const { default: jwt } = await import('jsonwebtoken');
    const secret = strapi.config.get('admin.auth.secret');
    const decoded = jwt.verify(token, secret as string) as any;
    // Strapi admin JWT has userId field
    return !!decoded?.userId;
  } catch {
    return false;
  }
}

export default {
  async find(ctx) {
    if (!(await verifyAdminToken(ctx))) {
      return ctx.unauthorized('Không có quyền truy cập.');
    }

    const orders = await strapi.db.query('api::order.order').findMany({
      orderBy: { createdAt: 'desc' },
      populate: { items: true },
      limit: 200,
    });

    return ctx.send({ data: orders });
  },

  async update(ctx) {
    if (!(await verifyAdminToken(ctx))) {
      return ctx.unauthorized('Không có quyền truy cập.');
    }

    const { id } = ctx.params;
    const { orderStatus } = ctx.request.body?.data || {};

    if (!orderStatus) {
      return ctx.badRequest('Thiếu trạng thái.');
    }

    const order = await strapi.db.query('api::order.order').findOne({
      where: { documentId: id },
    });

    if (!order) {
      return ctx.notFound('Không tìm thấy đơn hàng.');
    }

    const updated = await strapi.db.query('api::order.order').update({
      where: { id: order.id },
      data: { orderStatus },
    });

    return ctx.send({ data: updated });
  },
};
