const strapi = require('@strapi/strapi');

async function seedMoreProducts() {
    const app = await strapi().load();

    // Find categories
    const categories = await app.db.query('api::category.category').findMany();
    const nhanCategory = categories.find(c => c.slug === 'nhan');
    const vangMiengCategory = categories.find(c => c.slug === 'vang-mieng');
    const bacCategory = categories.find(c => c.slug === 'bac');

    if (!nhanCategory || !vangMiengCategory || !bacCategory) {
        console.error('Missing required categories (nhan, vang-mieng, bac)');
        process.exit(1);
    }

    const productsToSeed = [
        // Vàng nguyên liệu / miếng
        {
            name: 'Vàng Miếng SJC 1 Chỉ',
            slug: 'vang-mieng-sjc-1-chi',
            price: 8400000,
            description: 'Vàng miếng SJC 1 chỉ loại vàng 99.99%',
            stock: 100,
            category: vangMiengCategory.id,
            publishedAt: new Date()
        },
        {
            name: 'Vàng Miếng Khắc Tên 1 Chỉ',
            slug: 'vang-mieng-khac-ten-1-chi',
            price: 8420000,
            description: 'Vàng miếng An Thịnh 999.9 1 chỉ có khắc tên theo yêu cầu',
            stock: 50,
            category: vangMiengCategory.id,
            publishedAt: new Date()
        },
        {
            name: 'Nhẫn Tròn Trơn 999.9 2 Chỉ',
            slug: 'nhan-tron-tron-9999-2-chi',
            price: 16800000,
            description: 'Nhẫn tròn trơn Vàng An Thịnh 999.9 trọng lượng 2 chỉ',
            stock: 30,
            category: vangMiengCategory.id, // Or nhan
            publishedAt: new Date()
        },
        {
            name: 'Kiềng Cổ Vàng Ta 5 Chỉ',
            slug: 'kieng-co-vang-ta-5-chi',
            price: 42000000,
            description: 'Kiềng cổ bằng vàng ta 99.99% trọng lượng 5 chỉ',
            stock: 10,
            category: nhanCategory.id, // using rings as a proxy for high end jewelry if category doesn't exist
            publishedAt: new Date()
        },

        // Nhẫn Nam/Nữ
        {
            name: 'Nhẫn Nam Signet Vàng 18K',
            slug: 'nhan-nam-signet-vang-18k',
            price: 12500000,
            description: 'Nhẫn nam Signet cổ điển nam tính bằng vàng 18K',
            stock: 15,
            category: nhanCategory.id,
            publishedAt: new Date()
        },
        {
            name: 'Nhẫn Nữ Đính Đá Trắng 18K',
            slug: 'nhan-nu-dinh-da-trang-18k',
            price: 4500000,
            description: 'Nhẫn nữ tinh tế bằng vàng 18K đính đá CZ trắng',
            stock: 25,
            category: nhanCategory.id,
            publishedAt: new Date()
        },
        {
            name: 'Nhẫn Cưới Cặp 18K Đính Kim Cương Tấm',
            slug: 'nhan-cuoi-cap-18k-dinh-kim-cuong',
            price: 18000000,
            description: 'Cặp nhẫn cưới bằng vàng 18K đính kim cương thiên nhiên',
            stock: 5,
            category: nhanCategory.id,
            publishedAt: new Date()
        },

        // Bạc
        {
            name: 'Bạc Thỏi 1 Lượng (37.5g)',
            slug: 'bac-thoi-1-luong',
            price: 2500000,
            description: 'Bạc nguyên chất 99.9 đúc thỏi trọng lượng 1 lượng',
            stock: 50,
            category: bacCategory.id,
            publishedAt: new Date()
        },
        {
            name: 'Nhẫn Bạc Ta Khảm Trai',
            slug: 'nhan-bac-ta-kham-trai',
            price: 650000,
            description: 'Nhẫn bạc ta 925 thủ công khảm xà cừ',
            stock: 40,
            category: bacCategory.id,
            publishedAt: new Date()
        },
        {
            name: 'Bộ Trang Sức Bạc Đính Ngọc Trai',
            slug: 'bo-trang-suc-bac-dinh-ngoc-trai',
            price: 1850000,
            description: 'Bộ trang sức bạc ghim ngọc trai thiên nhiên gồm dây chuyền và bông tai',
            stock: 20,
            category: bacCategory.id,
            publishedAt: new Date()
        },
        {
            name: 'Vòng Tay Bạc Nguyên Khối Chạm Rồng',
            slug: 'vong-tay-bac-nguyen-khoi-cham-rong',
            price: 3200000,
            description: 'Vòng tay bạc nguyên khối chạm khắc nổi hình rồng phượng',
            stock: 8,
            category: bacCategory.id,
            publishedAt: new Date()
        }
    ];

    console.log(`Ready to seed ${productsToSeed.length} products...`);

    for (const productData of productsToSeed) {
        try {
            const existing = await app.db.query('api::product.product').findOne({
                where: { slug: productData.slug }
            });

            if (!existing) {
                await app.db.query('api::product.product').create({
                    data: productData
                });
                console.log(`Created: ${productData.name}`);
            } else {
                console.log(`Skipped (already exists): ${productData.name}`);
            }
        } catch (err) {
            console.error(`Failed to create ${productData.name}:`, err.message);
        }
    }

    console.log('Finished seeding products!');
    process.exit(0);
}

seedMoreProducts().catch(err => {
    console.error(err);
    process.exit(1);
});
