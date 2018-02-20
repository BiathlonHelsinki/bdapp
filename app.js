"use strict";
// Basic structure for the app is similar to this
// https://gist.github.com/romelgomez/3c1776fab4192c7687883c1a2b972c8c
Object.defineProperty(exports, "__esModule", { value: true });
const server = require("./server");
exports.default = new server.App().server;
