// COMPREHENSIVE PARSERATOR TESTING SUITE
// Tests 20+ diverse real-world datasets to validate production readiness

const testCases = [
  // BUSINESS & FINANCIAL
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
    name: "Employee Performance Review",
    inputData: `PERFORMANCE REVIEW - Q2 2024

Employee: Jessica Martinez
ID: EMP-4521
Department: Software Engineering
Manager: Robert Chen
Review Period: April 1 - June 30, 2024

Technical Skills (1-5 scale):
- Programming Languages: 4.5/5
- System Design: 4.0/5  
- Code Quality: 4.5/5
- Testing: 3.5/5
- Documentation: 4.0/5

Projects Completed:
1. User Authentication System (95% completion, 2 days early)
2. Payment Gateway Integration (100% completion, on time)
3. Mobile App API Redesign (90% completion, 1 week early)

Goals for Next Quarter:
- Lead junior developer mentoring program
- Complete AWS certification
- Improve test coverage to >90%

Overall Rating: 4.2/5 (Exceeds Expectations)
Salary Adjustment: +8% effective July 1, 2024
Promotion: Senior Software Engineer`,
    expectedFields: ["employee_name", "employee_id", "department", "manager", "review_period", "technical_skills", "projects", "goals", "overall_rating", "salary_adjustment", "promotion"]
  },

  // HEALTHCARE & MEDICAL
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
    name: "Prescription Details",
    inputData: `PRESCRIPTION

Patient: Maria Rodriguez
DOB: 12/15/1975
Address: 123 Oak Street, Dallas, TX 75201
Phone: (214) 555-8899
Insurance: Blue Cross Blue Shield - Group #12345

Rx #: 2024-PRX-789456
Date: June 10, 2024
Prescriber: Dr. Michael Thompson, MD
DEA #: BT1234567

Medications:
1. Lisinopril 10mg tablets
   Sig: Take one tablet by mouth daily
   Qty: 90 tablets (90-day supply)
   Refills: 5

2. Metformin 500mg tablets  
   Sig: Take one tablet twice daily with meals
   Qty: 180 tablets (90-day supply)
   Refills: 5

3. Atorvastatin 20mg tablets
   Sig: Take one tablet by mouth at bedtime
   Qty: 90 tablets (90-day supply) 
   Refills: 3

Generic Substitution: Allowed
Total Cost: $45.67 (Copay: $15.00)
Pharmacy: MediCare Pharmacy
Pharmacist: Jennifer Kim, PharmD`,
    expectedFields: ["patient_info", "insurance", "rx_number", "date", "prescriber", "medications", "generic_allowed", "cost", "pharmacy", "pharmacist"]
  },

  // REAL ESTATE & PROPERTY
  {
    name: "Property Listing with Virtual Tour",
    inputData: `FOR SALE - LUXURY WATERFRONT HOME

MLS #: TX-2024-55789
Price: $2,850,000
Address: 4567 Lakeshore Drive, Austin, TX 78746

Property Details:
- Bedrooms: 5
- Bathrooms: 4.5  
- Square Footage: 4,200 sq ft
- Lot Size: 1.2 acres
- Year Built: 2018
- Property Type: Single Family Residence
- Architectural Style: Modern Contemporary

Premium Features:
- Private boat dock with lift
- Infinity pool with spa
- Gourmet kitchen with Wolf appliances
- Master suite with lake views
- 3-car garage with Tesla charging
- Smart home automation system
- Wine cellar (200+ bottles)

Listing Agent: Amanda Foster
Coldwell Banker Luxury
Phone: (512) 555-0177
Email: amanda.foster@cbluxury.com
License: TX-RE-889922

Property Taxes: $28,500/year (2023)
HOA Fees: $450/month
Days on Market: 8
Showing Instructions: Call listing agent 24hr notice

Virtual Tour: www.virtualtours.com/tx55789
Drone Video: www.youtube.com/watch?v=abc123`,
    expectedFields: ["mls_number", "price", "address", "property_details", "features", "agent_info", "financial_info", "marketing", "virtual_media"]
  },

  // LEGAL & CONTRACTS
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

  // TRAVEL & HOSPITALITY  
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

  // EDUCATION & ACADEMIC
  {
    name: "University Transcript",
    inputData: `OFFICIAL TRANSCRIPT

University of Texas at Austin
Office of the Registrar
2515 Speedway, Austin, TX 78712

Student Information:
Name: Alexandra Chen
Student ID: UT-2020-445789
Date of Birth: August 15, 2002
Degree: Bachelor of Science in Computer Science
College: Cockrell School of Engineering

Academic Record:
Enrollment: Fall 2020 - Spring 2024
Graduation Date: May 18, 2024
GPA: 3.78 (Magna Cum Laude)

SEMESTER GRADES:

Fall 2020:
- CS 303: Intro to Programming (A)
- M 408C: Differential Calculus (B+)
- UGS 303: Ethics in Computing (A-)
- E 316K: Rhetoric & Writing (B+)
Hours: 15, GPA: 3.67

Spring 2021:  
- CS 314: Data Structures (A)
- CS 311: Discrete Math (A-)
- M 408D: Integral Calculus (B+)
- PHY 303K: Physics I (B)
Hours: 16, GPA: 3.50

[... continues through Spring 2024]

Final Semester - Spring 2024:
- CS 395T: Senior Capstone (A)
- CS 378: Machine Learning (A)
- CS 371P: Software Engineering (A-)
- Technical Writing (B+)
Hours: 12, GPA: 3.83

Total Hours: 128
Cumulative GPA: 3.78

Honors & Awards:
- Dean's List: Fall 2021, Spring 2022, Fall 2023
- Undergraduate Research Award 2023
- CS Department Outstanding Student 2024

Date Issued: May 20, 2024
Registrar: Dr. Patricia Williams`,
    expectedFields: ["student_info", "degree_info", "academic_summary", "semester_grades", "total_hours", "cumulative_gpa", "honors", "issue_date"]
  },

  // GOVERNMENT & LEGAL DOCUMENTS
  {
    name: "Building Permit Application",
    inputData: `BUILDING PERMIT APPLICATION

Permit #: BP-2024-07789
Application Date: June 15, 2024
City of Austin Development Services

Property Information:
Address: 1234 Cedar Park Drive, Austin, TX 78703
Legal Description: Lot 15, Block C, Cedar Hills Subdivision
Property Owner: Sarah & Michael Thompson
Parcel ID: 123-456-789-012

Project Details:
Work Type: Residential Addition & Renovation
Description: Two-story addition with master suite, kitchen remodel
Square Footage: Adding 850 sq ft (existing: 2,100 sq ft)
Estimated Cost: $185,000
Contractor: Premier Home Builders LLC (License: TX-CON-12345)

Construction Details:
- Foundation: Concrete slab with post-tension cables
- Framing: Wood frame construction  
- Roofing: Architectural shingles to match existing
- Electrical: 200 amp service upgrade required
- Plumbing: New master bath, kitchen upgrades
- HVAC: Extend existing system + supplemental unit

Required Inspections:
1. Foundation inspection
2. Framing inspection  
3. Electrical rough-in
4. Plumbing rough-in
5. Insulation inspection
6. Final inspection

Fees:
Plan Review Fee: $1,250
Permit Fee: $2,850
Impact Fees: $4,200
Total Paid: $8,300

Approval Date: June 22, 2024
Expiration: June 22, 2025
Inspector: James Rodriguez, Code Enforcement`,
    expectedFields: ["permit_number", "property_info", "project_details", "construction_specs", "inspections", "fees", "approval_info", "inspector"]
  },

  // AUTOMOTIVE & VEHICLE
  {
    name: "Vehicle Purchase Agreement",
    inputData: `VEHICLE PURCHASE AGREEMENT

Dealer: Austin European Motors
Address: 4500 Research Blvd, Austin, TX 78759
License: TX-AUTO-DEL-5567
Date: June 20, 2024

Buyer Information:
Name: Jennifer Martinez
Address: 890 Hill Country Rd, Austin, TX 78746
Phone: (512) 555-9876
Driver's License: TX-DL-34567890

Vehicle Details:
Year: 2024
Make: BMW
Model: X5 xDrive40i
VIN: WBAJA7C50PCD12345
Color: Alpine White/Black Interior
Mileage: 12 miles (new)
Engine: 3.0L Turbo I6
Transmission: 8-Speed Automatic
Drivetrain: All-Wheel Drive

Options & Packages:
- Premium Package ($3,200)
- Driving Assistance Pro ($1,700)  
- Harman Kardon Audio ($875)
- 20" M Sport Wheels ($1,200)
- Panoramic Moonroof ($1,350)

Pricing:
MSRP: $67,800
Options: $8,325
Destination Fee: $995
Subtotal: $77,120
Trade-in Credit: -$18,500 (2019 Honda Pilot)
Dealer Discount: -$2,500
Sales Tax (8.25%): $4,613
Title & License: $485
Total Amount: $61,218

Financing:
Down Payment: $12,000 (cash)
Amount Financed: $49,218
Term: 60 months
APR: 4.9%
Monthly Payment: $925.67

Extended Warranty: 5 years/75,000 miles ($2,800)
Gap Insurance: $895

Delivery Date: June 25, 2024`,
    expectedFields: ["dealer_info", "buyer_info", "vehicle_details", "options", "pricing", "financing", "warranties", "delivery_date"]
  },

  // INSURANCE & FINANCIAL SERVICES
  {
    name: "Insurance Claim Report",
    inputData: `INSURANCE CLAIM REPORT

Claim Number: CLM-2024-HO-78945
Policy Number: HO-889-567-123
Date of Loss: June 18, 2024, 2:30 PM
Report Date: June 19, 2024

Policyholder:
Name: Michael & Lisa Rodriguez
Address: 2567 Maple Grove Lane, Austin, TX 78704
Phone: (512) 555-4433
Policy Effective: Jan 1, 2024 - Jan 1, 2025

Incident Details:
Type of Loss: Water Damage
Cause: Burst water heater in utility room
Discovery Time: 6:45 PM (homeowner returned from work)
Initial Response: Water shut off, emergency plumber called

Affected Areas:
- Utility room (100% damaged)
- Kitchen (flooding, cabinet damage)  
- Living room (carpet, baseboards)
- Hardwood flooring (1,200 sq ft warped)

Emergency Services:
- Water extraction: ServiceMaster ($2,850)
- Emergency board-up: N/A
- Temporary lodging: 5 nights at Hampton Inn ($750)

Estimated Damages:
Water heater replacement: $1,800
Flooring (hardwood): $18,500  
Kitchen cabinets: $12,000
Drywall/painting: $8,500
Contents damage: $4,200
Labor: $15,000
Total Estimate: $60,000

Coverage:
Dwelling Coverage: $450,000
Personal Property: $225,000  
Deductible: $2,500
Additional Living Expenses: $50,000

Adjuster: Robert Kim
Phone: (512) 555-8800
Next Inspection: June 25, 2024

Status: Under Review`,
    expectedFields: ["claim_info", "policyholder", "incident_details", "affected_areas", "emergency_services", "damage_estimates", "coverage_info", "adjuster", "status"]
  },

  // SCIENTIFIC & RESEARCH
  {
    name: "Clinical Trial Data",
    inputData: `CLINICAL TRIAL PARTICIPANT DATA

Study Title: Phase II Trial of Novel Hypertension Treatment
Protocol ID: HTN-2024-Phase2-901
Principal Investigator: Dr. Rebecca Martinez, MD
Institution: Austin Medical Research Center
IRB Approval: IRB-2024-0234

Participant Information:
Study ID: P-4567
Initials: M.K.
Age: 52 years
Gender: Male
Ethnicity: Hispanic/Latino
BMI: 28.4 kg/m²

Enrollment Data:
Screening Date: May 15, 2024
Randomization: June 1, 2024
Group Assignment: Treatment Group A (Active Drug)
Baseline BP: 158/94 mmHg

Visit Schedule & Results:

Baseline Visit (Day 0):
- Systolic BP: 158 mmHg
- Diastolic BP: 94 mmHg  
- Heart Rate: 78 bpm
- Weight: 185 lbs
- Lab Values: Normal kidney function
- Adverse Events: None

Week 2 Visit (Day 14):
- Systolic BP: 145 mmHg
- Diastolic BP: 89 mmHg
- Heart Rate: 75 bpm  
- Weight: 183 lbs
- Medication Compliance: 100%
- Adverse Events: Mild headache (Grade 1)

Week 4 Visit (Day 28):
- Systolic BP: 138 mmHg
- Diastolic BP: 85 mmHg
- Heart Rate: 73 bpm
- Weight: 182 lbs
- Medication Compliance: 95%
- Adverse Events: None

Primary Endpoint: Reduction in systolic BP ≥10 mmHg
Result: ACHIEVED (20 mmHg reduction)

Concomitant Medications:
- Metformin 1000mg BID (diabetes)
- Atorvastatin 40mg daily (cholesterol)

Study Coordinator: Jennifer Lee, RN
Contact: (512) 555-7788`,
    expectedFields: ["study_info", "participant_demographics", "enrollment_data", "visit_results", "endpoints", "medications", "coordinator"]
  },

  // FOOD & RESTAURANT
  {
    name: "Restaurant Order & Delivery",
    inputData: `ONLINE ORDER CONFIRMATION

Order #: ORD-456789-TX
Restaurant: Primo Italian Bistro
Address: 1200 S. Lamar Blvd, Austin, TX 78704
Phone: (512) 555-FOOD

Customer Information:
Name: Ashley Thompson  
Phone: (512) 555-9988
Email: ashley.t@email.com
Delivery Address: 567 Oak Hill Drive, Austin, TX 78745

Order Details:
Date: June 21, 2024
Time Placed: 6:45 PM
Requested Delivery: 7:30 PM

Menu Items:
1. Caesar Salad (Large) × 1
   - Add grilled chicken (+$6.00)
   - Extra parmesan (+$2.00)
   Subtotal: $16.00

2. Margherita Pizza (Large) × 1  
   - Thin crust
   - Extra basil (+$1.50)
   Subtotal: $22.50

3. Chicken Parmigiana × 1
   - Side: Garlic mashed potatoes
   - No cheese (allergy note)
   Subtotal: $28.00

4. Tiramisu × 2
   Subtotal: $16.00

5. House Red Wine × 1 bottle
   (Chianti Classico 2021)
   Subtotal: $35.00

Order Summary:
Food Subtotal: $117.50
Tax (8.25%): $9.69
Delivery Fee: $3.99
Service Fee: $5.88  
Tip: $18.00 (15.3%)
Total: $155.06

Payment Method: Visa ending in 1234
Special Instructions: Ring doorbell, leave at door, text on arrival

Estimated Delivery: 7:30-7:45 PM
Driver: Mario S. (Phone: 512-555-7766)
Tracking: Track order at primo-bistro.com/track/ORD-456789-TX`,
    expectedFields: ["order_info", "restaurant_info", "customer_info", "menu_items", "pricing", "payment_method", "delivery_info", "tracking"]
  },

  // TECHNOLOGY & SOFTWARE
  {
    name: "Software Bug Report",
    inputData: `BUG REPORT #BUG-2024-1547

Application: TaskFlow Pro v2.8.3
Reporter: Mike Chen (QA Engineer)
Date Reported: June 20, 2024, 3:45 PM
Priority: High
Severity: Major

Environment:
OS: Windows 11 Pro (Build 22631)
Browser: Chrome 125.0.6422.112
Screen Resolution: 1920×1080
Memory: 16GB RAM

Bug Description:
When creating a new project with more than 50 team members, the application crashes during the "Add Members" step. The crash occurs consistently after selecting the 51st member from the team directory.

Steps to Reproduce:
1. Log in as Project Administrator
2. Navigate to "Create New Project"
3. Fill in project details (name, description, due date)
4. Click "Add Team Members"
5. Select members from directory one by one
6. After selecting 50th member, attempt to add 51st member
7. Application freezes for 5-10 seconds then crashes

Expected Result:
Should be able to add unlimited team members (or up to documented limit of 200)

Actual Result:
Application crashes with "Memory Access Violation" error
Error Code: 0xC0000005
Crash dump generated: crash_20240620_154523.dmp

Frequency: 100% reproducible
Workaround: Create project with <50 members, then add additional members after creation

Browser Console Errors:
- TypeError: Cannot read property 'id' of undefined at addMember()
- Memory usage spike from 150MB to 2.1GB before crash

Network Activity:
- Multiple duplicate AJAX calls to /api/members/search
- API response time increases exponentially with member count
- Final request times out after 30 seconds

Screenshots:
- screenshot_before_crash.png
- error_dialog.png  
- memory_usage_graph.png

Additional Notes:
Issue does not occur in Firefox or Safari
Problem started after v2.8.2 update
Related to ticket #BUG-2024-1432 (performance degradation)

Assigned To: Development Team Alpha
Target Fix: v2.8.4 (July 15, 2024)`,
    expectedFields: ["bug_id", "application_info", "reporter", "priority", "environment", "description", "reproduction_steps", "expected_vs_actual", "frequency", "technical_details", "workarounds", "assignment"]
  },

  // EVENT & ENTERTAINMENT
  {
    name: "Concert Ticket Information",
    inputData: `CONCERT TICKET CONFIRMATION

Event: Taylor Swift | The Eras Tour
Venue: Moody Center
Address: 2001 Robert Dedman Dr, Austin, TX 78712
Date: Saturday, August 17, 2024
Doors Open: 6:00 PM
Show Time: 8:00 PM

Ticket Information:
Order #: TIX-789456123
Confirmation: TS-AUS-081724-7891
Purchase Date: March 15, 2024 (Presale)
Purchaser: Amanda Foster
Email: amanda.foster@email.com

Seat Details:
Section: 104 (Lower Bowl)
Row: M  
Seats: 15, 16 (2 tickets)
Price Category: VIP Experience
Face Value: $350.00 each
Fees: $47.50 per ticket
Total Paid: $795.00

VIP Package Includes:
- Premium seating in Section 104
- Exclusive VIP entrance
- Commemorative lanyard & poster
- Access to VIP lounge (6:00-7:30 PM)
- Complimentary drinks (2 per person)
- Merchandise discount (20% off)
- Meet & greet opportunity (lottery)

Important Information:
- Mobile tickets only - no paper tickets
- Tickets available in app 24 hours before show
- Bags larger than 4"×6" not permitted
- Parking not included (see venue website)
- No outside food/drinks allowed
- No professional cameras

Parking Options:
- Venue parking: $40 (pre-purchase recommended)
- Street parking: Limited availability
- Shuttle from downtown: $15 round trip

Weather Policy: Event rain or shine (covered venue)
Age Restrictions: All ages welcome

Customer Service:
- Ticketmaster: 1-800-653-8000
- Venue: (512) 555-SHOW
- VIP Support: vip@moodycenter.com

Transfer/Resale: Tickets can be transferred through official app only`,
    expectedFields: ["event_info", "venue_info", "ticket_details", "seating", "vip_package", "policies", "parking", "customer_service"]
  },

  // RETAIL & E-COMMERCE
  {
    name: "Online Purchase Return",
    inputData: `RETURN MERCHANDISE AUTHORIZATION

RMA #: RMA-2024-667891
Original Order: #ORD-334455-AMZ
Return Date: June 22, 2024
Customer: Jennifer Kim

Original Purchase:
Order Date: June 8, 2024
Total Order Value: $287.45
Payment Method: Visa ****-1234

Items Being Returned:

1. Wireless Bluetooth Headphones
   Brand: Sony WH-1000XM5
   SKU: SNY-WH1000XM5-BLK
   Price: $399.99 → Sale: $279.99
   Quantity: 1
   Reason: Defective (left speaker intermittent)
   Condition: Used (14 days)

2. Phone Case for iPhone 15 Pro
   Brand: OtterBox Defender
   SKU: OTB-DEF-IP15P-BLU  
   Price: $49.99
   Quantity: 1
   Reason: Wrong color ordered
   Condition: New/Unopened

Return Processing:
Initiated: June 22, 2024
Return Label: Prepaid UPS (tracking: 1Z999AA1234567890)
Drop-off Location: Any UPS Store or pickup request
Return Deadline: July 6, 2024 (14 days)

Refund Information:
Sony Headphones: $279.99 (full refund approved)
OtterBox Case: $49.99 (full refund approved)
Original Shipping: $7.47 (non-refundable)
Total Refund: $329.98

Refund Method: Original payment method (Visa ****-1234)
Processing Time: 3-5 business days after item received
Inspection Required: Yes (for defective claim)

Return Instructions:
1. Pack items in original packaging when possible
2. Include printed return label
3. Remove/cover original shipping labels
4. Drop off at UPS location within 14 days
5. Keep tracking receipt for records

Quality Assurance Notes:
- Defective audio equipment requires inspection
- Return of electronics >$200 requires manager approval
- Customer eligible for expedited replacement if needed

Customer Service:
Phone: 1-800-BUY-TECH
Email: returns@techstore.com  
Live Chat: Available 24/7 on website
Account: Check return status at mytechstore.com/returns`,
    expectedFields: ["rma_info", "original_order", "return_items", "return_process", "refund_details", "instructions", "quality_notes", "customer_service"]
  },

  // NONPROFIT & CHARITY
  {
    name: "Charitable Donation Receipt",
    inputData: `DONATION RECEIPT

Austin Community Food Bank
Tax ID: 74-1234567
Address: 8201 S. Congress Ave, Austin, TX 78745
Phone: (512) 555-FOOD
Website: www.austinfoodbank.org

Donor Information:
Name: Robert & Susan Martinez
Address: 1234 Hill Country Blvd
Austin, TX 78746
Phone: (512) 555-7899
Email: rmartinez@email.com
Donor ID: DON-456789

Donation Details:
Receipt #: AFB-2024-12345
Date Received: June 21, 2024
Type: Monetary Donation
Method: Online Credit Card (Visa ****-5678)

Donation Amount: $500.00
Processing Fee: $0.00 (covered by donor)
Net Donation: $500.00

Designation: General Operating Fund
Campaign: Summer Food Drive 2024
In Honor/Memory: In honor of Maria Martinez (grandmother)

Tax Information:
This donation is tax-deductible to the full extent allowed by law.
No goods or services were provided in exchange for this donation.
Please retain this receipt for your tax records.
Deductible Amount: $500.00

Impact Statement:
Your generous donation of $500 will provide approximately 2,000 meals to families in need throughout Central Texas. Thank you for helping us fight hunger in our community.

Recurring Donation: 
Monthly gift of $50.00 scheduled for 12 months
Next charge: July 21, 2024
Manage subscription: www.austinfoodbank.org/manage

Recognition:
- Donor newsletter subscription: Yes
- Annual report mailing: Yes  
- Public recognition (website/materials): Yes
- Volunteer opportunities: Send information

Contact Information:
Development Office: (512) 555-0199
Email: development@austinfoodbank.org
Donor Services: donors@austinfoodbank.org

Thank you for making a difference in our community!

Executive Director: Sarah Johnson
Development Director: Michael Chen`,
    expectedFields: ["organization_info", "donor_info", "donation_details", "tax_information", "impact_statement", "recurring_info", "recognition_preferences", "contact_info"]
  },

  // MANUFACTURING & INDUSTRIAL
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
  },

  // SPORTS & FITNESS
  {
    name: "Personal Training Assessment",
    inputData: `FITNESS ASSESSMENT REPORT

Client: David Park
Member ID: FIT-7890123
Date: June 18, 2024
Trainer: Jessica Rodriguez, NASM-CPT
Gym Location: Austin Fitness Pro - Downtown

Client Information:
Age: 34 years
Height: 5'10" (178 cm)
Weight: 185 lbs (84 kg)
Body Fat: 18.5% (DEXA scan)
Fitness Experience: Intermediate (2 years)
Goals: Lose 15 lbs, build muscle, improve endurance

Health Screening:
Blood Pressure: 128/78 mmHg (slightly elevated)
Resting Heart Rate: 72 bpm
Medical History: None significant
Injuries: Previous right knee sprain (2022, fully healed)
Medications: None
Allergies: None

Fitness Testing Results:

Cardiovascular Assessment:
- 3-Minute Step Test: 
  Heart Rate Response: 156 bpm (good recovery)
  Rating: Above Average

Strength Testing:
- Bench Press (1RM est.): 165 lbs
- Squat (1RM est.): 205 lbs  
- Deadlift (1RM est.): 225 lbs
- Pull-ups: 8 consecutive (bodyweight)

Flexibility Assessment:
- Sit-and-Reach: 16 inches (good)
- Shoulder Mobility: Normal range
- Hip Flexibility: Slightly tight hip flexors
- Ankle Mobility: Normal

Movement Screen:
- Overhead Squat: Compensations noted
- Single Leg Balance: 45 seconds each leg
- Core Stability: Plank hold 90 seconds

Training Recommendations:

Phase 1 (Weeks 1-4): Foundation Building
- Frequency: 3x per week (Mon/Wed/Fri)
- Focus: Movement patterns, form, base conditioning
- Cardio: 20-30 min moderate intensity

Phase 2 (Weeks 5-8): Strength Development  
- Frequency: 4x per week (upper/lower split)
- Focus: Progressive overload, compound movements
- Cardio: HIIT 2x per week

Phase 3 (Weeks 9-12): Performance
- Frequency: 4-5x per week
- Focus: Advanced techniques, sport-specific training
- Cardio: Varied intensity training

Nutrition Guidelines:
- Daily Calories: 2,200-2,400 (moderate deficit)
- Protein: 150-170g per day
- Hydration: 3-4 liters water daily
- Meal Timing: Pre/post workout nutrition

Progress Tracking:
- Weekly weigh-ins: Tuesdays 7:00 AM
- Body measurements: Every 2 weeks
- Progress photos: Monthly
- Fitness testing: Every 6 weeks

Next Appointment:
Date: June 25, 2024
Time: 6:00 PM  
Focus: Program design and first workout
Duration: 60 minutes

Trainer Notes:
Client is motivated and has realistic expectations. Previous knee injury requires attention to movement quality and gradual progression. Recommend consultation with sports nutritionist for detailed meal planning.`,
    expectedFields: ["client_info", "health_screening", "fitness_testing", "training_recommendations", "nutrition_guidelines", "progress_tracking", "next_appointment", "trainer_notes"]
  }
];

async function runComprehensiveTests() {
  console.log('🧪 COMPREHENSIVE PARSERATOR TESTING SUITE\n');
  console.log(`Testing ${testCases.length} diverse real-world datasets...\n`);
  
  const results = {
    total: testCases.length,
    passed: 0,
    failed: 0,
    errors: [],
    performance: [],
    coverage: new Set()
  };

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    
    console.log(`\n📋 TEST ${i + 1}/${testCases.length}: ${testCase.name}`);
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
      const processingTime = endTime - startTime;

      if (result.success) {
        results.passed++;
        
        // Analyze field coverage
        const extractedFields = Object.keys(result.parsedData);
        extractedFields.forEach(field => results.coverage.add(field));
        
        console.log('✅ SUCCESS');
        console.log(`📊 Extracted ${extractedFields.length} fields:`);
        console.log(`   ${extractedFields.slice(0, 5).join(', ')}${extractedFields.length > 5 ? '...' : ''}`);
        console.log(`📈 Performance: ${processingTime}ms (${result.metadata.processingTimeMs}ms server)`);
        console.log(`🎯 Confidence: ${Math.round(result.metadata.confidence * 100)}%`);
        console.log(`🔧 Tokens: ${result.metadata.tokensUsed}`);
        console.log(`🧠 Steps: ${result.metadata.architectPlan.steps.length} extraction steps`);
        
        results.performance.push({
          test: testCase.name,
          clientTime: processingTime,
          serverTime: result.metadata.processingTimeMs,
          confidence: result.metadata.confidence,
          tokens: result.metadata.tokensUsed,
          fields: extractedFields.length
        });
        
      } else {
        results.failed++;
        const error = `${testCase.name}: ${result.error?.message || 'Unknown error'}`;
        results.errors.push(error);
        
        console.log('❌ FAILED');
        console.log(`Error: ${result.error?.message || 'Unknown error'}`);
      }
      
    } catch (error) {
      results.failed++;
      const errorMsg = `${testCase.name}: Network/Parse error - ${error.message}`;
      results.errors.push(errorMsg);
      
      console.log('❌ NETWORK ERROR');
      console.log(`Error: ${error.message}`);
    }
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Generate comprehensive report
  console.log('\n' + '═'.repeat(100));
  console.log('🎉 COMPREHENSIVE TESTING COMPLETE!');
  console.log('═'.repeat(100));
  
  console.log(`\n📊 OVERALL RESULTS:`);
  console.log(`   Total Tests: ${results.total}`);
  console.log(`   Passed: ${results.passed} (${Math.round(results.passed/results.total*100)}%)`);
  console.log(`   Failed: ${results.failed} (${Math.round(results.failed/results.total*100)}%)`);
  
  if (results.performance.length > 0) {
    const avgClientTime = results.performance.reduce((sum, p) => sum + p.clientTime, 0) / results.performance.length;
    const avgServerTime = results.performance.reduce((sum, p) => sum + p.serverTime, 0) / results.performance.length;
    const avgConfidence = results.performance.reduce((sum, p) => sum + p.confidence, 0) / results.performance.length;
    const avgTokens = results.performance.reduce((sum, p) => sum + p.tokens, 0) / results.performance.length;
    const avgFields = results.performance.reduce((sum, p) => sum + p.fields, 0) / results.performance.length;
    
    console.log(`\n⚡ PERFORMANCE METRICS:`);
    console.log(`   Avg Client Time: ${Math.round(avgClientTime)}ms`);
    console.log(`   Avg Server Time: ${Math.round(avgServerTime)}ms`);
    console.log(`   Avg Confidence: ${Math.round(avgConfidence * 100)}%`);
    console.log(`   Avg Tokens Used: ${Math.round(avgTokens)}`);
    console.log(`   Avg Fields Extracted: ${Math.round(avgFields)}`);
  }
  
  console.log(`\n🎯 DATA COVERAGE:`);
  console.log(`   Unique Field Types: ${results.coverage.size}`);
  console.log(`   Industries Tested: ${testCases.length} different domains`);
  
  const industries = [
    'Business & Financial', 'Healthcare & Medical', 'Real Estate & Property',
    'Legal & Contracts', 'Travel & Hospitality', 'Education & Academic',
    'Government & Legal', 'Automotive & Vehicle', 'Insurance & Financial',
    'Scientific & Research', 'Food & Restaurant', 'Technology & Software',
    'Event & Entertainment', 'Retail & E-commerce', 'Nonprofit & Charity',
    'Manufacturing & Industrial', 'Sports & Fitness'
  ];
  
  console.log(`   Industries: ${industries.slice(0, 3).join(', ')}... (+${industries.length - 3} more)`);
  
  if (results.errors.length > 0) {
    console.log(`\n❌ FAILED TESTS:`);
    results.errors.forEach((error, index) => {
      console.log(`   ${index + 1}. ${error}`);
    });
  }
  
  console.log(`\n🚀 PRODUCTION READINESS:`);
  const successRate = results.passed / results.total;
  if (successRate >= 0.95) {
    console.log(`   ✅ EXCELLENT (${Math.round(successRate * 100)}% success rate)`);
    console.log(`   Ready for production launch!`);
  } else if (successRate >= 0.85) {
    console.log(`   ⚠️  GOOD (${Math.round(successRate * 100)}% success rate)`);
    console.log(`   Minor improvements needed before launch`);
  } else {
    console.log(`   ❌ NEEDS WORK (${Math.round(successRate * 100)}% success rate)`);
    console.log(`   Significant improvements required`);
  }
  
  console.log(`\n📈 TOP PERFORMING TESTS:`);
  if (results.performance.length > 0) {
    const sortedByConfidence = [...results.performance].sort((a, b) => b.confidence - a.confidence);
    sortedByConfidence.slice(0, 3).forEach((test, index) => {
      console.log(`   ${index + 1}. ${test.test} (${Math.round(test.confidence * 100)}% confidence, ${test.fields} fields)`);
    });
  }
  
  return results;
}

function generateSchema(expectedFields) {
  const schema = {};
  expectedFields.forEach(field => {
    // Smart type inference based on field name
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

// Run if called directly
if (require.main === module) {
  runComprehensiveTests().catch(console.error);
}

module.exports = { runComprehensiveTests, testCases };