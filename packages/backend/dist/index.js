"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const server_1 = __importDefault(require("./server"));
server_1.default.start().catch((error) => {
    console.error('❌ Failed to start Jabbr Trading Bot Server:', error);
    process.exit(1);
});
//# sourceMappingURL=index.js.map