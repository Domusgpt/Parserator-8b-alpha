package com.parserator.plugin.listeners

import com.intellij.openapi.application.ApplicationActivationListener
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.wm.IdeFrame

class ParseratorApplicationListener : ApplicationActivationListener {
    
    private val logger = Logger.getInstance(ParseratorApplicationListener::class.java)
    
    override fun applicationActivated(ideFrame: IdeFrame) {
        logger.debug("Application activated")
        // Perform any application-level initialization if needed
    }
    
    override fun applicationDeactivated(ideFrame: IdeFrame) {
        logger.debug("Application deactivated")
        // Perform any cleanup if needed
    }
}