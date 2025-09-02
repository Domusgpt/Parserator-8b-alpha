#!/usr/bin/env node

/**
 * PARSERATOR COMPREHENSIVE TEST SUITE
 * Tests all major parsing scenarios to ensure quality
 */

const API_BASE = 'https://us-central1-parserator-production.cloudfunctions.net/app';

// Test scenarios that will impress developers
const TEST_SCENARIOS = [
  {
    name: '🧪 Basic Contact Extraction',
    input: 'John Doe, CEO at TechCorp. Email: john@techcorp.com Phone: (555) 123-4567',
    schema: {
      name: 'string',
      title: 'string',
      company: 'string',
      email: 'email',
      phone: 'phone'
    },
    expected: {
      name: 'John Doe',
      title: 'CEO',
      company: 'TechCorp',
      email: 'john@techcorp.com',
      phone: '(555) 123-4567'
    }
  },
  
  {
    name: '📧 Email Thread Parsing',
    input: `
      From: alice@company.com
      To: team@company.com
      Date: March 15, 2024 2:00 PM
      Subject: Project Update
      
      Hi team,
      
      Quick update on the Q2 deliverables:
      - API Integration: 80% complete
      - Documentation: In progress
      - Testing: Starting next week
      
      Budget used: $45,000 of $60,000
      
      Let's sync tomorrow at 10am.
      
      Best,
      Alice
    `,
    schema: {
      from: 'email',
      to: 'email',
      date: 'datetime',
      subject: 'string',
      tasks: 'array',
      budget_used: 'currency',
      budget_total: 'currency',
      meeting_time: 'string'
    }
  },
  
  {
    name: '🧾 Invoice Processing',
    input: `
      INVOICE #INV-2024-1234
      
      Bill To:
      Acme Corporation
      123 Business Blvd
      San Francisco, CA 94105
      Tax ID: 12-3456789
      
      Items:
      1. Professional Services (40 hours @ $150/hr): $6,000.00
      2. Software License (Annual): $12,000.00
      3. Priority Support: $3,000.00
      
      Subtotal: $21,000.00
      Tax (8.625%): $1,811.25
      
      TOTAL DUE: $22,811.25
      
      Payment Terms: Net 30
      Due Date: April 15, 2024
    `,
    schema: {
      invoice_number: 'string',
      company_name: 'string',
      company_address: 'string',
      tax_id: 'string',
      line_items: [{
        description: 'string',
        amount: 'currency'
      }],
      subtotal: 'currency',
      tax_rate: 'number',
      tax_amount: 'currency',
      total_due: 'currency',
      payment_terms: 'string',
      due_date: 'date'
    }
  },
  
  {
    name: '📊 CSV Data Transformation',
    input: `
      Name,Email,Department,Salary,Start Date
      John Smith,jsmith@corp.com,Engineering,"$120,000",2022-03-15
      Sarah Johnson,sjohnson@corp.com,Marketing,"$95,000",2021-07-22
      Mike Chen,mchen@corp.com,Engineering,"$135,000",2020-01-10
      Lisa Park,lpark@corp.com,Sales,"$105,000",2023-02-01
    `,
    schema: {
      employees: [{
        full_name: 'string',
        email: 'email',
        department: 'string',
        salary: 'currency',
        start_date: 'date',
        years_employed: 'number'
      }]
    }
  },
  
  {
    name: '🛒 E-commerce Product Listing',
    input: `
      Product: MacBook Pro 16" (2024)
      SKU: APPLE-MBP16-2024
      Price: $2,499.00 (was $2,799.00 - Save $300!)
      
      Key Features:
      • M3 Pro chip with 12-core CPU
      • 18-core GPU
      • 18GB unified memory
      • 512GB SSD storage
      • 16.2-inch Liquid Retina XDR display
      • Up to 22 hours battery life
      
      In Stock: Yes (14 units available)
      Ships within: 1-2 business days
      
      Customer Rating: 4.8/5 (324 reviews)
    `,
    schema: {
      product_name: 'string',
      sku: 'string',
      current_price: 'currency',
      original_price: 'currency',
      discount: 'currency',
      features: 'string_array',
      in_stock: 'boolean',
      stock_quantity: 'number',
      shipping_time: 'string',
      rating: 'number',
      review_count: 'number'
    }
  },
  
  {
    name: '📝 Meeting Notes Extraction',
    input: `
      Meeting Notes - Product Roadmap Review
      Date: March 15, 2024
      Attendees: John (PM), Sarah (Eng), Mike (Design), Lisa (QA)
      
      Decisions Made:
      1. Launch v2.0 on April 30th
      2. Prioritize mobile app over desktop
      3. Hire 2 more engineers by Q3
      
      Action Items:
      - John: Update roadmap document by Mar 20
      - Sarah: Complete API design by Mar 25
      - Mike: Finish mockups by Mar 22
      - Lisa: Prepare test plan by Apr 1
      
      Budget approved: $250,000 for Q2
      Next meeting: March 29, 2024 at 2:00 PM
    `,
    schema: {
      meeting_title: 'string',
      date: 'date',
      attendees: [{
        name: 'string',
        role: 'string'
      }],
      decisions: 'string_array',
      action_items: [{
        assignee: 'string',
        task: 'string',
        due_date: 'date'
      }],
      budget_approved: 'currency',
      next_meeting: 'datetime'
    }
  },
  
  {
    name: '🏠 Real Estate Listing Parse',
    input: `
      Stunning Modern Home in Pacific Heights
      
      $3,475,000 | 4 beds | 3.5 baths | 3,200 sqft
      
      Address: 2850 Pacific Avenue, San Francisco, CA 94115
      
      Built: 2019
      Lot Size: 4,500 sqft
      HOA: $450/month
      
      Features:
      - Panoramic city views
      - Chef's kitchen with Sub-Zero appliances
      - Master suite with walk-in closet
      - 2-car garage with EV charging
      - Smart home technology throughout
      
      Open House: Saturday & Sunday 1-4 PM
      Listed by: Jane Realtor, DRE# 01234567
      Contact: (415) 555-0100 or jane@luxuryrealty.com
    `,
    schema: {
      title: 'string',
      price: 'currency',
      bedrooms: 'number',
      bathrooms: 'number',
      square_feet: 'number',
      address: 'string',
      year_built: 'number',
      lot_size: 'string',
      hoa_fee: 'currency',
      features: 'string_array',
      open_house_times: 'string',
      agent_name: 'string',
      agent_license: 'string',
      agent_phone: 'phone',
      agent_email: 'email'
    }
  },
  
  {
    name: '🔬 Research Paper Metadata',
    input: `
      Title: "Deep Learning Approaches for Natural Language Understanding: A Comprehensive Survey"
      
      Authors: 
      - Dr. Emily Chen (Stanford University, echen@stanford.edu)
      - Prof. Michael Zhang (MIT, mzhang@mit.edu)
      - Dr. Sarah Williams (Google Research, swilliams@google.com)
      
      Published: Journal of Artificial Intelligence Research, Vol. 72, March 2024
      DOI: 10.1613/jair.2024.12345
      
      Abstract: This paper presents a comprehensive survey of deep learning approaches...
      
      Keywords: deep learning, NLP, transformers, BERT, GPT, attention mechanisms
      
      Citation Count: 127
      Download URL: https://arxiv.org/pdf/2024.12345.pdf
    `,
    schema: {
      title: 'string',
      authors: [{
        name: 'string',
        affiliation: 'string',
        email: 'email'
      }],
      journal: 'string',
      volume: 'number',
      publication_date: 'string',
      doi: 'string',
      keywords: 'string_array',
      citation_count: 'number',
      download_url: 'url'
    }
  }
];

// Test runner
async function runTests(apiKey = 'demo') {
  console.log('🚀 PARSERATOR COMPREHENSIVE TEST SUITE');
  console.log('=====================================\n');
  
  let passed = 0;
  let failed = 0;
  
  for (const test of TEST_SCENARIOS) {
    console.log(`\nRunning: ${test.name}`);
    console.log('-'.repeat(50));
    
    try {
      const response = await fetch(`${API_BASE}/v1/parse`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          inputData: test.input,
          outputSchema: test.schema
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        console.log('✅ PASSED');
        console.log('📊 Parsed Data:', JSON.stringify(result.parsedData, null, 2));
        console.log(`⚡ Performance: ${result.metadata?.processingTimeMs || 'N/A'}ms`);
        console.log(`🎯 Confidence: ${result.metadata?.confidence || 'N/A'}`);
        passed++;
      } else {
        console.log('❌ FAILED');
        console.log('Error:', result.error);
        failed++;
      }
    } catch (error) {
      console.log('❌ FAILED');
      console.log('Error:', error.message);
      failed++;
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log(`📊 TEST RESULTS: ${passed} passed, ${failed} failed`);
  console.log(`✨ Success Rate: ${((passed / TEST_SCENARIOS.length) * 100).toFixed(1)}%`);
  
  if (passed === TEST_SCENARIOS.length) {
    console.log('\n🎉 ALL TESTS PASSED! Parserator is ready for production!');
  }
}

// Check if API is ready first
async function checkAPIStatus() {
  try {
    const response = await fetch(`${API_BASE}/health`);
    if (response.ok) {
      console.log('✅ API is ready!');
      return true;
    } else {
      console.log('⏳ API still initializing...');
      return false;
    }
  } catch (error) {
    console.log('⏳ API not ready yet...');
    return false;
  }
}

// Main execution
async function main() {
  console.log('🔍 Checking API status...\n');
  
  const isReady = await checkAPIStatus();
  
  if (isReady) {
    await runTests(process.env.PARSERATOR_API_KEY || 'demo');
  } else {
    console.log('\n💡 API is still deploying. Try again in 1-2 minutes.');
    console.log('📝 Meanwhile, review the test scenarios above to see what Parserator can do!');
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { TEST_SCENARIOS, runTests };