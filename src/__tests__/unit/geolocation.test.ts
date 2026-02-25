/**
 * Unit tests for GeolocationService
 *
 * Tests cover:
 * - getCurrentPosition() with success and timeout scenarios
 * - watchPosition() callback invocation
 * - clearWatch() stops watching
 * - getLastKnownPosition() returns cached data
 * - geocodeAddress() stub behavior
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GeolocationService, GeolocationError, GeolocationErrorType } from '@client/services/geolocation';

// Mock navigator.geolocation
const mockGeolocation = {
  getCurrentPosition: vi.fn(),
  watchPosition: vi.fn(),
  clearWatch: vi.fn(),
};

beforeEach(() => {
  vi.useFakeTimers();
  Object.defineProperty(globalThis, 'navigator', {
    value: { geolocation: mockGeolocation },
    writable: true,
    configurable: true,
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('GeolocationService', () => {
  let service: GeolocationService;

  beforeEach(() => {
    service = new GeolocationService();
  });

  describe('getCurrentPosition()', () => {
    it('should resolve with GeoPosition on success', async () => {
      const mockCoords = {
        latitude: -23.5505,
        longitude: -46.6333,
        accuracy: 10,
      };

      mockGeolocation.getCurrentPosition.mockImplementation(
        (success: PositionCallback) => {
          success({
            coords: mockCoords,
            timestamp: 1000,
          } as GeolocationPosition);
        }
      );

      const position = await service.getCurrentPosition();

      expect(position).toEqual({
        latitude: -23.5505,
        longitude: -46.6333,
        accuracy: 10,
        timestamp: 1000,
      });
    });

    it('should reject when geolocation fails', async () => {
      mockGeolocation.getCurrentPosition.mockImplementation(
        (_success: PositionCallback, error: PositionErrorCallback) => {
          error({
            code: 1,
            message: 'User denied Geolocation',
            PERMISSION_DENIED: 1,
            POSITION_UNAVAILABLE: 2,
            TIMEOUT: 3,
          } as GeolocationPositionError);
        }
      );

      await expect(service.getCurrentPosition()).rejects.toThrow(
        'User denied Geolocation'
      );
    });

    it('should use a 3-second timeout option', async () => {
      mockGeolocation.getCurrentPosition.mockImplementation(
        (success: PositionCallback) => {
          success({
            coords: { latitude: 0, longitude: 0, accuracy: 100 },
            timestamp: Date.now(),
          } as GeolocationPosition);
        }
      );

      await service.getCurrentPosition();

      expect(mockGeolocation.getCurrentPosition).toHaveBeenCalledWith(
        expect.any(Function),
        expect.any(Function),
        expect.objectContaining({ timeout: 3000 })
      );
    });

    it('should cache the position in memory after success', async () => {
      const mockCoords = {
        latitude: -23.5505,
        longitude: -46.6333,
        accuracy: 10,
      };

      mockGeolocation.getCurrentPosition.mockImplementation(
        (success: PositionCallback) => {
          success({
            coords: mockCoords,
            timestamp: 2000,
          } as GeolocationPosition);
        }
      );

      await service.getCurrentPosition();

      const cached = await service.getLastKnownPosition();
      expect(cached).toEqual({
        latitude: -23.5505,
        longitude: -46.6333,
        accuracy: 10,
        timestamp: 2000,
      });
    });
  });

  describe('watchPosition()', () => {
    it('should call navigator.geolocation.watchPosition and return a watch id', () => {
      mockGeolocation.watchPosition.mockReturnValue(42);

      const callback = vi.fn();
      const watchId = service.watchPosition(callback);

      expect(watchId).toBe(42);
      expect(mockGeolocation.watchPosition).toHaveBeenCalledWith(
        expect.any(Function),
        expect.any(Function),
        expect.any(Object)
      );
    });

    it('should invoke callback with GeoPosition when position changes', () => {
      mockGeolocation.watchPosition.mockImplementation(
        (success: PositionCallback) => {
          success({
            coords: { latitude: -22.9068, longitude: -43.1729, accuracy: 15 },
            timestamp: 3000,
          } as GeolocationPosition);
          return 1;
        }
      );

      const callback = vi.fn();
      service.watchPosition(callback);

      expect(callback).toHaveBeenCalledWith({
        latitude: -22.9068,
        longitude: -43.1729,
        accuracy: 15,
        timestamp: 3000,
      });
    });

    it('should cache position from watch updates', async () => {
      mockGeolocation.watchPosition.mockImplementation(
        (success: PositionCallback) => {
          success({
            coords: { latitude: -15.7801, longitude: -47.9292, accuracy: 20 },
            timestamp: 4000,
          } as GeolocationPosition);
          return 1;
        }
      );

      const callback = vi.fn();
      service.watchPosition(callback);

      const cached = await service.getLastKnownPosition();
      expect(cached).toEqual({
        latitude: -15.7801,
        longitude: -47.9292,
        accuracy: 20,
        timestamp: 4000,
      });
    });
  });

  describe('clearWatch()', () => {
    it('should call navigator.geolocation.clearWatch with the watch id', () => {
      service.clearWatch(42);

      expect(mockGeolocation.clearWatch).toHaveBeenCalledWith(42);
    });
  });

  describe('getLastKnownPosition()', () => {
    it('should return null when no position has been cached', async () => {
      const position = await service.getLastKnownPosition();
      expect(position).toBeNull();
    });

    it('should return the last cached position from getCurrentPosition', async () => {
      mockGeolocation.getCurrentPosition.mockImplementation(
        (success: PositionCallback) => {
          success({
            coords: { latitude: -3.1190, longitude: -60.0217, accuracy: 5 },
            timestamp: 5000,
          } as GeolocationPosition);
        }
      );

      await service.getCurrentPosition();

      const cached = await service.getLastKnownPosition();
      expect(cached).toEqual({
        latitude: -3.1190,
        longitude: -60.0217,
        accuracy: 5,
        timestamp: 5000,
      });
    });
  });

  describe('geocodeAddress()', () => {
    it('should throw "Not implemented" for now', async () => {
      await expect(service.geocodeAddress('01001-000')).rejects.toThrow(
        'Not implemented'
      );
    });
  });

  describe('GeolocationError typed errors', () => {
    it('should throw GeolocationError with type PERMISSION_DENIED when permission is denied', async () => {
      mockGeolocation.getCurrentPosition.mockImplementation(
        (_success: PositionCallback, error: PositionErrorCallback) => {
          error({
            code: 1,
            message: 'User denied Geolocation',
            PERMISSION_DENIED: 1,
            POSITION_UNAVAILABLE: 2,
            TIMEOUT: 3,
          } as GeolocationPositionError);
        }
      );

      try {
        await service.getCurrentPosition();
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(GeolocationError);
        const geoErr = err as GeolocationError;
        expect(geoErr.type).toBe('PERMISSION_DENIED');
        expect(geoErr.code).toBe(1);
        expect(geoErr.message).toBe('User denied Geolocation');
      }
    });

    it('should throw GeolocationError with type POSITION_UNAVAILABLE when position is unavailable', async () => {
      mockGeolocation.getCurrentPosition.mockImplementation(
        (_success: PositionCallback, error: PositionErrorCallback) => {
          error({
            code: 2,
            message: 'Position unavailable',
            PERMISSION_DENIED: 1,
            POSITION_UNAVAILABLE: 2,
            TIMEOUT: 3,
          } as GeolocationPositionError);
        }
      );

      try {
        await service.getCurrentPosition();
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(GeolocationError);
        const geoErr = err as GeolocationError;
        expect(geoErr.type).toBe('POSITION_UNAVAILABLE');
        expect(geoErr.code).toBe(2);
      }
    });

    it('should throw GeolocationError with type TIMEOUT when request times out', async () => {
      mockGeolocation.getCurrentPosition.mockImplementation(
        (_success: PositionCallback, error: PositionErrorCallback) => {
          error({
            code: 3,
            message: 'Timeout expired',
            PERMISSION_DENIED: 1,
            POSITION_UNAVAILABLE: 2,
            TIMEOUT: 3,
          } as GeolocationPositionError);
        }
      );

      try {
        await service.getCurrentPosition();
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(GeolocationError);
        const geoErr = err as GeolocationError;
        expect(geoErr.type).toBe('TIMEOUT');
        expect(geoErr.code).toBe(3);
      }
    });

    it('should throw GeolocationError with type UNKNOWN for unrecognized error codes', async () => {
      mockGeolocation.getCurrentPosition.mockImplementation(
        (_success: PositionCallback, error: PositionErrorCallback) => {
          error({
            code: 99,
            message: 'Something weird happened',
            PERMISSION_DENIED: 1,
            POSITION_UNAVAILABLE: 2,
            TIMEOUT: 3,
          } as GeolocationPositionError);
        }
      );

      try {
        await service.getCurrentPosition();
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(GeolocationError);
        const geoErr = err as GeolocationError;
        expect(geoErr.type).toBe('UNKNOWN');
        expect(geoErr.code).toBe(99);
      }
    });
  });

  describe('getCurrentPositionWithFallback()', () => {
    it('should return position from getCurrentPosition on success', async () => {
      mockGeolocation.getCurrentPosition.mockImplementation(
        (success: PositionCallback) => {
          success({
            coords: { latitude: -23.5505, longitude: -46.6333, accuracy: 10 },
            timestamp: 1000,
          } as GeolocationPosition);
        }
      );

      const position = await service.getCurrentPositionWithFallback();
      expect(position).toEqual({
        latitude: -23.5505,
        longitude: -46.6333,
        accuracy: 10,
        timestamp: 1000,
      });
    });

    it('should return cached position on TIMEOUT when cache is available', async () => {
      // First, populate the cache
      mockGeolocation.getCurrentPosition.mockImplementationOnce(
        (success: PositionCallback) => {
          success({
            coords: { latitude: -22.9068, longitude: -43.1729, accuracy: 15 },
            timestamp: 2000,
          } as GeolocationPosition);
        }
      );
      await service.getCurrentPosition();

      // Now simulate a TIMEOUT
      mockGeolocation.getCurrentPosition.mockImplementationOnce(
        (_success: PositionCallback, error: PositionErrorCallback) => {
          error({
            code: 3,
            message: 'Timeout expired',
            PERMISSION_DENIED: 1,
            POSITION_UNAVAILABLE: 2,
            TIMEOUT: 3,
          } as GeolocationPositionError);
        }
      );

      const position = await service.getCurrentPositionWithFallback();
      expect(position).toEqual({
        latitude: -22.9068,
        longitude: -43.1729,
        accuracy: 15,
        timestamp: 2000,
      });
    });

    it('should return cached position on POSITION_UNAVAILABLE when cache is available', async () => {
      // Populate cache
      mockGeolocation.getCurrentPosition.mockImplementationOnce(
        (success: PositionCallback) => {
          success({
            coords: { latitude: -15.7801, longitude: -47.9292, accuracy: 20 },
            timestamp: 3000,
          } as GeolocationPosition);
        }
      );
      await service.getCurrentPosition();

      // Simulate POSITION_UNAVAILABLE
      mockGeolocation.getCurrentPosition.mockImplementationOnce(
        (_success: PositionCallback, error: PositionErrorCallback) => {
          error({
            code: 2,
            message: 'Position unavailable',
            PERMISSION_DENIED: 1,
            POSITION_UNAVAILABLE: 2,
            TIMEOUT: 3,
          } as GeolocationPositionError);
        }
      );

      const position = await service.getCurrentPositionWithFallback();
      expect(position).toEqual({
        latitude: -15.7801,
        longitude: -47.9292,
        accuracy: 20,
        timestamp: 3000,
      });
    });

    it('should throw on TIMEOUT when no cached position is available', async () => {
      mockGeolocation.getCurrentPosition.mockImplementation(
        (_success: PositionCallback, error: PositionErrorCallback) => {
          error({
            code: 3,
            message: 'Timeout expired',
            PERMISSION_DENIED: 1,
            POSITION_UNAVAILABLE: 2,
            TIMEOUT: 3,
          } as GeolocationPositionError);
        }
      );

      try {
        await service.getCurrentPositionWithFallback();
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(GeolocationError);
        expect((err as GeolocationError).type).toBe('TIMEOUT');
      }
    });

    it('should always throw on PERMISSION_DENIED even when cache is available', async () => {
      // Populate cache first
      mockGeolocation.getCurrentPosition.mockImplementationOnce(
        (success: PositionCallback) => {
          success({
            coords: { latitude: -23.5505, longitude: -46.6333, accuracy: 10 },
            timestamp: 1000,
          } as GeolocationPosition);
        }
      );
      await service.getCurrentPosition();

      // Simulate PERMISSION_DENIED
      mockGeolocation.getCurrentPosition.mockImplementationOnce(
        (_success: PositionCallback, error: PositionErrorCallback) => {
          error({
            code: 1,
            message: 'User denied Geolocation',
            PERMISSION_DENIED: 1,
            POSITION_UNAVAILABLE: 2,
            TIMEOUT: 3,
          } as GeolocationPositionError);
        }
      );

      try {
        await service.getCurrentPositionWithFallback();
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(GeolocationError);
        expect((err as GeolocationError).type).toBe('PERMISSION_DENIED');
      }
    });
  });
});
