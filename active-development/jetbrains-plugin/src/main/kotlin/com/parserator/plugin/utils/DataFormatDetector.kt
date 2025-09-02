package com.parserator.plugin.utils

import com.parserator.plugin.models.DataFormat

object DataFormatDetector {
    
    fun detectFormat(data: String): DataFormat {
        val trimmedData = data.trim()
        
        if (trimmedData.isEmpty()) {
            return DataFormat.TEXT
        }
        
        return when {
            isJson(trimmedData) -> DataFormat.JSON
            isXml(trimmedData) -> DataFormat.XML
            isCsv(trimmedData) -> DataFormat.CSV
            isTsv(trimmedData) -> DataFormat.TSV
            isYaml(trimmedData) -> DataFormat.YAML
            isHtml(trimmedData) -> DataFormat.HTML
            isLogFormat(trimmedData) -> DataFormat.LOG
            else -> DataFormat.TEXT
        }
    }
    
    private fun isJson(data: String): Boolean {
        val trimmed = data.trim()
        return (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
                (trimmed.startsWith("[") && trimmed.endsWith("]"))
    }
    
    private fun isXml(data: String): Boolean {
        val trimmed = data.trim()
        return trimmed.startsWith("<") && trimmed.contains(">") && 
               (trimmed.contains("</") || trimmed.endsWith("/>"))
    }
    
    private fun isCsv(data: String): Boolean {
        val lines = data.lines().filter { it.isNotBlank() }
        if (lines.isEmpty()) return false
        
        // Check if multiple lines have consistent comma separation
        val firstLineCommas = lines[0].count { it == ',' }
        if (firstLineCommas == 0) return false
        
        return lines.take(5).all { line ->
            val commas = line.count { it == ',' }
            commas == firstLineCommas || kotlin.math.abs(commas - firstLineCommas) <= 1
        }
    }
    
    private fun isTsv(data: String): Boolean {
        val lines = data.lines().filter { it.isNotBlank() }
        if (lines.isEmpty()) return false
        
        // Check if multiple lines have consistent tab separation
        val firstLineTabs = lines[0].count { it == '\t' }
        if (firstLineTabs == 0) return false
        
        return lines.take(5).all { line ->
            val tabs = line.count { it == '\t' }
            tabs == firstLineTabs || kotlin.math.abs(tabs - firstLineTabs) <= 1
        }
    }
    
    private fun isYaml(data: String): Boolean {
        val lines = data.lines().filter { it.isNotBlank() }
        if (lines.isEmpty()) return false
        
        // Check for YAML indicators
        return lines.any { line ->
            val trimmed = line.trim()
            trimmed.contains(":") && 
            !trimmed.startsWith("#") &&
            (trimmed.matches(Regex("^\\s*[a-zA-Z_][a-zA-Z0-9_]*\\s*:.*")) ||
             trimmed.matches(Regex("^\\s*-\\s+.*")))
        }
    }
    
    private fun isHtml(data: String): Boolean {
        val trimmed = data.trim().lowercase()
        return trimmed.contains("<html") || 
               trimmed.contains("<!doctype") ||
               trimmed.contains("<body") ||
               trimmed.contains("<head")
    }
    
    private fun isLogFormat(data: String): Boolean {
        val lines = data.lines().filter { it.isNotBlank() }
        if (lines.isEmpty()) return false
        
        // Check for common log patterns
        val logPatterns = listOf(
            Regex("^\\d{4}-\\d{2}-\\d{2}.*"), // Date format
            Regex("^\\[.*\\].*"), // Bracketed timestamps
            Regex("^\\w+\\s+\\d+\\s+\\d+:\\d+:\\d+.*"), // Syslog format
            Regex(".*\\s+(INFO|DEBUG|WARN|ERROR|FATAL)\\s+.*"), // Log levels
            Regex("^\\d+\\.\\d+\\.\\d+\\.\\d+.*") // IP addresses
        )
        
        return lines.take(10).count { line ->
            logPatterns.any { pattern -> pattern.containsMatchIn(line) }
        } >= lines.size / 2
    }
    
    fun getFormatConfidence(data: String, detectedFormat: DataFormat): Double {
        return when (detectedFormat) {
            DataFormat.JSON -> getJsonConfidence(data)
            DataFormat.XML -> getXmlConfidence(data)
            DataFormat.CSV -> getCsvConfidence(data)
            DataFormat.TSV -> getTsvConfidence(data)
            DataFormat.YAML -> getYamlConfidence(data)
            DataFormat.HTML -> getHtmlConfidence(data)
            DataFormat.LOG -> getLogConfidence(data)
            else -> 0.5
        }
    }
    
    private fun getJsonConfidence(data: String): Double {
        val trimmed = data.trim()
        return when {
            isValidJsonStructure(trimmed) -> 0.9
            trimmed.startsWith("{") || trimmed.startsWith("[") -> 0.7
            trimmed.contains("\"") && trimmed.contains(":") -> 0.6
            else -> 0.3
        }
    }
    
    private fun getXmlConfidence(data: String): Double {
        val trimmed = data.trim()
        val openTags = trimmed.count { it == '<' }
        val closeTags = trimmed.count { it == '>' }
        
        return when {
            openTags == closeTags && openTags > 0 -> 0.9
            trimmed.startsWith("<?xml") -> 0.95
            trimmed.startsWith("<") && trimmed.endsWith(">") -> 0.8
            else -> 0.4
        }
    }
    
    private fun getCsvConfidence(data: String): Double {
        val lines = data.lines().filter { it.isNotBlank() }
        if (lines.isEmpty()) return 0.0
        
        val commaConsistency = calculateDelimiterConsistency(lines, ',')
        return commaConsistency
    }
    
    private fun getTsvConfidence(data: String): Double {
        val lines = data.lines().filter { it.isNotBlank() }
        if (lines.isEmpty()) return 0.0
        
        val tabConsistency = calculateDelimiterConsistency(lines, '\t')
        return tabConsistency
    }
    
    private fun getYamlConfidence(data: String): Double {
        val lines = data.lines().filter { it.isNotBlank() }
        if (lines.isEmpty()) return 0.0
        
        val yamlLines = lines.count { line ->
            val trimmed = line.trim()
            trimmed.contains(":") && !trimmed.startsWith("#")
        }
        
        return yamlLines.toDouble() / lines.size
    }
    
    private fun getHtmlConfidence(data: String): Double {
        val trimmed = data.trim().lowercase()
        return when {
            trimmed.contains("<!doctype html") -> 0.95
            trimmed.contains("<html") && trimmed.contains("</html>") -> 0.9
            trimmed.contains("<body") || trimmed.contains("<head") -> 0.8
            trimmed.startsWith("<") && trimmed.endsWith(">") -> 0.6
            else -> 0.3
        }
    }
    
    private fun getLogConfidence(data: String): Double {
        val lines = data.lines().filter { it.isNotBlank() }
        if (lines.isEmpty()) return 0.0
        
        val logLines = lines.count { line ->
            line.contains(Regex("\\b(INFO|DEBUG|WARN|ERROR|FATAL)\\b")) ||
            line.matches(Regex("^\\d{4}-\\d{2}-\\d{2}.*")) ||
            line.matches(Regex("^\\[.*\\].*"))
        }
        
        return logLines.toDouble() / lines.size
    }
    
    private fun isValidJsonStructure(data: String): Boolean {
        return try {
            // Simple JSON validation without parsing
            val trimmed = data.trim()
            val openBraces = trimmed.count { it == '{' }
            val closeBraces = trimmed.count { it == '}' }
            val openBrackets = trimmed.count { it == '[' }
            val closeBrackets = trimmed.count { it == ']' }
            
            openBraces == closeBraces && openBrackets == closeBrackets
        } catch (e: Exception) {
            false
        }
    }
    
    private fun calculateDelimiterConsistency(lines: List<String>, delimiter: Char): Double {
        if (lines.size < 2) return 0.0
        
        val delimiterCounts = lines.map { it.count { c -> c == delimiter } }
        val avgCount = delimiterCounts.average()
        
        if (avgCount == 0.0) return 0.0
        
        val variance = delimiterCounts.map { (it - avgCount) * (it - avgCount) }.average()
        val standardDeviation = kotlin.math.sqrt(variance)
        
        // Lower standard deviation means higher consistency
        return kotlin.math.max(0.0, 1.0 - (standardDeviation / avgCount))
    }
}