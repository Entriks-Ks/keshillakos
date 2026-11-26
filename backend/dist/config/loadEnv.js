"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Must be the first import in src/index.ts: ES imports are hoisted, so env
// has to be loaded inside an imported module, not as a statement after imports.
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config({ override: true });
//# sourceMappingURL=loadEnv.js.map