import { GoogleMapsLibraryLoader } from "./services/implementations/GoogleMapsLibraryLoader";

let instance: GoogleMapsLibraryLoader | null = null;

export function getGoogleMapsLibraryLoader(): GoogleMapsLibraryLoader {
  if (!instance) instance = new GoogleMapsLibraryLoader();
  return instance;
}
