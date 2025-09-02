plugins {
    id("java")
    id("org.jetbrains.kotlin.jvm") version "1.9.10"
    id("org.jetbrains.intellij") version "1.15.0"
}

group = "com.parserator"
version = "1.0.0"

repositories {
    mavenCentral()
}

// Configure Gradle IntelliJ Plugin
intellij {
    version.set("2023.2.5")
    type.set("IC") // Target IDE Platform
    
    plugins.set(listOf(
        "com.intellij.java",
        "org.jetbrains.kotlin",
        "JavaScript",
        "com.intellij.database"
    ))
}

dependencies {
    implementation("org.jetbrains.kotlin:kotlin-stdlib-jdk8")
    implementation("com.fasterxml.jackson.core:jackson-core:2.15.2")
    implementation("com.fasterxml.jackson.core:jackson-databind:2.15.2")
    implementation("com.fasterxml.jackson.module:jackson-module-kotlin:2.15.2")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.7.3")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-swing:1.7.3")
    implementation("com.squareup.okhttp3:okhttp:4.11.0")
    implementation("com.google.code.gson:gson:2.10.1")
    
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.mockito:mockito-core:5.5.0")
}

tasks {
    // Set the JVM compatibility versions
    withType<JavaCompile> {
        sourceCompatibility = "17"
        targetCompatibility = "17"
    }
    
    withType<org.jetbrains.kotlin.gradle.tasks.KotlinCompile> {
        kotlinOptions.jvmTarget = "17"
    }

    patchPluginXml {
        sinceBuild.set("232")
        untilBuild.set("241.*")
        
        pluginDescription.set("""
            <p>Parserator IDE Plugin provides seamless integration with the Parserator AI service for parsing and structuring data directly within your IDE.</p>
            
            <h3>Features:</h3>
            <ul>
                <li>Parse JSON, CSV, XML, and text data with AI-powered schemas</li>
                <li>Custom schema creation and validation</li>
                <li>Bulk parsing operations</li>
                <li>Export to multiple formats (JSON, CSV, XML)</li>
                <li>Code generation from parsed schemas</li>
                <li>Integration with version control</li>
                <li>Tool window for results management</li>
                <li>Editor folding for large datasets</li>
                <li>Context menu actions and quick fixes</li>
            </ul>
            
            <h3>Getting Started:</h3>
            <p>1. Install the plugin<br/>
            2. Configure your Parserator API key in Settings<br/>
            3. Select text in the editor and use "Parse with Parserator" actions<br/>
            4. View results in the Parserator tool window</p>
        """)
        
        changeNotes.set("""
            <h3>Version 1.0.0</h3>
            <ul>
                <li>Initial release</li>
                <li>Core parsing functionality</li>
                <li>Schema management</li>
                <li>Tool window integration</li>
                <li>Export capabilities</li>
                <li>Code generation features</li>
            </ul>
        """)
    }

    signPlugin {
        certificateChain.set(System.getenv("CERTIFICATE_CHAIN"))
        privateKey.set(System.getenv("PRIVATE_KEY"))
        password.set(System.getenv("PRIVATE_KEY_PASSWORD"))
    }

    publishPlugin {
        token.set(System.getenv("PUBLISH_TOKEN"))
    }
    
    buildSearchableOptions {
        enabled = false
    }
}

kotlin {
    jvmToolchain(17)
}