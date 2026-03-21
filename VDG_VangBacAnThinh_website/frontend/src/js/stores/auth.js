import { fetchAPI } from '../utils/api';

export function registerAuthStore(Alpine) {
  Alpine.store('auth', {
    user: JSON.parse(localStorage.getItem('user') || 'null'),
    jwt: localStorage.getItem('jwt') || null,

    get isLoggedIn() {
      return !!this.jwt;
    },

    get isKycVerified() {
      return this.user?.kycStatus === 'verified';
    },

    async login(identifier, password) {
      const res = await fetchAPI('/auth/local', {
        method: 'POST',
        body: JSON.stringify({ identifier, password }),
      });
      this.jwt = res.jwt;
      this.user = res.user;
      localStorage.setItem('jwt', res.jwt);
      localStorage.setItem('user', JSON.stringify(res.user));
      return res;
    },

    async register(username, email, password) {
      const res = await fetchAPI('/auth/local/register', {
        method: 'POST',
        body: JSON.stringify({ username, email, password }),
      });
      this.jwt = res.jwt;
      this.user = res.user;
      localStorage.setItem('jwt', res.jwt);
      localStorage.setItem('user', JSON.stringify(res.user));
      return res;
    },

    logout() {
      this.jwt = null;
      this.user = null;
      localStorage.removeItem('jwt');
      localStorage.removeItem('user');
      window.location.href = '/';
    },

    async fetchProfile() {
      if (!this.jwt) return;
      try {
        const res = await fetchAPI('/users/me?populate=*', { auth: true });
        this.user = res;
        localStorage.setItem('user', JSON.stringify(res));
      } catch {
        this.logout();
      }
    },

    async submitKyc(files) {
      if (!this.jwt) throw new Error('Chưa đăng nhập');

      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
      }

      const STRAPI_URL = import.meta.env.PUBLIC_STRAPI_URL || '';
      const uploadRes = await fetch(STRAPI_URL + '/api/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.jwt}`
        },
        body: formData
      });

      if (!uploadRes.ok) {
        throw new Error('Upload hình ảnh thất bại.');
      }
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
