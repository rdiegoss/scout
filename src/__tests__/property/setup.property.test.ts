import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { propertyTestConfig, geoPositionArb, serviceCategoryArb } from './generators';

describe('Property Test Infrastructure', () => {
  it('should run property-based tests with fast-check', () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer(), (a, b) => {
        expect(a + b).toBe(b + a);
      }),
      propertyTestConfig,
    );
  });

  it('should generate valid GeoPosition values', () => {
    fc.assert(
      fc.property(geoPositionArb, (pos) => {
        expect(pos.latitude).toBeGreaterThanOrEqual(-90);
        expect(pos.latitude).toBeLessThanOrEqual(90);
        expect(pos.longitude).toBeGreaterThanOrEqual(-180);
        expect(pos.longitude).toBeLessThanOrEqual(180);
        expect(pos.accuracy).toBeGreaterThanOrEqual(1);
        expect(pos.timestamp).toBeGreaterThanOrEqual(0);
      }),
      propertyTestConfig,
    );
  });

  it('should generate valid ServiceCategory values', () => {
    const validCategories = [
      'reparos_domesticos',
      'servicos_pessoais',
      'automotivo',
      'construcao',
      'outros',
    ];
    fc.assert(
      fc.property(serviceCategoryArb, (category) => {
        expect(validCategories).toContain(category);
      }),
      propertyTestConfig,
    );
  });
});
