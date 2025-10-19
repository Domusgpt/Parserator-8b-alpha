#!/bin/bash

# Build script for Parserator Chrome Extension

echo "Building Parserator Chrome Extension..."

# Create dist directory
mkdir -p dist

# Copy source files
echo "Copying source files..."
cp -r src dist/

# Copy assets
echo "Copying assets..."
cp -r assets dist/

# Copy manifest
echo "Copying manifest..."
cp manifest.json dist/

# Create placeholder icons (since we have SVG but need PNG)
echo "Creating placeholder icons..."
mkdir -p dist/assets/icons

# Create simple colored rectangles as placeholders for PNG icons
# In a real build, you'd convert SVG to PNG using imagemagick or similar
echo "Creating icon placeholders..."

# Create a simple base64 encoded 1x1 blue pixel for each size
for size in 16 32 48 128; do
  # This creates a minimal PNG file as a placeholder
  # In production, you'd use proper icon conversion
  echo "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAGA8X7p/wAAAABJRU5ErkJggg==" | base64 -d > "dist/assets/icons/icon-${size}.png"
done

VERSION=$(jq -r '.version' manifest.json 2>/dev/null)
if [ -z "$VERSION" ] || [ "$VERSION" = "null" ]; then
  VERSION="dev"
fi

echo "Build complete! Extension files are in the 'dist' directory."
echo ""
echo "To install:"
echo "1. Open Chrome and go to chrome://extensions/"
echo "2. Enable Developer mode"
echo "3. Click 'Load unpacked' and select the 'dist' directory"
echo ""
echo "To package:"
echo "cd dist && zip -r ../parserator-chrome-extension-v${VERSION}.zip ."