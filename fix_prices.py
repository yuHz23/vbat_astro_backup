"""Fix prices by re-scraping from detail pages."""
import json
import sys
import io
import time
from playwright.sync_api import sync_playwright

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

with open("D:/VDG_astro/phuquy_gold_products.json", "r", encoding="utf-8") as f:
    data = json.load(f)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(
        viewport={"width": 1920, "height": 1080},
        user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    )
    page = context.new_page()

    for prod in data["products"]:
        url = prod.get("detail_url", "")
        if not url:
            continue
        print(f"\n{prod['name']} -> {url}")

        page.goto(url, wait_until="networkidle", timeout=30000)
        time.sleep(3)

        # Extract prices using a simpler approach
        prices = page.evaluate(r"""
            () => {
                const r = {};
                const body = document.body.innerText;
                const lines = body.split('\n').map(l => l.trim()).filter(l => l);

                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i].toLowerCase().replace(/\s+/g, ' ');
                    // Match "bán ra" or "mua vào"
                    if (line.match(/^b[aá]n ra/i)) {
                        for (let j = i + 1; j < Math.min(i + 3, lines.length); j++) {
                            const priceLine = lines[j].replace(/[^0-9,]/g, '');
                            if (priceLine.match(/^[0-9,]+$/) && priceLine.length > 5) {
                                r.sell_price = priceLine;
                                break;
                            }
                        }
                    }
                    if (line.match(/^mua v[aà]o/i)) {
                        for (let j = i + 1; j < Math.min(i + 3, lines.length); j++) {
                            const priceLine = lines[j].replace(/[^0-9,]/g, '');
                            if (priceLine.match(/^[0-9,]+$/) && priceLine.length > 5) {
                                r.buy_price = priceLine;
                                break;
                            }
                        }
                    }
                }

                // Get breadcrumb title
                for (let i = 0; i < lines.length; i++) {
                    if (lines[i].match(/Trang ch/)) {
                        const next = lines[i].split('/').pop();
                        if (next) r.breadcrumb_title = next.trim();
                    }
                }

                return r;
            }
        """)

        print(f"  Sell: {prices.get('sell_price', '?')}")
        print(f"  Buy: {prices.get('buy_price', '?')}")

        if prices.get('sell_price'):
            prod['sell_price'] = prices['sell_price']
        if prices.get('buy_price'):
            prod['buy_price'] = prices['buy_price']
        if prices.get('breadcrumb_title'):
            detail = prod.get('detail', {})
            detail['title'] = prices['breadcrumb_title']

    browser.close()

with open("D:/VDG_astro/phuquy_gold_products.json", "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f"\n{'=' * 60}")
print("VERIFIED PRICES")
print(f"{'=' * 60}")
for i, p in enumerate(data['products']):
    specs = p.get('detail', {}).get('specifications', {})
    print(f"{i+1}. {p['name']}")
    print(f"   SKU: {specs.get('Mã SP', '?')} | {specs.get('Định lượng', '?')} | {specs.get('Khối lượng', '?')}")
    print(f"   Sell: {p.get('sell_price', '?')} | Buy: {p.get('buy_price', '?')}")
