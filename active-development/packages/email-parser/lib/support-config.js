const functions = require('firebase-functions');

function safeFunctionsConfig() {
  if (typeof functions.config !== 'function') {
    return {};
  }

  try {
    return functions.config();
  } catch (error) {
    // `functions.config()` throws when no runtime config is available. Treat as empty.
    return {};
  }
}

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null) {
    return fallback;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  const normalized = String(value).trim().toLowerCase();

  if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) {
    return true;
  }

  if (['false', '0', 'no', 'n', 'off'].includes(normalized)) {
    return false;
  }

  return fallback;
}

function parseNumber(value, fallback) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function removeUndefinedKeys(object) {
  return Object.fromEntries(
    Object.entries(object).filter(([, value]) => value !== undefined)
  );
}

function ensureTransportPresent(options) {
  if (options.streamTransport) {
    return {
      streamTransport: true,
      buffer: true,
      newline: 'unix'
    };
  }

  const host = options.host;
  const service = options.service;
  const hasHost = typeof host === 'string' && host.length > 0;
  const hasService = typeof service === 'string' && service.length > 0;

  if (!hasHost && !hasService) {
    throw new Error(
      'Missing SMTP configuration for Parserator support mailbox. Provide host/service details or enable stream transport.'
    );
  }

  const transport = removeUndefinedKeys({
    host,
    port: options.port,
    secure: options.secure,
    service
  });

  if (options.auth && (options.auth.user || options.auth.pass)) {
    transport.auth = removeUndefinedKeys({
      user: options.auth.user,
      pass: options.auth.pass,
      type: options.auth.type,
      clientId: options.auth.clientId,
      clientSecret: options.auth.clientSecret,
      refreshToken: options.auth.refreshToken,
      accessToken: options.auth.accessToken
    });
  }

  return transport;
}

function getSupportMailboxConfig(overrides = {}) {
  const runtimeConfig = overrides.runtimeConfig || safeFunctionsConfig();
  const env = overrides.env || process.env;
  const supportConfig = runtimeConfig.support || {};
  const transportConfig = supportConfig.transport || {};

  const supportEmail =
    overrides.supportEmail ||
    env.SUPPORT_EMAIL ||
    supportConfig.email ||
    'Chairman@parserator.com';

  const senderName =
    overrides.senderName ||
    env.SUPPORT_SENDER_NAME ||
    supportConfig.sender_name ||
    'Parserator Support';

  const replyTo =
    overrides.replyTo ||
    env.SUPPORT_REPLY_TO ||
    supportConfig.reply_to ||
    supportEmail;

  const parseratorApiUrl =
    overrides.parseratorApiUrl ||
    env.PARSERATOR_API_URL ||
    supportConfig.parserator_api_url ||
    'https://app-5108296280.us-central1.run.app/v1/parse';

  const emailWebhookUrl =
    overrides.emailWebhookUrl ||
    env.SUPPORT_MAILBOX_ENDPOINT ||
    supportConfig.mailbox_endpoint ||
    'https://us-central1-parserator-production.cloudfunctions.net/emailToSchema';

  const geminiApiKey =
    overrides.geminiApiKey ||
    env.GEMINI_API_KEY ||
    (runtimeConfig.gemini && runtimeConfig.gemini.api_key);

  const userAgent =
    overrides.userAgent ||
    env.SUPPORT_USER_AGENT ||
    supportConfig.user_agent ||
    'parserator-support-mailbox/1.0';

  const transportOverride = overrides.transport;

  if (transportOverride) {
    return {
      supportEmail,
      senderName,
      replyTo,
      parseratorApiUrl,
      geminiApiKey,
      userAgent,
      transport: ensureTransportPresent(transportOverride)
    };
  }

  const streamTransport = parseBoolean(
    env.SUPPORT_STREAM_TRANSPORT ?? transportConfig.stream_transport,
    false
  );

  const host = env.SUPPORT_SMTP_HOST ?? transportConfig.host;
  const service = env.SUPPORT_SMTP_SERVICE ?? transportConfig.service;
  const port = parseNumber(
    env.SUPPORT_SMTP_PORT ?? transportConfig.port,
    undefined
  );
  const secure = parseBoolean(
    env.SUPPORT_SMTP_SECURE ?? transportConfig.secure,
    port === 465
  );

  const auth = {
    user: env.SUPPORT_SMTP_USER ?? transportConfig.user,
    pass: env.SUPPORT_SMTP_PASS ?? transportConfig.pass,
    type: env.SUPPORT_SMTP_AUTH_TYPE ?? transportConfig.auth_type,
    clientId: env.SUPPORT_SMTP_CLIENT_ID ?? transportConfig.client_id,
    clientSecret:
      env.SUPPORT_SMTP_CLIENT_SECRET ?? transportConfig.client_secret,
    refreshToken:
      env.SUPPORT_SMTP_REFRESH_TOKEN ?? transportConfig.refresh_token,
    accessToken:
      env.SUPPORT_SMTP_ACCESS_TOKEN ?? transportConfig.access_token
  };

  const transport = ensureTransportPresent({
    streamTransport,
    host,
    service,
    port,
    secure,
    auth
  });

  return {
    supportEmail,
    senderName,
    replyTo,
    parseratorApiUrl,
    emailWebhookUrl,
    geminiApiKey,
    userAgent,
    transport
  };
}

module.exports = {
  getSupportMailboxConfig,
  parseBoolean,
  parseNumber,
  ensureTransportPresent
};
