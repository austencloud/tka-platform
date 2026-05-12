/**
 * Browser Geolocation API Implementation
 * Wraps native geolocation with Promise-based interface
 */

import type { GeolocationError, GeolocationPosition } from "./types";

export function isSupported(): boolean {
  return "geolocation" in navigator;
}

export function getCurrentLocation(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!isSupported()) {
      reject({
        code: 0,
        message: "Geolocation is not supported by this browser",
      } as GeolocationError);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      (error) => {
        reject({
          code: error.code,
          message: getErrorMessage(error.code),
        } as GeolocationError);
      },
      {
        enableHighAccuracy: false, // Faster, less battery
        timeout: 10000,
        maximumAge: 300000, // Cache for 5 minutes
      }
    );
  });
}

export function watchLocation(
  callback: (position: GeolocationPosition) => void,
  onError?: (error: GeolocationError) => void
): () => void {
  if (!isSupported()) {
    onError?.({
      code: 0,
      message: "Geolocation is not supported by this browser",
    });
    return () => {};
  }

  const watchId = navigator.geolocation.watchPosition(
    (position) => {
      callback({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
      });
    },
    (error) => {
      onError?.({
        code: error.code,
        message: getErrorMessage(error.code),
      });
    },
    {
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: 300000,
    }
  );

  return () => navigator.geolocation.clearWatch(watchId);
}

function getErrorMessage(code: number): string {
  switch (code) {
    case 1:
      return "Location permission denied. Please enable location access in your browser settings.";
    case 2:
      return "Location information is unavailable. Please check your internet connection.";
    case 3:
      return "Location request timed out. Please try again.";
    default:
      return "An unknown error occurred while accessing your location.";
  }
}
