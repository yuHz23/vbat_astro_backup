"""Scrape silver product images at high DPI via element screenshots."""
import json, time, sys, io, os, urllib.request, subprocess

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

STRAPI = "http://localhost:1337"
CODE_TO_SKU = {
    'BM1OZ': 'BM1.006', 'BM1OZ02': 'BM1.007', 'BM10G01': 'BDR10G',
    'BM1OZ03': 'BP1.001', 'BM1OZ04': 'BP1.002', 'BM1OZ05': 'BP1.003',
    'BM1OZ06': 'BP1.005', 'BPQRAN1L': 'BRN1L',
}

SILVER_URLS = [
    ("BTL1KG",   "https://phuquy.com.vn/san-pham/bac-thanh-long-phu-quy-999-1kg"),
    ("BTL1KGM",  "https://phuquy.com.vn/san-pham/bac-thanh-long-phu-quy-999-1kg-m"),
    ("BTL5L",    "https://phuquy.com.vn/san-pham/bac-thanh-long-phu-quy-999-5l"),
    ("BTLPQ1L",  "https://phuquy.com.vn/san-pham/bac-thanh-long-phu-quy-999-1l"),
    ("BPQ1KG",   "https://phuquy.com.vn/san-pham/bac-thoi-phu-quy-999-1kg"),
    ("BPQ1L",    "https://phuquy.com.vn/san-pham/bac-mieng-phu-quy-999-1l"),
    ("BPQ5L",    "https://phuquy.com.vn/san-pham/bac-thoi-phu-quy-999-5l"),
    ("BBM5L",    "https://phuquy.com.vn/san-pham/bach-ma-phi-thien-999-5l"),
    ("BRN1L",    "https://phuquy.com.vn/san-pham/bac-mieng-phu-quy-999-ran1l"),
    ("BNM1L",    "https://phuquy.com.vn/san-pham/ngan-ma-chieu-tai-999-1l"),
    ("B80QK",    "https://phuquy.com.vn/san-pham/bac-ky-niem-80-nam-quoc-khanh-999-5l"),
    ("BXTPQ5L",  "https://phuquy.com.vn/san-pham/bac-ky-niem-50-nam-tndn-999-5l"),
    ("BM.002",   "https://phuquy.com.vn/san-pham/dong-bac-bat-bao-cat-tuong-phu-quy-5-chi"),
    ("BM1.001",  "https://phuquy.com.vn/san-pham/dong-bac-lien-hoa-bo-de-phu-quy-1-luong"),
    ("BM1.006",  "https://phuquy.com.vn/san-pham/dong-bac-buffalo-matte-1-oz-phu-quy-ban-mo"),
    ("BM1.007",  "https://phuquy.com.vn/san-pham/dong-bac-buffalo-proof-1-oz-phu-quy-ban-bong"),
    ("BDR10G",   "https://phuquy.com.vn/san-pham/mieng-bac-pamp-dragon-10g-2024"),
    ("BM30G01",  "https://phuquy.com.vn/san-pham/dong-bac-panda-30g-2024"),
    ("BM1OZ07",  "https://phuquy.com.vn/san-pham/dong-bac-dragon-iii-1-oz-2024"),
    ("BM1OZ08",  "https://phuquy.com.vn/san-pham/dong-bac-dragon-colour-iii-2024-1-oz"),
    ("BP1.001",  "https://phuquy.com.vn/san-pham/dong-bac-britannia-charles-iii-1-oz-2024"),
    ("BP1.002",  "https://phuquy.com.vn/san-pham/dong-bac-kangaroo-1-oz-2024"),
    ("BP1.003",  "https://phuquy.com.vn/san-pham/dong-bac-maple-leaf-1-oz-2024"),
    ("BP1.005",  "https://phuquy.com.vn/san-pham/dong-bac-american-eagle-1-oz-2024"),
]

def get_admin_token():
    body = json.dumps({"email": "admin@vanganthinh.com", "password": "Admin123456"}).encode()
    req = urllib.request.Request(f"{STRAPI}/admin/login", data=body, headers={"Content-Type": "application/json"})
    return json.loads(urllib.request.urlopen(req).read())["data"]["token"]

def get_products(token):
    req = urllib.request.Request(f"{STRAPI}/api/admin-products", headers={"Authorization": f"Bearer {token}"})
    return json.loads(urllib.request.urlopen(req).read())["data"]

def upload_image(token, filepath):
    result = subprocess.run(
        ['curl', '-s', '-X', 'POST', f'{STRAPI}/upload',
         '-H', f'Authorization: Bearer {token}',
         '-F', f'files=@{filepath}'],
        capture_output=True, text=True, timeout=60
    )
    res = json.loads(result.stdout)
    return res[0]['id'] if isinstance(res, list) and res else None

def attach_images(token, doc_id, img_ids):
    body = json.dumps({"images": {"set": [{"id": i} for i in img_ids]}}).encode('utf-8')
    req = urllib.request.Request(
        f"{STRAPI}/content-manager/collection-types/api::product.product/{doc_id}",
        data=body,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        method="PUT"
    )
    urllib.request.urlopen(req)


def scrape_and_upload():
    from playwright.sync_api import sync_playwright

    token = get_admin_token()
    products = get_products(token)
    sku_to_doc = {p['sku']: p['documentId'] for p in products}
    print(f"Strapi: {len(products)} products")

    tmp_dir = "D:/VDG_astro_2/tmp_scrape"
    os.makedirs(tmp_dir, exist_ok=True)

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        # High DPI context: 3x scale = 3x resolution screenshots
        ctx = browser.new_context(
            viewport={"width": 1920, "height": 1080},
            device_scale_factor=3,
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        )
        page = ctx.new_page()

        total_updated = 0

        for idx, (sku, url) in enumerate(SILVER_URLS):
            doc_id = sku_to_doc.get(sku)
            if not doc_id:
                continue

            print(f"\n[{idx+1}/{len(SILVER_URLS)}] {sku}")

            try:
                page.goto(url, wait_until="networkidle", timeout=25000)
                time.sleep(4)

                if page.url in ["https://phuquy.com.vn/", "https://phuquy.com.vn"]:
                    print(f"  Redirected")
                    continue

                # Find product gallery images
                img_elements = page.query_selector_all('img[src*="minio.phuquy.com.vn/images/product"]')

                uploaded_ids = []
                count = 0

                for img_el in img_elements:
                    if count >= 4:
                        break
                    try:
                        box = img_el.bounding_box()
                        if not box or box['width'] < 80 or box['height'] < 80 or box['y'] > 1200:
                            continue

                        tmp_path = f"{tmp_dir}/{sku.replace('.','_')}_{count+1}.png"
                        img_el.screenshot(path=tmp_path)

                        fsize = os.path.getsize(tmp_path)
                        if fsize < 5000:  # Skip tiny images
                            os.remove(tmp_path)
                            continue

                        img_id = upload_image(token, tmp_path)
                        if img_id:
                            uploaded_ids.append(img_id)
                            print(f"    img {count+1}: OK ({fsize//1024}KB, {int(box['width']*3)}x{int(box['height']*3)}px, id={img_id})")
                            count += 1
                        os.remove(tmp_path)

                    except Exception as e:
                        print(f"    err: {str(e)[:60]}")

                if uploaded_ids:
                    attach_images(token, doc_id, uploaded_ids)
                    total_updated += 1
                    print(f"  -> {len(uploaded_ids)} images")
                else:
                    print(f"  NO images")

            except Exception as e:
                print(f"  ERROR: {str(e)[:120]}")

        browser.close()

    try:
        os.rmdir(tmp_dir)
    except:
        pass

    print(f"\n{'='*60}")
    print(f"DONE! Updated {total_updated}/{len(SILVER_URLS)} products")
    print(f"{'='*60}")


if __name__ == "__main__":
    scrape_and_upload()
