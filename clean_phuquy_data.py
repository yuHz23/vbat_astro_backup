"""Merge and clean the scraped Phu Quy gold product data."""
import json
import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

with open("D:/VDG_astro/phuquy_gold_products.json", "r", encoding="utf-8") as f:
    raw = json.load(f)

# Separate listing products (with prices) and detail-only products
listing = [p for p in raw["products"] if p.get("sell_price")]
detail_only = [p for p in raw["products"] if not p.get("sell_price") and p.get("detail")]

# Known mapping: product name -> slug
name_to_slug = {
    "NHẪN TRÒN TRƠN 999.9 (0.5)": "nhan-tron-tron-9999-05",
    "NHẪN TRÒN TRƠN 999.9 (1)": "nhan-tron-tron-9999-1",
    "NHẪN TRÒN TRƠN 999.9 (2)": "nhan-tron-tron-9999-2",
    "NHẪN TRÒN TRƠN 999.9 (3)": "nhan-tron-tron-9999-3",
    "NHẪN TRÒN TRƠN 999.9 (5)": "nhan-tron-tron-9999-5",
    "NHẪN TRÒN TRƠN 999.9 (10)": "nhan-tron-tron-9999-10",
    "THẦN TÀI PHÚ QUÝ 1 CHỈ (999.9)": "than-tai-phu-quy-1-chi-9999",
    "PHÚ QUÝ 1 LƯỢNG 999.9": "phu-quy-1-luong-9999",
    "VÀNG RỒNG PHÚ QUÝ 999.9 1L": "vang-rong-phu-quy-9999-1l",
    "VÀNG CON GIÁP 1 CHỈ (999.9)": "vang-con-giap-1-chi-9999",
}

# Build detail lookup by slug
detail_by_slug = {}
for d in detail_only:
    url = d.get("detail_url", "")
    slug = url.split("/san-pham/")[-1] if "/san-pham/" in url else ""
    if slug:
        detail_by_slug[slug] = d

# Merge listing + detail
merged = []
for lp in listing:
    name = lp["name"]
    slug = name_to_slug.get(name, "")
    detail_url = f"https://phuquy.com.vn/san-pham/{slug}" if slug else ""
    detail_data = detail_by_slug.get(slug, {}).get("detail", {})

    # Get product's own images (first 3 from detail, which are the product gallery)
    own_images = []
    listing_img = lp.get("images", [])
    if listing_img:
        own_images.append(listing_img[0] if isinstance(listing_img[0], str) else listing_img[0])

    detail_product_images = detail_data.get("product_images", [])
    # First 3 images in detail are the product's own gallery
    product_gallery = [img["src"] for img in detail_product_images[:3]]

    # Add listing image if not already in gallery
    if listing_img:
        first_img = listing_img[0] if isinstance(listing_img[0], str) else ""
        if first_img and first_img not in product_gallery:
            product_gallery.insert(0, first_img)

    product = {
        "name": name,
        "slug": slug,
        "detail_url": detail_url,
        "sell_price": lp.get("sell_price", ""),
        "buy_price": lp.get("buy_price", ""),
        "status": lp.get("status", ""),
        "images": product_gallery,
        "description": detail_data.get("description", ""),
        "specifications": detail_data.get("specifications", {}),
        "related_products": list(set(
            rp["name"] for rp in detail_data.get("related_products", [])
        )) if detail_data.get("related_products") else [],
    }
    merged.append(product)

# Check if we're missing the 2 products that weren't on the 8-item listing page
# (The page said "10 products" but only showed 8 - the missing ones are likely
#  NHẪN TRÒN TRƠN 999.9 (2) and NHẪN TRÒN TRƠN 999.9 (5))
existing_names = set(p["name"] for p in merged)
for slug, d in detail_by_slug.items():
    detail = d.get("detail", {})
    title = detail.get("title", "")
    # Map detail title back to listing-style name
    name_upper = title.upper().strip()
    if name_upper and name_upper not in existing_names and name_upper != "THÔNG TIN SẢN PHẨM":
        product_gallery = [img["src"] for img in detail.get("product_images", [])[:3]]
        merged.append({
            "name": name_upper,
            "slug": slug,
            "detail_url": f"https://phuquy.com.vn/san-pham/{slug}",
            "sell_price": "",  # Not shown on listing (need to load more)
            "buy_price": "",
            "status": "",
            "images": product_gallery,
            "description": detail.get("description", ""),
            "specifications": detail.get("specifications", {}),
            "related_products": list(set(
                rp["name"] for rp in detail.get("related_products", [])
            )) if detail.get("related_products") else [],
        })

# Final output
output = {
    "scrape_date": raw["scrape_date"],
    "source": "https://phuquy.com.vn/vang",
    "total_products": len(merged),
    "products": merged,
}

with open("D:/VDG_astro/phuquy_gold_products.json", "w", encoding="utf-8") as f:
    json.dump(output, f, ensure_ascii=False, indent=2)

print(f"Cleaned data: {len(merged)} unique products")
print()
for i, p in enumerate(merged):
    print(f"{i+1}. {p['name']}")
    print(f"   Slug: {p['slug']}")
    print(f"   URL: {p['detail_url']}")
    print(f"   Sell: {p['sell_price']} VNĐ | Buy: {p['buy_price']} VNĐ")
    print(f"   Status: {p['status']}")
    print(f"   Images: {len(p['images'])}")
    for img in p['images']:
        print(f"     {img}")
    if p['specifications']:
        print(f"   Specs: {json.dumps(p['specifications'], ensure_ascii=False)}")
    if p['description']:
        print(f"   Desc: {p['description'][:200]}")
    print()
