const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;
// Intentionally avoiding Elements mounting until backend is wired
// const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

export function StripeElementsPlaceholder() {
  if (!publishableKey) {
    return (
      <div className="p-4 border rounded-lg bg-yellow-50 text-yellow-800 text-sm">
        Stripe publishable key not set. Add VITE_STRIPE_PUBLISHABLE_KEY in .env.local to enable Elements.
      </div>
    );
  }
  return (
    <div className="p-4 border rounded-lg bg-gray-50 text-sm text-gray-600">
      Stripe Elements will render here once backend session creation is wired. Key loaded: {publishableKey.slice(0, 8)}…
    </div>
  );
}
