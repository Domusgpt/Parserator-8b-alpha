/**
 * Basic Parserator SDK Example
 * Demonstrates simple data parsing with the Architect-Extractor pattern
 */

const { ParseratorClient, quickParse } = require('../dist/index.js');
require('dotenv').config();

// Example 1: Using the full client
async function basicClientExample() {
  console.log('\n🔧 Basic Client Example');
  console.log('='.repeat(50));
  
  const client = new ParseratorClient({
    apiKey: process.env.PARSERATOR_API_KEY,
    debug: true
  });

  // Test connection
  const connectionTest = await client.testConnection();
  console.log('Connection test:', connectionTest);

  // Parse some contact information
  const contactText = `
    John Smith
    Senior Software Engineer
    TechCorp Solutions
    john.smith@techcorp.com
    Phone: (555) 123-4567
    Address: 123 Innovation Drive, Suite 200, San Francisco, CA 94105
    LinkedIn: linkedin.com/in/johnsmith
  `;

  const contactSchema = {
    name: 'string',
    title: 'string',
    company: 'string',
    email: 'email',
    phone: 'phone',
    address: {
      type: 'object',
      required: false,
      description: 'Full address information'
    },
    social_media: {
      type: 'object',
      required: false,
      description: 'Social media profiles'
    }
  };

  try {
    const result = await client.parse({
      inputData: contactText,
      outputSchema: contactSchema,
      instructions: 'Extract comprehensive contact information. Break down address into components.'
    });

    console.log('\n✅ Parse successful!');
    console.log('Parsed Data:', JSON.stringify(result.parsedData, null, 2));
    console.log('\nMetadata:');
    console.log(`- Confidence: ${result.metadata.confidence}`);
    console.log(`- Tokens Used: ${result.metadata.tokensUsed}`);
    console.log(`- Processing Time: ${result.metadata.processingTimeMs}ms`);
    console.log(`- Architect Plan Steps: ${result.metadata.architectPlan.steps.length}`);

  } catch (error) {
    console.error('❌ Parse failed:', error.message);
    if (error.details) {
      console.error('Details:', error.details);
    }
  }
}

// Example 2: Using the quick parse helper
async function quickParseExample() {
  console.log('\n⚡ Quick Parse Example');
  console.log('='.repeat(50));
  
  const emailText = `
    From: alice@example.com
    To: team@company.com
    Subject: Urgent: Server Migration This Weekend
    Date: 2024-01-15 09:30:00

    Hi team,

    We need to migrate the production servers this weekend (Jan 20-21).
    Please review the migration checklist by Thursday and let me know if you have any concerns.

    The maintenance window is scheduled for Saturday 2 AM - 6 AM PST.

    Tasks:
    - Back up all databases (John)
    - Update DNS records (Sarah)
    - Test failover systems (Mike)
    - Monitor post-migration (Alice)

    Thanks!
    Alice
  `;

  const emailSchema = {
    sender: 'email',
    recipients: 'string_array',
    subject: 'string',
    date: 'iso_date',
    action_items: 'string_array',
    mentioned_dates: 'string_array',
    priority: {
      type: 'string',
      description: 'Priority level: low, medium, high, urgent'
    },
    assignments: {
      type: 'object',
      description: 'Task assignments with person names'
    }
  };

  try {
    const result = await quickParse(
      process.env.PARSERATOR_API_KEY,
      emailText,
      emailSchema,
      'Extract all actionable information from this email. Identify task assignments and deadlines.'
    );

    console.log('\n✅ Quick parse successful!');
    console.log('Parsed Email:', JSON.stringify(result.parsedData, null, 2));
    console.log(`\nConfidence: ${result.metadata.confidence}`);
    console.log(`Tokens Used: ${result.metadata.tokensUsed}`);

  } catch (error) {
    console.error('❌ Quick parse failed:', error.message);
  }
}

// Example 3: Error handling
async function errorHandlingExample() {
  console.log('\n🛠️  Error Handling Example');
  console.log('='.repeat(50));
  
  const client = new ParseratorClient({
    apiKey: process.env.PARSERATOR_API_KEY
  });

  try {
    // This will fail due to empty input
    await client.parse({
      inputData: '',
      outputSchema: { name: 'string' }
    });
  } catch (error) {
    console.log('Expected validation error:', error.code, '-', error.message);
  }

  try {
    // This will fail due to invalid schema
    await client.parse({
      inputData: 'Some text',
      outputSchema: {}
    });
  } catch (error) {
    console.log('Expected schema error:', error.code, '-', error.message);
  }
}

// Example 4: Using presets
async function presetExample() {
  console.log('\n📋 Preset Example');
  console.log('='.repeat(50));
  
  const { CONTACT_PARSER, EMAIL_PARSER } = require('../dist/index.js');
  
  const client = new ParseratorClient({
    apiKey: process.env.PARSERATOR_API_KEY
  });

  const businessCardText = `
    Dr. Sarah Johnson
    Chief Technology Officer
    InnovateTech Solutions
    sarah.johnson@innovatetech.com
    Direct: (555) 987-6543
    Mobile: (555) 123-9876
    2500 Technology Plaza, Austin, TX 78759
    www.innovatetech.com
    Twitter: @sarahj_tech
  `;

  try {
    // Use the contact parser preset
    const result = await client.parse({
      inputData: businessCardText,
      outputSchema: CONTACT_PARSER.outputSchema,
      instructions: CONTACT_PARSER.instructions,
      options: CONTACT_PARSER.options
    });

    console.log('\n✅ Preset parsing successful!');
    console.log('Contact Info:', JSON.stringify(result.parsedData, null, 2));

  } catch (error) {
    console.error('❌ Preset parsing failed:', error.message);
  }
}

// Run all examples
async function runAllExamples() {
  if (!process.env.PARSERATOR_API_KEY) {
    console.error('❌ Please set PARSERATOR_API_KEY environment variable');
    console.error('   You can get an API key at https://app.parserator.com');
    process.exit(1);
  }

  console.log('🚀 Parserator SDK Basic Examples');
  console.log('='.repeat(50));
  
  try {
    await basicClientExample();
    await quickParseExample();
    await errorHandlingExample();
    await presetExample();
    
    console.log('\n🎉 All examples completed successfully!');
  } catch (error) {
    console.error('\n💥 Example failed:', error);
    process.exit(1);
  }
}

// Export for use in other scripts
module.exports = {
  basicClientExample,
  quickParseExample,
  errorHandlingExample,
  presetExample
};

// Run if called directly
if (require.main === module) {
  runAllExamples();
}
