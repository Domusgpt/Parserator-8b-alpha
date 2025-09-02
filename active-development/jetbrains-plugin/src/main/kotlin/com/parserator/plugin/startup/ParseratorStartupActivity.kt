package com.parserator.plugin.startup

import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.project.Project
import com.intellij.openapi.startup.ProjectActivity
import com.parserator.plugin.services.ProjectParseratorService
import com.parserator.plugin.settings.ParseratorSettings

class ParseratorStartupActivity : ProjectActivity {
    
    private val logger = Logger.getInstance(ParseratorStartupActivity::class.java)
    
    override suspend fun execute(project: Project) {
        logger.info("Initializing Parserator plugin for project: ${project.name}")
        
        try {
            // Initialize project service
            val projectService = ProjectParseratorService.getInstance(project)
            logger.debug("Project service initialized")
            
            // Check settings configuration
            val settings = ParseratorSettings.getInstance()
            if (!settings.isConfigured()) {
                logger.warn("Parserator API key not configured")
                
                // Show configuration notification if enabled
                if (settings.enableNotifications) {
                    ApplicationManager.getApplication().invokeLater {
                        showConfigurationNotification(project)
                    }
                }
            } else {
                logger.info("Parserator plugin initialized successfully")
            }
            
        } catch (e: Exception) {
            logger.error("Error initializing Parserator plugin", e)
        }
    }
    
    private fun showConfigurationNotification(project: Project) {
        val notification = com.intellij.notification.NotificationGroupManager.getInstance()
            .getNotificationGroup("Parserator")
            .createNotification(
                "Parserator Configuration",
                "Parserator API key is not configured. Click to open settings.",
                com.intellij.notification.NotificationType.INFORMATION
            )
        
        notification.addAction(object : com.intellij.notification.NotificationAction("Configure") {
            override fun actionPerformed(e: com.intellij.openapi.actionSystem.AnActionEvent, notification: com.intellij.notification.Notification) {
                com.intellij.openapi.options.ShowSettingsUtil.getInstance()
                    .showSettingsDialog(project, "Parserator")
                notification.expire()
            }
        })
        
        notification.notify(project)
    }
}