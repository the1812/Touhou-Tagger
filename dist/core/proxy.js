"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultsToEmptyString = void 0;
const defaultsToEmptyString = (obj) => {
    return new Proxy(obj, {
        get(target, prop, ...args) {
            if (prop in target) {
                return Reflect.get(target, prop, ...args);
            }
            return '';
        }
    });
};
exports.defaultsToEmptyString = defaultsToEmptyString;
