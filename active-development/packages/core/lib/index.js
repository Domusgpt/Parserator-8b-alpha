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
exports.ParseratorCore = exports.ParseratorSession = exports.createDefaultResolvers = exports.ResolverRegistry = exports.RegexExtractor = exports.HeuristicArchitect = void 0;
const uuid_1 = require("uuid");
const architect_1 = require("./architect");
Object.defineProperty(exports, "HeuristicArchitect", { enumerable: true, get: function () { return architect_1.HeuristicArchitect; } });
const extractor_1 = require("./extractor");
Object.defineProperty(exports, "RegexExtractor", { enumerable: true, get: function () { return extractor_1.RegexExtractor; } });
const logger_1 = require("./logger");
const resolvers_1 = require("./resolvers");
Object.defineProperty(exports, "createDefaultResolvers", { enumerable: true, get: function () { return resolvers_1.createDefaultResolvers; } });
Object.defineProperty(exports, "ResolverRegistry", { enumerable: true, get: function () { return resolvers_1.ResolverRegistry; } });
const session_1 = require("./session");
Object.defineProperty(exports, "ParseratorSession", { enumerable: true, get: function () { return session_1.ParseratorSession; } });
__exportStar(require("./types"), exports);
const DEFAULT_CONFIG = {
    maxInputLength: 120000,
    maxSchemaFields: 64,
    minConfidence: 0.55,
    defaultStrategy: 'sequential',
    enableFieldFallbacks: true
};
const DEFAULT_LOGGER = (0, logger_1.createDefaultLogger)();
class ParseratorCore {
    constructor(options) {
        if (!options?.apiKey || options.apiKey.trim().length === 0) {
            throw new Error('ParseratorCore requires a non-empty apiKey');
        }
        this.apiKey = options.apiKey;
        this.config = { ...DEFAULT_CONFIG, ...options.config };
        this.logger = options.logger ?? DEFAULT_LOGGER;
        const initialResolvers = options.resolvers ?? (0, resolvers_1.createDefaultResolvers)(this.logger);
        this.resolverRegistry = new resolvers_1.ResolverRegistry(initialResolvers, this.logger);
        this.architect = options.architect ?? new architect_1.HeuristicArchitect(this.logger);
        const extractor = options.extractor ?? new extractor_1.RegexExtractor(this.logger, this.resolverRegistry);
        this.attachRegistryIfSupported(extractor);
        this.extractor = extractor;
        this.observers = new Set(options.observers ?? []);
    }
    updateConfig(partial) {
        this.config = { ...this.config, ...partial };
        this.logger.info?.('parserator-core:config-updated', { config: this.config });
    }
    getConfig() {
        return { ...this.config };
    }
    setArchitect(agent) {
        this.architect = agent;
    }
    setExtractor(agent) {
        this.attachRegistryIfSupported(agent);
        this.extractor = agent;
    }
    registerResolver(resolver, position = 'append') {
        this.resolverRegistry.register(resolver, position);
        this.logger.info?.('parserator-core:resolver-registered', {
            resolver: resolver.name,
            position
        });
    }
    replaceResolvers(resolvers) {
        this.resolverRegistry.replaceAll(resolvers);
        this.logger.info?.('parserator-core:resolvers-replaced', {
            resolvers: resolvers.map(resolver => resolver.name)
        });
    }
    listResolvers() {
        return this.resolverRegistry.listResolvers();
    }
    async parse(request) {
        const session = this.createSession(request);
        return session.run();
    }
    createSession(request, sessionId) {
        const session = new session_1.ParseratorSession({
            requestId: sessionId ?? (0, uuid_1.v4)(),
            request,
            config: { ...this.config },
            architect: this.architect,
            extractor: this.extractor,
            logger: this.logger,
            notify: event => this.dispatch(event)
        });
        return session;
    }
    addObserver(observer) {
        this.observers.add(observer);
        return () => this.removeObserver(observer);
    }
    removeObserver(observer) {
        this.observers.delete(observer);
    }
    clearObservers() {
        this.observers.clear();
    }
    getObservers() {
        return Array.from(this.observers);
    }
    attachRegistryIfSupported(agent) {
        if (typeof agent?.attachRegistry === 'function') {
            agent.attachRegistry(this.resolverRegistry);
        }
    }
    async dispatch(event) {
        for (const observer of this.observers) {
            try {
                await observer(event);
            }
            catch (error) {
                this.logger.warn?.('parserator-core:observer-error', {
                    event: event.type,
                    message: error instanceof Error ? error.message : String(error)
                });
            }
        }
    }
}
exports.ParseratorCore = ParseratorCore;
//# sourceMappingURL=index.js.map