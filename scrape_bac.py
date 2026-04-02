"""Scrape all silver (/bac) products from phuquy.com.vn"""
import json
import time
import sys
import io
from playwright.sync_api import sync_playwright

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')


def scrape_bac():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(
            viewport={"width": 1920, "height": 1080},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        )
        page = ctx.new_page()

        # Load /bac
        print("Loading /bac ...")
        page.goto("https://phuquy.com.vn/bac", wait_until="networkidle", timeout=60000)
        time.sleep(5)

        # Verify we're on the silver page
        body = page.inner_text("body")
        print(f"Page contains 'BẠC TÍCH TRỮ': {'BẠC TÍCH TRỮ' in body}")
        print(f"Page contains 'BẠC MỸ NGHỆ': {'BẠC MỸ NGHỆ' in body}")

        # Take screenshot
        page.screenshot(path="phuquy_bac_listing.png", full_page=True)

        # Extract all product info directly from the page text
        # The /bac page shows products in TWO sections:
        # 1. BẠC TÍCH TRỮ (9 products)
        # 2. BẠC MỸ NGHỆ (15 products)
        print("\n=== EXTRACTING ALL SILVER PRODUCTS FROM TEXT ===")

        # Parse products from body text
        lines = [l.strip() for l in body.split('\n') if l.strip()]
        all_products = []
        current_category = ""

        i = 0
        while i < len(lines):
            line = lines[i]

            # Track category
            if line in ["BẠC TÍCH TRỮ", "BẠC MỸ NGHỆ"]:
                current_category = line
                i += 1
                continue

            # Skip non-product lines
            if line in ["Thêm nhanh vào giỏ hàng", "Sắp xếp theo giá", "Loại sản phẩm",
                         "Chất liệu", "Trọng lượng (chỉ)", "Xem thêm", "BỘ LỌC", "Xóa lọc",
                         "Áp dụng", "VÀNG", "BẠC", "BẢNG GIÁ", "CỬA HÀNG", "TRANG SỨC",
                         "Bán ra", "Mua vào", "Vàng", "Bạc"]:
                i += 1
                continue

            # Check if this is a silver product name (contains "BẠC" or "BẠCH" or "MIẾNG" or "ĐỒNG")
            if (any(kw in line for kw in ["BẠC", "BẠCH", "ĐỒNG BẠC", "MIẾNG BẠC"])
                and len(line) > 5 and len(line) < 200
                and not line.startswith("Bạc 999")):

                product = {"name": line, "category": current_category}
                # Look ahead for prices and status
                j = i + 1
                while j < len(lines) and j < i + 8:
                    if lines[j] == "Bán ra" and j + 1 < len(lines):
                        product["sell_price"] = lines[j + 1]
                        j += 2
                        continue
                    elif lines[j] == "Mua vào" and j + 1 < len(lines):
                        product["buy_price"] = lines[j + 1]
                        j += 2
                        continue
                    elif lines[j] in ["Còn hàng", "Đặt hàng", "Hết hàng", "Dừng bán"]:
                        product["status"] = lines[j]
                        j += 1
                        continue
                    elif lines[j] == "Thêm nhanh vào giỏ hàng":
                        break
                    j += 1

                if product.get("sell_price"):
                    all_products.append(product)
                    print(f"  [{current_category}] {product['name']}")
                    print(f"    Sell: {product.get('sell_price','?')} | Buy: {product.get('buy_price','?')} | {product.get('status','?')}")
                i = j
            else:
                i += 1

        print(f"\nTotal silver products from text: {len(all_products)}")

        # Get listing images
        print("\n=== EXTRACTING LISTING IMAGES ===")
        listing_images = page.evaluate("""
            () => {
                const cards = document.querySelectorAll('.product-card');
                const results = [];
                cards.forEach(card => {
                    const name = card.querySelector('.product-name')?.innerText?.trim() || '';
                    const imgs = [];
                    card.querySelectorAll('img[src*="minio"]').forEach(img => imgs.push(img.src));
                    if (name) results.push({name, images: imgs});
                });
                return results;
            }
        """)
        print(f"Found {len(listing_images)} cards with images")

        # Match images to products
        img_map = {}
        for li in listing_images:
            img_map[li["name"]] = li["images"]

        for prod in all_products:
            prod["listing_images"] = img_map.get(prod["name"], [])

        # Now visit each product detail page
        print("\n=== VISITING SILVER PRODUCT DETAIL PAGES ===")

        # First, discover URLs by clicking cards from the /bac page
        # But since clicking redirects to /vang, let's try direct URL construction
        # The pattern is /san-pham/{slug}
        # Let's try to guess slugs from product names

        for i, prod in enumerate(all_products):
            name = prod["name"]
            # Construct possible slug
            slug_guess = (name.lower()
                .replace("ạ", "a").replace("ả", "a").replace("ã", "a").replace("à", "a").replace("á", "a").replace("ă", "a").replace("ắ", "a").replace("ằ", "a").replace("ẳ", "a").replace("ẵ", "a").replace("ặ", "a").replace("â", "a").replace("ấ", "a").replace("ầ", "a").replace("ẩ", "a").replace("ẫ", "a").replace("ậ", "a")
                .replace("đ", "d")
                .replace("ẹ", "e").replace("ẻ", "e").replace("ẽ", "e").replace("è", "e").replace("é", "e").replace("ê", "e").replace("ế", "e").replace("ề", "e").replace("ể", "e").replace("ễ", "e").replace("ệ", "e")
                .replace("ị", "i").replace("ỉ", "i").replace("ĩ", "i").replace("ì", "i").replace("í", "i")
                .replace("ọ", "o").replace("ỏ", "o").replace("õ", "o").replace("ò", "o").replace("ó", "o").replace("ô", "o").replace("ố", "o").replace("ồ", "o").replace("ổ", "o").replace("ỗ", "o").replace("ộ", "o").replace("ơ", "o").replace("ớ", "o").replace("ờ", "o").replace("ở", "o").replace("ỡ", "o").replace("ợ", "o")
                .replace("ụ", "u").replace("ủ", "u").replace("ũ", "u").replace("ù", "u").replace("ú", "u").replace("ư", "u").replace("ứ", "u").replace("ừ", "u").replace("ử", "u").replace("ữ", "u").replace("ự", "u")
                .replace("ỵ", "y").replace("ỷ", "y").replace("ỹ", "y").replace("ỳ", "y").replace("ý", "y")
                .replace("(", "").replace(")", "").replace(",", "").replace(".", "")
                .strip()
            )
            slug_guess = "-".join(slug_guess.split())

            url = f"https://phuquy.com.vn/san-pham/{slug_guess}"
            print(f"\n[{i+1}/{len(all_products)}] {name}")
            print(f"  Trying: {url}")

            try:
                page.goto(url, wait_until="networkidle", timeout=20000)
                time.sleep(2)

                current_url = page.url
                if current_url == "https://phuquy.com.vn/" or current_url == "https://phuquy.com.vn":
                    print(f"  Redirected to home - slug not found")
                    prod["detail_url"] = ""
                    continue

                print(f"  Loaded: {current_url}")
                prod["detail_url"] = current_url

                # Extract details
                details = page.evaluate(r'''
                    () => {
                        const r = {};
                        const body = document.body.innerText;
                        const lines = body.split('\n').map(l => l.trim()).filter(l => l);

                        // Specs
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

                        // Product images
                        const imgSet = new Set();
                        r.product_images = [];
                        document.querySelectorAll('img').forEach(img => {
                            const src = img.src || '';
                            if (src.includes('minio.phuquy.com.vn/images/product') && !imgSet.has(src)) {
                                imgSet.add(src);
                                r.product_images.push(src);
                            }
                        });

                        // Real name from description
                        r.real_name = '';
                        let inDesc = false;
                        for (const line of lines) {
                            if (line.includes('Chi tiết sản phẩm')) { inDesc = true; continue; }
                            if (inDesc) {
                                if (line === 'Thông số sản phẩm' || line === 'Về bạc Phú Quý') continue;
                                if (line.length > 5 && line.length < 200) {
                                    r.real_name = line;
                                    break;
                                }
                            }
                        }

                        // Description
                        r.description = '';
                        let desc = false;
                        const descLines = [];
                        for (const line of lines) {
                            if (line.includes('Chi tiết sản phẩm')) { desc = true; continue; }
                            if (desc) {
                                if (line === 'Thông số sản phẩm' || line === 'Về bạc Phú Quý') continue;
                                if (line.match(/^CHÍNH SÁCH/)) break;
                                descLines.push(line);
                                if (descLines.length > 15) break;
                            }
                        }
                        r.description = descLines.join('\n').substring(0, 3000);

                        // Prices
                        r.prices = [];
                        document.querySelectorAll('*').forEach(el => {
                            const t = (el.innerText || '').trim();
                            if (t.match(/^[0-9]{1,3}(,[0-9]{3}){1,}$/) && el.children.length === 0) {
                                const rect = el.getBoundingClientRect();
                                const fs = parseFloat(window.getComputedStyle(el).fontSize);
                                if (rect.top > 100 && rect.top < 800 && fs >= 20) {
                                    r.prices.push({ text: t, top: rect.top, left: rect.left, fs: fs });
                                }
                            }
                        });
                        r.prices.sort((a, b) => a.top - b.top || a.left - b.left);

                        return r;
                    }
                ''')

                if details.get("real_name"):
                    prod["name"] = details["real_name"]
                prod["specifications"] = details.get("specifications", {})
                prod["images"] = details.get("product_images", [])[:4]
                prod["description"] = details.get("description", "")

                if details["prices"] and len(details["prices"]) >= 2:
                    prod["sell_price"] = details["prices"][0]["text"]
                    prod["buy_price"] = details["prices"][1]["text"]

                print(f"  Real name: {prod['name']}")
                print(f"  Sell: {prod['sell_price']} | Buy: {prod['buy_price']}")
                print(f"  Specs: {json.dumps(prod['specifications'], ensure_ascii=False)}")
                print(f"  Images: {len(prod['images'])}")
                for img in prod["images"][:3]:
                    print(f"    {img}")

                page.screenshot(path=f"phuquy_bac_{i+1}.png")

            except Exception as e:
                print(f"  Error: {str(e)[:150]}")

        browser.close()

    # Save
    output = {
        "scrape_date": time.strftime("%Y-%m-%d %H:%M:%S"),
        "source": "https://phuquy.com.vn/bac",
        "total_products": len(all_products),
        "products": all_products,
    }
    with open("D:/VDG_astro/phuquy_silver_products.json", "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"\n{'=' * 60}")
    print(f"SAVED {len(all_products)} SILVER PRODUCTS")
    print(f"{'=' * 60}")
    for i, p in enumerate(all_products):
        specs = p.get("specifications", {})
        print(f"\n{i+1}. {p['name']}")
        print(f"   Category: {p.get('category', '?')}")
        print(f"   SKU: {specs.get('Mã SP', '?')} | Sell: {p.get('sell_price','?')} | Buy: {p.get('buy_price','?')} | {p.get('status','?')}")
        print(f"   Images: {len(p.get('images', p.get('listing_images', [])))}")
        if p.get("detail_url"):
            print(f"   URL: {p['detail_url']}")


if __name__ == "__main__":
    scrape_bac()
