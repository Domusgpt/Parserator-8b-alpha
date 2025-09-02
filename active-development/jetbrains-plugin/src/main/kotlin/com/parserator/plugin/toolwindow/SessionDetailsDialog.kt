package com.parserator.plugin.toolwindow

import com.intellij.openapi.project.Project
import com.intellij.openapi.ui.DialogWrapper
import com.intellij.ui.components.*
import com.intellij.ui.table.JBTable
import com.intellij.util.ui.JBUI
import com.parserator.plugin.models.ParseSession
import com.parserator.plugin.utils.ParseResultFormatter
import java.awt.BorderLayout
import java.awt.Dimension
import java.time.format.DateTimeFormatter
import javax.swing.*
import javax.swing.table.DefaultTableModel

class SessionDetailsDialog(
    private val session: ParseSession,
    project: Project
) : DialogWrapper(project) {
    
    private val formatter = ParseResultFormatter()
    
    init {
        title = "Parse Session Details"
        setSize(800, 600)
        init()
    }
    
    override fun createCenterPanel(): JComponent {
        val mainPanel = JPanel(BorderLayout())
        
        // Create tabbed pane
        val tabbedPane = JBTabbedPane()
        
        // Session Info tab
        tabbedPane.addTab("Session Info", createSessionInfoPanel())
        
        // Request tab
        tabbedPane.addTab("Request", createRequestPanel())
        
        // Response tab
        tabbedPane.addTab("Response", createResponsePanel())
        
        // Raw Data tab
        tabbedPane.addTab("Raw Data", createRawDataPanel())
        
        // Metadata tab
        tabbedPane.addTab("Metadata", createMetadataPanel())
        
        mainPanel.add(tabbedPane, BorderLayout.CENTER)
        
        return mainPanel
    }
    
    private fun createSessionInfoPanel(): JComponent {
        val panel = JPanel()
        panel.layout = BoxLayout(panel, BoxLayout.Y_AXIS)
        panel.border = JBUI.Borders.empty(16)
        
        addInfoRow(panel, "Session ID:", session.id)
        addInfoRow(panel, "Timestamp:", session.timestamp.format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")))
        addInfoRow(panel, "Filename:", session.filename ?: "N/A")
        addInfoRow(panel, "Success:", if (session.result.success) "Yes" else "No")
        addInfoRow(panel, "Processing Time:", "${session.result.processingTime ?: 0}ms")
        addInfoRow(panel, "Notes:", session.notes ?: "None")
        
        session.result.metadata?.let { metadata ->
            panel.add(Box.createVerticalStrut(16))
            panel.add(JBLabel("Metadata:").apply { 
                font = font.deriveFont(font.style or java.awt.Font.BOLD) 
            })
            
            metadata.recordCount?.let { addInfoRow(panel, "Record Count:", it.toString()) }
            metadata.fieldCount?.let { addInfoRow(panel, "Field Count:", it.toString()) }
            metadata.dataSize?.let { addInfoRow(panel, "Data Size:", "$it bytes") }
            metadata.detectedFormat?.let { addInfoRow(panel, "Detected Format:", it.toString()) }
            metadata.confidence?.let { addInfoRow(panel, "Confidence:", "${(it * 100).toInt()}%") }
        }
        
        return JBScrollPane(panel)
    }
    
    private fun createRequestPanel(): JComponent {
        val panel = JPanel(BorderLayout())
        
        val requestInfo = """
            Format: ${session.request.format}
            Options:
              - Trim Whitespace: ${session.request.options.trimWhitespace}
              - Skip Empty Rows: ${session.request.options.skipEmptyRows}
              - Infer Types: ${session.request.options.inferTypes}
              - Validate Data: ${session.request.options.validateData}
              - Max Rows: ${session.request.options.maxRows ?: "Unlimited"}
              - Encoding: ${session.request.options.encoding ?: "Auto-detect"}
              - Delimiter: ${session.request.options.delimiter ?: "Auto-detect"}
              - Quote Char: ${session.request.options.quoteChar ?: "Auto-detect"}
            
            Schema: ${if (session.request.schema != null) session.request.schema.name else "None"}
            
            Original Data:
            ${session.request.data}
        """.trimIndent()
        
        val textArea = JBTextArea(requestInfo).apply {
            isEditable = false
            font = com.intellij.ui.JBFont.monospaced()
        }
        
        panel.add(JBScrollPane(textArea), BorderLayout.CENTER)
        
        return panel
    }
    
    private fun createResponsePanel(): JComponent {
        val panel = JPanel(BorderLayout())
        
        val responseText = if (session.result.success) {
            formatter.formatAsJson(session.result)
        } else {
            "Parse failed with errors:\n${session.result.errors?.joinToString("\n") ?: "Unknown error"}"
        }
        
        val textArea = JBTextArea(responseText).apply {
            isEditable = false
            font = com.intellij.ui.JBFont.monospaced()
        }
        
        panel.add(JBScrollPane(textArea), BorderLayout.CENTER)
        
        return panel
    }
    
    private fun createRawDataPanel(): JComponent {
        val panel = JPanel(BorderLayout())
        
        val rawDataText = if (session.result.success && session.result.parsed != null) {
            formatter.formatAsJson(session.result.parsed)
        } else {
            "No parsed data available"
        }
        
        val textArea = JBTextArea(rawDataText).apply {
            isEditable = false
            font = com.intellij.ui.JBFont.monospaced()
        }
        
        panel.add(JBScrollPane(textArea), BorderLayout.CENTER)
        
        return panel
    }
    
    private fun createMetadataPanel(): JComponent {
        val tableModel = DefaultTableModel(arrayOf("Property", "Value"), 0)
        val table = JBTable(tableModel).apply {
            setShowGrid(false)
            intercellSpacing = JBUI.emptySize()
            tableHeader.reorderingAllowed = false
        }
        
        // Add basic metadata
        tableModel.addRow(arrayOf("Success", session.result.success.toString()))
        tableModel.addRow(arrayOf("Processing Time", "${session.result.processingTime ?: 0}ms"))
        
        // Add detailed metadata if available
        session.result.metadata?.let { metadata ->
            metadata.recordCount?.let { tableModel.addRow(arrayOf("Record Count", it.toString())) }
            metadata.fieldCount?.let { tableModel.addRow(arrayOf("Field Count", it.toString())) }
            metadata.dataSize?.let { tableModel.addRow(arrayOf("Data Size", "$it bytes")) }
            metadata.encoding?.let { tableModel.addRow(arrayOf("Encoding", it)) }
            metadata.detectedFormat?.let { tableModel.addRow(arrayOf("Detected Format", it.toString())) }
            metadata.confidence?.let { tableModel.addRow(arrayOf("Confidence", "${(it * 100).toInt()}%")) }
            metadata.timestamp?.let { tableModel.addRow(arrayOf("Server Timestamp", it)) }
        }
        
        // Add errors and warnings
        session.result.errors?.let { errors ->
            if (errors.isNotEmpty()) {
                tableModel.addRow(arrayOf("Errors", errors.size.toString()))
                errors.forEachIndexed { index, error ->
                    tableModel.addRow(arrayOf("Error ${index + 1}", error))
                }
            }
        }
        
        session.result.warnings?.let { warnings ->
            if (warnings.isNotEmpty()) {
                tableModel.addRow(arrayOf("Warnings", warnings.size.toString()))
                warnings.forEachIndexed { index, warning ->
                    tableModel.addRow(arrayOf("Warning ${index + 1}", warning))
                }
            }
        }
        
        return JBScrollPane(table)
    }
    
    private fun addInfoRow(panel: JPanel, label: String, value: String) {
        val rowPanel = JPanel(BorderLayout()).apply {
            maximumSize = Dimension(Int.MAX_VALUE, preferredSize.height)
        }
        
        val labelComponent = JBLabel(label).apply {
            font = font.deriveFont(font.style or java.awt.Font.BOLD)
            preferredSize = Dimension(120, preferredSize.height)
        }
        
        val valueComponent = JBLabel(value)
        
        rowPanel.add(labelComponent, BorderLayout.WEST)
        rowPanel.add(valueComponent, BorderLayout.CENTER)
        
        panel.add(rowPanel)
        panel.add(Box.createVerticalStrut(8))
    }
    
    override fun createActions() = arrayOf(okAction)
}