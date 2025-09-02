package com.parserator.plugin.actions

import com.intellij.notification.NotificationGroupManager
import com.intellij.notification.NotificationType
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.actionSystem.CommonDataKeys
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.editor.Editor
import com.intellij.openapi.progress.ProgressIndicator
import com.intellij.openapi.progress.ProgressManager
import com.intellij.openapi.progress.Task
import com.intellij.openapi.project.Project
import com.intellij.openapi.ui.DialogWrapper
import com.intellij.openapi.ui.Messages
import com.intellij.openapi.util.TextRange
import com.intellij.ui.components.JBList
import com.intellij.ui.components.JBScrollPane
import com.intellij.ui.components.JBTextArea
import com.parserator.plugin.models.*
import com.parserator.plugin.services.ParseratorService
import com.parserator.plugin.services.ProjectParseratorService
import com.parserator.plugin.settings.ParseratorSettings
import com.parserator.plugin.utils.DataFormatDetector
import kotlinx.coroutines.runBlocking
import java.awt.BorderLayout
import java.awt.Dimension
import java.time.LocalDateTime
import java.util.*
import javax.swing.*

class ParseWithSchemaAction : AnAction() {
    
    private val logger = Logger.getInstance(ParseWithSchemaAction::class.java)
    private val parseratorService = ParseratorService.getInstance()
    private val settings = ParseratorSettings.getInstance()
    
    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        val editor = e.getData(CommonDataKeys.EDITOR) ?: return
        
        // Check if API is configured
        if (!settings.isConfigured()) {
            showConfigurationDialog(project)
            return
        }
        
        val selectedText = getSelectedText(editor)
        if (selectedText.isBlank()) {
            showNotification(
                "No Text Selected",
                "Please select some text to parse",
                NotificationType.WARNING,
                project
            )
            return
        }
        
        // Show schema selection dialog
        showSchemaSelectionDialog(project, editor, selectedText)
    }
    
    override fun update(e: AnActionEvent) {
        val project = e.project
        val editor = e.getData(CommonDataKeys.EDITOR)
        
        e.presentation.isEnabledAndVisible = project != null && editor != null
        
        if (editor != null) {
            val hasSelection = editor.selectionModel.hasSelection()
            e.presentation.isEnabled = hasSelection
        }
    }
    
    private fun getSelectedText(editor: Editor): String {
        return if (editor.selectionModel.hasSelection()) {
            editor.selectionModel.selectedText ?: ""
        } else {
            // If no selection, use current line
            val document = editor.document
            val caretOffset = editor.caretModel.offset
            val lineNumber = document.getLineNumber(caretOffset)
            val lineStart = document.getLineStartOffset(lineNumber)
            val lineEnd = document.getLineEndOffset(lineNumber)
            document.getText(TextRange(lineStart, lineEnd))
        }
    }
    
    private fun showSchemaSelectionDialog(project: Project, editor: Editor, selectedText: String) {
        val dialog = SchemaSelectionDialog(project) { schema ->
            parseWithSchema(project, editor, selectedText, schema)
        }
        dialog.show()
    }
    
    private fun parseWithSchema(project: Project, editor: Editor, selectedText: String, schema: ParseratorSchema?) {
        val detectedFormat = DataFormatDetector.detectFormat(selectedText)
        
        val parseRequest = ParseRequest(
            data = selectedText,
            schema = schema,
            format = detectedFormat,
            options = ParseOptions(
                trimWhitespace = true,
                skipEmptyRows = true,
                inferTypes = true,
                validateData = true
            )
        )
        
        parseWithProgress(project, editor, parseRequest, selectedText, schema?.name)
    }
    
    private fun parseWithProgress(
        project: Project,
        editor: Editor,
        request: ParseRequest,
        originalText: String,
        schemaName: String?
    ) {
        val taskTitle = if (schemaName != null) {
            "Parsing with schema: $schemaName"
        } else {
            "Parsing with Parserator"
        }
        
        ProgressManager.getInstance().run(object : Task.Backgroundable(project, taskTitle, true) {
            
            override fun run(indicator: ProgressIndicator) {
                indicator.text = "Sending request to Parserator..."
                indicator.isIndeterminate = true
                
                try {
                    val result = runBlocking { parseratorService.parseData(request) }
                    
                    ApplicationManager.getApplication().invokeLater {
                        handleParseResult(project, editor, request, result, originalText)
                    }
                    
                } catch (e: Exception) {
                    logger.error("Error parsing data with schema", e)
                    
                    ApplicationManager.getApplication().invokeLater {
                        handleParseError(project, e)
                    }
                }
            }
        })
    }
    
    private fun handleParseResult(
        project: Project,
        editor: Editor,
        request: ParseRequest,
        result: ParseResult,
        originalText: String
    ) {
        try {
            // Store session
            val projectService = ProjectParseratorService.getInstance(project)
            val session = ParseSession(
                id = UUID.randomUUID().toString(),
                timestamp = LocalDateTime.now(),
                request = request,
                result = result,
                filename = getFileName(editor),
                notes = "Parsed with schema: ${request.schema?.name ?: "None"}"
            )
            
            projectService.addSession(session)
            
            if (result.success) {
                showNotification(
                    "Parse Successful",
                    "Data parsed successfully with schema. View results in the Parserator tool window.",
                    NotificationType.INFORMATION,
                    project
                )
            } else {
                showNotification(
                    "Parse Failed",
                    result.errors?.joinToString(", ") ?: "Unknown error occurred",
                    NotificationType.ERROR,
                    project
                )
            }
            
        } catch (e: Exception) {
            logger.error("Error handling parse result", e)
            handleParseError(project, e)
        }
    }
    
    private fun handleParseError(project: Project, error: Throwable) {
        val message = when (error) {
            is IllegalStateException -> error.message ?: "Configuration error"
            else -> "Failed to parse data: ${error.message}"
        }
        
        showNotification(
            "Parse Error",
            message,
            NotificationType.ERROR,
            project
        )
    }
    
    private fun showConfigurationDialog(project: Project) {
        ApplicationManager.getApplication().invokeLater {
            com.intellij.openapi.options.ShowSettingsUtil.getInstance()
                .showSettingsDialog(project, "Parserator")
        }
    }
    
    private fun getFileName(editor: Editor): String? {
        val file = com.intellij.openapi.fileEditor.FileDocumentManager.getInstance().getFile(editor.document)
        return file?.name
    }
    
    private fun showNotification(
        title: String,
        content: String,
        type: NotificationType,
        project: Project?
    ) {
        val notification = NotificationGroupManager.getInstance()
            .getNotificationGroup("Parserator")
            .createNotification(title, content, type)
        
        notification.notify(project)
    }
}

private class SchemaSelectionDialog(
    private val project: Project,
    private val onSchemaSelected: (ParseratorSchema?) -> Unit
) : DialogWrapper(project) {
    
    private lateinit var schemaList: JBList<SchemaInfo>
    private lateinit var schemaPreview: JBTextArea
    private val listModel = DefaultListModel<SchemaInfo>()
    private var availableSchemas: List<SchemaInfo> = emptyList()
    
    init {
        title = "Select Parsing Schema"
        setSize(600, 400)
        init()
        loadSchemas()
    }
    
    override fun createCenterPanel(): JComponent {
        val panel = JPanel(BorderLayout())
        
        // Left panel - schema list
        schemaList = JBList(listModel).apply {
            selectionMode = ListSelectionModel.SINGLE_SELECTION
            cellRenderer = SchemaListCellRenderer()
        }
        
        schemaList.addListSelectionListener {
            val selectedSchema = schemaList.selectedValue
            if (selectedSchema != null) {
                loadSchemaPreview(selectedSchema)
            }
        }
        
        val listScrollPane = JBScrollPane(schemaList).apply {
            preferredSize = Dimension(250, 300)
        }
        
        // Right panel - schema preview
        schemaPreview = JBTextArea().apply {
            isEditable = false
            font = com.intellij.ui.JBFont.monospaced()
            text = "Select a schema to preview"
        }
        
        val previewScrollPane = JBScrollPane(schemaPreview).apply {
            preferredSize = Dimension(300, 300)
        }
        
        // Split pane
        val splitPane = JSplitPane(JSplitPane.HORIZONTAL_SPLIT, listScrollPane, previewScrollPane)
        splitPane.dividerLocation = 250
        
        panel.add(splitPane, BorderLayout.CENTER)
        
        // Add "No Schema" option
        val noSchemaButton = JButton("Parse without schema").apply {
            addActionListener {
                onSchemaSelected(null)
                close(OK_EXIT_CODE)
            }
        }
        
        val buttonPanel = JPanel()
        buttonPanel.add(noSchemaButton)
        panel.add(buttonPanel, BorderLayout.SOUTH)
        
        return panel
    }
    
    override fun doOKAction() {
        val selectedSchemaInfo = schemaList.selectedValue
        if (selectedSchemaInfo != null) {
            // Load full schema and proceed
            loadFullSchema(selectedSchemaInfo)
        } else {
            Messages.showWarningDialog("Please select a schema or use 'Parse without schema'", "No Schema Selected")
        }
    }
    
    private fun loadSchemas() {
        ProgressManager.getInstance().run(object : Task.Backgroundable(project, "Loading Schemas", false) {
            override fun run(indicator: ProgressIndicator) {
                try {
                    val parseratorService = ParseratorService.getInstance()
                    availableSchemas = runBlocking { parseratorService.getAvailableSchemas() }
                    
                    ApplicationManager.getApplication().invokeLater {
                        listModel.clear()
                        availableSchemas.forEach { listModel.addElement(it) }
                    }
                    
                } catch (e: Exception) {
                    ApplicationManager.getApplication().invokeLater {
                        schemaPreview.text = "Error loading schemas: ${e.message}"
                    }
                }
            }
        })
    }
    
    private fun loadSchemaPreview(schemaInfo: SchemaInfo) {
        schemaPreview.text = """
            Name: ${schemaInfo.name}
            Description: ${schemaInfo.description}
            Version: ${schemaInfo.version}
            Tags: ${schemaInfo.tags.joinToString(", ")}
            
            Loading full schema...
        """.trimIndent()
        
        ProgressManager.getInstance().run(object : Task.Backgroundable(project, "Loading Schema Details", false) {
            override fun run(indicator: ProgressIndicator) {
                try {
                    val parseratorService = ParseratorService.getInstance()
                    val fullSchema = runBlocking { parseratorService.getSchema(schemaInfo.id) }
                    
                    ApplicationManager.getApplication().invokeLater {
                        if (fullSchema != null) {
                            val fields = fullSchema.fields.joinToString("\n") { field ->
                                "  ${field.name}: ${field.type} ${if (field.required) "(required)" else "(optional)"}"
                            }
                            
                            schemaPreview.text = """
                                Name: ${fullSchema.name}
                                Description: ${fullSchema.description ?: "No description"}
                                Version: ${fullSchema.version}
                                Format: ${fullSchema.format ?: "Auto-detect"}
                                
                                Fields:
                                $fields
                                
                                Examples:
                                ${fullSchema.examples?.joinToString("\n") ?: "No examples available"}
                            """.trimIndent()
                        } else {
                            schemaPreview.text = "Failed to load schema details"
                        }
                    }
                    
                } catch (e: Exception) {
                    ApplicationManager.getApplication().invokeLater {
                        schemaPreview.text = "Error loading schema details: ${e.message}"
                    }
                }
            }
        })
    }
    
    private fun loadFullSchema(schemaInfo: SchemaInfo) {
        ProgressManager.getInstance().run(object : Task.Backgroundable(project, "Loading Schema", false) {
            override fun run(indicator: ProgressIndicator) {
                try {
                    val parseratorService = ParseratorService.getInstance()
                    val fullSchema = runBlocking { parseratorService.getSchema(schemaInfo.id) }
                    
                    ApplicationManager.getApplication().invokeLater {
                        onSchemaSelected(fullSchema)
                        close(OK_EXIT_CODE)
                    }
                    
                } catch (e: Exception) {
                    ApplicationManager.getApplication().invokeLater {
                        Messages.showErrorDialog("Failed to load schema: ${e.message}", "Schema Load Error")
                    }
                }
            }
        })
    }
    
    private class SchemaListCellRenderer : ListCellRenderer<SchemaInfo> {
        override fun getListCellRendererComponent(
            list: JList<out SchemaInfo>,
            value: SchemaInfo,
            index: Int,
            isSelected: Boolean,
            cellHasFocus: Boolean
        ): JComponent {
            val panel = JPanel(BorderLayout()).apply {
                border = com.intellij.util.ui.JBUI.Borders.empty(4, 8)
                
                if (isSelected) {
                    background = list.selectionBackground
                } else {
                    background = list.background
                }
            }
            
            val nameLabel = com.intellij.ui.components.JBLabel(value.name).apply {
                font = font.deriveFont(font.style or java.awt.Font.BOLD)
                foreground = if (isSelected) list.selectionForeground else list.foreground
            }
            
            val descLabel = com.intellij.ui.components.JBLabel(value.description).apply {
                font = com.intellij.ui.JBFont.small()
                foreground = if (isSelected) list.selectionForeground else com.intellij.ui.JBColor.GRAY
            }
            
            val infoPanel = JPanel(com.intellij.ui.layout.migLayout.MigLayout("insets 0", "[]", "[]0[]"))
            infoPanel.add(nameLabel, "wrap")
            infoPanel.add(descLabel)
            infoPanel.background = panel.background
            
            panel.add(infoPanel, BorderLayout.CENTER)
            
            return panel
        }
    }
}