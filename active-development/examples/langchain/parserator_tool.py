"""
Parserator LangChain Integration
Parse any unstructured data into clean JSON
"""

from typing import Any, Dict, Optional
from langchain.tools import BaseTool
from langchain.callbacks.manager import CallbackManagerForToolRun
import requests

class ParseratorTool(BaseTool):
    """Parse unstructured data using Parserator AI"""
    
    name = "parserator"
    description = """
    Transform messy, unstructured data into clean JSON.
    Perfect for: emails, PDFs, invoices, web content, CSV data.
    
    Args:
        input_data: Raw text to parse
        output_schema: Desired JSON structure
    
    Returns: Structured JSON matching your schema
    """
    
    api_key: str
    base_url: str = "https://api.parserator.com"
    
    def _run(
        self,
        input_data: str,
        output_schema: Dict[str, Any],
        run_manager: Optional[CallbackManagerForToolRun] = None
    ) -> Dict[str, Any]:
        """Execute the parsing"""
        
        response = requests.post(
            f"{self.base_url}/v1/parse",
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            },
            json={
                "inputData": input_data,
                "outputSchema": output_schema
            }
        )
        
        result = response.json()
        return result["parsedData"] if result.get("success") else {}

# Example usage
if __name__ == "__main__":
    parserator = ParseratorTool(api_key="your_api_key")
    
    result = parserator._run(
        input_data="John Smith, CEO at Acme Corp. Contact: john@acme.com or 555-1234",
        output_schema={
            "name": "string",
            "title": "string",
            "company": "string", 
            "email": "email",
            "phone": "phone"
        }
    )
    
    print(result)
    # Output: {
    #   "name": "John Smith",
    #   "title": "CEO", 
    #   "company": "Acme Corp",
    #   "email": "john@acme.com",
    #   "phone": "555-1234"
    # }
