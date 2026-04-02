import { fetchAPI } from '../utils/api';

export function registerAuthStore(Alpine) {
  Alpine.store('auth', {
    user: (() => { try { const v = localStorage.getItem('user'); return v && v !== 'undefined' ? JSON.parse(v) : null; } catch { return null; } })(),
    jwt: localStorage.getItem('jwt') || null,

    get isLoggedIn() {
      return !!this.jwt;
    },

    get isKycVerified() {
      return this.user?.kycStatus === 'verified';
    },

    get isAdmin() {
      if (!localStorage.getItem('admin_jwt')) return false;
      // Only show for admin account
      const username = this.user?.username || this.user?.phone || '';
      return username === 'admin@vanganthinh.com';
    },

    async login(phone, password) {
      const res = await fetchAPI('/phone-auth/login', {
        method: 'POST',
        body: JSON.stringify({ phone, password }),
      });
      this.jwt = res.jwt;
      this.user = res.user;
      localStorage.setItem('jwt', res.jwt);
      localStorage.setItem('user', JSON.stringify(res.user));
      Alpine.store('cart').reloadForUser();
      return res;
    },

    async register(fullName, phone, email, password) {
      const res = await fetchAPI('/phone-auth/register', {
        method: 'POST',
        body: JSON.stringify({ fullName, phone, email, password }),
      });
      this.jwt = res.jwt;
      this.user = res.user;
      localStorage.setItem('jwt', res.jwt);
      localStorage.setItem('user', JSON.stringify(res.user));
      Alpine.store('cart').reloadForUser();
      return res;
    },

    logout() {
      this.jwt = null;
      this.user = null;
      localStorage.removeItem('jwt');
      localStorage.removeItem('user');
      localStorage.removeItem('admin_jwt');
      localStorage.removeItem('admin_user');
      Alpine.store('cart').reloadForUser();
      window.location.href = '/';
    },

    async fetchProfile() {
      if (!this.jwt) return;
      try {
        const res = await fetchAPI('/users/me?populate=*', { auth: true });
        // Merge custom fields that /users/me returns
        this.user = {
          ...this.user,
          ...res,
          fullName: res.fullName || this.user?.fullName,
        };
        localStorage.setItem('user', JSON.stringify(this.user));
      } catch {
        this.logout();
      }
    },

    async uploadFile(file) {
      if (!this.jwt) throw new Error('Chưa đăng nhập');
      const formData = new FormData();
      formData.append('files', file);

      const baseUrl = window.__strapiBase || '';
      const uploadRes = await fetch(baseUrl + '/api/upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${this.jwt}` },
        body: formData,
      });

      if (!uploadRes.ok) throw new Error('Upload hình ảnh thất bại.');
      const uploaded = await uploadRes.json();
      return uploaded[0]; // { id, url, name, ... }
    },

    async submitKycOcr(imageId, side) {
      const res = await fetchAPI('/kyc/ocr', {
        method: 'POST',
        auth: true,
        body: JSON.stringify({ imageId, side }),
      });

      if (res.user) {
        this.user = { ...this.user, ...res.user };
        localStorage.setItem('user', JSON.stringify(this.user));
      }
      return res;
    },

    async submitKycManual(data) {
      const res = await fetchAPI('/kyc/manual-submit', {
        method: 'POST',
        auth: true,
        body: JSON.stringify(data),
      });

      if (res.user) {
        this.user = { ...this.user, ...res.user };
        localStorage.setItem('user', JSON.stringify(this.user));
      }
      return res;
    },

    async submitKyc(files) {
      if (!this.jwt) throw new Error('Chưa đăng nhập');

      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
      }

      const baseUrl = window.__strapiBase || '';
      const uploadRes = await fetch(baseUrl + '/api/upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${this.jwt}` },
        body: formData,
      });

      if (!uploadRes.ok) throw new Error('Upload hình ảnh thất bại.');
      const uploadedImages = await uploadRes.json();
      const imageIds = uploadedImages.map(img => img.id);

      const kycRes = await fetchAPI('/kyc/submit', {
        method: 'POST',
        auth: true,
        body: JSON.stringify({ images: imageIds })
      });

      if (kycRes.user) {
        this.user = kycRes.user;
        localStorage.setItem('user', JSON.stringify(kycRes.user));
      }
      return kycRes;
    },
  });
}
