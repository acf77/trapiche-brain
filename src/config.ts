export interface AppConfig {
  port: number;
  host: string;
  apiKey?: string;
  corsOrigin: string;
  turso: {
    url?: string;
    authToken?: string;
  };
  stripe: {
    secretKey?: string;
  };
  abacatepay: {
    apiKey?: string;
  };
  simpleAnalytics: {
    hostname?: string;
    apiKey?: string;
    userId?: string;
    timezone: string;
  };
  posthog: {
    host: string;
    projectId?: string;
    personalApiKey?: string;
  };
}

function optionalEnv(key: string): string | undefined {
  const value = process.env[key]?.trim();
  return value ? value : undefined;
}

function intEnv(key: string, fallback: number): number {
  const raw = optionalEnv(key);
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const config: AppConfig = {
  port: intEnv("PORT", 3010),
  host: optionalEnv("HOST") ?? "0.0.0.0",
  apiKey: optionalEnv("API_KEY"),
  corsOrigin: optionalEnv("CORS_ORIGIN") ?? "*",
  turso: {
    url: optionalEnv("DB_URL") ?? optionalEnv("TURSO_DATABASE_URL"),
    authToken: optionalEnv("DB_AUTH_TOKEN") ?? optionalEnv("TURSO_AUTH_TOKEN"),
  },
  stripe: {
    secretKey: optionalEnv("STRIPE_SECRET_KEY"),
  },
  abacatepay: {
    apiKey: optionalEnv("ABACATEPAY_API_KEY"),
  },
  simpleAnalytics: {
    hostname: optionalEnv("SIMPLE_ANALYTICS_HOSTNAME"),
    apiKey: optionalEnv("SIMPLE_ANALYTICS_API_KEY"),
    userId: optionalEnv("SIMPLE_ANALYTICS_USER_ID"),
    timezone: optionalEnv("SIMPLE_ANALYTICS_TIMEZONE") ?? "America/Fortaleza",
  },
  posthog: {
    host: optionalEnv("POSTHOG_HOST") ?? "https://us.posthog.com",
    projectId: optionalEnv("POSTHOG_PROJECT_ID"),
    personalApiKey: optionalEnv("POSTHOG_PERSONAL_API_KEY"),
  },
};

export function integrationStatus() {
  return {
    turso: Boolean(config.turso.url && config.turso.authToken),
    stripe: Boolean(config.stripe.secretKey),
    abacatepay: Boolean(config.abacatepay.apiKey),
    simpleAnalytics: Boolean(config.simpleAnalytics.hostname),
    simpleAnalyticsPrivateAuth: Boolean(
      config.simpleAnalytics.apiKey && config.simpleAnalytics.userId,
    ),
    posthog: Boolean(config.posthog.projectId && config.posthog.personalApiKey),
  };
}
