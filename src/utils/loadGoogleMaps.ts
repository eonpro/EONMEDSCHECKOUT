let isLoading = false;
let isLoaded = false;

export function loadGoogleMapsScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    // Already loaded
    if (isLoaded && window.google && window.google.maps) {
      resolve();
      return;
    }

    // Currently loading
    if (isLoading) {
      const checkInterval = setInterval(() => {
        if (window.google && window.google.maps) {
          clearInterval(checkInterval);
          isLoaded = true;
          resolve();
        }
      }, 100);
      return;
    }

    isLoading = true;

    const apiKey = import.meta.env.VITE_GOOGLE_PLACES_KEY || '';
    
    if (!apiKey) {
      console.warn('Google Places API key not configured. Address autocomplete will not work.');
      reject(new Error('Google Places API key not configured'));
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      isLoaded = true;
      isLoading = false;
      resolve();
    };

    script.onerror = () => {
      isLoading = false;
      reject(new Error('Failed to load Google Maps script'));
    };

    document.head.appendChild(script);
  });
}
