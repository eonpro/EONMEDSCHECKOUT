import { useEffect, useRef, useState } from 'react';
import { loadGoogleMapsScript } from '../utils/loadGoogleMaps';

export interface AddressAutocompleteProps {
  value: {
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  onChange: (address: {
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  }) => void;
  language?: 'en' | 'es';
}

// Google Places Autocomplete Component
export function AddressAutocomplete({ value, onChange, language = 'en' }: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [googleLoaded, setGoogleLoaded] = useState(false);

  useEffect(() => {
    loadGoogleMapsScript()
      .then(() => {
        setGoogleLoaded(true);
      })
      .catch(err => {
        console.warn('Failed to load Google Maps:', err);
      });
  }, []);

  useEffect(() => {
    if (!googleLoaded) return;

    if (!inputRef.current) return;

    // Create autocomplete instance
    const autocompleteInstance = new google.maps.places.Autocomplete(inputRef.current, {
      types: ['address'],
      componentRestrictions: { country: 'us' },
      fields: ['address_components', 'formatted_address']
    });

    // Handle place selection
    autocompleteInstance.addListener('place_changed', () => {
      const place = autocompleteInstance.getPlace();
      
      if (!place.address_components) return;

      let streetNumber = '';
      let route = '';
      let city = '';
      let state = '';
      let zip = '';
      let country = 'US';

      // Parse address components
      place.address_components.forEach(component => {
        const types = component.types;
        const value = component.long_name;

        if (types.includes('street_number')) {
          streetNumber = value;
        } else if (types.includes('route')) {
          route = value;
        } else if (types.includes('locality')) {
          city = value;
        } else if (types.includes('administrative_area_level_1')) {
          state = component.short_name;
        } else if (types.includes('postal_code')) {
          zip = value;
        } else if (types.includes('country')) {
          country = component.short_name;
        }
      });

      // Update the address
      onChange({
        street: `${streetNumber} ${route}`.trim(),
        city,
        state,
        zip,
        country
      });
    });

    return () => {
      // Cleanup
      google.maps.event.clearInstanceListeners(autocompleteInstance);
    };
  }, [onChange, googleLoaded]);

  // For fallback when Google Maps isn't loaded
  if (!googleLoaded) {
    return (
      <div className="grid gap-4">
        <input
          type="text"
          placeholder={language === 'es' ? "Dirección de calle" : "Street Address"}
          value={value.street}
          onChange={(e) => onChange({...value, street: e.target.value})}
          className="px-4 py-2 border rounded-lg w-full"
        />
        <div className="grid grid-cols-2 gap-4">
          <input
            type="text"
            placeholder={language === 'es' ? "Ciudad" : "City"}
            value={value.city}
            onChange={(e) => onChange({...value, city: e.target.value})}
            className="px-4 py-2 border rounded-lg"
          />
          <input
            type="text"
            placeholder={language === 'es' ? "Estado" : "State"}
            value={value.state}
            onChange={(e) => onChange({...value, state: e.target.value})}
            className="px-4 py-2 border rounded-lg"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <input
            type="text"
            placeholder={language === 'es' ? "Código Postal" : "ZIP Code"}
            value={value.zip}
            onChange={(e) => onChange({...value, zip: e.target.value})}
            className="px-4 py-2 border rounded-lg"
          />
          <input
            type="text"
            placeholder={language === 'es' ? "País" : "Country"}
            value={value.country}
            disabled
            className="px-4 py-2 border rounded-lg bg-gray-50"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div>
        <input
          ref={inputRef}
          type="text"
          placeholder={language === 'es' ? "Comience a escribir su dirección..." : "Start typing your address..."}
          className="px-4 py-2 border rounded-lg w-full"
        />
        <p className="text-xs text-gray-500 mt-1">
          {language === 'es' ? "Seleccione una dirección de las sugerencias" : "Select an address from the suggestions"}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <input
          type="text"
          placeholder={language === 'es' ? "Ciudad" : "City"}
          value={value.city}
          onChange={(e) => onChange({...value, city: e.target.value})}
          className="px-4 py-2 border rounded-lg"
        />
        <input
          type="text"
          placeholder={language === 'es' ? "Estado" : "State"}
          value={value.state}
          onChange={(e) => onChange({...value, state: e.target.value})}
          className="px-4 py-2 border rounded-lg"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <input
          type="text"
          placeholder={language === 'es' ? "Código Postal" : "ZIP Code"}
          value={value.zip}
          onChange={(e) => onChange({...value, zip: e.target.value})}
          className="px-4 py-2 border rounded-lg"
        />
        <input
          type="text"
          placeholder={language === 'es' ? "País" : "Country"}
          value={value.country}
          disabled
          className="px-4 py-2 border rounded-lg bg-gray-50"
        />
      </div>
    </div>
  );
}
