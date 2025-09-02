package com.parserator.plugin.services

import com.intellij.openapi.components.Service
import com.intellij.openapi.project.Project
import com.parserator.plugin.models.ParseSession
import java.util.concurrent.ConcurrentHashMap

@Service(Service.Level.PROJECT)
class ProjectParseratorService(private val project: Project) {
    
    private val sessions = ConcurrentHashMap<String, ParseSession>()
    private val maxSessions = 100
    
    companion object {
        @JvmStatic
        fun getInstance(project: Project): ProjectParseratorService {
            return project.getService(ProjectParseratorService::class.java)
        }
    }
    
    fun addSession(session: ParseSession) {
        // Remove oldest sessions if we exceed max
        if (sessions.size >= maxSessions) {
            val oldestSession = sessions.values.minByOrNull { it.timestamp }
            oldestSession?.let { sessions.remove(it.id) }
        }
        
        sessions[session.id] = session
    }
    
    fun getSession(sessionId: String): ParseSession? {
        return sessions[sessionId]
    }
    
    fun getAllSessions(): List<ParseSession> {
        return sessions.values.sortedByDescending { it.timestamp }
    }
    
    fun removeSession(sessionId: String) {
        sessions.remove(sessionId)
    }
    
    fun clearAllSessions() {
        sessions.clear()
    }
    
    fun getSessionCount(): Int {
        return sessions.size
    }
}