"""
Scraper for phuquy.com.vn/vang - gold products (final version)
Extracts product cards, then visits each detail page by URL.
"""
import json
import time
import sys
import io
from playwright.sync_api import sync_playwright

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

captured_api = {}

def on_response(response):
    url = response.url
    if "phuquy-gw.techasians.com" in url and response.status == 200:
        try:
            body = response.json()
            path = url.split("techasians.com")[-1].split("?")[0]
            if path not in captured_api:
                captured_api[path] = []
            captured_api[path].append(body)
        except:
            pass


def extract_detail(page):
    """Extract all details from a product detail page."""
    return page.evaluate(r"""
        () => {
            const r = {};

            // Title
            for (const sel of ['h1', 'h2', 'h3', '.product-name', '[class*="product-name"]', '[class*="productName"]']) {
                const el = document.querySelector(sel);
                if (el) { const t = el.innerText.trim(); if (t.length > 2 && t.length < 300) { r.title = t; break; } }
            }

            // All product images (from minio only, deduplicated)
            const imgSet = new Set();
            r.product_images = [];
            document.querySelectorAll('img').forEach(img => {
                const src = img.src || img.getAttribute('data-src') || '';
                if (src && src.includes('minio.phuquy.com.vn/images/product') && !imgSet.has(src)) {
                    imgSet.add(src);
                    r.product_images.push({src, alt: img.alt || ''});
                }
            });
            document.querySelectorAll('[style*="background-image"]').forEach(el => {
                const m = (el.getAttribute('style')||'').match(/url\(['"]?([^'")\s]+)/);
                if (m && m[1].includes('minio') && m[1].includes('product') && !imgSet.has(m[1])) {
                    imgSet.add(m[1]);
                    r.product_images.push({src: m[1], alt: 'bg'});
                }
            });

            // Specs table
            r.specifications = {};
            document.querySelectorAll('tr').forEach(row => {
                const cells = row.querySelectorAll('td, th');
                if (cells.length >= 2) {
                    const k = cells[0].innerText.trim();
                    const v = cells[1].innerText.trim();
                    if (k && v && k.length < 100) r.specifications[k] = v;
                }
            });

            // Description
            for (const sel of ['[class*="description"]', '[class*="desc"]', '[class*="detail-content"]', '[class*="product-info"]']) {
                const el = document.querySelector(sel);
                if (el) { const t = el.innerText.trim(); if (t.length > 20) { r.description = t.substring(0, 5000); break; } }
            }

            // Full text for additional data extraction
            r.fullText = document.body.innerText.substring(0, 10000);

            // Price info from detail page
            r.prices = {};
            const priceEls = document.querySelectorAll('[class*="price"], [class*="Price"]');
            priceEls.forEach(el => {
                const t = el.innerText.trim();
                if (t.match(/[0-9]/) && t.length < 100) {
                    const parent = el.closest('div, span, td');
                    const label = parent?.previousElementSibling?.innerText?.trim() || '';
                    if (label) r.prices[label] = t;
                }
            });

            // Related products section
            r.related_products = [];
            document.querySelectorAll('.product-card').forEach(card => {
                const nameEl = card.querySelector('.product-name');
                const imgEl = card.querySelector('img[src*="minio"]');
                if (nameEl) {
                    r.related_products.push({
                        name: nameEl.innerText.trim(),
                        image: imgEl ? imgEl.src : ''
                    });
                }
            });

            return r;
        }
    """)


def scrape():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": 1920, "height": 1080},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        )
        page = context.new_page()
        page.on("response", on_response)

        # ── Load gold listing page ──
        print("Loading /vang ...")
        page.goto("https://phuquy.com.vn/vang", wait_until="networkidle", timeout=60000)
        time.sleep(5)

        # Extract all product cards
        print("Extracting product cards...")
        products = page.evaluate("""
            () => {
                const cards = document.querySelectorAll('.product-card');
                const results = [];
                cards.forEach(card => {
                    const nameEl = card.querySelector('.product-name');
                    const name = nameEl ? nameEl.innerText.trim() : '';
                    if (!name) return;

                    const images = [];
                    card.querySelectorAll('img[src*="minio"]').forEach(img => images.push(img.src));

                    const infoText = card.querySelector('.info-product')?.innerText || '';
                    const stockEl = card.querySelector('.in-stock, .tag-sold-out');
                    const status = stockEl ? stockEl.innerText.trim() : '';

                    results.push({ name, images, infoText, status });
                });
                return results;
            }
        """)

        # Parse prices
        for prod in products:
            lines = [l.strip() for l in prod.get('infoText', '').split('\n') if l.strip()]
            for i, line in enumerate(lines):
                if line == 'Bán ra' and i+1 < len(lines):
                    prod['sell_price'] = lines[i+1]
                elif line == 'Mua vào' and i+1 < len(lines):
                    prod['buy_price'] = lines[i+1]
            prod.pop('infoText', None)

        print(f"Found {len(products)} products on listing page")
        for p in products:
            print(f"  {p['name']} | Sell: {p.get('sell_price','?')} | Buy: {p.get('buy_price','?')} | {p['status']}")

        # ── Discover product detail URLs by clicking first card ──
        # We know the URL pattern is /san-pham/{slug}
        # Known slugs from previous run:
        known_product_slugs = [
            "nhan-tron-tron-9999-10",
            "nhan-tron-tron-9999-1",
            "than-tai-phu-quy-1-chi-9999",
            "phu-quy-1-luong-9999",
            "vang-rong-phu-quy-9999-1l",
            "vang-con-giap-1-chi-9999",
            "nhan-tron-tron-9999-05",
            "nhan-tron-tron-9999-3",
            "nhan-tron-tron-9999-2",
            "nhan-tron-tron-9999-5",
        ]

        # Also discover URLs by clicking each card once
        print("\n=== DISCOVERING PRODUCT URLS ===")
        discovered_urls = {}

        for i in range(len(products)):
            try:
                page.goto("https://phuquy.com.vn/vang", wait_until="networkidle", timeout=30000)
                time.sleep(3)

                card_count = page.evaluate("() => document.querySelectorAll('.product-card').length")
                if i >= card_count:
                    break

                page.evaluate(f"() => document.querySelectorAll('.product-card')[{i}].click()")
                time.sleep(3)
                page.wait_for_load_state("networkidle", timeout=15000)

                url = page.url
                if "/san-pham/" in url:
                    slug = url.split("/san-pham/")[-1]
                    discovered_urls[products[i]['name']] = url
                    print(f"  {products[i]['name']} -> {url}")
            except Exception as e:
                print(f"  Error discovering URL for card {i}: {str(e)[:80]}")

        # ── Visit ALL product detail pages ──
        print(f"\n=== VISITING ALL PRODUCT DETAIL PAGES ===")

        # Build complete list of URLs to visit
        all_detail_urls = set()
        for slug in known_product_slugs:
            all_detail_urls.add(f"https://phuquy.com.vn/san-pham/{slug}")
        for url in discovered_urls.values():
            all_detail_urls.add(url)

        all_detail_urls = sorted(all_detail_urls)
        print(f"Total detail URLs: {len(all_detail_urls)}")

        detail_data = {}
        for i, url in enumerate(all_detail_urls):
            print(f"\n[{i+1}/{len(all_detail_urls)}] {url}")
            try:
                page.goto(url, wait_until="networkidle", timeout=30000)
                time.sleep(3)

                # Check if page loaded properly (not redirected to home)
                if page.url == "https://phuquy.com.vn/" or page.url == "https://phuquy.com.vn":
                    print(f"  Redirected to home - product may not exist")
                    continue

                detail = extract_detail(page)
                detail_data[url] = detail

                # Take screenshot
                slug = url.split("/")[-1]
                page.screenshot(path=f"phuquy_{slug}.png")

                print(f"  Title: {detail.get('title', '?')}")
                print(f"  Product Images ({len(detail.get('product_images', []))}):")
                for img in detail.get('product_images', []):
                    print(f"    {img['src']}")
                if detail.get('specifications'):
                    print(f"  Specifications: {json.dumps(detail['specifications'], ensure_ascii=False)}")
                if detail.get('description'):
                    print(f"  Description: {detail['description'][:300]}")

                # Extract key metadata from full text
                ft = detail.get('fullText', '')
                for kw in ['Trọng lượng', 'Khối lượng', 'Tuổi vàng', 'Chất liệu',
                            'Kích thước', 'Thương hiệu', 'Xuất xứ', 'Mã sản phẩm', 'SKU',
                            'Loại sản phẩm', 'Hàm lượng']:
                    idx = ft.find(kw)
                    if idx >= 0:
                        snippet = ft[idx:idx+100].split('\n')[0]
                        print(f"  {snippet}")

            except Exception as e:
                print(f"  Error: {str(e)[:150]}")

        browser.close()

    # ── Build final output ──
    print("\n" + "=" * 60)
    print("BUILDING FINAL OUTPUT")
    print("=" * 60)

    # Match detail data back to listing products
    for prod in products:
        name = prod['name']
        # Find matching URL
        if name in discovered_urls:
            url = discovered_urls[name]
            if url in detail_data:
                prod['detail_url'] = url
                prod['detail'] = detail_data[url]
                detail_data.pop(url)  # Remove matched

    # Add any unmatched detail pages as additional products
    for url, detail in detail_data.items():
        # Check if this is a genuinely different product
        title = detail.get('title', '')
        already_exists = any(p['name'] == title for p in products)
        if not already_exists and title:
            products.append({
                'name': title,
                'detail_url': url,
                'detail': detail,
                'sell_price': '',
                'buy_price': '',
                'status': '',
                'images': detail.get('product_images', [{}])[0:1],
            })

    output = {
        "scrape_date": time.strftime("%Y-%m-%d %H:%M:%S"),
        "source": "https://phuquy.com.vn/vang",
        "total_products": len(products),
        "captured_api_data": captured_api,
        "products": products,
    }

    with open("phuquy_gold_products.json", "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"\nSaved {len(products)} products to phuquy_gold_products.json")

    # Full summary
    print("\n" + "=" * 60)
    print("COMPLETE SCRAPED DATA")
    print("=" * 60)
    for i, p in enumerate(products):
        print(f"\n{'━' * 60}")
        print(f"PRODUCT {i+1}: {p.get('name', '?')}")
        print(f"  Sell Price (Bán ra): {p.get('sell_price', 'N/A')}")
        print(f"  Buy Price (Mua vào): {p.get('buy_price', 'N/A')}")
        print(f"  Status: {p.get('status', 'N/A')}")
        print(f"  Detail URL: {p.get('detail_url', 'N/A')}")
        print(f"  Listing Image: {p.get('images', ['N/A'])}")
        detail = p.get('detail', {})
        if detail:
            print(f"  Detail Title: {detail.get('title', 'N/A')}")
            print(f"  Product Images ({len(detail.get('product_images', []))}):")
            for img in detail.get('product_images', []):
                print(f"    {img['src']}")
            if detail.get('specifications'):
                print(f"  Specifications:")
                for k, v in detail['specifications'].items():
                    print(f"    {k}: {v}")
            if detail.get('description'):
                desc = detail['description']
                print(f"  Description: {desc[:500]}")
            if detail.get('related_products'):
                print(f"  Related Products:")
                for rp in detail['related_products']:
                    print(f"    - {rp['name']}")


if __name__ == "__main__":
    scrape()
