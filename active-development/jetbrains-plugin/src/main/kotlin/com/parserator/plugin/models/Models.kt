package com.parserator.plugin.models

import com.fasterxml.jackson.annotation.JsonIgnoreProperties
import com.fasterxml.jackson.annotation.JsonInclude
import com.fasterxml.jackson.annotation.JsonProperty
import java.time.LocalDateTime

/**
 * Core parsing request model
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
@JsonIgnoreProperties(ignoreUnknown = true)
data class ParseRequest(
    val data: String,
    val schema: ParseratorSchema? = null,
    val format: DataFormat = DataFormat.AUTO,
    val options: ParseOptions = ParseOptions()
)

/**
 * Parsing response model
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
@JsonIgnoreProperties(ignoreUnknown = true)
data class ParseResult(
    val success: Boolean,
    val data: Any? = null,
    val parsed: Map<String, Any>? = null,
    val metadata: ParseMetadata? = null,
    val errors: List<String>? = null,
    val warnings: List<String>? = null,
    val processingTime: Long? = null,
    val schema: ParseratorSchema? = null
)

/**
 * Parse metadata
 */
@JsonIgnoreProperties(ignoreUnknown = true)
data class ParseMetadata(
    val recordCount: Int? = null,
    val fieldCount: Int? = null,
    val dataSize: Long? = null,
    val encoding: String? = null,
    val detectedFormat: DataFormat? = null,
    val confidence: Double? = null,
    val timestamp: String? = null
)

/**
 * Parse options
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
data class ParseOptions(
    val trimWhitespace: Boolean = true,
    val skipEmptyRows: Boolean = true,
    val inferTypes: Boolean = true,
    val validateData: Boolean = true,
    val maxRows: Int? = null,
    val encoding: String? = null,
    val delimiter: String? = null,
    val quoteChar: String? = null,
    val customOptions: Map<String, Any>? = null
)

/**
 * Parserator schema definition
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
@JsonIgnoreProperties(ignoreUnknown = true)
data class ParseratorSchema(
    val id: String? = null,
    val name: String,
    val description: String? = null,
    val version: String = "1.0",
    val fields: List<SchemaField>,
    val format: DataFormat? = null,
    val options: SchemaOptions? = null,
    val metadata: Map<String, Any>? = null,
    val tags: List<String>? = null,
    val examples: List<String>? = null
)

/**
 * Schema field definition
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
@JsonIgnoreProperties(ignoreUnknown = true)
data class SchemaField(
    val name: String,
    val type: FieldType,
    val description: String? = null,
    val required: Boolean = false,
    val default: Any? = null,
    val validation: FieldValidation? = null,
    val transform: FieldTransform? = null,
    val nested: List<SchemaField>? = null,
    val examples: List<String>? = null
)

/**
 * Field validation rules
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
data class FieldValidation(
    val minLength: Int? = null,
    val maxLength: Int? = null,
    val pattern: String? = null,
    val format: String? = null,
    val min: Double? = null,
    val max: Double? = null,
    val allowedValues: List<Any>? = null,
    val customValidator: String? = null
)

/**
 * Field transformation rules
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
data class FieldTransform(
    val trim: Boolean = false,
    val toLowerCase: Boolean = false,
    val toUpperCase: Boolean = false,
    val dateFormat: String? = null,
    val customTransform: String? = null,
    val extractPattern: String? = null
)

/**
 * Schema options
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
data class SchemaOptions(
    val strictMode: Boolean = false,
    val allowExtraFields: Boolean = true,
    val caseSensitive: Boolean = true,
    val autoCorrect: Boolean = false,
    val skipValidation: Boolean = false
)

/**
 * Schema validation result
 */
@JsonIgnoreProperties(ignoreUnknown = true)
data class SchemaValidationResult(
    val isValid: Boolean,
    val errors: List<String> = emptyList(),
    val warnings: List<String> = emptyList(),
    val suggestions: List<String> = emptyList()
)

/**
 * Schema information
 */
@JsonIgnoreProperties(ignoreUnknown = true)
data class SchemaInfo(
    val id: String,
    val name: String,
    val description: String,
    val version: String,
    val tags: List<String> = emptyList(),
    val createdAt: String? = null,
    val updatedAt: String? = null,
    val author: String? = null,
    val isPublic: Boolean = false
)

/**
 * Bulk parsing models
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
data class BulkParseRequest(
    val items: List<BulkParseItem>,
    val options: BulkParseOptions = BulkParseOptions()
)

@JsonInclude(JsonInclude.Include.NON_NULL)
data class BulkParseItem(
    val id: String,
    val data: String,
    val schema: ParseratorSchema? = null,
    val format: DataFormat = DataFormat.AUTO,
    val filename: String? = null,
    val options: ParseOptions = ParseOptions()
)

@JsonInclude(JsonInclude.Include.NON_NULL)
data class BulkParseOptions(
    val failFast: Boolean = false,
    val maxConcurrency: Int = 5,
    val timeout: Int = 300,
    val retryCount: Int = 1
)

@JsonIgnoreProperties(ignoreUnknown = true)
data class BulkParseResult(
    val success: Boolean,
    val results: List<BulkParseItemResult>,
    val summary: BulkParseSummary,
    val errors: List<String> = emptyList()
)

@JsonIgnoreProperties(ignoreUnknown = true)
data class BulkParseItemResult(
    val id: String,
    val success: Boolean,
    val result: ParseResult? = null,
    val error: String? = null,
    val processingTime: Long? = null
)

@JsonIgnoreProperties(ignoreUnknown = true)
data class BulkParseSummary(
    val totalItems: Int,
    val successCount: Int,
    val failureCount: Int,
    val totalProcessingTime: Long,
    val avgProcessingTime: Double
)

/**
 * Export models
 */
data class ExportRequest(
    val data: Any,
    val format: ExportFormat,
    val options: ExportOptions = ExportOptions()
)

data class ExportOptions(
    val filename: String? = null,
    val includeMetadata: Boolean = true,
    val compression: CompressionType = CompressionType.NONE,
    val customOptions: Map<String, Any> = emptyMap()
)

/**
 * Code generation models
 */
data class CodeGenerationRequest(
    val schema: ParseratorSchema,
    val language: CodeLanguage,
    val options: CodeGenerationOptions = CodeGenerationOptions()
)

data class CodeGenerationOptions(
    val className: String? = null,
    val packageName: String? = null,
    val includeValidation: Boolean = true,
    val includeSerializers: Boolean = true,
    val includeBuilders: Boolean = false,
    val annotations: List<String> = emptyList(),
    val customTemplates: Map<String, String> = emptyMap()
)

data class CodeGenerationResult(
    val success: Boolean,
    val files: List<GeneratedFile>,
    val errors: List<String> = emptyList(),
    val warnings: List<String> = emptyList()
)

data class GeneratedFile(
    val filename: String,
    val content: String,
    val language: CodeLanguage,
    val type: FileType
)

/**
 * UI Models
 */
data class ParseResultTreeNode(
    val name: String,
    val value: Any?,
    val type: String,
    val children: List<ParseResultTreeNode> = emptyList(),
    val isExpanded: Boolean = false,
    val icon: String? = null
)

data class ParseSession(
    val id: String,
    val timestamp: LocalDateTime,
    val request: ParseRequest,
    val result: ParseResult,
    val filename: String? = null,
    val notes: String? = null
)

/**
 * Enums
 */
enum class DataFormat {
    AUTO, JSON, CSV, XML, TSV, YAML, HTML, TEXT, LOG, CUSTOM
}

enum class FieldType {
    STRING, INTEGER, DOUBLE, BOOLEAN, DATE, DATETIME, TIME, 
    ARRAY, OBJECT, EMAIL, URL, PHONE, UUID, JSON_STRING, 
    CURRENCY, PERCENTAGE, CUSTOM
}

enum class ExportFormat {
    JSON, CSV, XML, EXCEL, TSV, YAML, SQL, PARQUET, AVRO
}

enum class CompressionType {
    NONE, GZIP, ZIP, BZIP2
}

enum class CodeLanguage {
    JAVA, KOTLIN, PYTHON, TYPESCRIPT, JAVASCRIPT, CSHARP, GO, RUST, SCALA
}

enum class FileType {
    MODEL, DTO, ENTITY, INTERFACE, ENUM, UTILITY, TEST, CONFIGURATION
}