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
    ],
};
