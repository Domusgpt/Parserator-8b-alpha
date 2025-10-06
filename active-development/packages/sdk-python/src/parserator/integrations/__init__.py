"""
Parserator Framework Integrations
Provides seamless integration with popular AI agent frameworks
"""

from .langchain import ParseratorOutputParser
from .crewai import ParseratorTool
from .autogpt import ParseratorPlugin

__all__ = [
    "ParseratorOutputParser",
    "ParseratorTool",
    "ParseratorPlugin",
]
