"""Re-scrape product detail pages to get all specifications and descriptions."""
import json
import time
import sys
import io
from playwright.sync_api import sync_playwright

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

with open("D:/VDG_astro/phuquy_gold_products.json", "r", encoding="utf-8") as f:
    data = json.load(f)

products = data["products"]

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(
        viewport={"width": 1920, "height": 1080},
        user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    )
    page = context.new_page()

    for i, prod in enumerate(products):
        url = prod.get("detail_url", "")
        if not url:
            continue
        name = prod["name"]
        print(f"\n[{i+1}/{len(products)}] {name}")
        print(f"  URL: {url}")

        try:
            page.goto(url, wait_until="networkidle", timeout=30000)
            time.sleep(3)

            detail = page.evaluate(r"""
                () => {
                    const r = {};

                    // Title
                    const h1 = document.querySelector('h1');
                    r.title = h1 ? h1.innerText.trim() : '';

                    // Product images (from gallery only - minio product images)
                    const imgSet = new Set();
                    r.product_images = [];
                    // Look for gallery/carousel images first
                    const gallerySelectors = [
                        '.product-gallery img',
                        '.swiper img',
                        '.carousel img',
                        '.slick img',
                        '[class*="gallery"] img',
                        '[class*="slider"] img',
                        '[class*="thumbnail"] img',
                        '[class*="preview"] img',
                    ];
                    // First try gallery-specific selectors
                    for (const sel of gallerySelectors) {
                        document.querySelectorAll(sel).forEach(img => {
                            const src = img.src || '';
                            if (src.includes('minio.phuquy.com.vn/images/product') && !imgSet.has(src)) {
                                imgSet.add(src);
                                r.product_images.push(src);
                            }
                        });
                    }
                    // Then all minio product images
                    document.querySelectorAll('img').forEach(img => {
                        const src = img.src || '';
                        if (src.includes('minio.phuquy.com.vn/images/product') && !imgSet.has(src)) {
                            imgSet.add(src);
                            r.product_images.push(src);
                        }
                    });

                    // Specifications - from the info area next to images
                    r.specifications = {};
                    // Look for spec rows (label: value patterns)
                    const specArea = document.querySelector('[class*="info"], [class*="spec"], [class*="detail"]');
                    if (specArea) {
                        const text = specArea.innerText;
                        const lines = text.split('\n').map(l => l.trim()).filter(l => l);
                        // Look for "KEY VALUE" or "KEY: VALUE" patterns
                        for (const line of lines) {
                            // Match patterns like "MÃ SP: NP01.0" or "KHỐI LƯỢNG: 3.75 GRAM"
                            const colonMatch = line.match(/^([^:]+):\s*(.+)/);
                            if (colonMatch) {
                                r.specifications[colonMatch[1].trim()] = colonMatch[2].trim();
                            }
                        }
                    }

                    // Also try table rows
                    document.querySelectorAll('tr').forEach(row => {
                        const cells = row.querySelectorAll('td, th');
                        if (cells.length >= 2) {
                            const k = cells[0].innerText.trim();
                            const v = cells[1].innerText.trim();
                            if (k && v && k.length < 100) r.specifications[k] = v;
                        }
                    });

                    // Try to extract specs from the product info section
                    // Pattern: "MÃ SP" followed by value on same or next element
                    const allText = document.body.innerText;
                    const specPatterns = [
                        [/MÃ SP[:\s]+([^\n]+)/i, 'Mã SP'],
                        [/KHỐI LƯỢNG[:\s]+([^\n]+)/i, 'Khối lượng'],
                        [/HÀM LƯỢNG[:\s]+([^\n]+)/i, 'Hàm lượng'],
                        [/ĐỊNH LƯỢNG[:\s]+([^\n]+)/i, 'Định lượng'],
                        [/XUẤT XỨ[:\s]+([^\n]+)/i, 'Xuất xứ'],
                    ];
                    for (const [pattern, label] of specPatterns) {
                        const m = allText.match(pattern);
                        if (m && !r.specifications[label]) {
                            r.specifications[label] = m[1].trim();
                        }
                    }

                    // Sell/Buy prices from detail page
                    r.sell_price = '';
                    r.buy_price = '';
                    const priceLabels = document.querySelectorAll('*');
                    for (const el of priceLabels) {
                        const t = el.innerText?.trim() || '';
                        if (t === 'Bán ra' || t === 'BÁN RA') {
                            const next = el.nextElementSibling || el.parentElement?.nextElementSibling;
                            if (next) r.sell_price = next.innerText?.trim().split('\n')[0] || '';
                        }
                        if (t === 'Mua vào' || t === 'MUA VÀO') {
                            const next = el.nextElementSibling || el.parentElement?.nextElementSibling;
                            if (next) r.buy_price = next.innerText?.trim().split('\n')[0] || '';
                        }
                    }

                    // Description from tabs
                    r.description = '';
                    // Look for tab content sections
                    const tabContents = document.querySelectorAll('[class*="tab-content"], [class*="tabContent"], [class*="detail"], [nz-tab-body]');
                    for (const tc of tabContents) {
                        const t = tc.innerText?.trim() || '';
                        if (t.length > 50 && !t.includes('Chính sách')) {
                            r.description = t.substring(0, 5000);
                            break;
                        }
                    }
                    // Fallback: look for description area
                    if (!r.description) {
                        const descArea = document.querySelector('[class*="description"], [class*="desc"], .product-detail-content');
                        if (descArea) r.description = descArea.innerText.trim().substring(0, 5000);
                    }

                    // Full page text for fallback
                    r.fullText = allText.substring(0, 12000);

                    return r;
                }
            """)

            prod['detail'] = detail
            prod['detail_url'] = url

            print(f"  Title: {detail.get('title', '?')}")
            print(f"  Product Images ({len(detail.get('product_images', []))}):")
            for img in detail.get('product_images', []):
                print(f"    {img}")
            print(f"  Specifications: {json.dumps(detail.get('specifications', {}), ensure_ascii=False)}")
            if detail.get('sell_price'):
                print(f"  Sell: {detail['sell_price']}")
            if detail.get('buy_price'):
                print(f"  Buy: {detail['buy_price']}")
            if detail.get('description'):
                print(f"  Description: {detail['description'][:300]}")

        except Exception as e:
            print(f"  Error: {str(e)[:150]}")

    browser.close()

# Clean up and separate product's own images vs related product images
for prod in products:
    detail = prod.get('detail', {})
    if not detail:
        continue

    all_imgs = detail.get('product_images', [])
    # The product's own images are typically the first 3-4 images
    # Related product images follow (they're thumbnails of other products)
    # We can identify own images by checking if they match the listing image
    listing_img = prod.get('images', [''])[0] if prod.get('images') else ''
    if isinstance(listing_img, dict):
        listing_img = listing_img.get('src', '')

    own_images = []
    related_images = []

    # Find where own images end - own images usually share a common name pattern
    # e.g. "nhan-tron-phu-quy-0,5-chi-01-MT", "nhan-tron-phu-quy-0,5-chi-01-MS", "nhan-tron-phu-quy-0,5-chi-04"
    if listing_img and all_imgs:
        # Extract the base pattern from listing image
        import re
        listing_base = re.sub(r'_\d+_', '_', listing_img.split('/')[-1].split('.')[0])
        # First few chars of the product-specific part
        parts = listing_img.split('/')[-1].split('_', 1)
        if len(parts) > 1:
            product_prefix = parts[1][:15]  # First 15 chars of filename after timestamp
        else:
            product_prefix = ''

        for img in all_imgs:
            img_name = img.split('/')[-1]
            if product_prefix and product_prefix[:10] in img_name:
                own_images.append(img)
            elif img == listing_img:
                own_images.append(img)
            elif len(own_images) < 4 and not related_images:
                # Still in the own images section
                own_images.append(img)
            else:
                related_images.append(img)
    else:
        own_images = all_imgs[:3]
        related_images = all_imgs[3:]

    prod['images'] = own_images if own_images else prod.get('images', [])

    # Remove fullText from output (too large)
    if 'detail' in prod and 'fullText' in prod['detail']:
        del prod['detail']['fullText']
    if 'detail' in prod and 'product_images' in prod['detail']:
        prod['detail']['all_page_images'] = prod['detail'].pop('product_images')

# Save
with open("D:/VDG_astro/phuquy_gold_products.json", "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f"\n{'=' * 60}")
print("FINAL VERIFIED DATA")
print(f"{'=' * 60}")
for i, p in enumerate(products):
    detail = p.get('detail', {})
    print(f"\n{'━' * 60}")
    print(f"PRODUCT {i+1}: {p['name']}")
    print(f"  URL: {p.get('detail_url', 'N/A')}")
    print(f"  Sell: {p.get('sell_price', 'N/A')} VNĐ")
    print(f"  Buy: {p.get('buy_price', 'N/A')} VNĐ")
    print(f"  Status: {p.get('status', 'N/A')}")
    specs = detail.get('specifications', {})
    if specs:
        print(f"  Specifications:")
        for k, v in specs.items():
            print(f"    {k}: {v}")
    print(f"  Images ({len(p.get('images', []))}):")
    for img in p.get('images', []):
        print(f"    {img}")
    if detail.get('description'):
        print(f"  Description: {detail['description'][:400]}")
