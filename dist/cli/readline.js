"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readline = void 0;
const rl = require("readline");
const reader = rl.createInterface({
    input: process.stdin,
    output: process.stdout,
});
exports.readline = (question) => {
    return new Promise(resolve => {
        reader.question(question, (answer) => resolve(answer));
    });
};
