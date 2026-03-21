export function registerAuthPages(Alpine) {
  Alpine.data('loginPage', () => ({
    identifier: '',
    password: '',
    error: '',
    loading: false,

    async login() {
      this.loading = true;
      this.error = '';
      try {
        await Alpine.store('auth').login(this.identifier, this.password);
        window.location.href = '/tai-khoan.html';
      } catch (e) {
        this.error = e.message || 'Đăng nhập thất bại. Vui lòng kiểm tra lại.';
      } finally {
        this.loading = false;
      }
    },
  }));

  Alpine.data('registerPage', () => ({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    error: '',
    loading: false,

    async register() {
      if (this.password !== this.confirmPassword) {
        this.error = 'Mật khẩu không khớp.';
        return;
      }
      this.loading = true;
      this.error = '';
      try {
        await Alpine.store('auth').register(this.username, this.email, this.password);
        window.location.href = '/tai-khoan.html';
      } catch (e) {
        this.error = e.message || 'Đăng ký thất bại. Vui lòng thử lại.';
      } finally {
        this.loading = false;
      }
    },
  }));

  Alpine.data('profilePage', () => ({
    loading: true,

    async init() {
      if (!Alpine.store('auth').isLoggedIn) {
        window.location.href = '/dang-nhap.html';
        return;
      }
      await Alpine.store('auth').fetchProfile();
      this.loading = false;
    },

    get user() {
      return Alpine.store('auth').user;
    },

    get kycLabel() {
      const status = this.user?.kycStatus;
      const labels = { pending: 'Đang chờ', verified: 'Đã xác minh', rejected: 'Bị từ chối' };
      return labels[status] || 'Chưa xác minh';
    },

    get kycColor() {
      const status = this.user?.kycStatus;
      const colors = { pending: 'text-warning', verified: 'text-success', rejected: 'text-error' };
      return colors[status] || 'text-gray-500';
    },

    logout() {
      Alpine.store('auth').logout();
    },

    kycFiles: [],
    submittingKyc: false,
    kycError: '',

    handleFileDrop(e) {
      this.kycFiles = [...e.dataTransfer.files].slice(0, 2);
    },

    handleFileSelect(e) {
      this.kycFiles = [...e.target.files].slice(0, 2);
    },

    async uploadKyc() {
      if (this.kycFiles.length !== 2) {
        this.kycError = 'Vui lòng chọn đủ 2 ảnh (mặt trước và mặt sau).';
        return;
      }
      this.submittingKyc = true;
      this.kycError = '';

      try {
        await Alpine.store('auth').submitKyc(this.kycFiles);
        window.location.reload();
      } catch (e) {
        this.kycError = e.message || 'Lỗi khi tải lên hồ sơ.';
      } finally {
        this.submittingKyc = false;
      }
    }
  }));
}
