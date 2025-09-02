// GMAIL WEBHOOK INTEGRATION
// This sets up Gmail API to forward emails to our parsing service

const { google } = require('googleapis');
const functions = require('firebase-functions');

const SCOPES = ['https://www.googleapis.com/auth/gmail.modify'];
const PARSERATOR_EMAIL = 'parse@parserator.com'; // The email people send to

// Gmail API setup
const auth = new google.auth.GoogleAuth({
  keyFile: 'service-account-key.json',
  scopes: SCOPES
});

const gmail = google.gmail({ version: 'v1', auth });

exports.gmailWebhook = functions.https.onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method not allowed');
    return;
  }

  try {
    const { message } = req.body;
    
    if (!message || !message.data) {
      res.status(400).send('Invalid message format');
      return;
    }

    // Decode the Pub/Sub message
    const data = JSON.parse(Buffer.from(message.data, 'base64').toString());
    const { historyId, emailAddress } = data;

    console.log(`Gmail webhook triggered for: ${emailAddress}`);

    // Get the latest history to find new messages
    const historyResponse = await gmail.users.history.list({
      userId: 'me',
      startHistoryId: historyId,
      historyTypes: ['messageAdded']
    });

    if (!historyResponse.data.history) {
      console.log('No new messages found');
      res.status(200).send('No new messages');
      return;
    }

    // Process each new message
    for (const historyItem of historyResponse.data.history) {
      if (historyItem.messagesAdded) {
        for (const messageAdded of historyItem.messagesAdded) {
          await processEmailMessage(messageAdded.message.id);
        }
      }
    }

    res.status(200).send('Messages processed');

  } catch (error) {
    console.error('Gmail webhook error:', error);
    res.status(500).send('Internal server error');
  }
});

async function processEmailMessage(messageId) {
  try {
    // Get the full message
    const messageResponse = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full'
    });

    const message = messageResponse.data;
    const headers = message.payload.headers;

    // Extract email metadata
    const from = headers.find(h => h.name === 'From')?.value;
    const to = headers.find(h => h.name === 'To')?.value;
    const subject = headers.find(h => h.name === 'Subject')?.value;

    // Check if this email is sent to our parsing address
    if (!to || !to.includes(PARSERATOR_EMAIL)) {
      console.log(`Email not sent to parsing address: ${to}`);
      return;
    }

    console.log(`Processing email from: ${from}, Subject: ${subject}`);

    // Extract email body
    const body = extractEmailBody(message.payload);
    const attachments = await extractAttachments(message.payload, messageId);

    // Call our email parsing function
    const parseResponse = await fetch('https://us-central1-parserator-production.cloudfunctions.net/emailToSchema', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from,
        subject,
        body,
        attachments,
        messageId
      })
    });

    if (parseResponse.ok) {
      console.log(`Successfully processed email from: ${from}`);
      
      // Mark email as read/processed
      await gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: {
          addLabelIds: ['PROCESSED'] // Custom label
        }
      });
      
    } else {
      console.error(`Failed to process email: ${parseResponse.statusText}`);
    }

  } catch (error) {
    console.error(`Error processing message ${messageId}:`, error);
  }
}

function extractEmailBody(payload) {
  let body = '';

  if (payload.body && payload.body.data) {
    body = Buffer.from(payload.body.data, 'base64').toString();
  } else if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body && part.body.data) {
        body += Buffer.from(part.body.data, 'base64').toString();
      }
    }
  }

  return body;
}

async function extractAttachments(payload, messageId) {
  const attachments = [];

  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.filename && part.body && part.body.attachmentId) {
        try {
          const attachmentResponse = await gmail.users.messages.attachments.get({
            userId: 'me',
            messageId: messageId,
            id: part.body.attachmentId
          });

          const content = Buffer.from(attachmentResponse.data.data, 'base64').toString();

          attachments.push({
            filename: part.filename,
            contentType: part.mimeType,
            content: content,
            size: part.body.size
          });
        } catch (error) {
          console.error(`Failed to extract attachment: ${part.filename}`, error);
        }
      }
    }
  }

  return attachments;
}

// Setup Gmail push notifications
exports.setupGmailWatch = functions.https.onRequest(async (req, res) => {
  try {
    const watchResponse = await gmail.users.watch({
      userId: 'me',
      requestBody: {
        topicName: 'projects/parserator-production/topics/gmail-notifications',
        labelIds: ['INBOX']
      }
    });

    console.log('Gmail watch setup:', watchResponse.data);
    res.json({ success: true, data: watchResponse.data });

  } catch (error) {
    console.error('Failed to setup Gmail watch:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});