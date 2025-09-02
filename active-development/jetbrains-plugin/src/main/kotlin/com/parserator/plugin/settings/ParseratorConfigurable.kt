package com.parserator.plugin.settings

import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.options.Configurable
import com.intellij.openapi.progress.ProgressManager
import com.intellij.openapi.ui.Messages
import com.intellij.ui.components.*
import com.intellij.ui.layout.panel
import com.intellij.util.ui.JBUI
import com.parserator.plugin.services.ParseratorService
import kotlinx.coroutines.runBlocking
import java.awt.BorderLayout
import java.awt.Dimension
import javax.swing.*

class ParseratorConfigurable : Configurable {
    
    private var panel: JPanel? = null
    private lateinit var apiKeyField: JPasswordField
    private lateinit var apiUrlField: JBTextField
    private lateinit var timeoutField: JBTextField
    private lateinit var autoValidateCheckBox: JBCheckBox
    private lateinit var enableCompletionCheckBox: JBCheckBox
    private lateinit var enableNotificationsCheckBox: JBCheckBox
    private lateinit var defaultExportFormatCombo: JComboBox<String>
    private lateinit var enableBulkCheckBox: JBCheckBox
    private lateinit var maxBulkItemsField: JBTextField
    private lateinit var enableFoldingCheckBox: JBCheckBox
    private lateinit var foldingThresholdField: JBTextField
    private lateinit var enableMarkersCheckBox: JBCheckBox
    private lateinit var enableInspectionsCheckBox: JBCheckBox
    private lateinit var cacheResultsCheckBox: JBCheckBox
    private lateinit var cacheExpirationField: JBTextField
    private lateinit var enableTelemetryCheckBox: JBCheckBox
    private lateinit var debugModeCheckBox: JBCheckBox
    
    private lateinit var testConnectionButton: JButton
    private lateinit var resetButton: JButton
    
    private val settings = ParseratorSettings.getInstance()
    
    override fun getDisplayName(): String = "Parserator"
    
    override fun createComponent(): JComponent {
        if (panel == null) {
            panel = createSettingsPanel()
        }
        return panel!!
    }
    
    private fun createSettingsPanel(): JPanel {
        val mainPanel = JPanel(BorderLayout())
        
        // Create tabs for different setting categories
        val tabbedPane = JBTabbedPane()
        
        // General settings tab
        tabbedPane.addTab("General", createGeneralPanel())
        
        // API settings tab
        tabbedPane.addTab("API", createApiPanel())
        
        // UI settings tab
        tabbedPane.addTab("UI", createUiPanel())
        
        // Advanced settings tab
        tabbedPane.addTab("Advanced", createAdvancedPanel())
        
        mainPanel.add(tabbedPane, BorderLayout.CENTER)
        mainPanel.add(createButtonPanel(), BorderLayout.SOUTH)
        
        return mainPanel
    }
    
    private fun createGeneralPanel(): JPanel {
        apiKeyField = JPasswordField(30)
        apiUrlField = JBTextField(30)
        timeoutField = JBTextField(10)
        autoValidateCheckBox = JBCheckBox("Auto-validate schemas")
        enableCompletionCheckBox = JBCheckBox("Enable code completion")
        enableNotificationsCheckBox = JBCheckBox("Enable notifications")
        
        return panel {
            row("API Key:") {
                cell {
                    apiKeyField()
                    button("Show") {
                        val echoChar = apiKeyField.echoChar
                        if (echoChar == 0.toChar()) {
                            apiKeyField.echoChar = '*'
                            (it.source as JButton).text = "Show"
                        } else {
                            apiKeyField.echoChar = 0.toChar()
                            (it.source as JButton).text = "Hide"
                        }
                    }
                }
            }
            row("API URL:") { apiUrlField() }
            row("Request Timeout (seconds):") { timeoutField() }
            row { autoValidateCheckBox() }
            row { enableCompletionCheckBox() }
            row { enableNotificationsCheckBox() }
            
            row {
                cell {
                    testConnectionButton = JButton("Test Connection")
                    testConnectionButton.addActionListener { testConnection() }
                    testConnectionButton()
                }
            }
            
            noteRow("Configure your Parserator API credentials and basic settings.")
        }
    }
    
    private fun createApiPanel(): JPanel {
        defaultExportFormatCombo = JComboBox(arrayOf("JSON", "CSV", "XML", "EXCEL", "YAML"))
        enableBulkCheckBox = JBCheckBox("Enable bulk operations")
        maxBulkItemsField = JBTextField(10)
        cacheResultsCheckBox = JBCheckBox("Cache results")
        cacheExpirationField = JBTextField(10)
        
        return panel {
            row("Default Export Format:") { defaultExportFormatCombo() }
            row { enableBulkCheckBox() }
            row("Max Bulk Items:") { maxBulkItemsField() }
            row { cacheResultsCheckBox() }
            row("Cache Expiration (seconds):") { cacheExpirationField() }
            
            noteRow("Configure API-related settings and caching options.")
        }
    }
    
    private fun createUiPanel(): JPanel {
        enableFoldingCheckBox = JBCheckBox("Enable auto-folding")
        foldingThresholdField = JBTextField(10)
        enableMarkersCheckBox = JBCheckBox("Enable line markers")
        enableInspectionsCheckBox = JBCheckBox("Enable inspections")
        
        return panel {
            row { enableFoldingCheckBox() }
            row("Folding Threshold (lines):") { foldingThresholdField() }
            row { enableMarkersCheckBox() }
            row { enableInspectionsCheckBox() }
            
            noteRow("Configure UI features and editor integrations.")
        }
    }
    
    private fun createAdvancedPanel(): JPanel {
        enableTelemetryCheckBox = JBCheckBox("Enable telemetry")
        debugModeCheckBox = JBCheckBox("Debug mode")
        
        return panel {
            row { enableTelemetryCheckBox() }
            row { debugModeCheckBox() }
            
            noteRow("Advanced settings for debugging and telemetry.")
            noteRow("Debug mode enables additional logging and error reporting.")
        }
    }
    
    private fun createButtonPanel(): JPanel {
        val buttonPanel = JPanel()
        
        resetButton = JButton("Reset to Defaults")
        resetButton.addActionListener { resetToDefaults() }
        
        buttonPanel.add(resetButton)
        
        return buttonPanel
    }
    
    private fun testConnection() {
        val apiKey = String(apiKeyField.password)
        val apiUrl = apiUrlField.text
        
        if (apiKey.isBlank()) {
            Messages.showErrorDialog("Please enter an API key", "Test Connection")
            return
        }
        
        if (apiUrl.isBlank()) {
            Messages.showErrorDialog("Please enter an API URL", "Test Connection")
            return
        }
        
        testConnectionButton.isEnabled = false
        testConnectionButton.text = "Testing..."
        
        ProgressManager.getInstance().runProcessWithProgressSynchronously({
            try {
                val service = ParseratorService.getInstance()
                val isValid = runBlocking { service.validateApiKey(apiKey) }
                
                ApplicationManager.getApplication().invokeLater {
                    if (isValid) {
                        Messages.showInfoMessage(
                            "Connection successful! API key is valid.",
                            "Test Connection"
                        )
                    } else {
                        Messages.showErrorDialog(
                            "Connection failed. Please check your API key and URL.",
                            "Test Connection"
                        )
                    }
                    
                    testConnectionButton.isEnabled = true
                    testConnectionButton.text = "Test Connection"
                }
            } catch (e: Exception) {
                ApplicationManager.getApplication().invokeLater {
                    Messages.showErrorDialog(
                        "Connection error: ${e.message}",
                        "Test Connection"
                    )
                    
                    testConnectionButton.isEnabled = true
                    testConnectionButton.text = "Test Connection"
                }
            }
        }, "Testing Connection...", true, null)
    }
    
    private fun resetToDefaults() {
        val result = Messages.showYesNoDialog(
            "Are you sure you want to reset all settings to defaults?",
            "Reset Settings",
            Messages.getQuestionIcon()
        )
        
        if (result == Messages.YES) {
            settings.resetToDefaults()
            reset()
            Messages.showInfoMessage("Settings reset to defaults", "Reset Complete")
        }
    }
    
    override fun isModified(): Boolean {
        return String(apiKeyField.password) != settings.apiKey ||
                apiUrlField.text != settings.apiUrl ||
                timeoutField.text.toIntOrNull() != settings.maxRequestTimeout ||
                autoValidateCheckBox.isSelected != settings.autoValidateSchemas ||
                enableCompletionCheckBox.isSelected != settings.enableCodeCompletion ||
                enableNotificationsCheckBox.isSelected != settings.enableNotifications ||
                defaultExportFormatCombo.selectedItem != settings.defaultExportFormat ||
                enableBulkCheckBox.isSelected != settings.enableBulkOperations ||
                maxBulkItemsField.text.toIntOrNull() != settings.maxBulkItems ||
                enableFoldingCheckBox.isSelected != settings.enableAutoFolding ||
                foldingThresholdField.text.toIntOrNull() != settings.foldingThreshold ||
                enableMarkersCheckBox.isSelected != settings.enableLineMarkers ||
                enableInspectionsCheckBox.isSelected != settings.enableInspections ||
                cacheResultsCheckBox.isSelected != settings.cacheResults ||
                cacheExpirationField.text.toIntOrNull() != settings.cacheExpiration ||
                enableTelemetryCheckBox.isSelected != settings.enableTelemetry ||
                debugModeCheckBox.isSelected != settings.debugMode
    }
    
    override fun apply() {
        // Validate input first
        val errors = validateInput()
        if (errors.isNotEmpty()) {
            Messages.showErrorDialog(
                "Please fix the following errors:\n" + errors.joinToString("\n"),
                "Invalid Settings"
            )
            return
        }
        
        // Apply settings
        settings.apiKey = String(apiKeyField.password)
        settings.apiUrl = apiUrlField.text.trim()
        settings.maxRequestTimeout = timeoutField.text.toIntOrNull() ?: 60
        settings.autoValidateSchemas = autoValidateCheckBox.isSelected
        settings.enableCodeCompletion = enableCompletionCheckBox.isSelected
        settings.enableNotifications = enableNotificationsCheckBox.isSelected
        settings.defaultExportFormat = defaultExportFormatCombo.selectedItem as String
        settings.enableBulkOperations = enableBulkCheckBox.isSelected
        settings.maxBulkItems = maxBulkItemsField.text.toIntOrNull() ?: 100
        settings.enableAutoFolding = enableFoldingCheckBox.isSelected
        settings.foldingThreshold = foldingThresholdField.text.toIntOrNull() ?: 50
        settings.enableLineMarkers = enableMarkersCheckBox.isSelected
        settings.enableInspections = enableInspectionsCheckBox.isSelected
        settings.cacheResults = cacheResultsCheckBox.isSelected
        settings.cacheExpiration = cacheExpirationField.text.toIntOrNull() ?: 3600
        settings.enableTelemetry = enableTelemetryCheckBox.isSelected
        settings.debugMode = debugModeCheckBox.isSelected
    }
    
    override fun reset() {
        apiKeyField.text = settings.apiKey
        apiUrlField.text = settings.apiUrl
        timeoutField.text = settings.maxRequestTimeout.toString()
        autoValidateCheckBox.isSelected = settings.autoValidateSchemas
        enableCompletionCheckBox.isSelected = settings.enableCodeCompletion
        enableNotificationsCheckBox.isSelected = settings.enableNotifications
        defaultExportFormatCombo.selectedItem = settings.defaultExportFormat
        enableBulkCheckBox.isSelected = settings.enableBulkOperations
        maxBulkItemsField.text = settings.maxBulkItems.toString()
        enableFoldingCheckBox.isSelected = settings.enableAutoFolding
        foldingThresholdField.text = settings.foldingThreshold.toString()
        enableMarkersCheckBox.isSelected = settings.enableLineMarkers
        enableInspectionsCheckBox.isSelected = settings.enableInspections
        cacheResultsCheckBox.isSelected = settings.cacheResults
        cacheExpirationField.text = settings.cacheExpiration.toString()
        enableTelemetryCheckBox.isSelected = settings.enableTelemetry
        debugModeCheckBox.isSelected = settings.debugMode
    }
    
    override fun disposeUIResources() {
        panel = null
    }
    
    private fun validateInput(): List<String> {
        val errors = mutableListOf<String>()
        
        val apiUrl = apiUrlField.text.trim()
        if (apiUrl.isNotEmpty() && !apiUrl.startsWith("http")) {
            errors.add("API URL must start with http:// or https://")
        }
        
        val timeout = timeoutField.text.toIntOrNull()
        if (timeout != null && (timeout < 10 || timeout > 300)) {
            errors.add("Request timeout must be between 10 and 300 seconds")
        }
        
        val maxBulk = maxBulkItemsField.text.toIntOrNull()
        if (maxBulk != null && (maxBulk < 1 || maxBulk > 1000)) {
            errors.add("Max bulk items must be between 1 and 1000")
        }
        
        val threshold = foldingThresholdField.text.toIntOrNull()
        if (threshold != null && (threshold < 10 || threshold > 1000)) {
            errors.add("Folding threshold must be between 10 and 1000 lines")
        }
        
        val cacheExp = cacheExpirationField.text.toIntOrNull()
        if (cacheExp != null && (cacheExp < 60 || cacheExp > 86400)) {
            errors.add("Cache expiration must be between 60 seconds and 24 hours")
        }
        
        return errors
    }
}