/**
 * Batch Processing Example for Parserator SDK
 * Demonstrates processing multiple documents concurrently
 */

const { ParseratorClient } = require('../dist/index.js');
require('dotenv').config();

async function batchProcessingExample() {
  console.log('\n📦 Batch Processing Example');
  console.log('='.repeat(50));
  
  const client = new ParseratorClient({
    apiKey: process.env.PARSERATOR_API_KEY,
    debug: true
  });

  // Sample documents to process
  const documents = [
    {
      id: 'contact1',
      data: `
        John Smith
        Software Engineer
        TechCorp
        john@techcorp.com
        (555) 123-4567
      `,
      schema: {
        name: 'string',
        title: 'string',
        company: 'string',
        email: 'email',
        phone: 'phone'
      }
    },
    {
      id: 'invoice1',
      data: `
        INVOICE #INV-2024-001
        Date: January 15, 2024
        Due: February 15, 2024
        
        Bill To: Acme Corporation
        123 Business Street
        
        Item: Web Development Services
        Quantity: 40 hours
        Rate: $150/hour
        Amount: $6,000.00
        
        Tax (8.5%): $510.00
        Total: $6,510.00
      `,
      schema: {
        invoice_number: 'string',
        date: 'iso_date',
        due_date: 'iso_date',
        client: 'string',
        items: 'object',
        subtotal: 'number',
        tax: 'number',
        total: 'number'
      }
    },
    {
      id: 'email1',
      data: `
        From: alice@company.com
        To: team@company.com
        Subject: Project Update - Q1 Goals
        
        Hi team,
        
        Quick update on our Q1 objectives:
        
        1. Launch new product feature by March 15
        2. Increase customer satisfaction to 95%
        3. Hire 3 new developers
        
        Please review and let me know your thoughts by Friday.
        
        Best,
        Alice
      `,
      schema: {
        sender: 'email',
        recipients: 'string_array',
        subject: 'string',
        goals: 'string_array',
        deadline: 'string',
        action_items: 'string_array'
      }
    },
    {
      id: 'log1',
      data: `
        2024-01-15 10:30:15 INFO [UserService] User login successful: user_id=12345
        2024-01-15 10:30:45 ERROR [PaymentService] Payment failed: order_id=67890, error=INSUFFICIENT_FUNDS
        2024-01-15 10:31:02 WARN [DatabaseService] Slow query detected: duration=3.2s
        2024-01-15 10:31:15 INFO [UserService] User logout: user_id=12345
      `,
      schema: {
        entries: 'object',
        error_count: 'number',
        warning_count: 'number',
        info_count: 'number',
        time_range: 'object'
      }
    },
    {
      id: 'csv1',
      data: `
        Name,Age,Department,Salary,Start Date
        John Doe,32,Engineering,75000,2022-03-15
        Jane Smith,28,Marketing,68000,2023-01-10
        Bob Johnson,45,Sales,82000,2020-11-22
        Alice Brown,35,Engineering,78000,2021-08-05
      `,
      schema: {
        headers: 'string_array',
        employees: 'object',
        department_summary: 'object',
        salary_stats: 'object'
      }
    }
  ];

  // Convert to batch request format
  const batchRequest = {
    items: documents.map(doc => ({
      inputData: doc.data,
      outputSchema: doc.schema,
      instructions: `Parse this ${doc.id} data accurately and extract all relevant information.`
    })),
    options: {
      concurrency: 3, // Process 3 items simultaneously
      failFast: false, // Continue processing even if some items fail
      preserveOrder: true // Keep results in the same order as input
    }
  };

  // Progress callback to track processing
  const progressCallback = (progress) => {
    const percentage = Math.round((progress.completed / progress.total) * 100);
    console.log(`🔄 Progress: ${percentage}% (${progress.completed}/${progress.total}) - ${progress.currentItem}`);
    
    if (progress.estimatedTimeRemaining) {
      const seconds = Math.round(progress.estimatedTimeRemaining / 1000);
      console.log(`   Estimated time remaining: ${seconds}s`);
    }
  };

  try {
    console.log(`\nStarting batch processing of ${documents.length} documents...`);
    
    const startTime = Date.now();
    const batchResult = await client.batchParse(batchRequest, progressCallback);
    const endTime = Date.now();

    console.log('\n✅ Batch processing completed!');
    console.log('\nSummary:');
    console.log(`- Total items: ${batchResult.summary.total}`);
    console.log(`- Successful: ${batchResult.summary.successful}`);
    console.log(`- Failed: ${batchResult.summary.failed}`);
    console.log(`- Total tokens used: ${batchResult.summary.totalTokensUsed}`);
    console.log(`- Total processing time: ${batchResult.summary.totalProcessingTimeMs}ms`);
    console.log(`- Wall clock time: ${endTime - startTime}ms`);
    console.log(`- Efficiency gain: ${Math.round((batchResult.summary.totalProcessingTimeMs / (endTime - startTime)) * 100)}%`);

    console.log('\nResults:');
    batchResult.results.forEach((result, index) => {
      const doc = documents[index];
      console.log(`\n${index + 1}. ${doc.id.toUpperCase()}:`);
      
      if ('success' in result && result.success) {
        console.log(`   ✅ Success (confidence: ${result.metadata.confidence})`);
        console.log(`   Data: ${JSON.stringify(result.parsedData, null, 6).substring(0, 200)}...`);
      } else {
        console.log(`   ❌ Failed: ${result.message}`);
        if (result.details) {
          console.log(`   Details: ${JSON.stringify(result.details, null, 6)}`);
        }
      }
    });

  } catch (error) {
    console.error('❌ Batch processing failed:', error.message);
    if (error.details) {
      console.error('Details:', error.details);
    }
  }
}

// Example of processing files from disk
async function batchFileProcessingExample() {
  console.log('\n📁 Batch File Processing Example');
  console.log('='.repeat(50));
  
  const fs = require('fs').promises;
  const path = require('path');
  
  const client = new ParseratorClient({
    apiKey: process.env.PARSERATOR_API_KEY
  });

  try {
    // This would read actual files from a directory
    // const files = await fs.readdir('./sample-data');
    // const batchItems = [];
    
    // for (const file of files) {
    //   const content = await fs.readFile(path.join('./sample-data', file), 'utf8');
    //   batchItems.push({
    //     inputData: content,
    //     outputSchema: getSchemaForFileType(file),
    //     instructions: `Parse ${file} and extract all structured data`
    //   });
    // }

    // For demo purposes, we'll simulate this
    console.log('In a real scenario, this would:');
    console.log('1. Read files from a directory');
    console.log('2. Determine appropriate schema for each file type');
    console.log('3. Process all files in batch');
    console.log('4. Save results to output directory');
    console.log('5. Generate processing report');
    
  } catch (error) {
    console.error('❌ File processing failed:', error.message);
  }
}

// Helper function to determine schema based on file type
function getSchemaForFileType(filename) {
  const extension = filename.split('.').pop().toLowerCase();
  
  switch (extension) {
    case 'csv':
      return {
        headers: 'string_array',
        rows: 'object',
        metadata: 'object'
      };
    case 'log':
      return {
        entries: 'object',
        summary: 'object'
      };
    case 'json':
      return {
        structure: 'object',
        validation: 'object'
      };
    default:
      return {
        content: 'string',
        metadata: 'object',
        summary: 'string'
      };
  }
}

// Performance comparison example
async function performanceComparisonExample() {
  console.log('\n📏 Performance Comparison Example');
  console.log('='.repeat(50));
  
  const client = new ParseratorClient({
    apiKey: process.env.PARSERATOR_API_KEY
  });

  const testData = Array.from({ length: 10 }, (_, i) => ({
    inputData: `Contact ${i + 1}: John Doe ${i + 1}, Developer, john${i + 1}@example.com, (555) 123-${1000 + i}`,
    outputSchema: {
      name: 'string',
      title: 'string',
      email: 'email',
      phone: 'phone'
    }
  }));

  // Sequential processing
  console.log('\nTesting sequential processing...');
  const sequentialStart = Date.now();
  const sequentialResults = [];
  
  for (const item of testData) {
    try {
      const result = await client.parse(item);
      sequentialResults.push(result);
    } catch (error) {
      sequentialResults.push(error);
    }
  }
  
  const sequentialTime = Date.now() - sequentialStart;
  console.log(`Sequential time: ${sequentialTime}ms`);

  // Batch processing
  console.log('\nTesting batch processing...');
  const batchStart = Date.now();
  
  try {
    const batchResult = await client.batchParse({
      items: testData,
      options: { concurrency: 5 }
    });
    
    const batchTime = Date.now() - batchStart;
    console.log(`Batch time: ${batchTime}ms`);
    console.log(`Speed improvement: ${Math.round((sequentialTime / batchTime) * 100)}%`);
    
  } catch (error) {
    console.error('Batch processing failed:', error.message);
  }
}

// Run all batch examples
async function runBatchExamples() {
  if (!process.env.PARSERATOR_API_KEY) {
    console.error('❌ Please set PARSERATOR_API_KEY environment variable');
    process.exit(1);
  }

  console.log('🚀 Parserator SDK Batch Processing Examples');
  console.log('='.repeat(50));
  
  try {
    await batchProcessingExample();
    await batchFileProcessingExample();
    await performanceComparisonExample();
    
    console.log('\n🎉 All batch examples completed!');
  } catch (error) {
    console.error('\n💥 Batch example failed:', error);
    process.exit(1);
  }
}

module.exports = {
  batchProcessingExample,
  batchFileProcessingExample,
  performanceComparisonExample,
  getSchemaForFileType
};

if (require.main === module) {
  runBatchExamples();
}
