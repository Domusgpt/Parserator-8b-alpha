package com.parserator.plugin.actions

import com.intellij.notification.NotificationGroupManager
import com.intellij.notification.NotificationType
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.actionSystem.CommonDataKeys
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.command.WriteCommandAction
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.editor.Editor
import com.intellij.openapi.fileEditor.FileDocumentManager
import com.intellij.openapi.progress.ProgressIndicator
import com.intellij.openapi.progress.ProgressManager
import com.intellij.openapi.progress.Task
import com.intellij.openapi.project.Project
import com.intellij.openapi.ui.Messages
import com.intellij.openapi.util.TextRange
import com.intellij.openapi.wm.ToolWindowManager
import com.parserator.plugin.models.*
import com.parserator.plugin.services.ParseratorService
import com.parserator.plugin.services.ProjectParseratorService
import com.parserator.plugin.settings.ParseratorSettings
import com.parserator.plugin.utils.DataFormatDetector
import com.parserator.plugin.utils.ParseResultFormatter
import kotlinx.coroutines.runBlocking
import java.time.LocalDateTime
import java.util.*

class ParseSelectedTextAction : AnAction() {
    
    private val logger = Logger.getInstance(ParseSelectedTextAction::class.java)
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
        
        // Detect format
        val detectedFormat = DataFormatDetector.detectFormat(selectedText)
        
        // Create parse request
        val parseRequest = ParseRequest(
            data = selectedText,
            format = detectedFormat,
            options = ParseOptions(
                trimWhitespace = true,
                skipEmptyRows = true,
                inferTypes = true,
                validateData = true
            )
        )
        
        // Parse with progress
        parseWithProgress(project, editor, parseRequest, selectedText)
    }
    
    override fun update(e: AnActionEvent) {
        val project = e.project
        val editor = e.getData(CommonDataKeys.EDITOR)
        
        e.presentation.isEnabledAndVisible = project != null && editor != null
        
        if (editor != null) {
            val hasSelection = editor.selectionModel.hasSelection()
            e.presentation.isEnabled = hasSelection
            
            if (hasSelection) {
                e.presentation.text = "Parse Selected Text with Parserator"
            } else {
                e.presentation.text = "Parse with Parserator (no selection)"
            }
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
    
    private fun parseWithProgress(
        project: Project,
        editor: Editor,
        request: ParseRequest,
        originalText: String
    ) {
        ProgressManager.getInstance().run(object : Task.Backgroundable(project, "Parsing with Parserator", true) {
            
            override fun run(indicator: ProgressIndicator) {
                indicator.text = "Sending request to Parserator..."
                indicator.isIndeterminate = true
                
                try {
                    val result = runBlocking { parseratorService.parseData(request) }
                    
                    ApplicationManager.getApplication().invokeLater {
                        handleParseResult(project, editor, request, result, originalText)
                    }
                    
                } catch (e: Exception) {
                    logger.error("Error parsing data", e)
                    
                    ApplicationManager.getApplication().invokeLater {
                        handleParseError(project, e)
                    }
                }
            }
            
            override fun onCancel() {
                showNotification(
                    "Parse Cancelled",
                    "The parsing operation was cancelled",
                    NotificationType.INFORMATION,
                    project
                )
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
                notes = null
            )
            
            projectService.addSession(session)
            
            // Show result options
            showResultOptions(project, editor, result, originalText)
            
            // Open tool window if result is successful
            if (result.success) {
                openToolWindow(project)
                
                showNotification(
                    "Parse Successful",
                    "Data parsed successfully. View results in the Parserator tool window.",
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
    
    private fun showResultOptions(
        project: Project,
        editor: Editor,
        result: ParseResult,
        originalText: String
    ) {
        if (!result.success) return
        
        val options = arrayOf(
            "View in Tool Window",
            "Replace Selection",
            "Insert Below",
            "Copy to Clipboard",
            "Export..."
        )
        
        val choice = Messages.showChooseDialog(
            project,
            "Parse completed successfully. What would you like to do with the results?",
            "Parse Results",
            Messages.getQuestionIcon(),
            options,
            options[0]
        )
        
        when (choice) {
            0 -> openToolWindow(project)
            1 -> replaceSelection(editor, result)
            2 -> insertBelow(editor, result)
            3 -> copyToClipboard(result)
            4 -> showExportDialog(project, result)
        }
    }
    
    private fun replaceSelection(editor: Editor, result: ParseResult) {
        val formatter = ParseResultFormatter()
        val formattedText = formatter.formatAsJson(result.parsed)
        
        WriteCommandAction.runWriteCommandAction(editor.project) {
            if (editor.selectionModel.hasSelection()) {
                editor.document.replaceString(
                    editor.selectionModel.selectionStart,
                    editor.selectionModel.selectionEnd,
                    formattedText
                )
            } else {
                val offset = editor.caretModel.offset
                editor.document.insertString(offset, formattedText)
            }
        }
    }
    
    private fun insertBelow(editor: Editor, result: ParseResult) {
        val formatter = ParseResultFormatter()
        val formattedText = formatter.formatAsJson(result.parsed)
        
        WriteCommandAction.runWriteCommandAction(editor.project) {
            val document = editor.document
            val caretOffset = editor.caretModel.offset
            val lineNumber = document.getLineNumber(caretOffset)
            val lineEnd = document.getLineEndOffset(lineNumber)
            
            document.insertString(lineEnd, "\n\n// Parserator Results:\n$formattedText")
        }
    }
    
    private fun copyToClipboard(result: ParseResult) {
        val formatter = ParseResultFormatter()
        val formattedText = formatter.formatAsJson(result.parsed)
        
        val clipboard = java.awt.Toolkit.getDefaultToolkit().systemClipboard
        val stringSelection = java.awt.datatransfer.StringSelection(formattedText)
        clipboard.setContents(stringSelection, null)
        
        // Show notification
        ApplicationManager.getApplication().invokeLater {
            showNotification(
                "Copied to Clipboard",
                "Parse results have been copied to clipboard",
                NotificationType.INFORMATION,
                null
            )
        }
    }
    
    private fun showExportDialog(project: Project, result: ParseResult) {
        // This would open an export dialog - placeholder for now
        Messages.showInfoMessage(
            project,
            "Export functionality will be implemented in the export action",
            "Export Results"
        )
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
        
        // If it's a configuration error, offer to open settings
        if (error is IllegalStateException && error.message?.contains("API key") == true) {
            val result = Messages.showYesNoDialog(
                project,
                "Parserator API key is not configured. Would you like to open settings?",
                "Configuration Required",
                Messages.getQuestionIcon()
            )
            
            if (result == Messages.YES) {
                showConfigurationDialog(project)
            }
        }
    }
    
    private fun showConfigurationDialog(project: Project) {
        // Open settings dialog
        ApplicationManager.getApplication().invokeLater {
            com.intellij.openapi.options.ShowSettingsUtil.getInstance()
                .showSettingsDialog(project, "Parserator")
        }
    }
    
    private fun openToolWindow(project: Project) {
        ApplicationManager.getApplication().invokeLater {
            val toolWindowManager = ToolWindowManager.getInstance(project)
            val toolWindow = toolWindowManager.getToolWindow("Parserator")
            toolWindow?.show()
        }
    }
    
    private fun getFileName(editor: Editor): String? {
        val file = FileDocumentManager.getInstance().getFile(editor.document)
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