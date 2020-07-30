"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.error = exports.warn = exports.log = exports.setDebug = void 0;
let debug = false;
exports.setDebug = (value) => {
    debug = value;
};
const invoke = (methodName) => {
    return (...args) => {
        if (!debug) {
            return;
        }
        console[methodName](...args);
    };
};
exports.log = invoke('log');
exports.warn = invoke('warn');
exports.error = invoke('error');
