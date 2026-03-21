import { fetchAPI, formatPrice } from '../utils/api';

const GOLD_TYPE_NAMES = {
  SJL1L10: 'Vàng SJC 9999 (1 Lượng)',
  SJ9999: 'Nhẫn SJC 9999',
  BTSJC: 'Bảo Tín SJC',
  BT9999NTT: 'Bảo Tín 9999',
  DOHNL: 'DOJI Hà Nội',
  DOHCML: 'DOJI HCM',
  DOJINHTV: 'DOJI Nữ Trang',
  PQHNVM: 'PNJ Hà Nội',
  PQHN24NTT: 'PNJ 24K',
  VNGSJC: 'VN Gold SJC',
  VIETTINMSJC: 'Viettin SJC',
  XAUUSD: 'Vàng Thế Giới (XAU/USD)',
};

const GOLD_SORT_ORDER = ['SJL1L10', 'SJ9999', 'BTSJC', 'BT9999NTT', 'DOHNL', 'DOHCML', 'DOJINHTV', 'PQHNVM', 'PQHN24NTT', 'VNGSJC', 'VIETTINMSJC', 'XAUUSD'];

export function registerGoldPricePage(Alpine) {
  Alpine.data('goldPricePage', (defaultType = 'SJL1L10') => ({
    prices: [],          // Array of { goldType, goldName, buyPrice, sellPrice, unit, changeBuy, changeSell }
    goldPrices: [],      // Filtered: non-silver
    xauusd: null,        // World gold price
    goldTypes: [],       // List for chart dropdown
    loading: true,
    loadingHistories: true,
    lastUpdated: null,
    pollInterval: null,
    selectedType: defaultType,
    selectedTimeRange: '1M',
    historyDataRaw: [],
    chartInstances: {},
    currentGoldMV: null,
    currentGoldBR: null,
    chartDateFrom: '',
    chartDateTo: '',
    chartUnit: 'luong',

    async init() {
      await this.fetchData();
      this.pollInterval = setInterval(() => this.fetchData(), 5 * 60 * 1000); // every 5 min

      this.$watch('selectedType', () => this.updateChartData());
      this.$watch('selectedTimeRange', () => this.updateChartData());
      this.$watch('chartUnit', () => this.updateChartData());
    },

    destroy() {
      if (this.pollInterval) clearInterval(this.pollInterval);
      Object.values(this.chartInstances).forEach((c) => c.destroy());
    },

    async fetchData() {
      try {
        this.loading = true;
        this.loadingHistories = true;

        // === 1. Fetch live prices from vang.today via Strapi proxy ===
        let livePrices = [];
        try {
          const liveRes = await fetch('/api/gold-price/live');
          if (liveRes.ok) {
            const liveJson = await liveRes.json();
            if (liveJson.success && liveJson.prices) {
              // Convert object to sorted array
              livePrices = GOLD_SORT_ORDER.map(code => {
                const p = liveJson.prices[code];
                if (!p) return null;
                return {
                  goldType: code,
                  goldName: GOLD_TYPE_NAMES[code] || p.name,
                  buyPrice: p.buy || 0,
                  sellPrice: p.sell || 0,
                  changeBuy: p.change_buy || 0,
                  changeSell: p.change_sell || 0,
                  currency: p.currency || 'VND',
                  unit: p.currency === 'USD' ? 'USD/oz' : 'VNĐ/lượng',
                };
              }).filter(Boolean);
            }
          }
        } catch (e) { console.warn('Live fetch failed, using DB fallback', e); }

        // === 2. Fallback: use Strapi DB if live fetch fails ===
        if (livePrices.length === 0) {
          const dbRes = await fetchAPI('/gold-prices', {
            params: {
              'filters[isActive][$eq]': 'true',
              'sort[0]': 'sortOrder:asc',
              'pagination[pageSize]': '20',
            },
          }).catch(() => ({ data: [] }));
          livePrices = (dbRes.data || []).map((p) => ({
            goldType: p.goldType,
            goldName: p.goldName,
            buyPrice: p.buyPrice,
            sellPrice: p.sellPrice,
            unit: p.unit,
            changeBuy: 0,
            changeSell: 0,
            currency: (p.unit || '').includes('USD') ? 'USD' : 'VND',
          }));
        }

        this.prices = livePrices;
        this.goldPrices = livePrices.filter(p => p.goldType !== 'XAUUSD');
        this.xauusd = livePrices.find(p => p.goldType === 'XAUUSD') || null;

        // Build dropdown list for chart (exclude XAUUSD for VND chart simplicity)
        this.goldTypes = this.goldPrices.map(p => ({ code: p.goldType, name: p.goldName }));

        this.lastUpdated = new Date().toLocaleString('vi-VN');
        this.loading = false;

        // === 3. Load history data from Strapi for chart ===
        const historyRes = await fetchAPI('/gold-histories', {
          params: {
            'sort[0]': 'recordDate:desc',
            'pagination[pageSize]': '1000',
          },
        }).catch(() => ({ data: [] }));

        this.historyDataRaw = historyRes.data || [];

        // Ensure every gold type has at least today's live point in history
        // so new gold types without past data can still render on the chart.
        const todayDate = new Date().toISOString().slice(0, 10);
        this.prices.forEach(p => {
          const hasToday = this.historyDataRaw.some(d => d.goldType === p.goldType && d.recordDate === todayDate);
          if (!hasToday) {
            this.historyDataRaw.unshift({
              goldType: p.goldType,
              goldName: p.goldName,
              buyPrice: p.buyPrice,
              sellPrice: p.sellPrice,
              recordDate: todayDate,
            });
          }
        });

        this.updateChartData();
        this.loadingHistories = false;

      } catch (e) {
        console.error('fetchData error:', e);
        this.loading = false;
        this.loadingHistories = false;
      }
    },

    updateChartData() {
      if (!this.historyDataRaw || this.historyDataRaw.length === 0) return;

      // 1. Filter by selected gold type
      let filteredData = this.historyDataRaw.filter(d => d.goldType === this.selectedType);

      if (filteredData.length === 0) {
        // Fallback to first available type
        filteredData = this.historyDataRaw.filter(d => d.goldType === 'SJL1L10');
      }
      if (filteredData.length === 0) {
        filteredData = this.historyDataRaw.slice(0, 30);
      }

      // 2. Filter by Time Range
      let limit = 30;
      switch (this.selectedTimeRange) {
        case '1D': limit = 2; break;
        case '7D': limit = 7; break;
        case '1M': limit = 30; break;
        case '3M': limit = 90; break;
        case '1Y': limit = 365; break;
        default: limit = 30;
      }

      const chartData = filteredData.slice(0, limit).reverse();

      if (chartData.length > 0) {
        const latest = chartData[chartData.length - 1];
        this.currentGoldMV = latest.buyPrice;
        this.currentGoldBR = latest.sellPrice;
      } else {
        // fallback: use live price for the selected type
        const live = this.prices.find(p => p.goldType === this.selectedType);
        if (live) {
          this.currentGoldMV = live.buyPrice;
          this.currentGoldBR = live.sellPrice;
        }
      }

      const labels = chartData.map(d => {
        const date = new Date(d.recordDate);
        return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}`;
      });

      const canvasId = document.getElementById('silverChart') ? 'silverChart' : 'goldChart';

      import('chart.js/auto').then(({ default: Chart }) => {
        this.drawSingleChart(Chart, canvasId, labels, chartData);
      });
    },

    drawSingleChart(Chart, canvasId, labels, data) {
      const canvas = document.getElementById(canvasId);
      if (!canvas) return;

      const isUSD = this.selectedType === 'XAUUSD';
      let divisor = isUSD ? 1 : 1000000;
      let unit = isUSD ? 'USD' : 'triệu đ';

      if (this.chartUnit === 'chi' && !isUSD) {
        divisor = 10000000; // Divide by 10 millions to get 'triệu đ/chỉ'
        unit = 'triệu đ (chỉ)';
      } else if (!isUSD) {
        unit = 'triệu đ (lượng)';
      }

      const datasetMV = data.map(d => ((d.buyPrice || 0) / divisor));
      const datasetBR = data.map(d => ((d.sellPrice || 0) / divisor));

      if (!this.chartInstances) this.chartInstances = {};
      if (this.chartInstances[canvasId]) {
        this.chartInstances[canvasId].destroy();
      }

      this.chartInstances[canvasId] = new Chart(canvas, {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Mua vào',
              data: datasetMV,
              borderColor: '#D32F2F',
              backgroundColor: 'rgba(211,47,47,0.06)',
              tension: 0.3,
              borderWidth: 2,
              pointRadius: datasetMV.length < 2 ? 4 : 0,
              pointHoverRadius: 4,
              fill: true,
            },
            {
              label: 'Bán ra',
              data: datasetBR,
              borderColor: '#0284c7',
              backgroundColor: 'rgba(2,132,199,0.04)',
              tension: 0.3,
              borderWidth: 2,
              pointRadius: datasetBR.length < 2 ? 4 : 0,
              pointHoverRadius: 4,
              fill: true,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: 'white',
              titleColor: '#1A1A1A',
              bodyColor: '#1A1A1A',
              borderColor: '#E5E7EB',
              borderWidth: 1,
              padding: 12,
              boxPadding: 6,
              usePointStyle: true,
              callbacks: {
                label: function (context) {
                  return `${context.dataset.label}: ${context.parsed.y.toFixed(isUSD ? 2 : 3)} ${unit}`;
                },
              },
            },
          },
          scales: {
            x: {
              grid: { color: '#f3f4f6' },
              ticks: { font: { family: 'Inter', size: 10 }, color: '#6B7280', maxTicksLimit: 8 },
            },
            y: {
              border: { display: false },
              grid: { color: '#f3f4f6' },
              ticks: {
                font: { family: 'Inter', size: 11 },
                color: '#6B7280',
                callback: function (value) { return value.toLocaleString(); },
              },
            },
          },
        },
      });
    },

    formatPriceVND(price, currency = 'VND') {
      if (!price && price !== 0) return '—';
      if (currency === 'USD') return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2 }).format(price) + ' USD';
      return new Intl.NumberFormat('vi-VN').format(price) + ' đ/lượng';
    },

    formatChange(change) {
      if (!change && change !== 0) return '';
      const sign = change > 0 ? '+' : '';
      return `${sign}${new Intl.NumberFormat('vi-VN').format(change)}`;
    },

    isUp(change) { return change > 0; },
    isDown(change) { return change < 0; },

    formatPrice,

    openEditModal(price) {
      alert(`Mở popup sửa giá cho: ${price.goldName}\n\n(Tính năng Admin sẽ được kết nối sau)`);
    },
  }));
}
