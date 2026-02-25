/**
 * Property 1: Location Persistence (Round-Trip)
 *
 * For any GPS location obtained by the GeolocationService, if it is stored
 * in the local cache, then retrieving it later must return equivalent
 * coordinates (latitude, longitude, accuracy).
 *
 * **Validates: Requirements 1.5**
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { GeolocationService } from '@client/services/geolocation';
import { propertyTestConfig, geoPositionArb } from './generators';

/**
 * Helper to create a mock navigator.geolocation that returns
 * the given position when getCurrentPosition is called.
 */
function createGeolocationMock(positionFn: () => { coords: GeolocationCoordinates; timestamp: number }) {
  return {
    getCurrentPosition: (success: PositionCallback) => {
      success(positionFn() as GeolocationPosition);
    },
    watchPosition: () => 0,
    clearWatch: () => {},
  };
}

function toGeolocationResult(pos: { latitude: number; longitude: number; accuracy: number; timestamp: number }) {
  return {
    coords: {
      latitude: pos.latitude,
      longitude: pos.longitude,
      accuracy: pos.accuracy,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
    } as GeolocationCoordinates,
    timestamp: pos.timestamp,
  };
}

describe('Property 1: Location Persistence (Round-Trip)', () => {
  let originalNavigator: Navigator;

  beforeEach(() => {
    originalNavigator = globalThis.navigator;
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
  });

  /**
   * **Validates: Requirements 1.5**
   *
   * For any GeoPosition, if stored via getCurrentPosition() (which caches
   * the result in memory), then getLastKnownPosition() must return
   * equivalent latitude, longitude, accuracy, and timestamp.
   */
  it('should preserve latitude, longitude, accuracy, and timestamp on round-trip through cache', async () => {
    await fc.assert(
      fc.asyncProperty(geoPositionArb, async (position) => {
        const mockGeolocation = createGeolocationMock(() => toGeolocationResult(position));

        Object.defineProperty(globalThis, 'navigator', {
          value: { geolocation: mockGeolocation },
          writable: true,
          configurable: true,
        });

        const service = new GeolocationService();

        // Trigger caching by calling getCurrentPosition
        const obtained = await service.getCurrentPosition();

        // Retrieve from cache
        const cached = await service.getLastKnownPosition();

        // The cached position must not be null
        expect(cached).not.toBeNull();

        // Round-trip must preserve all fields
        expect(cached!.latitude).toBe(obtained.latitude);
        expect(cached!.longitude).toBe(obtained.longitude);
        expect(cached!.accuracy).toBe(obtained.accuracy);
        expect(cached!.timestamp).toBe(obtained.timestamp);

        // The obtained position must match the original input
        expect(obtained.latitude).toBe(position.latitude);
        expect(obtained.longitude).toBe(position.longitude);
        expect(obtained.accuracy).toBe(position.accuracy);
        expect(obtained.timestamp).toBe(position.timestamp);
      }),
      propertyTestConfig,
    );
  });

  /**
   * **Validates: Requirements 1.5**
   *
   * For any sequence of two GeoPositions obtained in order, the cache
   * should always reflect the most recent position.
   */
  it('should always cache the most recent position after multiple getCurrentPosition calls', async () => {
    await fc.assert(
      fc.asyncProperty(
        geoPositionArb,
        geoPositionArb,
        async (firstPosition, secondPosition) => {
          const positions = [firstPosition, secondPosition];
          let callIndex = 0;

          const mockGeolocation = {
            getCurrentPosition: (success: PositionCallback) => {
              const pos = positions[callIndex++];
              success(toGeolocationResult(pos) as GeolocationPosition);
            },
            watchPosition: () => 0,
            clearWatch: () => {},
          };

          Object.defineProperty(globalThis, 'navigator', {
            value: { geolocation: mockGeolocation },
            writable: true,
            configurable: true,
          });

          const service = new GeolocationService();

          // Get first position (caches it)
          await service.getCurrentPosition();

          // Get second position (should overwrite cache)
          await service.getCurrentPosition();

          // Cache should reflect the second (most recent) position
          const cached = await service.getLastKnownPosition();
          expect(cached).not.toBeNull();
          expect(cached!.latitude).toBe(secondPosition.latitude);
          expect(cached!.longitude).toBe(secondPosition.longitude);
          expect(cached!.accuracy).toBe(secondPosition.accuracy);
          expect(cached!.timestamp).toBe(secondPosition.timestamp);
        },
      ),
      propertyTestConfig,
    );
  });
});
