import type { Alpine as AlpineType } from 'alpinejs';
import persist from '@alpinejs/persist';
import focus from '@alpinejs/focus';
import { registerDashboardPage } from './js/dashboard';

export default (Alpine: AlpineType) => {
  Alpine.plugin(persist);
  Alpine.plugin(focus);
  registerDashboardPage(Alpine);
};
