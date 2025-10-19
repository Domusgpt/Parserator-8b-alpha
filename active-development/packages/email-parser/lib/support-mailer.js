const nodemailer = require('nodemailer');
const { getSupportMailboxConfig } = require('./support-config');

function defaultHtmlWrapper(text) {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\r?\n/g, '<br>');

  return `<div style="font-family: 'Inter', 'Segoe UI', Arial, sans-serif; white-space: pre-wrap;">${escaped}</div>`;
}

function createSupportMailer(options = {}) {
  const config = options.config || getSupportMailboxConfig(options);
  const transporter = nodemailer.createTransport(config.transport);

  async function sendMail(message) {
    const composedMessage = {
      from: message.from || `${config.senderName} <${config.supportEmail}>`,
      replyTo: message.replyTo || config.replyTo,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html || defaultHtmlWrapper(message.text || ''),
      headers: {
        'X-Parserator-Client': config.userAgent,
        ...(message.headers || {})
      }
    };

    return transporter.sendMail(composedMessage);
  }

  return {
    config,
    transporter,
    sendMail,
    html: defaultHtmlWrapper
  };
}

module.exports = {
  createSupportMailer,
  defaultHtmlWrapper
};
