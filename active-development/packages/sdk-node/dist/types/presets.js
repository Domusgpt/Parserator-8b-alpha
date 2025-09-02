"use strict";
/**
 * Pre-built parsing presets and templates for common use cases
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ALL_PRESETS = exports.DOCUMENT_PARSER = exports.LOG_PARSER = exports.CSV_PARSER = exports.CONTACT_PARSER = exports.INVOICE_PARSER = exports.EMAIL_PARSER = void 0;
exports.getPresetByName = getPresetByName;
exports.getPresetsByTag = getPresetsByTag;
exports.listAvailablePresets = listAvailablePresets;
exports.EMAIL_PARSER = {
    name: 'Email Parser',
    description: 'Extract structured data from email content including sender, subject, dates, and key information',
    outputSchema: {
        sender: {
            type: 'object',
            required: true,
            description: 'Sender information',
        },
        subject: 'string',
        date: 'iso_date',
        recipients: 'string_array',
        body: 'string',
        attachments: 'string_array',
        action_items: 'string_array',
        mentioned_dates: 'string_array',
        priority: {
            type: 'string',
            required: false,
            description: 'Urgency level: low, medium, high, urgent'
        }
    },
    instructions: 'Parse email content focusing on extracting actionable information, dates, and contacts. Identify urgency and action items.',
    examples: [
        {
            input: 'From: john@example.com\nTo: team@company.com\nSubject: Urgent: Project deadline moved to Friday\n\nHi team,\n\nThe client meeting has been moved to this Friday at 2pm. Please prepare the presentation by Thursday.',
            expectedOutput: {
                sender: { email: 'john@example.com', name: 'john' },
                subject: 'Urgent: Project deadline moved to Friday',
                recipients: ['team@company.com'],
                action_items: ['prepare the presentation by Thursday'],
                mentioned_dates: ['Friday at 2pm', 'Thursday'],
                priority: 'urgent'
            }
        }
    ],
    options: {
        timeout: 30000,
        validateOutput: true,
        confidenceThreshold: 0.85
    }
};
exports.INVOICE_PARSER = {
    name: 'Invoice Parser',
    description: 'Extract financial data from invoices including amounts, dates, vendor information',
    outputSchema: {
        invoice_number: 'string',
        date: 'iso_date',
        due_date: 'iso_date',
        vendor: {
            type: 'object',
            required: true,
            description: 'Vendor/supplier information'
        },
        customer: {
            type: 'object',
            required: true,
            description: 'Customer/buyer information'
        },
        line_items: {
            type: 'object',
            required: true,
            description: 'Array of invoice line items'
        },
        subtotal: 'number',
        tax_amount: 'number',
        total_amount: 'number',
        currency: 'string',
        payment_terms: 'string'
    },
    instructions: 'Extract all financial and business information from invoices. Focus on accurate number parsing and date extraction.',
    examples: [
        {
            input: 'INVOICE #INV-2024-001\nDate: Jan 15, 2024\nDue: Feb 15, 2024\n\nBill To: Acme Corp\n123 Main St\n\nQty | Description | Price\n2   | Widgets     | $50.00\n1   | Service     | $100.00\n\nSubtotal: $200.00\nTax: $20.00\nTotal: $220.00',
            expectedOutput: {
                invoice_number: 'INV-2024-001',
                date: '2024-01-15',
                due_date: '2024-02-15',
                customer: { name: 'Acme Corp', address: '123 Main St' },
                line_items: [
                    { qty: 2, description: 'Widgets', price: 50.00 },
                    { qty: 1, description: 'Service', price: 100.00 }
                ],
                subtotal: 200.00,
                tax_amount: 20.00,
                total_amount: 220.00,
                currency: 'USD'
            }
        }
    ],
    options: {
        timeout: 45000,
        validateOutput: true,
        confidenceThreshold: 0.9
    }
};
exports.CONTACT_PARSER = {
    name: 'Contact Parser',
    description: 'Extract contact information from various text formats',
    outputSchema: {
        name: 'string',
        email: 'email',
        phone: 'phone',
        company: 'string',
        title: 'string',
        address: {
            type: 'object',
            required: false,
            description: 'Physical address information'
        },
        social_media: {
            type: 'object',
            required: false,
            description: 'Social media profiles'
        },
        notes: 'string'
    },
    instructions: 'Extract comprehensive contact information. Handle various formats like business cards, email signatures, and directory listings.',
    examples: [
        {
            input: 'John Smith\nSenior Developer\nTech Solutions Inc.\njohn.smith@techsolutions.com\n(555) 123-4567\n123 Business Ave, Suite 100\nSan Francisco, CA 94105\nLinkedIn: linkedin.com/in/johnsmith',
            expectedOutput: {
                name: 'John Smith',
                title: 'Senior Developer',
                company: 'Tech Solutions Inc.',
                email: 'john.smith@techsolutions.com',
                phone: '(555) 123-4567',
                address: {
                    street: '123 Business Ave, Suite 100',
                    city: 'San Francisco',
                    state: 'CA',
                    zip: '94105'
                },
                social_media: {
                    linkedin: 'linkedin.com/in/johnsmith'
                }
            }
        }
    ],
    options: {
        timeout: 20000,
        validateOutput: true,
        confidenceThreshold: 0.8
    }
};
exports.CSV_PARSER = {
    name: 'CSV Parser',
    description: 'Parse CSV data into structured JSON with automatic header detection',
    outputSchema: {
        headers: 'string_array',
        rows: {
            type: 'object',
            required: true,
            description: 'Array of data rows as objects'
        },
        metadata: {
            type: 'object',
            required: true,
            description: 'CSV parsing metadata'
        }
    },
    instructions: 'Parse CSV data with intelligent type detection. Handle various delimiters and quote characters. Detect column types automatically.',
    examples: [
        {
            input: 'Name,Age,Email,Salary\nJohn Doe,30,john@example.com,50000\nJane Smith,25,jane@example.com,55000',
            expectedOutput: {
                headers: ['Name', 'Age', 'Email', 'Salary'],
                rows: [
                    { Name: 'John Doe', Age: 30, Email: 'john@example.com', Salary: 50000 },
                    { Name: 'Jane Smith', Age: 25, Email: 'jane@example.com', Salary: 55000 }
                ],
                metadata: {
                    row_count: 2,
                    column_count: 4,
                    delimiter: ',',
                    column_types: {
                        Name: 'string',
                        Age: 'number',
                        Email: 'email',
                        Salary: 'number'
                    }
                }
            }
        }
    ],
    options: {
        timeout: 30000,
        validateOutput: true,
        confidenceThreshold: 0.9
    }
};
exports.LOG_PARSER = {
    name: 'Log Parser',
    description: 'Parse application logs and extract structured information',
    outputSchema: {
        entries: {
            type: 'object',
            required: true,
            description: 'Array of parsed log entries'
        },
        summary: {
            type: 'object',
            required: true,
            description: 'Log analysis summary'
        }
    },
    instructions: 'Parse log files extracting timestamps, levels, messages, and structured data. Identify patterns and anomalies.',
    examples: [
        {
            input: '2024-01-15 10:30:15 INFO [UserService] User login successful: user_id=123\n2024-01-15 10:30:45 ERROR [PaymentService] Payment failed: order_id=456, error=CARD_DECLINED',
            expectedOutput: {
                entries: [
                    {
                        timestamp: '2024-01-15T10:30:15',
                        level: 'INFO',
                        service: 'UserService',
                        message: 'User login successful',
                        data: { user_id: '123' }
                    },
                    {
                        timestamp: '2024-01-15T10:30:45',
                        level: 'ERROR',
                        service: 'PaymentService',
                        message: 'Payment failed',
                        data: { order_id: '456', error: 'CARD_DECLINED' }
                    }
                ],
                summary: {
                    total_entries: 2,
                    error_count: 1,
                    warning_count: 0,
                    info_count: 1,
                    time_range: {
                        start: '2024-01-15T10:30:15',
                        end: '2024-01-15T10:30:45'
                    }
                }
            }
        }
    ],
    options: {
        timeout: 40000,
        validateOutput: true,
        confidenceThreshold: 0.85
    }
};
exports.DOCUMENT_PARSER = {
    name: 'Document Parser',
    description: 'Extract structured information from documents like contracts, reports, and forms',
    outputSchema: {
        title: 'string',
        document_type: 'string',
        date: 'iso_date',
        parties: 'string_array',
        key_terms: {
            type: 'object',
            required: false,
            description: 'Important terms and values'
        },
        dates: {
            type: 'object',
            required: false,
            description: 'Important dates mentioned'
        },
        amounts: {
            type: 'object',
            required: false,
            description: 'Financial amounts mentioned'
        },
        summary: 'string'
    },
    instructions: 'Extract key information from business documents. Focus on parties, dates, amounts, and important terms. Provide a concise summary.',
    examples: [],
    options: {
        timeout: 60000,
        validateOutput: true,
        confidenceThreshold: 0.8
    }
};
// Export all presets as a collection
exports.ALL_PRESETS = {
    EMAIL_PARSER: exports.EMAIL_PARSER,
    INVOICE_PARSER: exports.INVOICE_PARSER,
    CONTACT_PARSER: exports.CONTACT_PARSER,
    CSV_PARSER: exports.CSV_PARSER,
    LOG_PARSER: exports.LOG_PARSER,
    DOCUMENT_PARSER: exports.DOCUMENT_PARSER
};
// Helper functions
function getPresetByName(name) {
    return Object.values(exports.ALL_PRESETS).find(preset => preset.name === name);
}
function getPresetsByTag(tag) {
    return Object.values(exports.ALL_PRESETS).filter(preset => preset.examples.length > 0 && preset.name.toLowerCase().includes(tag.toLowerCase()));
}
function listAvailablePresets() {
    return Object.values(exports.ALL_PRESETS).map(preset => preset.name);
}
//# sourceMappingURL=presets.js.map