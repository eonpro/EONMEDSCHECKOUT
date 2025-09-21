### Pricing Helpers

Functions:

- `computeAddonPrice(addon, duration, selectedPlan)`
- `computeTotals({ selectedPlanData, selectedAddons, addons, fatBurnerDuration, expeditedShipping, promoApplied })`

Self-tests (dev only):

- Executed on module load via `console.assert`
- Cover 9 scenarios including shipping and promo

Extending:

- Keep functions pure
- Add more discounts via additional parameters
