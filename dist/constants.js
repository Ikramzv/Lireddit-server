"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FORGET_PASSWORD_PREFIX = exports.SESSION_SECRET = exports.COOKIE_NAME = exports.__prod__ = void 0;
exports.__prod__ = process.env.NODE_ENV !== 'production';
exports.COOKIE_NAME = 'qid';
exports.SESSION_SECRET = 'doqfksfsdcikccdcosdvmdsovn';
exports.FORGET_PASSWORD_PREFIX = 'forget-password:';
