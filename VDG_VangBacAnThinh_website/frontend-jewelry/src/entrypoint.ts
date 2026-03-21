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
};
