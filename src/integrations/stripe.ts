export type CreateCheckoutSessionParams = {
  lineItems: Array<{ name: string; amount: number; quantity: number }>;
  customerEmail?: string;
};

export async function createCheckoutSession(_params: CreateCheckoutSessionParams): Promise<{ url: string } | { error: string }> {
  // TODO: Implement with backend API. Placeholder returns a mock URL.
  return { url: '/mock-checkout' };
}
