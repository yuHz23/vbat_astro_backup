export function registerMobileMenu(Alpine) {
  Alpine.data('mobileMenu', () => ({
    openSubmenu: null,

    toggleSubmenu(menu) {
      this.openSubmenu = this.openSubmenu === menu ? null : menu;
    },

    close() {
      Alpine.store('ui').mobileMenuOpen = false;
      this.openSubmenu = null;
    },
  }));
}
