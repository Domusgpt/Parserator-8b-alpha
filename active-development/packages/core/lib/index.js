"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ParseratorCore = void 0;
const uuid_1 = require("uuid");
const default_kernel_1 = require("./presets/default-kernel");
__exportStar(require("./types"), exports);
__exportStar(require("./kernel/agentic-kernel"), exports);
__exportStar(require("./modules/architect-module"), exports);
__exportStar(require("./modules/extractor-module"), exports);
function normaliseInvocation(request, invocation) {
    const now = new Date();
    return {
        ...request,
        requestId: invocation?.requestId ?? (0, uuid_1.v4)(),
        createdAt: now.toISOString(),
        invokedBy: invocation?.invokedBy ?? 'sdk',
        tenantId: invocation?.tenantId,
        metadata: {
            ...invocation?.metadata,
            requestedOptions: request.options
        }
    };
}
class ParseratorCore {
    constructor(options) {
        this.currentOptions = options;
        this.kernel = (0, default_kernel_1.createDefaultKernel)(options);
    }
    /**
     * Rebuild the kernel with a new configuration without changing the API key.
     */
    reconfigure(config) {
        this.currentOptions = {
            ...this.currentOptions,
            config: {
                ...this.currentOptions.config,
                ...config
            }
        };
        this.kernel = (0, default_kernel_1.createDefaultKernel)(this.currentOptions);
    }
    /**
     * Execute the architect-extractor pipeline via the agentic kernel.
     */
    async parse(request, invocation) {
        const job = normaliseInvocation(request, invocation);
        const summary = await this.kernel.run(job);
        return summary.response;
    }
    /**
     * Expose the underlying kernel for advanced composition or module injection.
     */
    getKernel() {
        return this.kernel;
    }
}
exports.ParseratorCore = ParseratorCore;
//# sourceMappingURL=index.js.map