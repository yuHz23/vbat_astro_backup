const apiUrl = 'http://127.0.0.1:1337/api';

async function seedV5() {
    console.log('Fetching categories...');
    let categories = [];
    try {
        const res = await fetch(`${apiUrl}/product-categories`);
        const json = await res.json();
        if (json.data) {
            categories = json.data;
        } else {
            console.error('Unexpected categories response:', json);
            return;
        }
    } catch (err) {
        console.error('Fetch categories error:', err);
        return;
    }

    const getCatId = (slug) => {
        // Strapi 5 uses documentId as the primary relation identifier
        const cat = categories.find(c => c.slug === slug);
        return cat ? cat.documentId : null;
    };

    const createCategory = async (name, slug) => {
        console.log(`Creating category: ${name}`);
        const res = await fetch(`${apiUrl}/product-categories`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: { name, slug } })
        });
        const json = await res.json();
        if (!res.ok) {
            console.error(`Error creating ${name}:`, json);
            return null;
        }
        return json.data?.documentId;
    };

    let nhanId = getCatId('nhan');
    if (!nhanId) { nhanId = await createCategory('Nhẫn', 'nhan'); }
    let vangMiengId = getCatId('vang-mieng');
    if (!vangMiengId) { vangMiengId = await createCategory('Vàng Miếng', 'vang-mieng'); }
    let bacId = getCatId('bac');
    if (!bacId) { bacId = await createCategory('Bạc', 'bac'); }

    if (!nhanId || !vangMiengId || !bacId) {
        console.error('Failed to resolve categories in DB:', { nhanId, vangMiengId, bacId });
        return;
    }

    const productsToSeed = [
        {
            name: 'Vàng Miếng SJC 1 Chỉ',
            slug: 'vang-mieng-sjc-1-chi',
            price: 8400000,
            description: 'Vàng miếng SJC 1 chỉ loại vàng 99.99%',
            stock: 100,
            category: vangMiengId
        },
        {
            name: 'Vàng Miếng Khắc Tên 1 Chỉ',
            slug: 'vang-mieng-khac-ten-1-chi',
            price: 8420000,
            description: 'Vàng miếng An Thịnh 999.9 1 chỉ có khắc tên theo yêu cầu',
            stock: 50,
            category: vangMiengId
        },
        {
            name: 'Nhẫn Tròn Trơn 999.9 2 Chỉ',
            slug: 'nhan-tron-tron-9999-2-chi',
            price: 16800000,
            description: 'Nhẫn tròn trơn Vàng An Thịnh 999.9 trọng lượng 2 chỉ',
            stock: 30,
            category: vangMiengId
        },
        {
            name: 'Kiềng Cổ Vàng Ta 5 Chỉ',
            slug: 'kieng-co-vang-ta-5-chi',
            price: 42000000,
            description: 'Kiềng cổ bằng vàng ta 99.99% trọng lượng 5 chỉ',
            stock: 10,
            category: nhanId
        },
        {
            name: 'Nhẫn Nam Signet Vàng 18K',
            slug: 'nhan-nam-signet-vang-18k',
            price: 12500000,
            description: 'Nhẫn nam Signet cổ điển nam tính bằng vàng 18K',
            stock: 15,
            category: nhanId
        },
        {
            name: 'Nhẫn Nữ Đính Đá Trắng 18K',
            slug: 'nhan-nu-dinh-da-trang-18k',
            price: 4500000,
            description: 'Nhẫn nữ tinh tế bằng vàng 18K đính đá CZ trắng',
            stock: 25,
            category: nhanId
        },
        {
            name: 'Nhẫn Cưới Cặp 18K Đính Kim Cương Tấm',
            slug: 'nhan-cuoi-cap-18k-dinh-kim-cuong',
            price: 18000000,
            description: 'Cặp nhẫn cưới bằng vàng 18K đính kim cương thiên nhiên',
            stock: 5,
            category: nhanId
        },
        {
            name: 'Bạc Thỏi 1 Lượng (37.5g)',
            slug: 'bac-thoi-1-luong',
            price: 2500000,
            description: 'Bạc nguyên chất 99.9 đúc thỏi trọng lượng 1 lượng',
            stock: 50,
            category: bacId
        },
        {
            name: 'Nhẫn Bạc Ta Khảm Trai',
            slug: 'nhan-bac-ta-kham-trai',
            price: 650000,
            description: 'Nhẫn bạc ta 925 thủ công khảm xà cừ',
            stock: 40,
            category: bacId
        },
        {
            name: 'Bộ Trang Sức Bạc Đính Ngọc Trai',
            slug: 'bo-trang-suc-bac-dinh-ngoc-trai',
            price: 1850000,
            description: 'Bộ trang sức bạc ghim ngọc trai thiên nhiên gồm dây chuyền và bông tai',
            stock: 20,
            category: bacId
        },
        {
            name: 'Vòng Tay Bạc Nguyên Khối Chạm Rồng',
            slug: 'vong-tay-bac-nguyen-khoi-cham-rong',
            price: 3200000,
            description: 'Vòng tay bạc nguyên khối chạm khắc nổi hình rồng phượng',
            stock: 8,
            category: bacId
        }
    ];

    for (const product of productsToSeed) {
        try {
            const res = await fetch(`${apiUrl}/products`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ data: product })
            });
            if (res.ok) {
                console.log(`Created: ${product.name}`);
            } else {
                const errJson = await res.json();
                console.error(`Failed to create ${product.name}:`, errJson);
            }
        } catch (err) {
            console.error(`Error creating ${product.name}:`, err);
        }
    }
}

seedV5();
