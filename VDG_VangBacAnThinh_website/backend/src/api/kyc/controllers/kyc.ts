export default {
    async submit(ctx) {
        try {
            const user = ctx.state.user;
            if (!user) {
                return ctx.unauthorized('Vui lòng đăng nhập.');
            }

            const { images } = ctx.request.body;
            if (!images || !Array.isArray(images) || images.length === 0) {
                return ctx.badRequest('Vui lòng cung cấp ít nhất một hình ảnh CMND/CCCD.');
            }

            // Update user with kycImages & kycStatus
            const updatedUser = await strapi.entityService.update('plugin::users-permissions.user', user.id, {
                data: {
                    kycStatus: 'pending',
                    kycImages: images, // Array of media IDs
                } as any,
            });

            return ctx.send({ message: 'Đã gửi hồ sơ xác minh', user: updatedUser });
        } catch (err) {
            ctx.throw(500, err);
        }
    },

    // OCR endpoint: upload CCCD image -> extract info -> auto-fill + set KYC verified
    async ocr(ctx) {
        try {
            const user = ctx.state.user;
            if (!user) {
                return ctx.unauthorized('Vui lòng đăng nhập.');
            }

            const { imageId, side } = ctx.request.body;
            // side: 'front' or 'back'

            if (!imageId) {
                return ctx.badRequest('Vui lòng cung cấp hình ảnh CCCD.');
            }

            // Get the uploaded file info
            const file = await strapi.db.query('plugin::upload.file').findOne({ where: { id: imageId } });
            if (!file) {
                return ctx.badRequest('Không tìm thấy hình ảnh.');
            }

            // Try FPT.AI eKYC OCR
            const fptApiKey = process.env.FPT_AI_API_KEY || '';
            let ocrData: any = null;

            if (fptApiKey) {
                ocrData = await callFptOcr(file.url, fptApiKey, side || 'front');
            }

            // If no FPT key or OCR failed, try basic extraction from filename/metadata
            // In production, you MUST use a real OCR service
            if (!ocrData) {
                strapi.log.warn('[kyc-ocr] No FPT_AI_API_KEY set or OCR failed. Using placeholder.');
                // Return empty so frontend can handle manual input
                return ctx.send({
                    success: false,
                    message: 'OCR service không khả dụng. Vui lòng nhập thông tin thủ công.',
                    data: {},
                });
            }

            // Update user with extracted data
            const updateData: any = { kycImages: [imageId] };

            if (ocrData.id) updateData.cccdNumber = ocrData.id;
            if (ocrData.name) updateData.fullName = ocrData.name;
            if (ocrData.dob) updateData.dateOfBirth = ocrData.dob;
            if (ocrData.sex) updateData.gender = ocrData.sex;
            if (ocrData.home) updateData.placeOfOrigin = ocrData.home;
            if (ocrData.address) updateData.placeOfResidence = ocrData.address;
            if (ocrData.doe) updateData.cccdExpiry = ocrData.doe;

            // Auto-verify since OCR successfully extracted data
            updateData.kycStatus = 'verified';

            const updatedUser = await strapi.entityService.update('plugin::users-permissions.user', user.id, {
                data: updateData as any,
            });

            return ctx.send({
                success: true,
                message: 'Xác minh CCCD thành công!',
                data: ocrData,
                user: {
                    id: updatedUser.id,
                    fullName: updatedUser.fullName,
                    phone: updatedUser.phone,
                    kycStatus: updatedUser.kycStatus,
                    cccdNumber: (updatedUser as any).cccdNumber,
                    dateOfBirth: (updatedUser as any).dateOfBirth,
                    gender: (updatedUser as any).gender,
                    placeOfOrigin: (updatedUser as any).placeOfOrigin,
                    placeOfResidence: (updatedUser as any).placeOfResidence,
                    cccdExpiry: (updatedUser as any).cccdExpiry,
                },
            });
        } catch (err) {
            strapi.log.error('[kyc-ocr] Error:', err);
            ctx.throw(500, err);
        }
    },

    // Manual KYC submit with extracted data (when OCR not available)
    async manualSubmit(ctx) {
        try {
            const user = ctx.state.user;
            if (!user) {
                return ctx.unauthorized('Vui lòng đăng nhập.');
            }

            const { cccdNumber, fullName, dateOfBirth, gender, placeOfOrigin, placeOfResidence, cccdExpiry, images } = ctx.request.body;

            if (!cccdNumber || !fullName) {
                return ctx.badRequest('Vui lòng nhập số CCCD và họ tên.');
            }

            const updateData: any = {
                kycStatus: 'pending',
                cccdNumber,
                fullName,
            };

            if (dateOfBirth) updateData.dateOfBirth = dateOfBirth;
            if (gender) updateData.gender = gender;
            if (placeOfOrigin) updateData.placeOfOrigin = placeOfOrigin;
            if (placeOfResidence) updateData.placeOfResidence = placeOfResidence;
            if (cccdExpiry) updateData.cccdExpiry = cccdExpiry;
            if (images?.length) updateData.kycImages = images;

            const updatedUser = await strapi.entityService.update('plugin::users-permissions.user', user.id, {
                data: updateData as any,
            });

            return ctx.send({
                success: true,
                message: 'Đã gửi thông tin xác minh.',
                user: {
                    id: updatedUser.id,
                    fullName: updatedUser.fullName,
                    phone: updatedUser.phone,
                    kycStatus: updatedUser.kycStatus,
                    cccdNumber: (updatedUser as any).cccdNumber,
                    dateOfBirth: (updatedUser as any).dateOfBirth,
                    gender: (updatedUser as any).gender,
                    placeOfOrigin: (updatedUser as any).placeOfOrigin,
                    placeOfResidence: (updatedUser as any).placeOfResidence,
                    cccdExpiry: (updatedUser as any).cccdExpiry,
                },
            });
        } catch (err) {
            ctx.throw(500, err);
        }
    },
};

// FPT.AI eKYC OCR helper - reads file from disk and sends to FPT API
async function callFptOcr(filePath: string, apiKey: string, side: string): Promise<any> {
    const fs = require('fs');
    const path = require('path');

    try {
        // Read file from disk
        const fullPath = path.join(strapi.dirs.static.public, '..', 'public', filePath);

        // Try multiple possible paths
        const possiblePaths = [
            path.resolve(process.cwd(), 'public', filePath.replace(/^\//, '')),
            path.resolve(process.cwd(), 'public/uploads', path.basename(filePath)),
        ];

        let fileBuffer: Buffer | null = null;
        for (const p of possiblePaths) {
            try {
                if (fs.existsSync(p)) {
                    fileBuffer = fs.readFileSync(p);
                    strapi.log.info(`[kyc-ocr] Read file from: ${p} (${fileBuffer.length} bytes)`);
                    break;
                }
            } catch {}
        }

        if (!fileBuffer) {
            strapi.log.error(`[kyc-ocr] Could not find file: ${filePath}`);
            return null;
        }

        // Send to FPT.AI using multipart form
        const boundary = '----FormBoundary' + Date.now().toString(36);
        const fileName = path.basename(filePath);

        const bodyParts = [
            `--${boundary}\r\n`,
            `Content-Disposition: form-data; name="image"; filename="${fileName}"\r\n`,
            `Content-Type: image/jpeg\r\n\r\n`,
        ];

        const header = Buffer.from(bodyParts.join(''));
        const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
        const body = Buffer.concat([header, fileBuffer, footer]);

        const endpoint = 'https://api.fpt.ai/vision/idr/vnm';

        const res = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'api-key': apiKey,
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
            },
            body: body,
        });

        const text = await res.text();
        strapi.log.info(`[kyc-ocr] FPT response status: ${res.status}`);
        strapi.log.info(`[kyc-ocr] FPT response: ${text.substring(0, 500)}`);

        if (!res.ok) return null;

        const json = JSON.parse(text);
        if (json.errorCode !== 0 || !json.data?.length) return null;

        const d = json.data[0];
        return {
            id: d.id || '',
            name: d.name || '',
            dob: d.dob || '',
            sex: d.sex || '',
            nationality: d.nationality || '',
            home: d.home || d.origin_location || '',
            address: d.address || d.recent_location || '',
            doe: d.doe || d.expiry || '',
            type: d.type || '',
        };
    } catch (err) {
        strapi.log.error(`[kyc-ocr] FPT OCR error:`, err);
        return null;
    }
}
