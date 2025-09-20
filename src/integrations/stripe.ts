export type CreateCheckoutSessionParams = {
  lineItems: Array<{ name: string; amount: number; quantity: number }>;
  customerEmail?: string;
};

export async function createCheckoutSession(_params: CreateCheckoutSessionParams): Promise<{ url: string } | { error: string }> {
  try {
    const res = await fetch('/api/checkout/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(_params),
    });
    if (!res.ok) return { error: `Failed to create session: ${res.status}` };
    return res.json();
  } catch (e: any) {
    return { error: e.message || 'Network error' };
  }
}
