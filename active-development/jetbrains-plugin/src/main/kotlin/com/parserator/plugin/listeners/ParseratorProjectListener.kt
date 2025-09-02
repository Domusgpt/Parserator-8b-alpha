package com.parserator.plugin.listeners

import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.project.Project
import com.intellij.openapi.project.ProjectManagerListener
import com.parserator.plugin.services.ProjectParseratorService

class ParseratorProjectListener : ProjectManagerListener {
    
    private val logger = Logger.getInstance(ParseratorProjectListener::class.java)
    
    override fun projectOpened(project: Project) {
        logger.debug("Project opened: ${project.name}")
        
        // Initialize project-specific services
        try {
            ProjectParseratorService.getInstance(project)
            logger.debug("Project services initialized for: ${project.name}")
        } catch (e: Exception) {
            logger.error("Error initializing project services", e)
        }
    }
    
    override fun projectClosed(project: Project) {
        logger.debug("Project closed: ${project.name}")
        
        // Cleanup project-specific resources if needed
        try {
            val projectService = ProjectParseratorService.getInstance(project)
            // Could add cleanup logic here if needed
            logger.debug("Project cleanup completed for: ${project.name}")
        } catch (e: Exception) {
            logger.error("Error during project cleanup", e)
        }
    }
    
    override fun projectClosing(project: Project) {
        logger.debug("Project closing: ${project.name}")
        
        // Perform any pre-close operations
        // This is called before projectClosed
    }
}