package com.parserator.plugin.actions

import com.intellij.ide.actions.CreateFileFromTemplateAction
import com.intellij.ide.actions.CreateFileFromTemplateDialog
import com.intellij.openapi.project.DumbAware
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.io.FileUtil
import com.intellij.psi.PsiDirectory
import com.intellij.psi.PsiFile
import com.intellij.psi.PsiFileFactory
import com.parserator.plugin.filetypes.ParseratorSchemaFileType

class CreateSchemaAction : CreateFileFromTemplateAction(
    "Parserator Schema",
    "Create a new Parserator schema file",
    ParseratorSchemaFileType.INSTANCE.icon
), DumbAware {

    override fun buildDialog(
        project: Project,
        directory: PsiDirectory,
        builder: CreateFileFromTemplateDialog.Builder
    ) {
        builder
            .setTitle("New Parserator Schema")
            .addKind("Basic Schema", ParseratorSchemaFileType.INSTANCE.icon, "ParseSchema")
            .addKind("CSV Schema", ParseratorSchemaFileType.INSTANCE.icon, "CSVSchema")
            .addKind("JSON Schema", ParseratorSchemaFileType.INSTANCE.icon, "JSONSchema")
            .addKind("XML Schema", ParseratorSchemaFileType.INSTANCE.icon, "XMLSchema")
    }

    override fun createFile(name: String, templateName: String, dir: PsiDirectory): PsiFile? {
        val project = dir.project
        val fileName = if (name.endsWith(".pschema")) name else "$name.pschema"
        
        val template = getSchemaTemplate(templateName)
        
        val psiFile = PsiFileFactory.getInstance(project).createFileFromText(
            fileName,
            ParseratorSchemaFileType.INSTANCE,
            template
        )
        
        return dir.add(psiFile) as PsiFile
    }

    override fun getActionName(directory: PsiDirectory?, newName: String, templateName: String?): String {
        return "Create Parserator Schema"
    }

    private fun getSchemaTemplate(templateName: String): String {
        return when (templateName) {
            "CSVSchema" -> csvSchemaTemplate
            "JSONSchema" -> jsonSchemaTemplate
            "XMLSchema" -> xmlSchemaTemplate
            else -> basicSchemaTemplate
        }
    }

    companion object {
        private val basicSchemaTemplate = """
{
  "name": "MySchema",
  "description": "A custom parsing schema",
  "version": "1.0",
  "format": "AUTO",
  "fields": [
    {
      "name": "field1",
      "type": "STRING",
      "description": "First field",
      "required": true
    },
    {
      "name": "field2",
      "type": "INTEGER",
      "description": "Second field",
      "required": false,
      "validation": {
        "min": 0,
        "max": 100
      }
    }
  ],
  "options": {
    "strictMode": false,
    "allowExtraFields": true,
    "caseSensitive": true
  },
  "examples": [
    "field1,field2\nvalue1,42\nvalue2,24"
  ]
}
        """.trimIndent()

        private val csvSchemaTemplate = """
{
  "name": "CSVSchema",
  "description": "Schema for parsing CSV data",
  "version": "1.0",
  "format": "CSV",
  "fields": [
    {
      "name": "id",
      "type": "INTEGER",
      "description": "Unique identifier",
      "required": true,
      "validation": {
        "min": 1
      }
    },
    {
      "name": "name",
      "type": "STRING",
      "description": "Name field",
      "required": true,
      "validation": {
        "minLength": 1,
        "maxLength": 100
      }
    },
    {
      "name": "email",
      "type": "EMAIL",
      "description": "Email address",
      "required": false
    },
    {
      "name": "created_date",
      "type": "DATE",
      "description": "Creation date",
      "required": false,
      "transform": {
        "dateFormat": "yyyy-MM-dd"
      }
    }
  ],
  "options": {
    "trimWhitespace": true,
    "skipEmptyRows": true,
    "delimiter": ",",
    "quoteChar": "\""
  },
  "examples": [
    "id,name,email,created_date\n1,John Doe,john@example.com,2023-01-01\n2,Jane Smith,jane@example.com,2023-01-02"
  ]
}
        """.trimIndent()

        private val jsonSchemaTemplate = """
{
  "name": "JSONSchema",
  "description": "Schema for parsing JSON data",
  "version": "1.0",
  "format": "JSON",
  "fields": [
    {
      "name": "user",
      "type": "OBJECT",
      "description": "User object",
      "required": true,
      "nested": [
        {
          "name": "id",
          "type": "INTEGER",
          "required": true
        },
        {
          "name": "username",
          "type": "STRING",
          "required": true,
          "validation": {
            "minLength": 3,
            "maxLength": 50,
            "pattern": "^[a-zA-Z0-9_]+$"
          }
        },
        {
          "name": "profile",
          "type": "OBJECT",
          "required": false,
          "nested": [
            {
              "name": "firstName",
              "type": "STRING",
              "required": false
            },
            {
              "name": "lastName",
              "type": "STRING",
              "required": false
            },
            {
              "name": "age",
              "type": "INTEGER",
              "required": false,
              "validation": {
                "min": 0,
                "max": 150
              }
            }
          ]
        }
      ]
    },
    {
      "name": "permissions",
      "type": "ARRAY",
      "description": "User permissions",
      "required": false
    }
  ],
  "options": {
    "strictMode": false,
    "allowExtraFields": true
  },
  "examples": [
    "{\n  \"user\": {\n    \"id\": 123,\n    \"username\": \"johndoe\",\n    \"profile\": {\n      \"firstName\": \"John\",\n      \"lastName\": \"Doe\",\n      \"age\": 30\n    }\n  },\n  \"permissions\": [\"read\", \"write\"]\n}"
  ]
}
        """.trimIndent()

        private val xmlSchemaTemplate = """
{
  "name": "XMLSchema",
  "description": "Schema for parsing XML data",
  "version": "1.0",
  "format": "XML",
  "fields": [
    {
      "name": "root",
      "type": "OBJECT",
      "description": "Root XML element",
      "required": true,
      "nested": [
        {
          "name": "item",
          "type": "ARRAY",
          "description": "List of items",
          "required": false,
          "nested": [
            {
              "name": "id",
              "type": "INTEGER",
              "required": true
            },
            {
              "name": "title",
              "type": "STRING",
              "required": true
            },
            {
              "name": "description",
              "type": "STRING",
              "required": false
            },
            {
              "name": "category",
              "type": "STRING",
              "required": false,
              "validation": {
                "allowedValues": ["electronics", "books", "clothing", "home"]
              }
            }
          ]
        }
      ]
    }
  ],
  "options": {
    "strictMode": false,
    "allowExtraFields": true,
    "caseSensitive": false
  },
  "examples": [
    "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<root>\n  <item>\n    <id>1</id>\n    <title>Sample Item</title>\n    <description>This is a sample item</description>\n    <category>electronics</category>\n  </item>\n  <item>\n    <id>2</id>\n    <title>Another Item</title>\n    <category>books</category>\n  </item>\n</root>"
  ]
}
        """.trimIndent()
    }
}