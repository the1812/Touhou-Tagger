"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetSpinner = async () => {
    const ora = await Promise.resolve().then(() => require('ora'));
    exports.spinner = ora({
        text: '搜索中',
        spinner: {
            interval: 500,
            frames: ['.  ', '.. ', '...']
        }
    }).start();
};
