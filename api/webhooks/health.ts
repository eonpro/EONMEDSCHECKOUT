import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Health Check Endpoint for Webhook Integrations
 * 
 * Returns the health status of all integration dependencies.
 * Use this to verify environment variables are configured correctly.
 * 
 * Access: https://checkout.eonmeds.com/api/webhooks/health
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Check all required environment variables
  const integrations = {
    stripe: {
      configured: Boolean(
        process.env.STRIPE_SECRET_KEY && 
        process.env.STRIPE_WEBHOOK_SECRET
      ),
      required: true,
      description: 'Stripe payment processing and webhooks',
      envVars: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'],
    },
    airtable: {
      configured: Boolean(
        process.env.AIRTABLE_API_TOKEN &&
        process.env.AIRTABLE_BASE_ID &&
        process.env.AIRTABLE_TABLE_ID
      ),
      required: true,
      description: 'Airtable intake form data sync',
      envVars: ['AIRTABLE_API_TOKEN', 'AIRTABLE_BASE_ID', 'AIRTABLE_TABLE_ID'],
    },
    gohighlevel: {
      configured: Boolean(
        process.env.GHL_API_KEY && 
        process.env.GHL_LOCATION_ID
      ),
      required: true,
      description: 'GoHighLevel SMS notifications',
      envVars: ['GHL_API_KEY', 'GHL_LOCATION_ID'],
    },
    intakeq: {
      configured: Boolean(process.env.INTAKEQ_API_KEY),
      required: true,
      description: 'IntakeQ client management and PDF upload',
      envVars: ['INTAKEQ_API_KEY'],
    },
    vercelKV: {
      configured: Boolean(
        process.env.KV_REST_API_URL && 
        process.env.KV_REST_API_TOKEN
      ),
      required: false,
      description: 'Vercel KV for caching and idempotency (optional)',
      envVars: ['KV_REST_API_URL', 'KV_REST_API_TOKEN'],
    },
  };

  // Calculate overall health
  const requiredIntegrations = Object.entries(integrations).filter(
    ([_, config]) => config.required
  );
  
  const allRequiredConfigured = requiredIntegrations.every(
    ([_, config]) => config.configured
  );
  
  const missingRequired = requiredIntegrations
    .filter(([_, config]) => !config.configured)
    .map(([name, config]) => ({
      integration: name,
      description: config.description,
      missingEnvVars: config.envVars,
    }));

  const status = allRequiredConfigured ? 'healthy' : 'degraded';
  const statusCode = allRequiredConfigured ? 200 : 503;

  const response = {
    status,
    timestamp: new Date().toISOString(),
    integrations: Object.entries(integrations).reduce((acc, [name, config]) => {
      acc[name] = {
        configured: config.configured,
        required: config.required,
        description: config.description,
        status: config.configured ? '✅' : (config.required ? '❌ MISSING' : '⚠️ Optional'),
      };
      return acc;
    }, {} as Record<string, any>),
    summary: {
      totalIntegrations: Object.keys(integrations).length,
      requiredIntegrations: requiredIntegrations.length,
      configuredIntegrations: Object.values(integrations).filter(i => i.configured).length,
      missingRequired: missingRequired.length,
    },
  };

  // If unhealthy, add details about what's missing
  if (!allRequiredConfigured) {
    (response as any).errors = missingRequired;
    (response as any).message = 'Some required integrations are not configured. Set missing environment variables in Vercel.';
  }

  // Set appropriate HTTP status code
  res.status(statusCode).json(response);
}
