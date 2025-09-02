/**
 * Pre-built parsing presets and templates for common use cases
 */
import { ParsePreset } from './index';
export declare const EMAIL_PARSER: ParsePreset;
export declare const INVOICE_PARSER: ParsePreset;
export declare const CONTACT_PARSER: ParsePreset;
export declare const CSV_PARSER: ParsePreset;
export declare const LOG_PARSER: ParsePreset;
export declare const DOCUMENT_PARSER: ParsePreset;
export declare const ALL_PRESETS: Record<string, ParsePreset>;
export declare function getPresetByName(name: string): ParsePreset | undefined;
export declare function getPresetsByTag(tag: string): ParsePreset[];
export declare function listAvailablePresets(): string[];
//# sourceMappingURL=presets.d.ts.map