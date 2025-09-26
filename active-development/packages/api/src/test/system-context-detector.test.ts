import { SystemContextDetector } from '../services/system-context-detector';

const sampleEcommerceEmail = `
  Order Confirmation
  Order ID: 12345
  Product SKU: ABC-123
  Your shipment will be delivered by UPS.
`;

describe('SystemContextDetector', () => {
  let detector: SystemContextDetector;

  beforeEach(() => {
    detector = new SystemContextDetector();
  });

  it('classifies ecommerce scenarios using multiple signal sources', () => {
    const result = detector.detect({
      schemaFields: ['orderId', 'sku', 'shipping.carrier'],
      instructions: 'Extract the order details for the customer invoice',
      sample: sampleEcommerceEmail,
      domainHints: ['Shopify fulfillment workflow'],
      systemContextHint: undefined
    });

    expect(result.type).toBe('ecommerce');
    expect(result.confidence).toBeGreaterThan(0.5);
    expect(result.summary).toContain('e-commerce');
    expect(result.signals.some(signal => signal.startsWith('schema:sku'))).toBe(true);
    expect(result.metrics.rawScore).toBeGreaterThan(0);
    expect(result.metrics.domainHintMatches).toBeGreaterThan(0);
    expect(result.metrics.domainHintsProvided).toBe(1);
    expect(result.metrics.sourceBreakdown.schema).toBeGreaterThan(0);
    expect(result.metrics.explicitHintProvided).toBe(false);
  });

  it('falls back to generic when evidence is ambiguous', () => {
    const ambiguousSample = `
      Customer shipment created for consolidated order.
      Sync this update to the CRM while finalizing the delivery manifest.
    `;

    const result = detector.detect({
      schemaFields: ['customerId', 'shipmentId'],
      instructions: 'Coordinate CRM follow-up and delivery scheduling',
      sample: ambiguousSample,
      domainHints: [],
      systemContextHint: undefined
    });

    expect(result.type).toBe('generic');
    expect(result.summary).toContain('Signals were too evenly');
    expect(result.metrics.ambiguous).toBe(true);
    expect(result.metrics.lowConfidenceFallback).toBe(false);
    expect(result.metrics.topCandidateType).toBeDefined();
  });

  it('respects provided hints when keywords are absent', () => {
    const result = detector.detect({
      schemaFields: ['trackingId'],
      instructions: 'Map to the fulfillment integration',
      sample: 'ID: 999-XYZ',
      domainHints: ['Logistics operations dashboard'],
      systemContextHint: 'logistics'
    });

    expect(result.type).toBe('logistics');
    expect(result.confidence).toBeGreaterThan(0.4);
    expect(result.signals.some(signal => signal.includes('hint'))).toBe(true);
    expect(result.alternatives).toBeDefined();
    expect(Array.isArray(result.alternatives)).toBe(true);
    expect(result.metrics.explicitHintProvided).toBe(true);
    expect(result.metrics.explicitHintMatchedFinalContext).toBe(true);
    expect(result.metrics.topCandidateHintBoosted).toBe(true);
    expect(result.metrics.domainHintMatches).toBeGreaterThan(0);
  });
});
