#!/bin/bash

# Parserator JetBrains Plugin Build Script
# This script builds the plugin for distribution

set -e

echo "🚀 Building Parserator JetBrains Plugin..."

# Check if Gradle wrapper exists
if [ ! -f "./gradlew" ]; then
    echo "❌ Gradle wrapper not found. Initializing..."
    gradle wrapper
fi

# Make gradlew executable
chmod +x ./gradlew

# Clean previous builds
echo "🧹 Cleaning previous builds..."
./gradlew clean

# Run tests
echo "🧪 Running tests..."
./gradlew test

# Verify plugin configuration
echo "🔍 Verifying plugin configuration..."
./gradlew verifyPlugin

# Build the plugin
echo "🔨 Building plugin..."
./gradlew buildPlugin

# Check if build was successful
if [ -f "build/distributions/parserator-jetbrains-plugin-1.0.0.zip" ]; then
    echo "✅ Plugin built successfully!"
    echo "📦 Plugin file: build/distributions/parserator-jetbrains-plugin-1.0.0.zip"
    
    # Show file size
    size=$(du -h "build/distributions/parserator-jetbrains-plugin-1.0.0.zip" | cut -f1)
    echo "📏 File size: $size"
    
    echo ""
    echo "🎉 Build completed successfully!"
    echo ""
    echo "📋 Next steps:"
    echo "  1. Test the plugin: ./gradlew runIde"
    echo "  2. Install manually in IDE: File → Settings → Plugins → Install from disk"
    echo "  3. Publish to marketplace: ./gradlew publishPlugin"
    echo ""
    
else
    echo "❌ Build failed! Check the logs above."
    exit 1
fi