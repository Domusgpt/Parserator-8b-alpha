package com.parserator.plugin.toolwindow

import com.intellij.icons.AllIcons
import com.intellij.ide.util.treeView.NodeRenderer
import com.intellij.openapi.actionSystem.*
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.project.Project
import com.intellij.openapi.ui.SimpleToolWindowPanel
import com.intellij.openapi.ui.Splitter
import com.intellij.ui.*
import com.intellij.ui.components.*
import com.intellij.ui.table.JBTable
import com.intellij.ui.treeView.Tree
import com.intellij.util.ui.JBUI
import com.intellij.util.ui.UIUtil
import com.parserator.plugin.models.*
import com.parserator.plugin.services.ExportService
import com.parserator.plugin.services.ProjectParseratorService
import com.parserator.plugin.utils.ParseResultFormatter
import com.parserator.plugin.utils.TreeUtils
import java.awt.BorderLayout
import java.awt.CardLayout
import java.awt.event.MouseAdapter
import java.awt.event.MouseEvent
import java.time.format.DateTimeFormatter
import javax.swing.*
import javax.swing.table.DefaultTableModel
import javax.swing.tree.DefaultMutableTreeNode
import javax.swing.tree.DefaultTreeModel

class ParseratorToolWindow(private val project: Project) {
    
    private val logger = Logger.getInstance(ParseratorToolWindow::class.java)
    private val projectService = ProjectParseratorService.getInstance(project)
    private val exportService = ExportService.getInstance()
    
    private lateinit var mainPanel: SimpleToolWindowPanel
    private lateinit var contentPanel: JPanel
    private lateinit var cardLayout: CardLayout
    
    // Components
    private lateinit var sessionsList: JBList<ParseSession>
    private lateinit var resultsTree: Tree
    private lateinit var rawDataArea: JTextArea
    private lateinit var metadataTable: JBTable
    private lateinit var splitter: Splitter
    
    // Data
    private val sessionsModel = DefaultListModel<ParseSession>()
    private val treeModel = DefaultTreeModel(DefaultMutableTreeNode("Results"))
    private val metadataTableModel = DefaultTableModel(arrayOf("Property", "Value"), 0)
    
    fun getContent(): JComponent {
        createUI()
        setupListeners()
        refreshSessions()
        return mainPanel
    }
    
    private fun createUI() {
        mainPanel = SimpleToolWindowPanel(true, true)
        
        // Create toolbar
        val toolbar = createToolbar()
        mainPanel.setToolbar(toolbar.component)
        
        // Create main content
        createMainContent()
        mainPanel.setContent(splitter)
    }
    
    private fun createToolbar(): ActionToolbar {
        val actionGroup = DefaultActionGroup().apply {
            add(RefreshSessionsAction())
            add(ClearSessionsAction())
            addSeparator()
            add(ExportSelectedAction())
            add(ExportAllAction())
            addSeparator()
            add(ExpandAllAction())
            add(CollapseAllAction())
        }
        
        return ActionManager.getInstance().createActionToolbar(
            "ParseratorToolWindow",
            actionGroup,
            true
        )
    }
    
    private fun createMainContent() {
        // Left panel - Sessions list
        val sessionsPanel = createSessionsPanel()
        
        // Right panel - Results display
        val resultsPanel = createResultsPanel()
        
        // Create splitter
        splitter = Splitter(false, 0.3f).apply {
            firstComponent = sessionsPanel
            secondComponent = resultsPanel
        }
    }
    
    private fun createSessionsPanel(): JComponent {
        sessionsList = JBList(sessionsModel).apply {
            cellRenderer = SessionListCellRenderer()
            selectionMode = ListSelectionModel.SINGLE_SELECTION
        }
        
        val scrollPane = JBScrollPane(sessionsList).apply {
            border = JBUI.Borders.customLine(JBColor.border(), 0, 0, 0, 1)
        }
        
        val panel = JPanel(BorderLayout()).apply {
            add(JBLabel("Parse Sessions").apply {
                border = JBUI.Borders.empty(8)
                font = font.deriveFont(font.style or java.awt.Font.BOLD)
            }, BorderLayout.NORTH)
            add(scrollPane, BorderLayout.CENTER)
        }
        
        return panel
    }
    
    private fun createResultsPanel(): JComponent {
        cardLayout = CardLayout()
        contentPanel = JPanel(cardLayout)
        
        // Empty state
        val emptyPanel = createEmptyPanel()
        contentPanel.add(emptyPanel, "empty")
        
        // Results view
        val resultsPanel = createResultsView()
        contentPanel.add(resultsPanel, "results")
        
        cardLayout.show(contentPanel, "empty")
        return contentPanel
    }
    
    private fun createEmptyPanel(): JComponent {
        val panel = JPanel(BorderLayout())
        val label = JBLabel("Select a parse session to view results", UIUtil.ComponentStyle.LARGE).apply {
            horizontalAlignment = SwingConstants.CENTER
            foreground = JBColor.GRAY
        }
        panel.add(label, BorderLayout.CENTER)
        return panel
    }
    
    private fun createResultsView(): JComponent {
        val tabbedPane = JBTabbedPane()
        
        // Tree view tab
        resultsTree = Tree(treeModel).apply {
            cellRenderer = ParseResultTreeCellRenderer()
            isRootVisible = false
            showsRootHandles = true
        }
        
        val treeScrollPane = JBScrollPane(resultsTree)
        tabbedPane.addTab("Tree View", AllIcons.Hierarchy.Class, treeScrollPane)
        
        // Raw data tab
        rawDataArea = JTextArea().apply {
            isEditable = false
            font = JBFont.monospaced()
            background = UIUtil.getTextFieldBackground()
        }
        
        val rawScrollPane = JBScrollPane(rawDataArea)
        tabbedPane.addTab("Raw Data", AllIcons.FileTypes.Text, rawScrollPane)
        
        // Metadata tab
        metadataTable = JBTable(metadataTableModel).apply {
            setShowGrid(false)
            intercellSpacing = JBUI.emptySize()
            tableHeader.reorderingAllowed = false
        }
        
        val metadataScrollPane = JBScrollPane(metadataTable)
        tabbedPane.addTab("Metadata", AllIcons.Actions.Properties, metadataScrollPane)
        
        return tabbedPane
    }
    
    private fun setupListeners() {
        // Session selection listener
        sessionsList.addListSelectionListener { event ->
            if (!event.valueIsAdjusting) {
                val selectedSession = sessionsList.selectedValue
                if (selectedSession != null) {
                    displaySession(selectedSession)
                } else {
                    cardLayout.show(contentPanel, "empty")
                }
            }
        }
        
        // Double-click to view session details
        sessionsList.addMouseListener(object : MouseAdapter() {
            override fun mouseClicked(e: MouseEvent) {
                if (e.clickCount == 2) {
                    val selectedSession = sessionsList.selectedValue
                    selectedSession?.let {
                        // Open session details dialog
                        showSessionDetails(it)
                    }
                }
            }
        })
        
        // Tree expansion listener
        resultsTree.addTreeExpansionListener(object : javax.swing.event.TreeExpansionListener {
            override fun treeExpanded(event: javax.swing.event.TreeExpansionEvent) {
                // Handle tree expansion if needed
            }
            
            override fun treeCollapsed(event: javax.swing.event.TreeExpansionEvent) {
                // Handle tree collapse if needed
            }
        })
    }
    
    private fun displaySession(session: ParseSession) {
        try {
            // Update tree view
            updateTreeView(session.result)
            
            // Update raw data
            updateRawData(session)
            
            // Update metadata
            updateMetadata(session.result)
            
            // Show results panel
            cardLayout.show(contentPanel, "results")
            
        } catch (e: Exception) {
            logger.error("Error displaying session", e)
        }
    }
    
    private fun updateTreeView(result: ParseResult) {
        val root = DefaultMutableTreeNode("Parse Result")
        
        if (result.success && result.parsed != null) {
            val treeNodes = TreeUtils.buildTreeFromData(result.parsed)
            treeNodes.forEach { root.add(it) }
        } else {
            root.add(DefaultMutableTreeNode("No data available"))
        }
        
        treeModel.setRoot(root)
        treeModel.reload()
        
        // Expand first level
        for (i in 0 until resultsTree.rowCount) {
            resultsTree.expandRow(i)
        }
    }
    
    private fun updateRawData(session: ParseSession) {
        val formatter = ParseResultFormatter()
        val formattedData = if (session.result.success) {
            formatter.formatAsJson(session.result.parsed)
        } else {
            "Parse failed:\n${session.result.errors?.joinToString("\n") ?: "Unknown error"}"
        }
        
        rawDataArea.text = formattedData
        rawDataArea.caretPosition = 0
    }
    
    private fun updateMetadata(result: ParseResult) {
        metadataTableModel.rowCount = 0
        
        // Add basic metadata
        metadataTableModel.addRow(arrayOf("Success", result.success.toString()))
        
        result.processingTime?.let {
            metadataTableModel.addRow(arrayOf("Processing Time", "${it}ms"))
        }
        
        result.metadata?.let { metadata ->
            metadata.recordCount?.let {
                metadataTableModel.addRow(arrayOf("Record Count", it.toString()))
            }
            
            metadata.fieldCount?.let {
                metadataTableModel.addRow(arrayOf("Field Count", it.toString()))
            }
            
            metadata.dataSize?.let {
                metadataTableModel.addRow(arrayOf("Data Size", "${it} bytes"))
            }
            
            metadata.detectedFormat?.let {
                metadataTableModel.addRow(arrayOf("Detected Format", it.toString()))
            }
            
            metadata.confidence?.let {
                metadataTableModel.addRow(arrayOf("Confidence", "${(it * 100).toInt()}%"))
            }
        }
        
        if (result.errors?.isNotEmpty() == true) {
            metadataTableModel.addRow(arrayOf("Errors", result.errors.size.toString()))
        }
        
        if (result.warnings?.isNotEmpty() == true) {
            metadataTableModel.addRow(arrayOf("Warnings", result.warnings.size.toString()))
        }
    }
    
    private fun refreshSessions() {
        ApplicationManager.getApplication().executeOnPooledThread {
            val sessions = projectService.getAllSessions()
            
            ApplicationManager.getApplication().invokeLater {
                sessionsModel.clear()
                sessions.forEach { sessionsModel.addElement(it) }
            }
        }
    }
    
    private fun showSessionDetails(session: ParseSession) {
        // Create and show session details dialog
        val dialog = SessionDetailsDialog(session, project)
        dialog.show()
    }
    
    // Action classes
    private inner class RefreshSessionsAction : AnAction("Refresh", "Refresh sessions list", AllIcons.Actions.Refresh) {
        override fun actionPerformed(e: AnActionEvent) {
            refreshSessions()
        }
    }
    
    private inner class ClearSessionsAction : AnAction("Clear", "Clear all sessions", AllIcons.Actions.GC) {
        override fun actionPerformed(e: AnActionEvent) {
            val result = Messages.showYesNoDialog(
                "Are you sure you want to clear all parse sessions?",
                "Clear Sessions",
                Messages.getQuestionIcon()
            )
            
            if (result == Messages.YES) {
                projectService.clearAllSessions()
                refreshSessions()
                cardLayout.show(contentPanel, "empty")
            }
        }
    }
    
    private inner class ExportSelectedAction : AnAction("Export Selected", "Export selected session", AllIcons.ToolbarDecorator.Export) {
        override fun actionPerformed(e: AnActionEvent) {
            val selectedSession = sessionsList.selectedValue
            if (selectedSession != null) {
                exportService.exportSession(selectedSession, project)
            }
        }
        
        override fun update(e: AnActionEvent) {
            e.presentation.isEnabled = sessionsList.selectedValue != null
        }
    }
    
    private inner class ExportAllAction : AnAction("Export All", "Export all sessions", AllIcons.Actions.Download) {
        override fun actionPerformed(e: AnActionEvent) {
            val sessions = (0 until sessionsModel.size()).map { sessionsModel.getElementAt(it) }
            if (sessions.isNotEmpty()) {
                exportService.exportSessions(sessions, project)
            }
        }
        
        override fun update(e: AnActionEvent) {
            e.presentation.isEnabled = !sessionsModel.isEmpty
        }
    }
    
    private inner class ExpandAllAction : AnAction("Expand All", "Expand all tree nodes", AllIcons.Actions.Expandall) {
        override fun actionPerformed(e: AnActionEvent) {
            TreeUtils.expandAll(resultsTree)
        }
    }
    
    private inner class CollapseAllAction : AnAction("Collapse All", "Collapse all tree nodes", AllIcons.Actions.Collapseall) {
        override fun actionPerformed(e: AnActionEvent) {
            TreeUtils.collapseAll(resultsTree)
        }
    }
    
    // Custom cell renderers
    private class SessionListCellRenderer : ListCellRenderer<ParseSession> {
        override fun getListCellRendererComponent(
            list: JList<out ParseSession>,
            value: ParseSession,
            index: Int,
            isSelected: Boolean,
            cellHasFocus: Boolean
        ): JComponent {
            val panel = JPanel(BorderLayout()).apply {
                border = JBUI.Borders.empty(4, 8)
                
                if (isSelected) {
                    background = list.selectionBackground
                } else {
                    background = list.background
                }
            }
            
            val nameLabel = JBLabel(value.filename ?: "Parse Session ${value.id.take(8)}").apply {
                font = font.deriveFont(font.style or java.awt.Font.BOLD)
                foreground = if (isSelected) list.selectionForeground else list.foreground
            }
            
            val timeLabel = JBLabel(value.timestamp.format(DateTimeFormatter.ofPattern("MMM dd, HH:mm"))).apply {
                font = JBFont.small()
                foreground = if (isSelected) list.selectionForeground else JBColor.GRAY
            }
            
            val statusIcon = if (value.result.success) {
                AllIcons.General.InspectionsOK
            } else {
                AllIcons.General.Error
            }
            
            val iconLabel = JBLabel(statusIcon)
            
            panel.add(iconLabel, BorderLayout.WEST)
            panel.add(nameLabel, BorderLayout.CENTER)
            panel.add(timeLabel, BorderLayout.EAST)
            
            return panel
        }
    }
    
    private class ParseResultTreeCellRenderer : NodeRenderer() {
        override fun customizeCellRenderer(
            tree: JTree,
            value: Any?,
            selected: Boolean,
            expanded: Boolean,
            leaf: Boolean,
            row: Int,
            hasFocus: Boolean
        ) {
            super.customizeCellRenderer(tree, value, selected, expanded, leaf, row, hasFocus)
            
            if (value is DefaultMutableTreeNode) {
                when (val userObject = value.userObject) {
                    is ParseResultTreeNode -> {
                        icon = when (userObject.type) {
                            "object" -> AllIcons.Json.Object
                            "array" -> AllIcons.Json.Array
                            "string" -> AllIcons.Nodes.Property
                            "number" -> AllIcons.Nodes.Property
                            "boolean" -> AllIcons.Nodes.Property
                            else -> AllIcons.Nodes.Property
                        }
                    }
                }
            }
        }
    }
}