const apiUrl = 'https://be.phuquy.com.vn/jewelry/product-payment-service/api/sync-price-history/get-sync-table-history';

async function testFetch() {
    try {
        const res = await fetch(apiUrl);
        const json = await res.json();
        console.log(JSON.stringify(json, null, 2));
    } catch (e) {
        console.error(e);
    }
}
testFetch();
