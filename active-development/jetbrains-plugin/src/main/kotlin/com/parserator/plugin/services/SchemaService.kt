package com.parserator.plugin.services

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.registerKotlinModule
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.Service
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.vfs.VirtualFile
import com.parserator.plugin.models.ParseratorSchema
import com.parserator.plugin.models.SchemaValidationResult
import java.io.File

@Service(Service.Level.APP)
class SchemaService {
    
    private val logger = Logger.getInstance(SchemaService::class.java)
    private val objectMapper = ObjectMapper().registerKotlinModule()
    private val localSchemas = mutableMapOf<String, ParseratorSchema>()
    
    companion object {
        @JvmStatic
        fun getInstance(): SchemaService {
            return ApplicationManager.getApplication().getService(SchemaService::class.java)
        }
    }
    
    /**
     * Load schema from file
     */
    fun loadSchemaFromFile(file: VirtualFile): ParseratorSchema? {
        return try {
            val content = String(file.contentsToByteArray())
            val schema = objectMapper.readValue(content, ParseratorSchema::class.java)
            
            // Cache the schema
            localSchemas[schema.id ?: file.nameWithoutExtension] = schema
            
            schema
        } catch (e: Exception) {
            logger.error("Error loading schema from file: ${file.path}", e)
            null
        }
    }
    
    /**
     * Save schema to file
     */
    fun saveSchemaToFile(schema: ParseratorSchema, file: File): Boolean {
        return try {
            val content = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(schema)
            file.writeText(content)
            
            // Cache the schema
            localSchemas[schema.id ?: schema.name] = schema
            
            true
        } catch (e: Exception) {
            logger.error("Error saving schema to file: ${file.absolutePath}", e)
            false
        }
    }
    
    /**
     * Validate schema locally
     */
    fun validateSchemaLocally(schema: ParseratorSchema): SchemaValidationResult {
        val errors = mutableListOf<String>()
        val warnings = mutableListOf<String>()
        val suggestions = mutableListOf<String>()
        
        // Basic validation
        if (schema.name.isBlank()) {
            errors.add("Schema name is required")
        }
        
        if (schema.fields.isEmpty()) {
            errors.add("Schema must have at least one field")
        }
        
        // Validate fields
        schema.fields.forEach { field ->
            if (field.name.isBlank()) {
                errors.add("Field name is required")
            }
            
            // Check for duplicate field names
            val duplicates = schema.fields.count { it.name == field.name }
            if (duplicates > 1) {
                errors.add("Duplicate field name: ${field.name}")
            }
            
            // Validate nested fields
            field.nested?.let { nestedFields ->
                nestedFields.forEach { nestedField ->
                    if (nestedField.name.isBlank()) {
                        errors.add("Nested field name is required in field: ${field.name}")
                    }
                }
            }
            
            // Validation rules check
            field.validation?.let { validation ->
                validation.minLength?.let { min ->
                    validation.maxLength?.let { max ->
                        if (min > max) {
                            errors.add("minLength cannot be greater than maxLength for field: ${field.name}")
                        }
                    }
                }
                
                validation.min?.let { min ->
                    validation.max?.let { max ->
                        if (min > max) {
                            errors.add("min cannot be greater than max for field: ${field.name}")
                        }
                    }
                }
                
                validation.pattern?.let { pattern ->
                    try {
                        Regex(pattern)
                    } catch (e: Exception) {
                        errors.add("Invalid regex pattern for field ${field.name}: ${e.message}")
                    }
                }
            }
        }
        
        // Performance warnings
        if (schema.fields.size > 50) {
            warnings.add("Schema has many fields (${schema.fields.size}). Consider breaking it into smaller schemas.")
        }
        
        val deeplyNestedFields = schema.fields.filter { it.nested?.isNotEmpty() == true }
        if (deeplyNestedFields.size > 10) {
            warnings.add("Many nested fields detected. This may impact parsing performance.")
        }
        
        // Suggestions
        if (schema.description.isNullOrBlank()) {
            suggestions.add("Consider adding a description to help others understand this schema")
        }
        
        if (schema.examples.isNullOrEmpty()) {
            suggestions.add("Adding examples can help validate the schema works as expected")
        }
        
        schema.fields.forEach { field ->
            if (field.description.isNullOrBlank()) {
                suggestions.add("Consider adding a description for field: ${field.name}")
            }
        }
        
        return SchemaValidationResult(
            isValid = errors.isEmpty(),
            errors = errors,
            warnings = warnings,
            suggestions = suggestions
        )
    }
    
    /**
     * Get local schemas
     */
    fun getLocalSchemas(): List<ParseratorSchema> {
        return localSchemas.values.toList()
    }
    
    /**
     * Get schema by ID
     */
    fun getLocalSchema(id: String): ParseratorSchema? {
        return localSchemas[id]
    }
    
    /**
     * Remove schema from cache
     */
    fun removeLocalSchema(id: String) {
        localSchemas.remove(id)
    }
    
    /**
     * Clear all cached schemas
     */
    fun clearLocalSchemas() {
        localSchemas.clear()
    }
    
    /**
     * Create a basic schema template
     */
    fun createBasicSchema(name: String, description: String? = null): ParseratorSchema {
        return ParseratorSchema(
            name = name,
            description = description,
            version = "1.0",
            fields = listOf(
                com.parserator.plugin.models.SchemaField(
                    name = "example_field",
                    type = com.parserator.plugin.models.FieldType.STRING,
                    description = "Example field - replace with your own",
                    required = true
                )
            )
        )
    }
    
    /**
     * Merge two schemas
     */
    fun mergeSchemas(schema1: ParseratorSchema, schema2: ParseratorSchema, newName: String): ParseratorSchema {
        val mergedFields = (schema1.fields + schema2.fields).distinctBy { it.name }
        
        return ParseratorSchema(
            name = newName,
            description = "Merged schema from ${schema1.name} and ${schema2.name}",
            version = "1.0",
            fields = mergedFields,
            format = schema1.format ?: schema2.format,
            options = schema1.options ?: schema2.options,
            tags = (schema1.tags.orEmpty() + schema2.tags.orEmpty()).distinct()
        )
    }
    
    /**
     * Generate schema from sample data
     */
    fun generateSchemaFromSample(name: String, sampleData: String): ParseratorSchema {
        // This is a simplified implementation
        // In a real implementation, you would analyze the sample data to infer field types
        
        val lines = sampleData.lines().filter { it.isNotBlank() }
        if (lines.isEmpty()) {
            return createBasicSchema(name, "Generated from empty sample")
        }
        
        // Try to detect CSV format
        val firstLine = lines.first()
        if (firstLine.contains(",")) {
            val headers = firstLine.split(",").map { it.trim() }
            val fields = headers.map { header ->
                com.parserator.plugin.models.SchemaField(
                    name = header,
                    type = com.parserator.plugin.models.FieldType.STRING, // Default to string
                    description = "Auto-generated field",
                    required = false
                )
            }
            
            return ParseratorSchema(
                name = name,
                description = "Auto-generated schema from CSV sample",
                version = "1.0",
                fields = fields,
                format = com.parserator.plugin.models.DataFormat.CSV
            )
        }
        
        // For other formats, return a basic schema
        return createBasicSchema(name, "Generated from sample data")
    }
}