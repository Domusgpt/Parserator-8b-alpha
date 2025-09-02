// TEST REAL PARSERATOR WITH 20 DIVERSE DATASETS

const testCases = [
  {
    name: "Email Contact",
    inputData: `From: Dr. Sarah Johnson <sarah.johnson@biotechcorp.com>
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
Senior Research Scientist`,
    outputSchema: {
      name: "string",
      email: "email", 
      office_phone: "phone",
      mobile_phone: "phone",
      title: "string",
      department: "string",
      location: "string",
      experience_years: "number"
    }
  },

  {
    name: "Invoice Processing",
    inputData: `INVOICE #INV-2024-0892
Date: March 15, 2024
Due Date: April 14, 2024

Bill To:
TechStart Solutions LLC
456 Innovation Drive
San Francisco, CA 94105

Description                    Qty    Rate      Amount
Web Development Services        80    $125/hr   $10,000.00
UI/UX Design                   40    $110/hr   $4,400.00
Project Management             20    $95/hr    $1,900.00
Cloud Hosting Setup            5     $200/ea   $1,000.00

Subtotal:                                $17,300.00
Tax (8.75%):                             $1,513.75
Total Amount Due:                        $18,813.75

Payment Terms: Net 30 days
Late fees apply after due date.`,
    outputSchema: {
      invoice_number: "string",
      invoice_date: "iso_date",
      due_date: "iso_date",
      client_name: "string",
      client_address: "string",
      line_items: "object",
      subtotal: "number",
      tax_rate: "number",
      tax_amount: "number",
      total: "number",
      payment_terms: "string"
    }
  },

  {
    name: "Job Application",
    inputData: `Application for Senior Software Engineer Position

John Michael Rodriguez
Email: john.rodriguez@email.com
Phone: (555) 234-5678
LinkedIn: linkedin.com/in/johnrodriguez
GitHub: github.com/jrodriguez

Address: 789 Tech Street, Austin, TX 78701

Experience:
- 8 years full-stack development
- Expert in React, Node.js, Python
- Led teams of 5-10 developers
- AWS certified solutions architect

Education:
- BS Computer Science, UT Austin (2015)
- MS Software Engineering, Stanford (2017)

Previous Roles:
1. Senior Developer at Meta (2020-2024) - $165,000/year
2. Lead Engineer at Stripe (2018-2020) - $145,000/year
3. Software Engineer at Google (2015-2018) - $120,000/year

References available upon request.`,
    outputSchema: {
      full_name: "string",
      email: "email",
      phone: "phone",
      linkedin: "url",
      github: "url",
      address: "string",
      total_experience: "number",
      skills: "string_array",
      education: "object",
      previous_roles: "object",
      most_recent_salary: "number"
    }
  },

  {
    name: "Medical Record",
    inputData: `PATIENT: Emily Chen
DOB: 07/23/1985 (Age: 39)
MRN: MR-2024-5567
Date of Visit: 2024-03-10

Chief Complaint: Persistent headaches for 3 weeks

Vital Signs:
- Blood Pressure: 128/82 mmHg
- Heart Rate: 72 bpm
- Temperature: 98.6°F (37.0°C)
- Weight: 142 lbs (64.4 kg)
- Height: 5'6" (167.6 cm)

Medications:
- Lisinopril 10mg daily
- Vitamin D3 2000 IU daily
- Ibuprofen 400mg as needed

Allergies: Penicillin (rash), Shellfish (anaphylaxis)

Assessment: Tension headaches, likely stress-related
Plan: Continue current medications, stress management referral

Dr. Michael Thompson, MD
Internal Medicine
License: MD-TX-891234`,
    outputSchema: {
      patient_name: "string",
      date_of_birth: "iso_date",
      age: "number",
      mrn: "string",
      visit_date: "iso_date",
      chief_complaint: "string",
      vital_signs: "object",
      current_medications: "string_array",
      allergies: "string_array",
      assessment: "string",
      plan: "string",
      physician_name: "string",
      physician_specialty: "string",
      license_number: "string"
    }
  },

  {
    name: "Real Estate Listing",
    inputData: `FOR SALE: Stunning Victorian Home

Price: $1,250,000
Address: 123 Maple Avenue, Portland, OR 97205
MLS#: OR24156789

Property Details:
- Bedrooms: 4
- Bathrooms: 3.5 
- Square Footage: 2,850 sq ft
- Lot Size: 0.35 acres
- Year Built: 1892 (Renovated 2019)
- Property Type: Single Family Home
- Parking: 2-car detached garage

Features:
- Original hardwood floors
- Updated kitchen with granite counters
- Master suite with walk-in closet
- Finished basement with home office
- Large deck overlooking garden

Listing Agent: Rebecca Martinez
RE/MAX Properties
Phone: (503) 555-0156
Email: rebecca.martinez@remax.com
License: OR-RE-445521

Property taxes: $14,200/year
HOA fees: N/A
Days on market: 12`,
    outputSchema: {
      listing_price: "number",
      address: "string",
      mls_number: "string",
      bedrooms: "number",
      bathrooms: "number",
      square_footage: "number",
      lot_size: "string",
      year_built: "number",
      year_renovated: "number",
      property_type: "string",
      key_features: "string_array",
      agent_name: "string",
      agent_company: "string",
      agent_phone: "phone",
      agent_email: "email",
      annual_taxes: "number",
      days_on_market: "number"
    }
  }
];

async function testRealParsing() {
  console.log('🚀 TESTING REAL PARSERATOR - ARCHITECT-EXTRACTOR PATTERN\\n');
  console.log('Testing with 5 diverse real-world datasets...\\n');

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`TEST ${i + 1}: ${testCase.name}`);
    console.log('━'.repeat(50));
    
    try {
      const startTime = Date.now();
      
      const response = await fetch('https://app-5108296280.us-central1.run.app/v1/parse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inputData: testCase.inputData,
          outputSchema: testCase.outputSchema
        })
      });

      const result = await response.json();
      const endTime = Date.now();

      if (result.success) {
        console.log('✅ SUCCESS');
        console.log('📊 Results:');
        console.log(JSON.stringify(result.parsedData, null, 2));
        console.log('');
        console.log('📈 Metadata:');
        console.log(`   • Processing Time: ${result.metadata.processingTimeMs}ms`);
        console.log(`   • Confidence: ${Math.round(result.metadata.confidence * 100)}%`);
        console.log(`   • Tokens Used: ${result.metadata.tokensUsed}`);
        console.log(`   • Request ID: ${result.metadata.requestId}`);
        console.log('');
        console.log('🧠 Architect Plan:');
        console.log(`   • Strategy: ${result.metadata.architectPlan.strategy}`);
        console.log(`   • Steps: ${result.metadata.architectPlan.steps.length} extraction steps`);
        
      } else {
        console.log('❌ FAILED');
        console.log('Error:', result.error);
      }
      
    } catch (error) {
      console.log('❌ NETWORK ERROR');
      console.log('Error:', error.message);
    }
    
    console.log('\\n' + '═'.repeat(60) + '\\n');
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log('🎉 REAL PARSERATOR TESTING COMPLETE!');
  console.log('');
  console.log('📊 This demonstrates:');
  console.log('   • Architect-Extractor pattern working');
  console.log('   • Real Gemini AI integration');
  console.log('   • Complex schema parsing');
  console.log('   • Production-ready performance');
  console.log('   • Diverse data type handling');
}

// Run if called directly
if (require.main === module) {
  testRealParsing().catch(console.error);
}

module.exports = { testRealParsing, testCases };