// DEBUG ARCHITECT GEMINI RESPONSES
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function debugArchitect() {
  const genAI = new GoogleGenerativeAI('AIzaSyB0-rtYB0XkqQ1ZrjWGi-x8gOJxYnSDCwE');
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const sample = `From: Dr. Sarah Johnson <sarah.johnson@biotechcorp.com>
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
Senior Research Scientist`.substring(0, 1000);

  const outputSchema = {
    name: "string",
    email: "email",
    office_phone: "phone", 
    mobile_phone: "phone",
    title: "string",
    department: "string",
    location: "string",
    experience_years: "number"
  };

  const architectPrompt = `You are the Architect. Create a SearchPlan JSON for parsing data.

SAMPLE DATA:
${sample}

TARGET SCHEMA:
${JSON.stringify(outputSchema, null, 2)}

Return ONLY this exact JSON format with NO markdown, NO explanations, NO code blocks:

{
  "searchPlan": {
    "steps": [
      {
        "field": "fieldname",
        "instruction": "specific extraction instruction", 
        "pattern": "search pattern",
        "validation": "data type"
      }
    ],
    "confidence": 0.95,
    "strategy": "field-by-field extraction"
  }
}

Create one step per field in the target schema. Return ONLY valid JSON.`;

  console.log('🧠 TESTING ARCHITECT PROMPT');
  console.log('━'.repeat(50));
  console.log('PROMPT:');
  console.log(architectPrompt);
  console.log('\n' + '━'.repeat(50));

  try {
    const result = await model.generateContent(architectPrompt);
    const response = result.response.text();
    
    console.log('RAW GEMINI RESPONSE:');
    console.log(response);
    console.log('\n' + '━'.repeat(50));

    // Test our cleaning logic
    let cleanResponse = response;
    
    // Remove all markdown code blocks
    cleanResponse = cleanResponse.replace(/```[a-zA-Z]*\n?/g, '');
    cleanResponse = cleanResponse.replace(/```/g, '');
    
    // Remove any explanatory text before/after JSON
    const jsonStart = cleanResponse.indexOf('{');
    const jsonEnd = cleanResponse.lastIndexOf('}');
    
    if (jsonStart !== -1 && jsonEnd !== -1) {
      cleanResponse = cleanResponse.substring(jsonStart, jsonEnd + 1);
    }
    
    cleanResponse = cleanResponse.trim();

    console.log('CLEANED RESPONSE:');
    console.log(cleanResponse);
    console.log('\n' + '━'.repeat(50));

    try {
      const parsed = JSON.parse(cleanResponse);
      console.log('✅ PARSED SUCCESSFULLY:');
      console.log(JSON.stringify(parsed, null, 2));
      
      if (parsed.searchPlan && parsed.searchPlan.steps) {
        console.log(`\n✅ VALID SEARCHPLAN with ${parsed.searchPlan.steps.length} steps`);
      } else {
        console.log('\n❌ INVALID SEARCHPLAN STRUCTURE');
      }
    } catch (parseError) {
      console.log('❌ JSON PARSE FAILED:');
      console.log(parseError.message);
      console.log('\nPosition', parseError.message.match(/position (\d+)/)?.[1] || 'unknown');
      
      // Show the character at error position
      const pos = parseInt(parseError.message.match(/position (\d+)/)?.[1] || '0');
      if (pos < cleanResponse.length) {
        console.log(`Character at position ${pos}: "${cleanResponse[pos]}"`);
        console.log(`Context: "${cleanResponse.substring(Math.max(0, pos-20), pos+20)}"`);
      }
    }

  } catch (error) {
    console.log('❌ GEMINI API ERROR:', error.message);
  }
}

debugArchitect().catch(console.error);