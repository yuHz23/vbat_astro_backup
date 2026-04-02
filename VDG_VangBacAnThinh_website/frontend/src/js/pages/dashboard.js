import { formatPriceVND } from '../utils/api';

const STRAPI_URL = import.meta.env.PUBLIC_STRAPI_URL || '';
const API_URL = `${STRAPI_URL}/api`;
const ADMIN_URL = `${STRAPI_URL}/admin`;

// Admin-specific fetch using admin JWT
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
      // Already logged in? redirect to dashboard
      if (localStorage.getItem('admin_jwt')) {
        window.location.href = '/admin-dashboard';
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
        window.location.href = '/admin-dashboard';
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
    editPrice: '',
    editComparePrice: '',
    editStatus: '',
    showAddForm: false,
    newProduct: { name: '', sku: '', price: '', compareAtPrice: '', status: 'available', karatType: '', productType: 'gold', subCategory: 'tich-tru', sortOrder: 99 },
    savingProduct: false,
    deletingProduct: null,

    get activeOrders() {
      const active = this.orders.filter(o => !['completed', 'cancelled'].includes(o.orderStatus));
      if (this.filter === 'all') return active;
      return active.filter(o => o.orderStatus === this.filter);
    },

    get historyOrders() {
      return this.orders.filter(o => ['completed', 'cancelled'].includes(o.orderStatus));
    },

    get goldProducts() {
      return this.products.filter(p => p.karatType?.includes('999,9') || p.karatType?.includes('Vàng'));
    },

    get silverProducts() {
      return this.products.filter(p => p.karatType?.includes('Bạc') || p.karatType?.includes('999.9'));
    },

    async init() {
      const token = localStorage.getItem('admin_jwt');
      if (!token) {
        window.location.href = '/admin-login';
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
      window.location.href = '/admin-login';
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
            price: Number(this.editPrice),
            compareAtPrice: Number(this.editComparePrice) || null,
            status: this.editStatus,
          }),
        });
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

    resetNewProduct() {
      this.newProduct = { name: '', sku: '', price: '', compareAtPrice: '', status: 'available', karatType: '', productType: 'gold', subCategory: 'tich-tru', sortOrder: 99 };
      this.showAddForm = false;
    },

    async createProduct() {
      if (!this.newProduct.name || !this.newProduct.price) {
        alert('Vui lòng nhập tên và giá sản phẩm.');
        return;
      }
      this.savingProduct = true;
      try {
        await adminFetch('/admin-products', {
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

    formatPrice: formatPriceVND,
  }));
}
