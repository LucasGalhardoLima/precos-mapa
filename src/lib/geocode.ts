interface GeocodeResult {
  lat: number;
  lng: number;
}

interface NominatimResponse {
  lat: string;
  lon: string;
}

export async function geocodeAddress(
  address: string,
  city: string,
  state: string,
): Promise<GeocodeResult> {
  const query = [address, city, state, "Brasil"].filter(Boolean).join(", ");
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=br&limit=1`;

  const response = await fetch(url, {
    headers: {
      "User-Agent": "PrecoMapa/1.0 (admin-panel)",
    },
  });

  if (!response.ok) {
    throw new Error(`Geocoding falhou (HTTP ${response.status})`);
  }

  const results = (await response.json()) as NominatimResponse[];

  if (results.length === 0) {
    throw new Error(
      `Endereco nao encontrado: "${query}". Verifique o endereco e tente novamente.`,
    );
  }

  return {
    lat: parseFloat(results[0].lat),
    lng: parseFloat(results[0].lon),
  };
}
