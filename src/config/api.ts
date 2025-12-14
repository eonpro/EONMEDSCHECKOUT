// API Configuration
// Handles different environments and API endpoints

const getApiBaseUrl = () => {
  // In production, always use the main domain to avoid authentication issues
  if (import.meta.env.PROD) {
    return 'https://eonmeds-checkout.vercel.app';
  }
  
  // In development, use relative URLs
  return '';
};

export const API_CONFIG = {
  baseUrl: getApiBaseUrl(),
  endpoints: {
    createPaymentIntent: '/api/payment/create-intent',
    createCheckoutSession: '/api/payment/create-checkout-session',
    createSubscription: '/api/payment/create-subscription',
    webhook: '/api/webhooks/stripe',
  },
};

// Helper function to get full API URL
export const getApiUrl = (endpoint: keyof typeof API_CONFIG.endpoints): string => {
  return `${API_CONFIG.baseUrl}${API_CONFIG.endpoints[endpoint]}`;
};
