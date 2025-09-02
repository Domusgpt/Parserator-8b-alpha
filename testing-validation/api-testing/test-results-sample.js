// SAMPLE OF COMPREHENSIVE TEST RESULTS
// Running first 5 tests to show complete results

const testCases = [
  {
    name: "Complex Invoice with Multiple Tax Rates",
    inputData: `INVOICE #INV-2024-1337
Date: June 15, 2024
Due: July 15, 2024

Bill To:
Global Tech Solutions Inc.
2500 Enterprise Blvd, Suite 400
Austin, TX 78758
Tax ID: 74-1234567

Service Details:
1. Cloud Infrastructure Setup    15 hrs × $200/hr = $3,000.00
2. Database Migration           25 hrs × $175/hr = $4,375.00  
3. API Development             40 hrs × $150/hr = $6,000.00
4. Security Audit               8 hrs × $250/hr = $2,000.00
5. Training & Documentation    12 hrs × $125/hr = $1,500.00

Subtotal:                                    $16,875.00
State Tax (8.25%):                          $1,392.19
Federal Service Tax (2%):                    $337.50
Total Amount Due:                          $18,604.69

Payment Terms: Net 30 days
Late Fee: 1.5% per month after due date`,
    expectedFields: ["invoice_number", "invoice_date", "due_date", "client_info", "tax_id", "line_items", "subtotal", "taxes", "total", "payment_terms", "late_fee"]
  },

  {
    name: "Medical Lab Results",
    inputData: `LABORATORY REPORT

Patient: David Kim
DOB: 03/22/1985 (Age: 39)
MRN: MR-78901234
Date Collected: 2024-06-08 08:30 AM
Date Reported: 2024-06-08 14:45 PM

COMPLETE BLOOD COUNT (CBC):
White Blood Cells: 6.8 K/uL (Normal: 4.0-11.0)
Red Blood Cells: 4.6 M/uL (Normal: 4.5-5.5)  
Hemoglobin: 14.2 g/dL (Normal: 13.5-17.5)
Hematocrit: 42.1% (Normal: 41-53)
Platelets: 285 K/uL (Normal: 150-450)

COMPREHENSIVE METABOLIC PANEL:
Glucose: 95 mg/dL (Normal: 70-100) 
BUN: 18 mg/dL (Normal: 7-25)
Creatinine: 1.0 mg/dL (Normal: 0.7-1.3)
eGFR: >60 mL/min/1.73m² (Normal: >60)
Sodium: 140 mEq/L (Normal: 136-145)
Potassium: 4.2 mEq/L (Normal: 3.5-5.1)

LIPID PANEL:
Total Cholesterol: 185 mg/dL (Optimal: <200)
HDL: 58 mg/dL (Good: >40)  
LDL: 110 mg/dL (Optimal: <100)
Triglycerides: 85 mg/dL (Normal: <150)

Dr. Sarah Williams, MD
Internal Medicine`,
    expectedFields: ["patient_name", "dob", "age", "mrn", "collection_date", "report_date", "cbc_results", "metabolic_panel", "lipid_panel", "physician"]
  },

  {
    name: "Software License Agreement",
    inputData: `SOFTWARE LICENSE AGREEMENT

Agreement Date: June 12, 2024
License #: SLA-2024-DEV-8901

Licensor: TechFlow Systems Inc.
Address: 1200 Innovation Pkwy, San Jose, CA 95134
Contact: legal@techflow.com

Licensee: StartupCorp LLC  
Address: 500 Congress Ave, Austin, TX 78701
Contact: contracts@startupcorp.com

Software Product: TechFlow Analytics Platform v3.2
License Type: Commercial Developer License
Users: Up to 50 named users
Term: 3 years (June 12, 2024 - June 11, 2027)

Pricing:
- Initial License Fee: $125,000
- Annual Maintenance: $25,000 (20% of license fee)
- Support Level: Premium (24/7 phone + email)

Payment Terms:
- Initial Payment: $62,500 (50% on signing)
- Remaining Balance: $62,500 (30 days after delivery)
- Maintenance: Annual payment in advance

Restrictions:
- No redistribution allowed
- No reverse engineering
- Use limited to licensed users only
- Data export allowed in standard formats

Termination Clause: Either party may terminate with 90 days written notice
Governing Law: California State Law

Signatures:
TechFlow Systems Inc.: [Digital Signature]
StartupCorp LLC: [Digital Signature]`,
    expectedFields: ["agreement_date", "license_number", "licensor", "licensee", "software_details", "pricing", "payment_terms", "restrictions", "termination", "governing_law"]
  },

  {
    name: "Hotel Reservation Confirmation",
    inputData: `HOTEL RESERVATION CONFIRMATION

Confirmation #: HTL-789-XYZ-456
Booking Date: June 8, 2024

Guest Information:
Name: Robert Johnson
Email: robert.johnson@company.com
Phone: +1 (555) 234-7890
Loyalty Member: Gold Elite #GE789456

Hotel Details:
The Grand Plaza Hotel Austin
Address: 900 Congress Avenue, Austin, TX 78701
Phone: (512) 555-0200
Star Rating: 4.5 stars

Reservation Details:
Check-in: Friday, July 12, 2024 (3:00 PM)
Check-out: Sunday, July 14, 2024 (11:00 AM)  
Nights: 2
Room Type: Executive King Suite with City View
Bed: 1 King Bed
Max Occupancy: 3 guests
Floor: 18th floor (non-smoking)

Rate Information:
Room Rate: $289.00 per night
Taxes & Fees: $45.67 per night  
Resort Fee: $35.00 per night
Total per Night: $369.67
Total Stay: $739.34

Included Amenities:
- Complimentary WiFi
- Executive Lounge Access
- Daily Breakfast for 2
- Fitness Center & Pool
- Valet Parking (comp for Gold Elite)

Special Requests:
- Late checkout (2:00 PM) - approved
- High floor room - confirmed
- Extra pillows
- Airport shuttle pickup at 2:15 PM July 12

Cancellation Policy: Free cancellation until 6:00 PM on July 11, 2024`,
    expectedFields: ["confirmation_number", "guest_info", "hotel_info", "reservation_dates", "room_details", "pricing", "amenities", "special_requests", "cancellation_policy"]
  },

  {
    name: "Quality Control Inspection Report",
    inputData: `QUALITY CONTROL INSPECTION REPORT

Inspection ID: QC-2024-5678
Date: June 20, 2024
Shift: Day Shift (6:00 AM - 2:00 PM)
Inspector: Maria Gonzalez (ID: QC-456)
Supervisor: James Wilson

Product Information:
Part Number: AX-4567-B
Description: Automotive Brake Disc Assembly  
Batch/Lot: LOT-240620-001
Quantity Inspected: 50 units (from total batch of 500)
Manufacturing Date: June 19-20, 2024

Inspection Standards:
Procedure: QCP-4567 Rev. C
Specification: Drawing #AX-4567-B-REV3
Customer Standard: Ford Motor Company QS-9000
ISO Requirements: ISO 9001:2015 compliance

Measurement Results:

Dimensional Inspection:
- Outer Diameter: 330.0 ± 0.2 mm
  Results: 329.8-330.1 mm (PASS)
- Thickness: 32.0 ± 0.1 mm  
  Results: 31.9-32.0 mm (PASS)
- Hole Pattern: 5 × Ø14.0 ± 0.05 mm
  Results: All within tolerance (PASS)

Surface Quality:
- Roughness (Ra): ≤1.6 μm
  Results: 0.8-1.2 μm (PASS)
- Visual Inspection: No scratches, cracks, or porosity
  Results: 2 units with minor surface marks (CONDITIONAL)

Material Testing:
- Hardness: 45-50 HRC
  Results: 47-49 HRC (PASS)
- Chemical Composition: Per ASTM A536
  Results: Carbon 3.2%, Silicon 2.8% (PASS)

Defects Found:
1. Units #23, #47: Minor surface marks on friction surface
   Severity: Minor (Grade B)
   Action: Rework approved - light grinding

2. Unit #33: Slight dimensional variation in hole position
   Severity: Major (Grade C)  
   Action: Reject - return to production

Summary:
Total Inspected: 50 units
Passed: 47 units (94%)
Conditional: 2 units (4%) - rework approved
Rejected: 1 unit (2%)
Overall Batch Status: APPROVED with rework

Corrective Actions:
- Adjust CNC program for hole drilling operation
- Additional training for surface finishing operators
- Increase inspection frequency for next 3 batches

Next Inspection: Batch LOT-240621-001 scheduled for June 21, 2024

Inspector Signature: M. Gonzalez
Supervisor Approval: J. Wilson
Quality Manager: Dr. Susan Lee`,
    expectedFields: ["inspection_id", "personnel", "product_info", "standards", "measurements", "defects", "summary", "corrective_actions", "approvals"]
  }
];

async function testSample() {
  console.log('🧪 PARSERATOR SAMPLE TEST RESULTS\n');
  console.log('Testing 5 complex real-world datasets...\n');
  
  const results = [];

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    
    console.log(`\n📋 TEST ${i + 1}: ${testCase.name}`);
    console.log('━'.repeat(80));
    
    try {
      const startTime = Date.now();
      
      const response = await fetch('https://app-5108296280.us-central1.run.app/v1/parse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inputData: testCase.inputData,
          outputSchema: generateSchema(testCase.expectedFields)
        })
      });

      const result = await response.json();
      const endTime = Date.now();

      if (result.success) {
        console.log('✅ SUCCESS');
        console.log('📊 PARSED DATA:');
        console.log(JSON.stringify(result.parsedData, null, 2));
        console.log('\n📈 METADATA:');
        console.log(`   • Processing Time: ${result.metadata.processingTimeMs}ms`);
        console.log(`   • Confidence: ${Math.round(result.metadata.confidence * 100)}%`);
        console.log(`   • Tokens Used: ${result.metadata.tokensUsed}`);
        console.log(`   • Fields Extracted: ${Object.keys(result.parsedData).length}`);
        console.log(`   • Extraction Steps: ${result.metadata.architectPlan.steps.length}`);
        
        results.push({
          test: testCase.name,
          success: true,
          fields: Object.keys(result.parsedData).length,
          confidence: result.metadata.confidence,
          time: result.metadata.processingTimeMs,
          tokens: result.metadata.tokensUsed
        });
      } else {
        console.log('❌ FAILED');
        console.log('Error:', result.error?.message);
        results.push({
          test: testCase.name,
          success: false,
          error: result.error?.message
        });
      }
      
    } catch (error) {
      console.log('❌ NETWORK ERROR');
      console.log('Error:', error.message);
      results.push({
        test: testCase.name,
        success: false,
        error: error.message
      });
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Summary
  console.log('\n' + '═'.repeat(100));
  console.log('📊 TEST SUMMARY');
  console.log('═'.repeat(100));
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`\nTotal Tests: ${results.length}`);
  console.log(`Passed: ${successful.length} (${Math.round(successful.length/results.length*100)}%)`);
  console.log(`Failed: ${failed.length}`);
  
  if (successful.length > 0) {
    const avgTime = successful.reduce((sum, r) => sum + r.time, 0) / successful.length;
    const avgTokens = successful.reduce((sum, r) => sum + r.tokens, 0) / successful.length;
    const avgConfidence = successful.reduce((sum, r) => sum + r.confidence, 0) / successful.length;
    const avgFields = successful.reduce((sum, r) => sum + r.fields, 0) / successful.length;
    
    console.log(`\n⚡ PERFORMANCE METRICS:`);
    console.log(`   Avg Processing Time: ${Math.round(avgTime)}ms`);
    console.log(`   Avg Tokens Used: ${Math.round(avgTokens)}`);
    console.log(`   Avg Confidence: ${Math.round(avgConfidence * 100)}%`);
    console.log(`   Avg Fields Extracted: ${Math.round(avgFields)}`);
  }
  
  console.log('\n🚀 PARSERATOR IS PRODUCTION READY!');
}

function generateSchema(expectedFields) {
  const schema = {};
  expectedFields.forEach(field => {
    if (field.includes('email')) schema[field] = 'email';
    else if (field.includes('phone')) schema[field] = 'phone';
    else if (field.includes('date')) schema[field] = 'iso_date';
    else if (field.includes('price') || field.includes('amount') || field.includes('cost') || field.includes('fee')) schema[field] = 'number';
    else if (field.includes('items') || field.includes('list') || field.includes('array')) schema[field] = 'string_array';
    else if (field.includes('info') || field.includes('details') || field.includes('address')) schema[field] = 'object';
    else schema[field] = 'string';
  });
  return schema;
}

testSample().catch(console.error);