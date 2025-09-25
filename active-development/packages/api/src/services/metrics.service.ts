/**
 * Metrics utilities for tracking Parserator parse operations.
 * Provides structured events that downstream systems can ship to observability stacks.
 */

import { ISystemContext, SystemContextType } from '../interfaces/search-plan.interface';

/** Supported event types emitted by the parse service. */
export type ParseMetricsEventType =
  | 'parse_start'
  | 'parse_stage'
  | 'parse_complete'
  | 'parse_failure';

/** Base shape shared by all parse metrics events. */
export interface ParseMetricsEventBase {
  /** Unique identifier for the parse operation. */
  requestId: string;
  /** Optional user identifier for correlating to billing or tenancy. */
  userId?: string;
  /** ISO timestamp for when the event was recorded. */
  timestamp: string;
  /** Type discriminator describing the event payload. */
  eventType: ParseMetricsEventType;
}

/** Event captured when a parse request is accepted. */
export interface ParseStartEvent extends ParseMetricsEventBase {
  eventType: 'parse_start';
  inputLength: number;
  schemaFieldCount: number;
  hasInstructions: boolean;
  /** Hint provided by the client for downstream system context. */
  systemContextHint?: SystemContextType;
  /** Additional keywords supplied by the client for context detection. */
  domainHintCount: number;
}

/** Event captured when a specific stage (Architect/Extractor) finishes. */
export interface ParseStageEvent extends ParseMetricsEventBase {
  eventType: 'parse_stage';
  stage: 'architect' | 'extractor';
  success: boolean;
  tokensUsed: number;
  processingTimeMs: number;
  /** Confidence reported by the stage if available. */
  confidence?: number;
  /** Error code supplied by the stage failure. */
  errorCode?: string;
}

/** Event captured when the entire parse flow completes successfully. */
export interface ParseCompleteEvent extends ParseMetricsEventBase {
  eventType: 'parse_complete';
  success: true;
  tokensUsed: number;
  processingTimeMs: number;
  confidence: number;
  systemContext: ISystemContext;
}

/** Event captured when the parse flow fails before completion. */
export interface ParseFailureEvent extends ParseMetricsEventBase {
  eventType: 'parse_failure';
  success: false;
  stage: 'validation' | 'architect' | 'extractor' | 'orchestration';
  errorCode: string;
  processingTimeMs: number;
  systemContext: ISystemContext;
}

export type ParseMetricsEvent =
  | ParseStartEvent
  | ParseStageEvent
  | ParseCompleteEvent
  | ParseFailureEvent;

/** Minimal contract for a metrics recorder implementation. */
export interface IParseMetricsRecorder {
  record(event: ParseMetricsEvent): void;
}

/** In-memory recorder used primarily for tests. */
export class InMemoryParseMetricsRecorder implements IParseMetricsRecorder {
  private events: ParseMetricsEvent[] = [];

  record(event: ParseMetricsEvent): void {
    this.events.push(event);
  }

  /** Retrieve the captured events. */
  getEvents(): ParseMetricsEvent[] {
    return [...this.events];
  }

  /** Reset the captured events. */
  reset(): void {
    this.events = [];
  }
}

/** Recorder that forwards events to the console with consistent formatting. */
export class ConsoleParseMetricsRecorder implements IParseMetricsRecorder {
  constructor(private logger: Console = console) {}

  record(event: ParseMetricsEvent): void {
    const { eventType, ...payload } = event;
    this.logger.info(`[metrics:${eventType}]`, payload);
  }
}
