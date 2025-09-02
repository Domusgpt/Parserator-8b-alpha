package com.parserator.plugin.services

import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.Service
import com.intellij.openapi.fileChooser.FileChooserDescriptorFactory
import com.intellij.openapi.fileChooser.FileChooserFactory
import com.intellij.openapi.project.Project
import com.intellij.openapi.ui.Messages
import com.intellij.openapi.vfs.VirtualFile
import com.parserator.plugin.models.ExportFormat
import com.parserator.plugin.models.ParseSession
import com.parserator.plugin.utils.ParseResultFormatter
import java.io.File

@Service(Service.Level.APP)
class ExportService {
    
    private val formatter = ParseResultFormatter()
    
    companion object {
        @JvmStatic
        fun getInstance(): ExportService {
            return ApplicationManager.getApplication().getService(ExportService::class.java)
        }
    }
    
    fun exportSession(session: ParseSession, project: Project) {
        val formats = ExportFormat.values()
        val formatNames = formats.map { it.name }.toTypedArray()
        
        val choice = Messages.showChooseDialog(
            project,
            "Choose export format:",
            "Export Parse Results",
            Messages.getQuestionIcon(),
            formatNames,
            formatNames[0]
        )
        
        if (choice >= 0) {
            val selectedFormat = formats[choice]
            exportToFile(session, selectedFormat, project)
        }
    }
    
    fun exportSessions(sessions: List<ParseSession>, project: Project) {
        if (sessions.isEmpty()) {
            Messages.showInfoMessage("No sessions to export", "Export")
            return
        }
        
        val formats = ExportFormat.values()
        val formatNames = formats.map { it.name }.toTypedArray()
        
        val choice = Messages.showChooseDialog(
            project,
            "Choose export format for ${sessions.size} sessions:",
            "Export Parse Results",
            Messages.getQuestionIcon(),
            formatNames,
            formatNames[0]
        )
        
        if (choice >= 0) {
            val selectedFormat = formats[choice]
            exportSessionsToFile(sessions, selectedFormat, project)
        }
    }
    
    private fun exportToFile(session: ParseSession, format: ExportFormat, project: Project) {
        val fileChooser = FileChooserFactory.getInstance().createSaveFileDialog(
            FileChooserDescriptorFactory.createSingleFileDescriptor(),
            project
        )
        
        val defaultName = "parserator_result_${session.id.take(8)}.${format.name.lowercase()}"
        
        fileChooser.save(defaultName)?.let { wrapper ->
            val file = wrapper.file
            try {
                val content = formatSessionData(session, format)
                file.writeText(content)
                
                Messages.showInfoMessage(
                    "Results exported successfully to ${file.absolutePath}",
                    "Export Complete"
                )
            } catch (e: Exception) {
                Messages.showErrorDialog(
                    "Failed to export results: ${e.message}",
                    "Export Error"
                )
            }
        }
    }
    
    private fun exportSessionsToFile(sessions: List<ParseSession>, format: ExportFormat, project: Project) {
        val fileChooser = FileChooserFactory.getInstance().createSaveFileDialog(
            FileChooserDescriptorFactory.createSingleFileDescriptor(),
            project
        )
        
        val defaultName = "parserator_sessions_${sessions.size}.${format.name.lowercase()}"
        
        fileChooser.save(defaultName)?.let { wrapper ->
            val file = wrapper.file
            try {
                val content = formatSessionsData(sessions, format)
                file.writeText(content)
                
                Messages.showInfoMessage(
                    "${sessions.size} sessions exported successfully to ${file.absolutePath}",
                    "Export Complete"
                )
            } catch (e: Exception) {
                Messages.showErrorDialog(
                    "Failed to export sessions: ${e.message}",
                    "Export Error"
                )
            }
        }
    }
    
    private fun formatSessionData(session: ParseSession, format: ExportFormat): String {
        return when (format) {
            ExportFormat.JSON -> formatter.formatAsJson(session.result.parsed)
            ExportFormat.CSV -> formatAsCsv(session.result.parsed)
            ExportFormat.XML -> formatter.formatAsXml(session.result.parsed)
            else -> formatter.formatAsJson(session.result.parsed)
        }
    }
    
    private fun formatSessionsData(sessions: List<ParseSession>, format: ExportFormat): String {
        return when (format) {
            ExportFormat.JSON -> {
                val allResults = sessions.map { session ->
                    mapOf(
                        "sessionId" to session.id,
                        "timestamp" to session.timestamp.toString(),
                        "filename" to session.filename,
                        "success" to session.result.success,
                        "data" to session.result.parsed
                    )
                }
                formatter.formatAsJson(allResults)
            }
            ExportFormat.CSV -> {
                val header = "SessionId,Timestamp,Filename,Success,Data\n"
                val rows = sessions.joinToString("\n") { session ->
                    "${session.id},${session.timestamp},${session.filename ?: ""},${session.result.success},\"${formatter.formatAsJson(session.result.parsed).replace("\"", "\"\"")}\""
                }
                header + rows
            }
            else -> formatter.formatAsJson(sessions.map { it.result.parsed })
        }
    }
    
    private fun formatAsCsv(data: Any?): String {
        return when (data) {
            is List<*> -> {
                if (data.isEmpty()) return ""
                
                val firstItem = data.first()
                if (firstItem is Map<*, *>) {
                    val headers = firstItem.keys.joinToString(",")
                    val rows = data.map { item ->
                        if (item is Map<*, *>) {
                            item.values.joinToString(",") { value ->
                                "\"${value?.toString()?.replace("\"", "\"\"") ?: ""}\""
                            }
                        } else {
                            "\"$item\""
                        }
                    }
                    headers + "\n" + rows.joinToString("\n")
                } else {
                    data.joinToString("\n") { "\"$it\"" }
                }
            }
            is Map<*, *> -> {
                val headers = data.keys.joinToString(",")
                val values = data.values.joinToString(",") { value ->
                    "\"${value?.toString()?.replace("\"", "\"\"") ?: ""}\""
                }
                headers + "\n" + values
            }
            else -> "\"$data\""
        }
    }
}