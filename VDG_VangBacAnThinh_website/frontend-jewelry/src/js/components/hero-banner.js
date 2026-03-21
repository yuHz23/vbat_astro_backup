import Swiper from 'swiper';
import { Navigation, Pagination, Autoplay, EffectFade } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';
import 'swiper/css/effect-fade';
import { fetchAPI, getStrapiMedia } from '../utils/api';

export function registerHeroBanner(Alpine) {
  Alpine.data('heroBanner', () => ({
    banners: [],
    swiperInstance: null,

    async init() {
      try {
        const res = await fetchAPI('/banners', {
          params: {
            'filters[position][$eq]': 'hero',
            'sort[0]': 'sortOrder:asc',
            'populate': '*',
          },
        });
        this.banners = res.data || [];
        this.$nextTick(() => this.initSwiper());
      } catch (e) {
        console.error('Failed to fetch banners:', e);
      }
    },

    initSwiper() {
      const el = this.$refs.swiperContainer;
      if (!el) return;
      this.swiperInstance = new Swiper(el, {
        modules: [Navigation, Pagination, Autoplay, EffectFade],
        effect: 'fade',
        loop: true,
        autoplay: { delay: 5000, disableOnInteraction: false },
        pagination: { el: '.swiper-pagination', clickable: true },
        navigation: { nextEl: '.swiper-button-next', prevEl: '.swiper-button-prev' },
      });
    },

    getStrapiMedia,

    destroy() {
      if (this.swiperInstance) this.swiperInstance.destroy();
    },
  }));
}
