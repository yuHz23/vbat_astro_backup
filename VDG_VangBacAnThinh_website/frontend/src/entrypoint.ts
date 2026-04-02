import type { Alpine as AlpineType } from 'alpinejs';
import persist from '@alpinejs/persist';
import focus from '@alpinejs/focus';
import intersect from '@alpinejs/intersect';

import { registerCartStore } from './js/stores/cart';
import { registerAuthStore } from './js/stores/auth';
import { registerUiStore } from './js/stores/ui';

import { registerHeader } from './js/components/header';
import { registerMobileMenu } from './js/components/mobile-menu';
import { registerGoldPriceWidget } from './js/components/gold-price-widget';
import { registerProductCard } from './js/components/product-card';
import { registerHeroBanner } from './js/components/hero-banner';
import { registerNewsletter } from './js/components/newsletter';
import { registerSearch } from './js/components/search';

import { registerGoldPricePage } from './js/pages/gold-price';
import { registerProductListing } from './js/pages/product-listing';
import { registerProductDetail } from './js/pages/product-detail';
import { registerCheckoutPage } from './js/pages/checkout';
import { registerAuthPages } from './js/pages/auth';
import { registerContactPage } from './js/pages/contact';
import { registerStoreLocator } from './js/pages/store-locator';
import { registerOrderHistory } from './js/pages/order-history';
import { registerDashboardPage } from './js/pages/dashboard';
import { registerSilverPage } from './js/pages/silver-page';

// Global media URL helper
(window as any).__strapiBase = (() => {
  const h = window.location.hostname;
  if (h === 'localhost' || h === '127.0.0.1' || /^\d+\.\d+\.\d+\.\d+$/.test(h)) {
    return `${window.location.protocol}//${h}:1337`;
  }
  return `${window.location.protocol}//admin.${h}`;
})();
(window as any).__mediaUrl = (url: string) => {
  if (!url) return '/placeholder.jpg';
  if (url.startsWith('http')) return url;
  return (window as any).__strapiBase + url;
};

export default (Alpine: AlpineType) => {
  Alpine.plugin(persist);
  Alpine.plugin(focus);
  Alpine.plugin(intersect);

  // Stores
  registerCartStore(Alpine);
  registerAuthStore(Alpine);
  registerUiStore(Alpine);

  // Components
  registerHeader(Alpine);
  registerMobileMenu(Alpine);
  registerGoldPriceWidget(Alpine);
  registerProductCard(Alpine);
  registerHeroBanner(Alpine);
  registerNewsletter(Alpine);
  registerSearch(Alpine);

  // Pages
  registerGoldPricePage(Alpine);
  registerProductListing(Alpine);
  registerProductDetail(Alpine);
  registerCheckoutPage(Alpine);
  registerAuthPages(Alpine);
  registerContactPage(Alpine);
  registerStoreLocator(Alpine);
  registerOrderHistory(Alpine);
  registerDashboardPage(Alpine);
  registerSilverPage(Alpine);
};
