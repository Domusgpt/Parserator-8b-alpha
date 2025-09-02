package com.parserator.plugin.toolwindow

import com.intellij.openapi.project.DumbAware
import com.intellij.openapi.project.Project
import com.intellij.openapi.wm.ToolWindow
import com.intellij.openapi.wm.ToolWindowFactory
import com.intellij.ui.content.ContentFactory

class ParseratorToolWindowFactory : ToolWindowFactory, DumbAware {
    
    override fun createToolWindowContent(project: Project, toolWindow: ToolWindow) {
        val parseratorToolWindow = ParseratorToolWindow(project)
        val content = ContentFactory.getInstance().createContent(
            parseratorToolWindow.getContent(),
            "",
            false
        )
        toolWindow.contentManager.addContent(content)
        
        // Set tool window properties
        toolWindow.setToHideOnEmptyContent(false)
        toolWindow.isShowStripeButton = true
    }
    
    override fun shouldBeAvailable(project: Project): Boolean = true
}