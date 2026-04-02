import bcrypt from 'bcryptjs';
import { addCustomerRow } from '../../../utils/google-sheets';

export default {
  async register(ctx) {
    const { fullName, phone, email, password } = ctx.request.body;

    if (!fullName || !phone || !email || !password) {
      return ctx.badRequest('Vui lòng nhập đầy đủ họ tên, số điện thoại, email và mật khẩu.');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return ctx.badRequest('Email không hợp lệ.');
    }

    // Password strength validation
    if (password.length < 8) {
      return ctx.badRequest('Mật khẩu phải có ít nhất 8 ký tự.');
    }
    if (!/[A-Z]/.test(password)) {
      return ctx.badRequest('Mật khẩu phải chứa ít nhất 1 chữ cái viết hoa.');
    }
    if (!/[a-z]/.test(password)) {
      return ctx.badRequest('Mật khẩu phải chứa ít nhất 1 chữ cái viết thường.');
    }
    if (!/[0-9]/.test(password)) {
      return ctx.badRequest('Mật khẩu phải chứa ít nhất 1 chữ số.');
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      return ctx.badRequest('Mật khẩu phải chứa ít nhất 1 ký tự đặc biệt.');
    }

    const existing = await strapi.db.query('plugin::users-permissions.user').findOne({
      where: { username: phone.trim() },
    });

    if (existing) {
      return ctx.badRequest('Số điện thoại này đã được đăng ký.');
    }

    try {
      const pluginStore = await strapi.store({ type: 'plugin', name: 'users-permissions' });
      const advancedSettings = (await pluginStore.get({ key: 'advanced' })) as Record<string, any> | null;
      const defaultRole = advancedSettings?.default_role || 'authenticated';

      const role = await strapi.db.query('plugin::users-permissions.role').findOne({
        where: { type: defaultRole },
      });

      const hashedPassword = await bcrypt.hash(password, 10);

      const newUser = await strapi.db.query('plugin::users-permissions.user').create({
        data: {
          username: phone.trim(),
          phone: phone.trim(),
          email: email.trim(),
          fullName: fullName.trim(),
          password: hashedPassword,
          provider: 'local',
          confirmed: true,
          role: role?.id,
        },
      });

      // Re-fetch to get all custom fields
      const createdUser = await strapi.db.query('plugin::users-permissions.user').findOne({
        where: { id: newUser.id },
      });

      const jwt = strapi.service('plugin::users-permissions.jwt').issue({ id: createdUser.id });

      // Sync to Google Sheets (non-blocking)
      addCustomerRow({
        fullName: fullName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        registeredAt: new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
      }).catch(err => strapi.log.error('[google-sheets] Failed to add customer:', err));

      // Send Telegram notification for new registration
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      const chatId = process.env.TELEGRAM_CHAT_ID;
      if (botToken && chatId) {
        const msg = `👤 *KHÁCH HÀNG MỚI ĐĂNG KÝ*\n- Họ tên: ${fullName.trim()}\n- SĐT: ${phone.trim()}\n- Email: ${email.trim()}\n- Thời gian: ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`;
        fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text: msg, parse_mode: 'Markdown' }),
        }).catch(err => strapi.log.error('[telegram] Failed to send registration notification:', err));
      }

      return ctx.send({
        jwt,
        user: {
          id: createdUser.id,
          username: createdUser.username,
          phone: createdUser.phone,
          email: createdUser.email,
          fullName: createdUser.fullName,
        },
      });
    } catch (err) {
      strapi.log.error('[phone-auth] Registration failed:', err);
      return ctx.badRequest('Đăng ký thất bại. Vui lòng thử lại.');
    }
  },

  async login(ctx) {
    const { phone, password } = ctx.request.body;

    if (!phone || !password) {
      return ctx.badRequest('Vui lòng nhập số điện thoại và mật khẩu.');
    }

    const user = await strapi.db.query('plugin::users-permissions.user').findOne({
      where: { username: phone.trim() },
      populate: ['role'],
    });

    if (!user) {
      return ctx.badRequest('Số điện thoại hoặc mật khẩu không đúng.');
    }

    const isValid = await bcrypt.compare(password, user.password);

    if (!isValid) {
      return ctx.badRequest('Số điện thoại hoặc mật khẩu không đúng.');
    }

    const jwt = strapi.service('plugin::users-permissions.jwt').issue({ id: user.id });

    return ctx.send({
      jwt,
      user: {
        id: user.id,
        username: user.username,
        phone: user.phone,
        fullName: user.fullName,
        kycStatus: user.kycStatus,
      },
    });
  },

  async updateProfile(ctx) {
    const user = ctx.state.user;
    if (!user) {
      return ctx.unauthorized('Vui lòng đăng nhập.');
    }

    const { fullName } = ctx.request.body;
    if (!fullName || !fullName.trim()) {
      return ctx.badRequest('Vui lòng nhập họ và tên.');
    }

    const updated = await strapi.db.query('plugin::users-permissions.user').update({
      where: { id: user.id },
      data: { fullName: fullName.trim() },
    });

    return ctx.send({
      id: updated.id,
      username: updated.username,
      phone: updated.phone,
      fullName: updated.fullName,
      kycStatus: updated.kycStatus,
    });
  },
};
