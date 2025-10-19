// SIMPLE EMAIL SERVICE
// A simpler approach using email forwarding rules

const functions = require('firebase-functions');
const nodemailer = require('nodemailer');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Simple email processor that can be called via webhook
exports.processEmailData = functions.https.onRequest(async (req, res) => {
  // Set CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { emailContent, senderEmail } = req.body;

    if (!emailContent || !senderEmail) {
      res.status(400).json({ 
        error: 'Missing required fields: emailContent, senderEmail' 
      });
      return;
    }

    console.log(`Processing email from: ${senderEmail}`);

    // Initialize Gemini
    const genAI = new GoogleGenerativeAI(functions.config().gemini.api_key);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // Step 1: Analyze data and suggest optimal schema
    const schemaPrompt = `Analyze this email content and create the most useful JSON schema for parsing it.

EMAIL CONTENT:
${emailContent.substring(0, 2000)}

Create a comprehensive schema that captures all important information. Consider the data type and suggest appropriate field names and types.

Return ONLY valid JSON in this format:
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
  "dataType": "contact|invoice|medical|job_application|real_estate|other",
  "description": "Brief description of what this data represents"
}`;

    const schemaResult = await model.generateContent(schemaPrompt);
    let schemaResponse = schemaResult.response.text();

    // Clean schema response
    schemaResponse = schemaResponse.replace(/```[a-zA-Z]*\n?/g, '');
    schemaResponse = schemaResponse.replace(/```/g, '');
    
    const jsonStart = schemaResponse.indexOf('{');
    const jsonEnd = schemaResponse.lastIndexOf('}');
    
    if (jsonStart !== -1 && jsonEnd !== -1) {
      schemaResponse = schemaResponse.substring(jsonStart, jsonEnd + 1);
    }

    const schemaAnalysis = JSON.parse(schemaResponse.trim());

    // Step 2: Parse the data using our Parserator API
    const parseResponse = await fetch('https://app-5108296280.us-central1.run.app/v1/parse', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputData: emailContent,
        outputSchema: schemaAnalysis.suggestedSchema
      })
    });

    const parseResult = await parseResponse.json();

    // Step 3: Format response for email
    const response = {
      success: parseResult.success,
      dataType: schemaAnalysis.dataType,
      description: schemaAnalysis.description,
      suggestedSchema: schemaAnalysis.suggestedSchema,
      parsedData: parseResult.parsedData,
      metadata: parseResult.metadata,
      emailSubject: parseResult.success 
        ? `✅ Parsed: ${schemaAnalysis.dataType} (${Object.keys(parseResult.parsedData || {}).length} fields)`
        : `❌ Parse Failed: ${schemaAnalysis.dataType}`,
      emailBody: formatEmailResponse(schemaAnalysis, parseResult)
    };

    res.json(response);

  } catch (error) {
    console.error('Email processing error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      emailSubject: '❌ Parserator Error',
      emailBody: `Sorry, there was an error processing your data: ${error.message}\n\nPlease try again with clearer data formatting.\n\n---\nPowered by Parserator`
    });
  }
});

function formatEmailResponse(schemaAnalysis, parseResult) {
  if (parseResult.success) {
    return `📊 PARSERATOR RESULTS

✅ Successfully parsed your ${schemaAnalysis.dataType}!
${schemaAnalysis.description}

📋 EXTRACTED DATA:
${JSON.stringify(parseResult.parsedData, null, 2)}

🔧 SCHEMA USED:
${JSON.stringify(schemaAnalysis.suggestedSchema, null, 2)}

📈 METADATA:
• Confidence: ${Math.round(parseResult.metadata.confidence * 100)}%
• Processing Time: ${parseResult.metadata.processingTimeMs}ms  
• Fields Detected: ${Object.keys(parseResult.parsedData).length}
• Tokens Used: ${parseResult.metadata.tokensUsed}

🧠 EXTRACTION DETAILS:
• Steps: ${parseResult.metadata.architectPlan.steps.length} extraction steps
• Strategy: ${parseResult.metadata.architectPlan.strategy}

🚀 INTEGRATE THIS PARSING:

curl -X POST "https://app-5108296280.us-central1.run.app/v1/parse" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify({
    inputData: "your data here",
    outputSchema: schemaAnalysis.suggestedSchema
  })}'

💡 NODE.JS SDK:
npm install parserator-sdk

const { ParseratorClient } = require('parserator-sdk');
const client = new ParseratorClient();
const result = await client.parse({
  inputData: "your data",
  outputSchema: ${JSON.stringify(schemaAnalysis.suggestedSchema)}
});

---
Powered by Parserator - Intelligent Data Parsing
🌐 https://parserator.com | 📧 Chairman@parserator.com`;

  } else {
    return `❌ PARSERATOR PARSING FAILED

Error: ${parseResult.error?.message || 'Unknown error'}

📋 SUGGESTED SCHEMA:
${JSON.stringify(schemaAnalysis.suggestedSchema, null, 2)}

💡 TIPS TO IMPROVE PARSING:
• Ensure data has clear field labels
• Include headers or descriptive text
• Try smaller data samples first
• Check for special characters or encoding issues

🔧 MANUAL PARSING:
You can still use the suggested schema above with our API:

curl -X POST "https://app-5108296280.us-central1.run.app/v1/parse" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify({
    inputData: "your cleaned data",
    outputSchema: schemaAnalysis.suggestedSchema
  })}'

---
Powered by Parserator - Intelligent Data Parsing  
🌐 https://parserator.com | 📧 Chairman@parserator.com`;
  }
}

// Health check endpoint
exports.emailParserHealth = functions.https.onRequest(async (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Email Parser',
    timestamp: new Date().toISOString(),
    endpoints: {
      'POST /processEmailData': 'Process email content and return parsed schema'
    }
  });
});