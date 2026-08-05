const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'hackathon-travel-board/1.0 (contact: lenoxnguyen2014@gmail.com)';

interface GeocodeResult {
  lat: number;
  lng: number;
  raw: any;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const geocodeLocationName = async (name: string): Promise<GeocodeResult | null> => {
  try {
    const url = `${NOMINATIM_URL}?format=json&limit=1&q=${encodeURIComponent(name)}`;
    const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (!response.ok) return null;

    const results = await response.json();
    const first = results?.[0];
    if (!first) return null;

    return { lat: parseFloat(first.lat), lng: parseFloat(first.lon), raw: first };
  } catch (error: any) {
    console.error('Error in geocodeLocationName:', error.message);
    return null;
  }
};

// Nominatim's usage policy caps requests at ~1/sec — always sequential, never Promise.all.
const geocodeBatch = async (names: string[]): Promise<Map<string, GeocodeResult | null>> => {
  const uniqueNames = [...new Set(names)];
  const results = new Map<string, GeocodeResult | null>();

  for (const name of uniqueNames) {
    results.set(name, await geocodeLocationName(name));
    await sleep(1100);
  }

  return results;
};

export { geocodeLocationName, geocodeBatch };
export type { GeocodeResult };
