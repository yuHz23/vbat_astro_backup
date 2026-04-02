"""
Fix gold product names + scrape all silver (/bac) products from phuquy.com.vn
"""
import json
import time
import sys
import io
import re
from playwright.sync_api import sync_playwright

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')


def extract_real_product_name(page):
    """Get the real product name from the description tab (bold title)."""
    return page.evaluate(r'''
        () => {
            const body = document.body.innerText;
            const lines = body.split('\n').map(l => l.trim()).filter(l => l);

            // Find the description section - it starts after "Chi tiết sản phẩm"
            let inDesc = false;
            for (const line of lines) {
                if (line.includes('Chi tiết sản phẩm')) {
                    inDesc = true;
                    continue;
                }
                if (inDesc) {
                    // Skip tab labels
                    if (line === 'Thông số sản phẩm' || line === 'Về bạc Phú Quý') continue;
                    // The first uppercase line with substantial content is the real product name
                    if (line.length > 5 && line.length < 200) {
                        return line;
                    }
                }
            }
            return '';
        }
    ''')


def extract_product_details(page):
    """Extract all details from a product detail page."""
    return page.evaluate(r'''
        () => {
            const r = {};
            const body = document.body.innerText;
            const lines = body.split('\n').map(l => l.trim()).filter(l => l);

            // Page title (breadcrumb name)
            r.page_title = '';
            for (const line of lines) {
                if (line.match(/^Trang chủ/)) {
                    const parts = line.split('/');
                    r.page_title = parts[parts.length - 1].trim();
                    break;
                }
            }

            // Specs from text
            r.specifications = {};
            const specPatterns = [
                [/M[AÃ] SP[:\s]+([^\n]+)/i, 'Mã SP'],
                [/KH[OỐ]I L[UƯ][OỢ]NG[:\s]+([^\n]+)/i, 'Khối lượng'],
                [/H[AÀ]M L[UƯ][OỢ]NG[:\s]+([^\n]+)/i, 'Hàm lượng'],
                [/[ĐD][IỊ]NH L[UƯ][OỢ]NG[:\s]+([^\n]+)/i, 'Định lượng'],
                [/XU[AẤ]T X[UỨ][:\s]+([^\n]+)/i, 'Xuất xứ'],
            ];
            for (const [pattern, label] of specPatterns) {
                const m = body.match(pattern);
                if (m) r.specifications[label] = m[1].trim();
            }

            // Product images (minio product images, deduplicated)
            const imgSet = new Set();
            r.product_images = [];
            document.querySelectorAll('img').forEach(img => {
                const src = img.src || '';
                if (src.includes('minio.phuquy.com.vn/images/product') && !imgSet.has(src)) {
                    imgSet.add(src);
                    r.product_images.push(src);
                }
            });

            // Prices (large font, in content area)
            r.prices = [];
            document.querySelectorAll('*').forEach(el => {
                const t = (el.innerText || '').trim();
                if (t.match(/^[0-9]{1,3}(,[0-9]{3}){2,}$/) && el.children.length === 0) {
                    const rect = el.getBoundingClientRect();
                    const fs = parseFloat(window.getComputedStyle(el).fontSize);
                    if (rect.top > 100 && rect.top < 800 && fs >= 20) {
                        r.prices.push({ text: t, top: rect.top, left: rect.left, fontSize: fs });
                    }
                }
            });
            r.prices.sort((a, b) => a.top - b.top || a.left - b.left);

            // Description from tab content
            r.description = '';
            let inDesc = false;
            const descLines = [];
            for (const line of lines) {
                if (line.includes('Chi tiết sản phẩm')) { inDesc = true; continue; }
                if (inDesc) {
                    if (line === 'Thông số sản phẩm' || line === 'Về bạc Phú Quý') continue;
                    if (line.match(/^CHÍNH SÁCH/)) break;
                    descLines.push(line);
                    if (descLines.length > 20) break;
                }
            }
            r.description = descLines.join('\n').substring(0, 3000);

            // Status
            r.status = '';
            if (body.includes('Còn hàng')) r.status = 'Còn hàng';
            else if (body.includes('Đặt hàng')) r.status = 'Đặt hàng';
            else if (body.includes('Hết hàng')) r.status = 'Hết hàng';
            else if (body.includes('Dừng bán')) r.status = 'Dừng bán';

            return r;
        }
    ''')


def scrape():
    with open("D:/VDG_astro/phuquy_gold_products.json", "r", encoding="utf-8") as f:
        gold_data = json.load(f)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(
            viewport={"width": 1920, "height": 1080},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        )
        page = ctx.new_page()

        # ═══════════════════════════════════════
        # PART 1: Fix gold product names
        # ═══════════════════════════════════════
        print("=" * 60)
        print("PART 1: FIXING GOLD PRODUCT NAMES")
        print("=" * 60)

        for prod in gold_data["products"]:
            url = prod.get("detail_url", "")
            if not url:
                continue
            page.goto(url, wait_until="networkidle", timeout=30000)
            time.sleep(2)

            real_name = extract_real_product_name(page)
            if real_name:
                old = prod["name"]
                prod["name"] = real_name
                print(f'  "{old}" -> "{real_name}"')

        # Save fixed gold data
        with open("D:/VDG_astro/phuquy_gold_products.json", "w", encoding="utf-8") as f:
            json.dump(gold_data, f, ensure_ascii=False, indent=2)
        print(f"\nFixed {len(gold_data['products'])} gold product names")

        # ═══════════════════════════════════════
        # PART 2: Scrape all silver products
        # ═══════════════════════════════════════
        print("\n" + "=" * 60)
        print("PART 2: SCRAPING SILVER (/bac) PRODUCTS")
        print("=" * 60)

        page.goto("https://phuquy.com.vn/bac", wait_until="networkidle", timeout=60000)
        time.sleep(5)

        # Click all "Xem thêm" buttons to load everything
        print("Loading all silver products...")
        for _ in range(15):
            clicked = page.evaluate("""
                () => {
                    const els = document.querySelectorAll('*');
                    for (const el of els) {
                        if (el.innerText && el.innerText.trim() === 'Xem thêm' && el.offsetParent !== null) {
                            const rect = el.getBoundingClientRect();
                            if (rect.top > 300 && rect.top < 5000) { el.click(); return true; }
                        }
                    }
                    return false;
                }
            """)
            if clicked:
                time.sleep(3)
            else:
                break

        # Extract all silver product cards
        silver_cards = page.evaluate("""
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

        print(f"Found {len(silver_cards)} silver product cards on listing page")

        # Parse prices from listing
        for card in silver_cards:
            lines = [l.strip() for l in card.get("infoText", "").split("\n") if l.strip()]
            for i, line in enumerate(lines):
                if line == "Bán ra" and i + 1 < len(lines):
                    card["sell_price"] = lines[i + 1]
                elif line == "Mua vào" and i + 1 < len(lines):
                    card["buy_price"] = lines[i + 1]
            card.pop("infoText", None)
            print(f"  {card['name']} | Sell: {card.get('sell_price','?')} | Buy: {card.get('buy_price','?')} | {card.get('status','?')}")

        # Discover silver product detail URLs by clicking each card
        print("\n--- Discovering silver product URLs ---")
        silver_products = []

        for i in range(len(silver_cards)):
            card_name = silver_cards[i]["name"]
            print(f"\n[{i+1}/{len(silver_cards)}] {card_name}")

            try:
                page.goto("https://phuquy.com.vn/bac", wait_until="networkidle", timeout=30000)
                time.sleep(3)

                # Re-click all "Xem thêm"
                for _ in range(15):
                    c = page.evaluate("""
                        () => {
                            for (const el of document.querySelectorAll('*')) {
                                if (el.innerText && el.innerText.trim() === 'Xem thêm' && el.offsetParent !== null) {
                                    const rect = el.getBoundingClientRect();
                                    if (rect.top > 300) { el.click(); return true; }
                                }
                            }
                            return false;
                        }
                    """)
                    if c:
                        time.sleep(2)
                    else:
                        break

                # Click the i-th card
                card_count = page.evaluate("() => document.querySelectorAll('.product-card').length")
                if i >= card_count:
                    print(f"  Card {i} out of range ({card_count})")
                    continue

                page.evaluate(f"() => document.querySelectorAll('.product-card')[{i}].click()")
                time.sleep(3)
                page.wait_for_load_state("networkidle", timeout=15000)

                url = page.url
                print(f"  URL: {url}")

                if "/san-pham/" in url:
                    # Extract details
                    details = extract_product_details(page)
                    real_name = extract_real_product_name(page)

                    sell = ""
                    buy = ""
                    if details["prices"] and len(details["prices"]) >= 2:
                        sell = details["prices"][0]["text"]
                        buy = details["prices"][1]["text"]

                    product = {
                        "name": real_name if real_name else card_name,
                        "listing_name": card_name,
                        "slug": url.split("/san-pham/")[-1],
                        "detail_url": url,
                        "sell_price": sell if sell else silver_cards[i].get("sell_price", ""),
                        "buy_price": buy if buy else silver_cards[i].get("buy_price", ""),
                        "status": details.get("status") or silver_cards[i].get("status", ""),
                        "specifications": details.get("specifications", {}),
                        "images": details.get("product_images", [])[:4],
                        "description": details.get("description", ""),
                        "listing_image": silver_cards[i].get("images", []),
                    }

                    silver_products.append(product)

                    print(f"  Real name: {product['name']}")
                    print(f"  Sell: {product['sell_price']} | Buy: {product['buy_price']}")
                    print(f"  Specs: {json.dumps(product['specifications'], ensure_ascii=False)}")
                    print(f"  Images: {len(product['images'])}")
                    for img in product["images"][:3]:
                        print(f"    {img}")

                    # Take screenshot
                    page.screenshot(path=f"phuquy_bac_{product['slug']}.png")
                else:
                    print(f"  Did not navigate to product page")
                    silver_products.append({
                        "name": card_name,
                        "listing_name": card_name,
                        "sell_price": silver_cards[i].get("sell_price", ""),
                        "buy_price": silver_cards[i].get("buy_price", ""),
                        "status": silver_cards[i].get("status", ""),
                        "images": silver_cards[i].get("images", []),
                    })

            except Exception as e:
                print(f"  Error: {str(e)[:150]}")
                silver_products.append({
                    "name": card_name,
                    "listing_name": card_name,
                    "sell_price": silver_cards[i].get("sell_price", ""),
                    "buy_price": silver_cards[i].get("buy_price", ""),
                    "status": silver_cards[i].get("status", ""),
                    "images": silver_cards[i].get("images", []),
                })

        browser.close()

    # ═══════════════════════════════════════
    # Save silver products
    # ═══════════════════════════════════════
    silver_output = {
        "scrape_date": time.strftime("%Y-%m-%d %H:%M:%S"),
        "source": "https://phuquy.com.vn/bac",
        "total_products": len(silver_products),
        "products": silver_products,
    }

    with open("D:/VDG_astro/phuquy_silver_products.json", "w", encoding="utf-8") as f:
        json.dump(silver_output, f, ensure_ascii=False, indent=2)

    # ═══════════════════════════════════════
    # Final summary
    # ═══════════════════════════════════════
    print("\n" + "=" * 60)
    print("GOLD PRODUCTS (FIXED NAMES)")
    print("=" * 60)
    for i, p in enumerate(gold_data["products"]):
        specs = p.get("detail", {}).get("specifications", {})
        print(f"{i+1}. {p['name']}")
        print(f"   SKU: {specs.get('Mã SP','?')} | {specs.get('Định lượng','?')} | Sell: {p['sell_price']} | Buy: {p['buy_price']}")

    print("\n" + "=" * 60)
    print(f"SILVER PRODUCTS ({len(silver_products)} total)")
    print("=" * 60)
    for i, p in enumerate(silver_products):
        specs = p.get("specifications", {})
        print(f"{i+1}. {p['name']}")
        print(f"   Listing: {p.get('listing_name', '?')}")
        print(f"   SKU: {specs.get('Mã SP','?')} | Sell: {p.get('sell_price','?')} | Buy: {p.get('buy_price','?')} | {p.get('status','?')}")
        print(f"   Images: {len(p.get('images', []))}")


if __name__ == "__main__":
    scrape()
