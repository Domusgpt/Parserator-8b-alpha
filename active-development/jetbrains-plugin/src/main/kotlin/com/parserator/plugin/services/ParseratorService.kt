package com.parserator.plugin.services

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.registerKotlinModule
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.Service
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.progress.ProgressIndicator
import com.intellij.openapi.progress.ProgressManager
import com.intellij.openapi.progress.Task
import com.parserator.plugin.models.*
import com.parserator.plugin.settings.ParseratorSettings
import kotlinx.coroutines.*
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException
import java.util.concurrent.TimeUnit

@Service(Service.Level.APP)
class ParseratorService {
    
    private val logger = Logger.getInstance(ParseratorService::class.java)
    private val objectMapper = ObjectMapper().registerKotlinModule()
    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()
    
    private val coroutineScope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    
    companion object {
        @JvmStatic
        fun getInstance(): ParseratorService {
            return ApplicationManager.getApplication().getService(ParseratorService::class.java)
        }
        
        private const val BASE_URL = "https://parserator.com/api"
        private const val PARSE_ENDPOINT = "$BASE_URL/parse"
        private const val SCHEMA_ENDPOINT = "$BASE_URL/schema"
        private const val VALIDATE_ENDPOINT = "$BASE_URL/validate"
    }
    
    /**
     * Parse text data with optional schema
     */
    suspend fun parseData(request: ParseRequest): ParseResult {
        return withContext(Dispatchers.IO) {
            try {
                val settings = ParseratorSettings.getInstance()
                val apiKey = settings.apiKey
                
                if (apiKey.isBlank()) {
                    throw IllegalStateException("Parserator API key is not configured. Please set it in Settings > Tools > Parserator")
                }
                
                val requestBody = objectMapper.writeValueAsString(request)
                val body = requestBody.toRequestBody("application/json".toMediaType())
                
                val httpRequest = Request.Builder()
                    .url(PARSE_ENDPOINT)
                    .post(body)
                    .addHeader("Authorization", "Bearer $apiKey")
                    .addHeader("Content-Type", "application/json")
                    .addHeader("User-Agent", "Parserator-JetBrains-Plugin/1.0.0")
                    .build()
                
                logger.info("Sending parse request to Parserator API")
                
                val response = httpClient.newCall(httpRequest).execute()
                
                if (!response.isSuccessful) {
                    val errorBody = response.body?.string() ?: "Unknown error"
                    logger.warn("Parse request failed with status ${response.code}: $errorBody")
                    throw IOException("Request failed: ${response.code} - $errorBody")
                }
                
                val responseBody = response.body?.string() 
                    ?: throw IOException("Empty response body")
                
                val parseResult = objectMapper.readValue(responseBody, ParseResult::class.java)
                logger.info("Parse request completed successfully")
                
                parseResult
                
            } catch (e: Exception) {
                logger.error("Error parsing data", e)
                throw e
            }
        }
    }
    
    /**
     * Parse data with progress indicator for UI
     */
    fun parseDataWithProgress(
        request: ParseRequest,
        title: String = "Parsing Data",
        onSuccess: (ParseResult) -> Unit,
        onError: (Throwable) -> Unit
    ) {
        ProgressManager.getInstance().run(object : Task.Backgroundable(null, title, true) {
            override fun run(indicator: ProgressIndicator) {
                indicator.text = "Sending request to Parserator..."
                indicator.isIndeterminate = true
                
                coroutineScope.launch {
                    try {
                        val result = parseData(request)
                        ApplicationManager.getApplication().invokeLater {
                            onSuccess(result)
                        }
                    } catch (e: Exception) {
                        ApplicationManager.getApplication().invokeLater {
                            onError(e)
                        }
                    }
                }
            }
        })
    }
    
    /**
     * Validate schema format
     */
    suspend fun validateSchema(schema: ParseratorSchema): SchemaValidationResult {
        return withContext(Dispatchers.IO) {
            try {
                val settings = ParseratorSettings.getInstance()
                val apiKey = settings.apiKey
                
                if (apiKey.isBlank()) {
                    return@withContext SchemaValidationResult(
                        isValid = false,
                        errors = listOf("API key is not configured")
                    )
                }
                
                val requestBody = objectMapper.writeValueAsString(schema)
                val body = requestBody.toRequestBody("application/json".toMediaType())
                
                val httpRequest = Request.Builder()
                    .url(VALIDATE_ENDPOINT)
                    .post(body)
                    .addHeader("Authorization", "Bearer $apiKey")
                    .addHeader("Content-Type", "application/json")
                    .build()
                
                val response = httpClient.newCall(httpRequest).execute()
                val responseBody = response.body?.string() ?: "{}"
                
                if (response.isSuccessful) {
                    objectMapper.readValue(responseBody, SchemaValidationResult::class.java)
                } else {
                    SchemaValidationResult(
                        isValid = false,
                        errors = listOf("Validation failed: ${response.code}")
                    )
                }
                
            } catch (e: Exception) {
                logger.error("Error validating schema", e)
                SchemaValidationResult(
                    isValid = false,
                    errors = listOf("Validation error: ${e.message}")
                )
            }
        }
    }
    
    /**
     * Get available schemas from server
     */
    suspend fun getAvailableSchemas(): List<SchemaInfo> {
        return withContext(Dispatchers.IO) {
            try {
                val settings = ParseratorSettings.getInstance()
                val apiKey = settings.apiKey
                
                if (apiKey.isBlank()) {
                    return@withContext emptyList()
                }
                
                val httpRequest = Request.Builder()
                    .url("$SCHEMA_ENDPOINT/list")
                    .get()
                    .addHeader("Authorization", "Bearer $apiKey")
                    .build()
                
                val response = httpClient.newCall(httpRequest).execute()
                
                if (response.isSuccessful) {
                    val responseBody = response.body?.string() ?: "[]"
                    val jsonNode = objectMapper.readTree(responseBody)
                    
                    if (jsonNode.isArray) {
                        jsonNode.map { node ->
                            SchemaInfo(
                                id = node.get("id")?.asText() ?: "",
                                name = node.get("name")?.asText() ?: "",
                                description = node.get("description")?.asText() ?: "",
                                version = node.get("version")?.asText() ?: "1.0",
                                tags = node.get("tags")?.map { it.asText() } ?: emptyList()
                            )
                        }
                    } else {
                        emptyList()
                    }
                } else {
                    logger.warn("Failed to fetch schemas: ${response.code}")
                    emptyList()
                }
                
            } catch (e: Exception) {
                logger.error("Error fetching schemas", e)
                emptyList()
            }
        }
    }
    
    /**
     * Get schema by ID
     */
    suspend fun getSchema(schemaId: String): ParseratorSchema? {
        return withContext(Dispatchers.IO) {
            try {
                val settings = ParseratorSettings.getInstance()
                val apiKey = settings.apiKey
                
                if (apiKey.isBlank()) {
                    return@withContext null
                }
                
                val httpRequest = Request.Builder()
                    .url("$SCHEMA_ENDPOINT/$schemaId")
                    .get()
                    .addHeader("Authorization", "Bearer $apiKey")
                    .build()
                
                val response = httpClient.newCall(httpRequest).execute()
                
                if (response.isSuccessful) {
                    val responseBody = response.body?.string() ?: return@withContext null
                    objectMapper.readValue(responseBody, ParseratorSchema::class.java)
                } else {
                    null
                }
                
            } catch (e: Exception) {
                logger.error("Error fetching schema", e)
                null
            }
        }
    }
    
    /**
     * Bulk parse multiple files
     */
    suspend fun bulkParse(requests: List<BulkParseItem>): BulkParseResult {
        return withContext(Dispatchers.IO) {
            try {
                val settings = ParseratorSettings.getInstance()
                val apiKey = settings.apiKey
                
                if (apiKey.isBlank()) {
                    throw IllegalStateException("API key is not configured")
                }
                
                val bulkRequest = BulkParseRequest(
                    items = requests,
                    options = BulkParseOptions(
                        failFast = false,
                        maxConcurrency = 5
                    )
                )
                
                val requestBody = objectMapper.writeValueAsString(bulkRequest)
                val body = requestBody.toRequestBody("application/json".toMediaType())
                
                val httpRequest = Request.Builder()
                    .url("$BASE_URL/bulk-parse")
                    .post(body)
                    .addHeader("Authorization", "Bearer $apiKey")
                    .addHeader("Content-Type", "application/json")
                    .build()
                
                val response = httpClient.newCall(httpRequest).execute()
                
                if (!response.isSuccessful) {
                    throw IOException("Bulk parse failed: ${response.code}")
                }
                
                val responseBody = response.body?.string() ?: throw IOException("Empty response")
                objectMapper.readValue(responseBody, BulkParseResult::class.java)
                
            } catch (e: Exception) {
                logger.error("Error in bulk parse", e)
                throw e
            }
        }
    }
    
    /**
     * Check API key validity
     */
    suspend fun validateApiKey(apiKey: String): Boolean {
        return withContext(Dispatchers.IO) {
            try {
                val httpRequest = Request.Builder()
                    .url("$BASE_URL/auth/validate")
                    .get()
                    .addHeader("Authorization", "Bearer $apiKey")
                    .build()
                
                val response = httpClient.newCall(httpRequest).execute()
                response.isSuccessful
                
            } catch (e: Exception) {
                logger.error("Error validating API key", e)
                false
            }
        }
    }
    
    fun dispose() {
        coroutineScope.cancel()
        httpClient.dispatcher.executorService.shutdown()
        httpClient.connectionPool.evictAll()
    }
}