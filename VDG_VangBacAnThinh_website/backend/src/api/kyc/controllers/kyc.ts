export default {
    async submit(ctx) {
        try {
            const user = ctx.state.user;
            if (!user) {
                return ctx.unauthorized('Vui lòng đăng nhập.');
            }

            const { images } = ctx.request.body;
            if (!images || !Array.isArray(images) || images.length === 0) {
                return ctx.badRequest('Vui lòng cung cấp ít nhất một hình ảnh CMND/CCCD.');
            }

            // Update user with kycImages & kycStatus
            const updatedUser = await strapi.entityService.update('plugin::users-permissions.user', user.id, {
                data: {
                    kycStatus: 'pending',
                    kycImages: images, // Array of media IDs
                } as any,
            });

            return ctx.send({ message: 'Đã gửi hồ sơ xác minh', user: updatedUser });
        } catch (err) {
            ctx.throw(500, err);
        }
    },
};
