import { formatPriceVND } from './utils';

const STRAPI_URL = (() => {
  const h = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  if (h === 'localhost' || h === '127.0.0.1' || /^\d+\.\d+\.\d+\.\d+$/.test(h)) {
    return `${typeof window !== 'undefined' ? window.location.protocol : 'http:'}//${h}:1337`;
  }
  return `${typeof window !== 'undefined' ? window.location.protocol : 'https:'}//api.${h.replace('admin.', '')}`;
})();
const API_URL = `${STRAPI_URL}/api`;
const ADMIN_URL = `${STRAPI_URL}/admin`;

async function adminFetch(endpoint, options = {}) {
  const token = localStorage.getItem('admin_jwt');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `API Error: ${res.status}`);
  }
  return res.json();
}

export function registerDashboardPage(Alpine) {
  // Admin login page
  Alpine.data('adminLoginPage', () => ({
    email: '',
    password: '',
    error: '',
    loading: false,

    init() {
      if (localStorage.getItem('admin_jwt')) {
        window.location.href = '/dashboard';
      }
    },

    async login() {
      this.loading = true;
      this.error = '';
      try {
        const res = await fetch(`${ADMIN_URL}/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: this.email, password: this.password }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error?.message || 'Đăng nhập thất bại');
        }
        localStorage.setItem('admin_jwt', data.data.token);
        localStorage.setItem('admin_user', JSON.stringify(data.data.user));
        window.location.href = '/dashboard';
      } catch (e) {
        this.error = e.message || 'Email hoặc mật khẩu không đúng.';
      } finally {
        this.loading = false;
      }
    },
  }));

  // Admin dashboard page
  Alpine.data('dashboardPage', () => ({
    orders: [],
    products: [],
    loading: true,
    loadingProducts: false,
    syncing: false,
    filter: 'all',
    mainTab: 'orders',
    tab: 'active',
    _interval: null,
    adminUser: null,
    editingProduct: null,
    editName: '',
    editPrice: '',
    editComparePrice: '',
    editStatus: '',
    showAddForm: false,
    newProduct: { name: '', sku: '', price: '', compareAtPrice: '', status: 'available', karatType: '', productType: 'gold', subCategory: 'tich-tru', sortOrder: 99 },
    savingProduct: false,
    deletingProduct: null,
    uploadingImage: false,
    newProductImageFile: null,
    newProductImagePreview: null,

    get activeOrders() {
      const active = this.orders.filter(o => !['completed', 'cancelled'].includes(o.orderStatus));
      if (this.filter === 'all') return active;
      return active.filter(o => o.orderStatus === this.filter);
    },

    get historyOrders() {
      return this.orders.filter(o => ['completed', 'cancelled'].includes(o.orderStatus));
    },

    async init() {
      const token = localStorage.getItem('admin_jwt');
      if (!token) {
        window.location.href = '/';
        return;
      }
      try {
        this.adminUser = JSON.parse(localStorage.getItem('admin_user') || 'null');
      } catch { }
      await this.loadOrders();
      this._interval = setInterval(() => this.loadOrders(true), 10000);
    },

    destroy() {
      if (this._interval) clearInterval(this._interval);
    },

    adminLogout() {
      localStorage.removeItem('admin_jwt');
      localStorage.removeItem('admin_user');
      window.location.href = '/';
    },

    async loadOrders(silent = false) {
      if (!silent) this.loading = true;
      try {
        const res = await adminFetch('/admin-orders', { method: 'GET' });
        const newOrders = res.data || [];
        this.orders = newOrders.map(order => {
          const existing = this.orders.find(o => o.id === order.id);
          const isEditing = existing && existing._newStatus !== existing.orderStatus;
          return {
            ...order,
            _newStatus: isEditing ? existing._newStatus : order.orderStatus,
          };
        });
      } catch (e) {
        console.error('Failed to load orders:', e);
        if (e.message?.includes('401') || e.message?.includes('403')) {
          this.adminLogout();
        }
      } finally {
        this.loading = false;
      }
    },

    async loadProducts() {
      this.loadingProducts = true;
      try {
        const res = await adminFetch('/admin-products', { method: 'GET' });
        this.products = res.data || [];
      } catch (e) {
        console.error('Failed to load products:', e);
      } finally {
        this.loadingProducts = false;
      }
    },

    async syncPrices() {
      this.syncing = true;
      try {
        await adminFetch('/admin-products/sync-prices', { method: 'POST' });
        await this.loadProducts();
        alert('Đã đồng bộ giá theo thị trường!');
      } catch (e) {
        alert('Lỗi: ' + (e.message || 'Đồng bộ thất bại'));
      } finally {
        this.syncing = false;
      }
    },

    startEdit(product) {
      this.editingProduct = product.documentId;
      this.editName = product.name;
      this.editPrice = product.price;
      this.editComparePrice = product.compareAtPrice || '';
      this.editStatus = product.status;
    },

    cancelEdit() {
      this.editingProduct = null;
    },

    async saveProduct(product) {
      try {
        await adminFetch(`/admin-products/${product.documentId}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: this.editName,
            price: Number(this.editPrice),
            compareAtPrice: Number(this.editComparePrice) || null,
            status: this.editStatus,
          }),
        });
        product.name = this.editName;
        product.price = Number(this.editPrice);
        product.compareAtPrice = Number(this.editComparePrice) || null;
        product.status = this.editStatus;
        this.editingProduct = null;
      } catch (e) {
        alert('Lỗi: ' + (e.message || 'Cập nhật thất bại'));
      }
    },

    async updateStatus(order) {
      try {
        await adminFetch(`/admin-orders/${order.documentId}`, {
          method: 'PUT',
          body: JSON.stringify({ data: { orderStatus: order._newStatus } }),
        });
        order.orderStatus = order._newStatus;
      } catch (e) {
        alert('Cập nhật thất bại: ' + (e.message || 'Lỗi'));
      }
    },

    async switchToProducts() {
      this.mainTab = 'products';
      if (this.products.length === 0) await this.loadProducts();
    },

    previewNewProductImage(event) {
      const file = event.target.files?.[0];
      if (!file) return;
      this.newProductImageFile = file;
      this.newProductImagePreview = URL.createObjectURL(file);
    },

    resetNewProduct() {
      this.newProduct = { name: '', sku: '', price: '', compareAtPrice: '', status: 'available', karatType: '', productType: 'gold', subCategory: 'tich-tru', sortOrder: 99 };
      this.newProductImageFile = null;
      this.newProductImagePreview = null;
      this.showAddForm = false;
    },

    async createProduct() {
      if (!this.newProduct.name || !this.newProduct.price) {
        alert('Vui lòng nhập tên và giá sản phẩm.');
        return;
      }
      this.savingProduct = true;
      try {
        const res = await adminFetch('/admin-products', {
          method: 'POST',
          body: JSON.stringify({
            name: this.newProduct.name,
            sku: this.newProduct.sku || undefined,
            price: Number(this.newProduct.price),
            compareAtPrice: this.newProduct.compareAtPrice ? Number(this.newProduct.compareAtPrice) : undefined,
            status: this.newProduct.status,
            karatType: this.newProduct.karatType || undefined,
            productType: this.newProduct.productType || undefined,
            subCategory: this.newProduct.subCategory || undefined,
            sortOrder: Number(this.newProduct.sortOrder) || 99,
          }),
        });

        // Upload image if selected
        if (this.newProductImageFile && res?.data?.documentId) {
          try {
            const token = localStorage.getItem('admin_jwt');
            const formData = new FormData();
            formData.append('files', this.newProductImageFile);
            const uploadRes = await fetch(`${STRAPI_URL}/upload`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${token}` },
              body: formData,
            });
            const uploaded = await uploadRes.json();
            if (uploaded?.[0]?.id) {
              await fetch(`${STRAPI_URL}/content-manager/collection-types/api::product.product/${res.data.documentId}`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ images: { set: [{ id: uploaded[0].id }] } }),
              });
            }
          } catch (imgErr) {
            console.error('Image upload failed:', imgErr);
          }
        }

        this.resetNewProduct();
        await this.loadProducts();
      } catch (e) {
        alert('Lỗi: ' + (e.message || 'Thêm sản phẩm thất bại'));
      } finally {
        this.savingProduct = false;
      }
    },

    async deleteProduct(product) {
      if (!confirm(`Bạn có chắc muốn xóa sản phẩm "${product.name}"?`)) return;
      this.deletingProduct = product.documentId;
      try {
        await adminFetch(`/admin-products/${product.documentId}`, { method: 'DELETE' });
        this.products = this.products.filter(p => p.documentId !== product.documentId);
      } catch (e) {
        alert('Lỗi: ' + (e.message || 'Xóa sản phẩm thất bại'));
      } finally {
        this.deletingProduct = null;
      }
    },

    getImageUrl(url) {
      if (!url) return '';
      if (url.startsWith('http')) return url;
      return `${STRAPI_URL}${url}`;
    },

    async uploadImage(event, product) {
      const file = event.target.files?.[0];
      if (!file) return;

      this.uploadingImage = true;
      try {
        const token = localStorage.getItem('admin_jwt');
        const formData = new FormData();
        formData.append('files', file);

        // Upload file to Strapi
        const uploadRes = await fetch(`${STRAPI_URL}/upload`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData,
        });
        if (!uploadRes.ok) throw new Error('Upload thất bại');
        const uploaded = await uploadRes.json();
        if (!uploaded?.[0]?.id) throw new Error('Không nhận được ID ảnh');

        const imgId = uploaded[0].id;

        // Attach to product via content-manager
        const attachRes = await fetch(`${STRAPI_URL}/content-manager/collection-types/api::product.product/${product.documentId}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ images: { set: [{ id: imgId }] } }),
        });
        if (!attachRes.ok) throw new Error('Gắn ảnh thất bại');

        // Update local product data
        product.images = [{ id: imgId, url: uploaded[0].url }];
        alert('Đã cập nhật ảnh!');
      } catch (e) {
        alert('Lỗi: ' + (e.message || 'Upload thất bại'));
      } finally {
        this.uploadingImage = false;
        event.target.value = '';
      }
    },

    formatPrice: formatPriceVND,
  }));
}
