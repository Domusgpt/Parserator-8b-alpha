// TEST EMAIL-TO-SCHEMA PARSING SERVICE
// Simulates sending email and receiving auto-generated schema + parsing

const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testEmailParser() {
  console.log('📧 TESTING EMAIL-TO-SCHEMA SERVICE\n');
  
  // Simulate email content from user
  const emailExamples = [
    {
      subject: "Parse my customer contact",
      body: `From: Dr. Sarah Johnson <sarah.johnson@biotechcorp.com>
Subject: Research Collaboration

Hi Team,

I'm reaching out regarding our upcoming research project. You can reach me at:
- Office: (617) 555-0123
- Mobile: (617) 555-0199  
- Department: Molecular Biology Research
- Location: Boston, MA
- Experience: 12 years in biotechnology

Best regards,
Dr. Sarah Johnson
Senior Research Scientist`
    },

    {
      subject: "Parse this invoice data",
      body: `INVOICE #INV-2024-0892
Date: March 15, 2024
Due Date: April 14, 2024

Bill To:
TechStart Solutions LLC
456 Innovation Drive
San Francisco, CA 94105

Description                    Qty    Rate      Amount
Web Development Services        80    $125/hr   $10,000.00
UI/UX Design                   40    $110/hr   $4,400.00

Subtotal:                                $14,400.00
Tax (8.75%):                             $1,260.00
Total Amount Due:                        $15,660.00

Payment Terms: Net 30 days`
    }
  ];

  const genAI = new GoogleGenerativeAI('AIzaSyB0-rtYB0XkqQ1ZrjWGi-x8gOJxYnSDCwE');
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  for (let i = 0; i < emailExamples.length; i++) {
    const email = emailExamples[i];
    
    console.log(`\n📨 TEST ${i + 1}: ${email.subject}`);
    console.log('━'.repeat(60));
    
    try {
      // Step 1: Generate optimal schema
      const schemaPrompt = `Analyze this email content and create the most useful JSON schema for parsing it.

EMAIL CONTENT:
${email.body}

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

      console.log('🧠 Generating optimal schema...');
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
      
      console.log('✅ Schema generated:');
      console.log('   Data Type:', schemaAnalysis.dataType);
      console.log('   Description:', schemaAnalysis.description);
      console.log('   Fields:', Object.keys(schemaAnalysis.suggestedSchema).length);

      // Step 2: Parse using Parserator API
      console.log('\n🔄 Parsing with Parserator API...');
      
      const parseResponse = await fetch('https://app-5108296280.us-central1.run.app/v1/parse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inputData: email.body,
          outputSchema: schemaAnalysis.suggestedSchema
        })
      });

      const parseResult = await parseResponse.json();

      // Step 3: Format email response
      if (parseResult.success) {
        console.log('✅ Parsing successful!');
        
        const replySubject = `✅ Parsed: ${schemaAnalysis.dataType} (${Object.keys(parseResult.parsedData).length} fields)`;
        
        const emailReply = `📧 AUTO-REPLY EMAIL:

TO: [original sender]
SUBJECT: ${replySubject}

📊 PARSERATOR RESULTS

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
  }, null, 2)}'

💡 NODE.JS SDK:
npm install parserator-sdk

const { ParseratorClient } = require('parserator-sdk');
const client = new ParseratorClient();
const result = await client.parse({
  inputData: "your data",
  outputSchema: ${JSON.stringify(schemaAnalysis.suggestedSchema, null, 2)}
});

---
Powered by Parserator - Intelligent Data Parsing
🌐 https://parserator.com | 📧 Chairman@parserator.com`;

        console.log(emailReply);

      } else {
        console.log('❌ Parsing failed:', parseResult.error?.message);
        
        const errorReply = `📧 AUTO-REPLY EMAIL:

TO: [original sender]  
SUBJECT: ❌ Parse Failed: ${schemaAnalysis.dataType}

❌ PARSERATOR PARSING FAILED

Error: ${parseResult.error?.message || 'Unknown error'}

📋 SUGGESTED SCHEMA:
${JSON.stringify(schemaAnalysis.suggestedSchema, null, 2)}

💡 TIPS TO IMPROVE PARSING:
• Ensure data has clear field labels
• Include headers or descriptive text
• Try smaller data samples first
• Check for special characters or encoding issues

---
Powered by Parserator - Intelligent Data Parsing
🌐 https://parserator.com | 📧 Chairman@parserator.com`;

        console.log(errorReply);
      }

    } catch (error) {
      console.log('❌ Error:', error.message);
    }
    
    console.log('\n' + '═'.repeat(80));
  }

  console.log('\n🎉 EMAIL-TO-SCHEMA SERVICE TESTING COMPLETE!');
  console.log('\n📊 This demonstrates:');
  console.log('   • Automatic schema generation from any data');
  console.log('   • Email-based parsing interface');  
  console.log('   • Comprehensive auto-reply with results');
  console.log('   • Ready-to-use integration code');
  console.log('   • No-code data parsing via email');
}

testEmailParser().catch(console.error);