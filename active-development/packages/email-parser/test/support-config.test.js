const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getSupportMailboxConfig,
  ensureTransportPresent
} = require('../lib/support-config');

const baseEnv = {
  GEMINI_API_KEY: 'test-key'
};

test('environment overrides populate SMTP host transport', () => {
  const config = getSupportMailboxConfig({
    env: {
      ...baseEnv,
      SUPPORT_EMAIL: 'Chairman@parserator.com',
      SUPPORT_SENDER_NAME: 'Parserator Launch',
      SUPPORT_REPLY_TO: 'Chairman@parserator.com',
      SUPPORT_SMTP_HOST: 'smtp.gmail.com',
      SUPPORT_SMTP_PORT: '465',
      SUPPORT_SMTP_SECURE: 'true',
      SUPPORT_SMTP_USER: 'chairman@parserator.com',
      SUPPORT_SMTP_PASS: 'app-password',
      PARSERATOR_API_URL: 'https://example.com/parse',
      SUPPORT_MAILBOX_ENDPOINT: 'https://example.com/email'
    },
    runtimeConfig: {}
  });

  assert.equal(config.supportEmail, 'Chairman@parserator.com');
  assert.equal(config.senderName, 'Parserator Launch');
  assert.equal(config.replyTo, 'Chairman@parserator.com');
  assert.equal(config.transport.host, 'smtp.gmail.com');
  assert.equal(config.transport.port, 465);
  assert.equal(config.transport.secure, true);
  assert.equal(config.transport.auth.user, 'chairman@parserator.com');
  assert.equal(config.transport.auth.pass, 'app-password');
  assert.equal(config.parseratorApiUrl, 'https://example.com/parse');
  assert.equal(config.emailWebhookUrl, 'https://example.com/email');
});

test('runtime config fallback provides defaults when env missing', () => {
  const config = getSupportMailboxConfig({
    runtimeConfig: {
      support: {
        email: 'ops@parserator.com',
        sender_name: 'Ops Team',
        reply_to: 'ops@parserator.com',
        transport: {
          host: 'smtp.ops-mail.local',
          port: 2525,
          secure: false,
          user: 'ops-user',
          pass: 'ops-pass'
        },
        mailbox_endpoint: 'https://example.com/support-email'
      },
      gemini: {
        api_key: 'runtime-key'
      }
    },
    env: {}
  });

  assert.equal(config.supportEmail, 'ops@parserator.com');
  assert.equal(config.senderName, 'Ops Team');
  assert.equal(config.transport.host, 'smtp.ops-mail.local');
  assert.equal(config.transport.port, 2525);
  assert.equal(config.transport.secure, false);
  assert.equal(config.transport.auth.user, 'ops-user');
  assert.equal(config.transport.auth.pass, 'ops-pass');
  assert.equal(config.geminiApiKey, 'runtime-key');
  assert.equal(config.emailWebhookUrl, 'https://example.com/support-email');
});

test('ensureTransportPresent throws when configuration missing', () => {
  assert.throws(
    () => ensureTransportPresent({}),
    /Missing SMTP configuration/
  );
});

test('stream transport flag generates local transport', () => {
  const config = getSupportMailboxConfig({
    env: {
      ...baseEnv,
      SUPPORT_STREAM_TRANSPORT: 'true'
    },
    runtimeConfig: {}
  });

  assert.equal(config.transport.streamTransport, true);
  assert.equal(config.transport.newline, 'unix');
  assert.equal(config.transport.buffer, true);
});
