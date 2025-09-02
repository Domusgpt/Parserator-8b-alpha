// EMAIL-TO-SCHEMA PARSER
// Send any data via email and get back structured JSON

const functions = require('firebase-functions');
const nodemailer = require('nodemailer');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Email configuration
const EMAIL_CONFIG = {
  service: 'gmail',
  auth: {
    user: 'parserator@gmail.com',
    pass: process.env.GMAIL_APP_PASSWORD
  }
};

const transporter = nodemailer.createTransporter(EMAIL_CONFIG);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

exports.emailToSchema = functions.https.onRequest(async (req, res) => {
  // This will be triggered by Gmail API webhook or email service
  
  if (req.method !== 'POST') {
    res.status(405).send('Method not allowed');
    return;
  }

  try {
    const { from, subject, body, attachments } = req.body;
    
    console.log(`Processing email from: ${from}`);
    console.log(`Subject: ${subject}`);
    
    // Extract data from email body and attachments
    let inputData = body;
    
    if (attachments && attachments.length > 0) {
      // Handle text attachments (CSV, TXT, etc.)
      for (const attachment of attachments) {
        if (attachment.contentType.startsWith('text/')) {
          inputData += '\n\n' + attachment.content;
        }
      }
    }

    // Step 1: Analyze data and suggest schema
    const schemaPrompt = `Analyze this data and create an optimal JSON schema for parsing it.

DATA:
${inputData.substring(0, 2000)}

Create a comprehensive schema that captures all the important fields. Return ONLY valid JSON:

{
  "suggestedSchema": {
    "field1": "string",
    "field2": "email",
    "field3": "phone",
    "field4": "number",
    "field5": "iso_date",
    "field6": "string_array",
    "field7": "object"
  },
  "confidence": 0.95,
  "dataType": "email|invoice|contact|medical|etc",
  "description": "Brief description of the data"
}`;

    const schemaResult = await model.generateContent(schemaPrompt);
    const schemaResponse = schemaResult.response.text();
    
    // Clean and parse schema response
    let cleanSchemaResponse = schemaResponse;
    cleanSchemaResponse = cleanSchemaResponse.replace(/```[a-zA-Z]*\n?/g, '');
    cleanSchemaResponse = cleanSchemaResponse.replace(/```/g, '');
    
    const jsonStart = cleanSchemaResponse.indexOf('{');
    const jsonEnd = cleanSchemaResponse.lastIndexOf('}');
    
    if (jsonStart !== -1 && jsonEnd !== -1) {
      cleanSchemaResponse = cleanSchemaResponse.substring(jsonStart, jsonEnd + 1);
    }
    
    const schemaAnalysis = JSON.parse(cleanSchemaResponse.trim());

    // Step 2: Parse the data using Parserator API
    const parseResponse = await fetch('https://app-5108296280.us-central1.run.app/v1/parse', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputData: inputData,
        outputSchema: schemaAnalysis.suggestedSchema
      })
    });

    const parseResult = await parseResponse.json();

    // Step 3: Format email response
    let replyBody = '';
    
    if (parseResult.success) {
      replyBody = `📊 PARSERATOR RESULTS

✅ Successfully parsed your ${schemaAnalysis.dataType || 'data'}!

📋 EXTRACTED DATA:
${JSON.stringify(parseResult.parsedData, null, 2)}

🔧 SCHEMA USED:
${JSON.stringify(schemaAnalysis.suggestedSchema, null, 2)}

📈 METADATA:
• Confidence: ${Math.round(parseResult.metadata.confidence * 100)}%
• Processing Time: ${parseResult.metadata.processingTimeMs}ms
• Fields Detected: ${Object.keys(parseResult.parsedData).length}
• Tokens Used: ${parseResult.metadata.tokensUsed}

🧠 EXTRACTION STRATEGY:
• Steps: ${parseResult.metadata.architectPlan.steps.length} extraction steps
• Strategy: ${parseResult.metadata.architectPlan.strategy}

🚀 API INTEGRATION:
To integrate this parsing into your application:

curl -X POST "https://app-5108296280.us-central1.run.app/v1/parse" \\
  -H "Content-Type: application/json" \\
  -d '{
    "inputData": "your data here",
    "outputSchema": ${JSON.stringify(schemaAnalysis.suggestedSchema)}
  }'

💡 SDK Usage (Node.js):
const { ParseratorClient } = require('parserator-sdk');
const client = new ParseratorClient();
const result = await client.parse({
  inputData: "your data",
  outputSchema: ${JSON.stringify(schemaAnalysis.suggestedSchema)}
});

---
Powered by Parserator - Intelligent Data Parsing
https://parserator.com`;

    } else {
      replyBody = `❌ PARSERATOR ERROR

Failed to parse your data: ${parseResult.error?.message || 'Unknown error'}

📋 SUGGESTED SCHEMA:
${JSON.stringify(schemaAnalysis.suggestedSchema, null, 2)}

💡 TIPS:
• Make sure your data is clearly structured
• Include field labels or headers
• Try sending smaller data samples first

---
Powered by Parserator - Intelligent Data Parsing
https://parserator.com`;
    }

    // Step 4: Send reply email
    const replySubject = parseResult.success 
      ? `✅ Parsed: ${schemaAnalysis.dataType || 'Data'} (${Object.keys(parseResult.parsedData || {}).length} fields)`
      : `❌ Parse Failed: ${schemaAnalysis.dataType || 'Data'}`;

    await transporter.sendMail({
      from: '"Parserator" <parserator@gmail.com>',
      to: from,
      subject: replySubject,
      text: replyBody,
      html: `<pre>${replyBody}</pre>`
    });

    console.log(`Reply sent to: ${from}`);
    res.json({ success: true, message: 'Email processed and reply sent' });

  } catch (error) {
    console.error('Email processing error:', error);
    
    // Send error email if we have sender info
    if (req.body.from) {
      try {
        await transporter.sendMail({
          from: '"Parserator" <parserator@gmail.com>',
          to: req.body.from,
          subject: '❌ Parserator Processing Error',
          text: `Sorry, there was an error processing your data: ${error.message}

Please try again with a smaller data sample or contact support.

---
Powered by Parserator - Intelligent Data Parsing
https://parserator.com`
        });
      } catch (emailError) {
        console.error('Failed to send error email:', emailError);
      }
    }
    
    res.status(500).json({ success: false, error: error.message });
  }
});