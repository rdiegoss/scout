import type { GeoPosition } from '@shared/types';

export type WatchId = number;

export type GeolocationErrorType =
  | 'PERMISSION_DENIED'
  | 'POSITION_UNAVAILABLE'
  | 'TIMEOUT'
  | 'UNKNOWN';

export class GeolocationError extends Error {
  public readonly type: GeolocationErrorType;
  public readonly code: number;

  constructor(error: GeolocationPositionError) {
    super(error.message);
    this.name = 'GeolocationError';
    this.code = error.code;
    this.type = GeolocationError.mapCode(error.code);
  }

  private static mapCode(code: number): GeolocationErrorType {
    switch (code) {
      case 1:
        return 'PERMISSION_DENIED';
      case 2:
        return 'POSITION_UNAVAILABLE';
      case 3:
        return 'TIMEOUT';
      default:
        return 'UNKNOWN';
    }
  }
}

export class GeolocationService {
  private cachedPosition: GeoPosition | null = null;

  getCurrentPosition(): Promise<GeoPosition> {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position: GeolocationPosition) => {
          const geoPos = this.toGeoPosition(position);
          this.cachedPosition = geoPos;
          resolve(geoPos);
        },
        (error: GeolocationPositionError) => {
          reject(new GeolocationError(error));
        },
        {
          enableHighAccuracy: true,
          timeout: 3000,
          maximumAge: 0,
        }
      );
    });
  }

  watchPosition(callback: (position: GeoPosition) => void): WatchId {
    return navigator.geolocation.watchPosition(
      (position: GeolocationPosition) => {
        const geoPos = this.toGeoPosition(position);
        this.cachedPosition = geoPos;
        callback(geoPos);
      },
      () => {
      },
      {
        enableHighAccuracy: true,
        maximumAge: 300000, // 5 minutes
      }
    );
  }

  clearWatch(watchId: WatchId): void {
    navigator.geolocation.clearWatch(watchId);
  }

  async getLastKnownPosition(): Promise<GeoPosition | null> {
    return this.cachedPosition;
  }

  async geocodeAddress(_address: string): Promise<GeoPosition> {
    throw new Error('Not implemented');
  }

  async getCurrentPositionWithFallback(): Promise<GeoPosition> {
    try {
      return await this.getCurrentPosition();
    } catch (err) {
      if (err instanceof GeolocationError) {
        if (err.type === 'PERMISSION_DENIED') {
          throw err;
        }
        const cached = await this.getLastKnownPosition();
        if (cached) {
          return cached;
        }
      }
      throw err;
    }
  }

  private toGeoPosition(position: GeolocationPosition): GeoPosition {
    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      timestamp: position.timestamp,
    };
  }
}
