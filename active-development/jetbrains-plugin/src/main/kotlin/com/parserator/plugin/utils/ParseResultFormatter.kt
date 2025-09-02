package com.parserator.plugin.utils

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.SerializationFeature
import com.fasterxml.jackson.module.kotlin.registerKotlinModule

class ParseResultFormatter {
    
    private val objectMapper = ObjectMapper().apply {
        registerKotlinModule()
        enable(SerializationFeature.INDENT_OUTPUT)
        configure(SerializationFeature.FAIL_ON_EMPTY_BEANS, false)
    }
    
    fun formatAsJson(data: Any?): String {
        return try {
            objectMapper.writeValueAsString(data)
        } catch (e: Exception) {
            "Error formatting data: ${e.message}"
        }
    }
    
    fun formatAsTable(data: Any?): String {
        // Implementation for table format
        return "Table format not yet implemented"
    }
    
    fun formatAsXml(data: Any?): String {
        // Implementation for XML format
        return "XML format not yet implemented"
    }
}