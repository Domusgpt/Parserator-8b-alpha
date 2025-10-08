"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDefaultKernel = createDefaultKernel;
const agentic_kernel_1 = require("../kernel/agentic-kernel");
const architect_module_1 = require("../modules/architect-module");
const extractor_module_1 = require("../modules/extractor-module");
function createDefaultKernel(options) {
    const kernel = new agentic_kernel_1.AgenticKernel(options.config, options.logger ?? console);
    kernel.registerModule(new architect_module_1.DefaultArchitectModule());
    kernel.registerModule(new extractor_module_1.DefaultExtractorModule());
    return kernel;
}
//# sourceMappingURL=default-kernel.js.map