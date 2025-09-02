package com.parserator.plugin.utils

import com.parserator.plugin.models.ParseResultTreeNode
import javax.swing.JTree
import javax.swing.tree.DefaultMutableTreeNode
import javax.swing.tree.TreePath

object TreeUtils {
    
    fun buildTreeFromData(data: Any?): List<DefaultMutableTreeNode> {
        return when (data) {
            is Map<*, *> -> buildFromMap(data)
            is List<*> -> buildFromList(data)
            else -> listOf(createLeafNode("value", data))
        }
    }
    
    private fun buildFromMap(map: Map<*, *>): List<DefaultMutableTreeNode> {
        return map.entries.map { (key, value) ->
            val keyStr = key?.toString() ?: "null"
            when (value) {
                is Map<*, *> -> {
                    val node = DefaultMutableTreeNode(
                        ParseResultTreeNode(
                            name = keyStr,
                            value = null,
                            type = "object",
                            children = emptyList()
                        )
                    )
                    buildFromMap(value).forEach { node.add(it) }
                    node
                }
                is List<*> -> {
                    val node = DefaultMutableTreeNode(
                        ParseResultTreeNode(
                            name = keyStr,
                            value = null,
                            type = "array",
                            children = emptyList()
                        )
                    )
                    buildFromList(value).forEach { node.add(it) }
                    node
                }
                else -> createLeafNode(keyStr, value)
            }
        }
    }
    
    private fun buildFromList(list: List<*>): List<DefaultMutableTreeNode> {
        return list.mapIndexed { index, value ->
            when (value) {
                is Map<*, *> -> {
                    val node = DefaultMutableTreeNode(
                        ParseResultTreeNode(
                            name = "[$index]",
                            value = null,
                            type = "object",
                            children = emptyList()
                        )
                    )
                    buildFromMap(value).forEach { node.add(it) }
                    node
                }
                is List<*> -> {
                    val node = DefaultMutableTreeNode(
                        ParseResultTreeNode(
                            name = "[$index]",
                            value = null,
                            type = "array",
                            children = emptyList()
                        )
                    )
                    buildFromList(value).forEach { node.add(it) }
                    node
                }
                else -> createLeafNode("[$index]", value)
            }
        }
    }
    
    private fun createLeafNode(name: String, value: Any?): DefaultMutableTreeNode {
        val type = when (value) {
            is String -> "string"
            is Number -> "number"
            is Boolean -> "boolean"
            null -> "null"
            else -> "unknown"
        }
        
        return DefaultMutableTreeNode(
            ParseResultTreeNode(
                name = name,
                value = value,
                type = type,
                children = emptyList()
            )
        )
    }
    
    fun expandAll(tree: JTree) {
        for (i in 0 until tree.rowCount) {
            tree.expandRow(i)
        }
    }
    
    fun collapseAll(tree: JTree) {
        for (i in tree.rowCount - 1 downTo 0) {
            tree.collapseRow(i)
        }
    }
    
    fun expandPath(tree: JTree, path: TreePath) {
        tree.expandPath(path)
    }
    
    fun collapsePath(tree: JTree, path: TreePath) {
        tree.collapsePath(path)
    }
}