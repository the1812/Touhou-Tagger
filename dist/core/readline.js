"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.readline = void 0;
const readline_1 = __importDefault(require("readline"));
const reader = readline_1.default.createInterface({
    input: process.stdin,
    output: process.stdout,
});
const readline = (question) => {
    return new Promise(resolve => {
        reader.question(question, (answer) => resolve(answer));
    });
};
exports.readline = readline;
