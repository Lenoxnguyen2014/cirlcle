const GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';

interface GeocodeResult {
  lat: number;
  lng: number;
  raw: any;
}

const geocodeLocationName = async (name: string): Promise<GeocodeResult | null> => {
  try {
    const url = `${GEOCODE_URL}?address=${encodeURIComponent(name)}&key=${process.env.GOOGLE_MAPS_API_KEY}`;
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    const first = data?.results?.[0];
    if (!first) return null;

    return { lat: first.geometry.location.lat, lng: first.geometry.location.lng, raw: first };
  } catch (error: any) {
    console.error('Error in geocodeLocationName:', error.message);
    return null;
  }
};

const geocodeBatch = async (names: string[]): Promise<Map<string, GeocodeResult | null>> => {
  const uniqueNames = [...new Set(names)];
  const results = new Map<string, GeocodeResult | null>();

  for (const name of uniqueNames) {
    results.set(name, await geocodeLocationName(name));
  }

  return results;
};

// Used to suggest a label when a user drops a manual pin on the map —
// resolves clicked coordinates back to a human-readable place name.
const reverseGeocode = async (lat: number, lng: number): Promise<string | null> => {
  try {
    const url = `${GEOCODE_URL}?latlng=${lat},${lng}&key=${process.env.GOOGLE_MAPS_API_KEY}`;
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    return data?.results?.[0]?.formatted_address ?? null;
  } catch (error: any) {
    console.error('Error in reverseGeocode:', error.message);
    return null;
  }
};

export { geocodeLocationName, geocodeBatch, reverseGeocode };
export type { GeocodeResult };
