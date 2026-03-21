export function registerUiStore(Alpine) {
  Alpine.store('ui', {
    mobileMenuOpen: false,
    searchOpen: false,
    loading: false,

    toggleMobileMenu() {
      this.mobileMenuOpen = !this.mobileMenuOpen;
    },

    toggleSearch() {
      this.searchOpen = !this.searchOpen;
    },
  });
}
