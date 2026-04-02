export default {
    routes: [
        {
            method: 'POST',
            path: '/kyc/submit',
            handler: 'kyc.submit',
            config: {
                policies: [],
                middlewares: [],
            },
        },
        {
            method: 'POST',
            path: '/kyc/ocr',
            handler: 'kyc.ocr',
            config: {
                policies: [],
                middlewares: [],
            },
        },
        {
            method: 'POST',
            path: '/kyc/manual-submit',
            handler: 'kyc.manualSubmit',
            config: {
                policies: [],
                middlewares: [],
            },
        },
    ],
};
