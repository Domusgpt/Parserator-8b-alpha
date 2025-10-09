import { CoreLogger, ParseratorTelemetry, ParseratorTelemetryEvent, ParseratorTelemetryListener } from './types';
export declare class TelemetryHub implements ParseratorTelemetry {
    private readonly logger?;
    private readonly listenersSet;
    constructor(listeners?: ParseratorTelemetryListener[], logger?: CoreLogger | undefined);
    emit(event: ParseratorTelemetryEvent): void;
    register(listener: ParseratorTelemetryListener): void;
    unregister(listener: ParseratorTelemetryListener): void;
    listeners(): ParseratorTelemetryListener[];
}
export declare function createTelemetryHub(input: ParseratorTelemetry | ParseratorTelemetryListener | ParseratorTelemetryListener[] | undefined, logger?: CoreLogger): ParseratorTelemetry;
//# sourceMappingURL=telemetry.d.ts.map