# Parserator API Documentation

## Authentication
All API requests require an API key in the Authorization header:
```
Authorization: Bearer your_api_key_here
```

## Base URL
```
https://api.parserator.com
```

## Endpoints

### POST /v1/parse
Transform unstructured data into structured JSON.

**Request Body:**
```json
{
  "inputData": "string",     // Raw data to parse
  "outputSchema": "object",  // Desired structure
  "instructions": "string"   // Optional context
}
```

**Response:**
```json
{
  "success": true,
  "parsedData": { ... },     // Structured output
  "metadata": {
    "confidence": 0.95,
    "tokensUsed": 847,
    "processingTimeMs": 650
  }
}
```

## Field Types
- `string`: Text data
- `number`: Numeric values  
- `boolean`: True/false
- `email`: Email addresses
- `phone`: Phone numbers
- `date`: Date values
- `datetime`: Date with time
- `currency`: Monetary amounts
- `url`: Web addresses
- `string_array`: Array of strings

## Examples

### Email Parsing
```bash
curl -X POST https://api.parserator.com/v1/parse \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "inputData": "From: john@company.com\nMeeting tomorrow at 2pm",
    "outputSchema": {
      "email": "email",
      "meeting_time": "string"
    }
  }'
```

### Invoice Processing  
```bash
curl -X POST https://api.parserator.com/v1/parse \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "inputData": "Invoice #1234\nTotal: $99.99\nDue: 2024-04-15",
    "outputSchema": {
      "invoice_number": "string", 
      "total": "currency",
      "due_date": "date"
    }
  }'
```
