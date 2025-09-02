package com.parserator.plugin.settings

import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.*
import com.intellij.util.xmlb.XmlSerializerUtil

@Service(Service.Level.APP)
@State(
    name = "ParseratorSettings",
    storages = [Storage("parserator.xml")]
)
class ParseratorSettings : PersistentStateComponent<ParseratorSettings> {
    
    var apiKey: String = ""
    var apiUrl: String = "https://parserator.com/api"
    var autoValidateSchemas: Boolean = true
    var enableCodeCompletion: Boolean = true
    var maxRequestTimeout: Int = 60
    var enableNotifications: Boolean = true
    var defaultExportFormat: String = "JSON"
    var enableBulkOperations: Boolean = true
    var maxBulkItems: Int = 100
    var enableAutoFolding: Boolean = true
    var foldingThreshold: Int = 50
    var enableLineMarkers: Boolean = true
    var enableInspections: Boolean = true
    var cacheResults: Boolean = true
    var cacheExpiration: Int = 3600 // seconds
    var enableTelemetry: Boolean = false
    var debugMode: Boolean = false
    
    // UI Preferences
    var toolWindowLocation: String = "right"
    var showParseMetadata: Boolean = true
    var showProcessingTime: Boolean = true
    var expandResultsOnParse: Boolean = true
    var colorCodeResults: Boolean = true
    var fontSize: Int = 12
    var theme: String = "default"
    
    // Advanced settings
    var customHeaders: MutableMap<String, String> = mutableMapOf()
    var proxySettings: ProxySettings = ProxySettings()
    var retrySettings: RetrySettings = RetrySettings()
    var schemaDirectories: MutableList<String> = mutableListOf()
    var templateDirectories: MutableList<String> = mutableListOf()
    
    companion object {
        @JvmStatic
        fun getInstance(): ParseratorSettings {
            return ApplicationManager.getApplication().getService(ParseratorSettings::class.java)
        }
    }
    
    override fun getState(): ParseratorSettings = this
    
    override fun loadState(state: ParseratorSettings) {
        XmlSerializerUtil.copyBean(state, this)
    }
    
    /**
     * Validate current settings
     */
    fun validate(): List<String> {
        val errors = mutableListOf<String>()
        
        if (apiKey.isBlank()) {
            errors.add("API key is required")
        }
        
        if (apiUrl.isBlank()) {
            errors.add("API URL is required")
        } else if (!apiUrl.startsWith("http")) {
            errors.add("API URL must start with http:// or https://")
        }
        
        if (maxRequestTimeout < 10 || maxRequestTimeout > 300) {
            errors.add("Request timeout must be between 10 and 300 seconds")
        }
        
        if (maxBulkItems < 1 || maxBulkItems > 1000) {
            errors.add("Max bulk items must be between 1 and 1000")
        }
        
        if (foldingThreshold < 10 || foldingThreshold > 1000) {
            errors.add("Folding threshold must be between 10 and 1000")
        }
        
        if (cacheExpiration < 60 || cacheExpiration > 86400) {
            errors.add("Cache expiration must be between 60 seconds and 24 hours")
        }
        
        return errors
    }
    
    /**
     * Reset to default values
     */
    fun resetToDefaults() {
        apiKey = ""
        apiUrl = "https://parserator.com/api"
        autoValidateSchemas = true
        enableCodeCompletion = true
        maxRequestTimeout = 60
        enableNotifications = true
        defaultExportFormat = "JSON"
        enableBulkOperations = true
        maxBulkItems = 100
        enableAutoFolding = true
        foldingThreshold = 50
        enableLineMarkers = true
        enableInspections = true
        cacheResults = true
        cacheExpiration = 3600
        enableTelemetry = false
        debugMode = false
        
        toolWindowLocation = "right"
        showParseMetadata = true
        showProcessingTime = true
        expandResultsOnParse = true
        colorCodeResults = true
        fontSize = 12
        theme = "default"
        
        customHeaders.clear()
        proxySettings = ProxySettings()
        retrySettings = RetrySettings()
        schemaDirectories.clear()
        templateDirectories.clear()
    }
    
    /**
     * Check if API is configured
     */
    fun isConfigured(): Boolean {
        return apiKey.isNotBlank() && apiUrl.isNotBlank()
    }
    
    /**
     * Get request headers including custom headers
     */
    fun getRequestHeaders(): Map<String, String> {
        val headers = mutableMapOf<String, String>()
        headers["Authorization"] = "Bearer $apiKey"
        headers["User-Agent"] = "Parserator-JetBrains-Plugin/1.0.0"
        headers["Content-Type"] = "application/json"
        headers.putAll(customHeaders)
        return headers
    }
}

/**
 * Proxy configuration
 */
data class ProxySettings(
    var enabled: Boolean = false,
    var host: String = "",
    var port: Int = 8080,
    var username: String = "",
    var password: String = "",
    var type: ProxyType = ProxyType.HTTP
)

enum class ProxyType {
    HTTP, HTTPS, SOCKS
}

/**
 * Retry configuration
 */
data class RetrySettings(
    var enabled: Boolean = true,
    var maxRetries: Int = 3,
    var baseDelay: Long = 1000, // milliseconds
    var maxDelay: Long = 10000,
    var exponentialBackoff: Boolean = true,
    var retryOnTimeout: Boolean = true,
    var retryOnServerError: Boolean = true
)