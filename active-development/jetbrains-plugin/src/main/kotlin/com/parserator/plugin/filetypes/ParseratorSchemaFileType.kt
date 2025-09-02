package com.parserator.plugin.filetypes

import com.intellij.icons.AllIcons
import com.intellij.json.JsonLanguage
import com.intellij.openapi.fileTypes.LanguageFileType
import com.intellij.openapi.vfs.VirtualFile
import javax.swing.Icon

class ParseratorSchemaFileType : LanguageFileType(JsonLanguage.INSTANCE) {
    
    companion object {
        @JvmField
        val INSTANCE = ParseratorSchemaFileType()
    }
    
    override fun getName(): String = "Parserator Schema"
    
    override fun getDescription(): String = "Parserator parsing schema files"
    
    override fun getDefaultExtension(): String = "pschema"
    
    override fun getIcon(): Icon = AllIcons.FileTypes.Json
    
    override fun getCharset(file: VirtualFile, content: ByteArray): String = "UTF-8"
}