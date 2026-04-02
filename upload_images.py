import requests, json, os

BASE = "D:/VDG_astro_2/VDG_VangBacAnThinh_website"
API = "http://147.93.157.156:1337"

# Get admin token
resp = requests.post(f"{API}/admin/login", json={
    "email": "admin@vanganthinh.com",
    "password": "Jinky@otc1"
})
data = resp.json()
if not data.get("data"):
    print(f"Login failed: {data}")
    exit(1)
token = data["data"]["token"]
print("Got admin token")

sku_to_file = {
    "NPQ0.5": "NPQ-ring-05.png", "NPQ1.0": "NPQ-ring-05.png",
    "NPQ2": "NPQ-ring-05.png", "NPQ3": "NPQ-ring-05.png",
    "NPQ5": "NPQ-ring-05.png", "NPQ10": "NPQ-ring-05.png",
    "TPQ1C": "TPQ-thantai.png", "TPQ1L": "TPQ1L-mieng.jpg",
    "VRPQ1L": "VRPQ-rong.png", "CNG1.0": "CNG-congiap.png",
    "BTL1KG": "B80QK.png", "BTL1KGM": "BTL1KGM.png",
    "BTL5L": "BTL5L.png", "BTLPQ1L": "BTLPQ1L.png",
    "BPQ1KG": "BPQ1KG.png", "BPQ1L": "BPQ1L.png",
    "BPQ5L": "BPQ5L.png", "BBM5L": "BBM5L.png",
    "BNM1L": "BNM1L.png", "BM1.001": "BBC5C.png",
    "BM1.006": "BM1OZ-matte.png", "BM1.007": "BM1OZ-proof.png",
    "BDR10G": "BDR10G.png", "BRN1L": "BRN1L.png",
    "BP1.001": "BP-britannia.png", "BP1.002": "BP-kangaroo.png",
    "BP1.003": "BP-maple.png", "BP1.004": "BP-philharmonia.png",
    "BP1.005": "BP-eagle.png", "BP1.006": "BP-niue.png",
    "BP1.007": "BP-somalia.png",
}

headers = {"Authorization": f"Bearer {token}"}

products = requests.get(f"{API}/api/products", params={
    "populate": "images",
    "pagination[pageSize]": 100
}).json()["data"]

ok = 0
for p in products:
    sku, doc_id, pid = p["sku"], p["documentId"], p["id"]
    if sku not in sku_to_file:
        print(f"SKIP {sku}")
        continue
    img = os.path.join(BASE, sku_to_file[sku])
    if not os.path.exists(img):
        print(f"MISS {sku} -> {sku_to_file[sku]}")
        continue

    # Step 1: Upload file
    filename = os.path.basename(img)
    with open(img, "rb") as f:
        upload_resp = requests.post(f"{API}/upload", headers=headers, files={"files": (filename, f, "image/png")})
    resp = upload_resp.json()
    if isinstance(resp, list) and resp:
        file_id = resp[0]["id"]
        # Step 2: Link image to product
        link_resp = requests.put(
            f"{API}/content-manager/collection-types/api::product.product/{doc_id}",
            headers={**headers, "Content-Type": "application/json"},
            json={"images": {"connect": [{"id": file_id}]}}
        )
        resp2 = link_resp.json()
        if "id" in resp2 or "data" in resp2:
            print(f"OK {sku} -> {sku_to_file[sku]} (fileId={file_id})")
            ok += 1
        else:
            print(f"LINK_FAIL {sku}: {json.dumps(resp2)[:150]}")
    else:
        print(f"UPLOAD_FAIL {sku}: {json.dumps(resp)[:150]}")

print(f"\nDone! Uploaded: {ok}/{len(products)}")
