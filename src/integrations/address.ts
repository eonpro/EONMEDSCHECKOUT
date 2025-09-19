export type AddressSuggestion = { address: string; placeId: string };
export type Address = { street: string; city: string; state: string; zip: string; country: string };

export async function autocompleteAddress(_q: string): Promise<AddressSuggestion[]> {
  // TODO: wire to Google Places or Mapbox. Mock for now.
  return [];
}

export async function resolvePlaceId(_placeId: string): Promise<Address | null> {
  // TODO: call provider details API. Mock for now.
  return null;
}
