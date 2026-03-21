export function registerHeader(Alpine) {
  Alpine.data('header', () => ({
    scrolled: false,
    activeMenu: null,

    init() {
      window.addEventListener('scroll', () => {
        this.scrolled = window.scrollY > 50;
      });
    },

    toggleMenu(menu) {
      this.activeMenu = this.activeMenu === menu ? null : menu;
    },

    closeMenu() {
      this.activeMenu = null;
    },
  }));
}
