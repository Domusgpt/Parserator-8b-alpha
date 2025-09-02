#!/usr/bin/env python3
"""
Generate Chrome extension icons from Parserator logo
"""

from PIL import Image
import os

def generate_chrome_icons():
    logo_path = '/mnt/c/Users/millz/ParseratorMarketing/PARSERATOR-LOGO.png'
    chrome_icons_dir = '/mnt/c/Users/millz/parserator-development-post-launch/active-development/chrome-extension/assets/icons'
    chrome_ext_dir = '/mnt/c/Users/millz/parserator-development-post-launch/active-development/chrome-extension'
    
    # Icon sizes for Chrome extension
    icon_sizes = [
        (16, 'icon-16.png'),
        (32, 'icon-32.png'),
        (48, 'icon-48.png'),
        (128, 'icon-128.png')
    ]
    
    # Open the original logo
    logo = Image.open(logo_path)
    
    # Convert to RGBA if not already
    if logo.mode != 'RGBA':
        logo = logo.convert('RGBA')
    
    print("🎨 Generating Chrome extension icons from real Parserator logo...")
    
    # Generate each icon size
    for size, filename in icon_sizes:
        print(f"  📐 Generating {filename} ({size}x{size})...")
        
        # Create a copy and resize
        icon = logo.copy()
        icon.thumbnail((size, size), Image.Resampling.LANCZOS)
        
        # Create a new image with exact dimensions
        final_icon = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        
        # Paste the resized logo centered
        x = (size - icon.width) // 2
        y = (size - icon.height) // 2
        final_icon.paste(icon, (x, y))
        
        # Save the icon
        output_path = os.path.join(chrome_icons_dir, filename)
        final_icon.save(output_path, 'PNG')
        print(f"  ✅ Generated {filename}")
    
    # Generate promotional images for Chrome Web Store
    print("\n🎪 Generating Chrome Web Store promotional images...")
    
    # Dark purple background to match branding
    dark_purple = (15, 10, 28, 255)
    
    # Small promo tile (440x280)
    small_promo = Image.new('RGBA', (440, 280), dark_purple)
    logo_resized = logo.copy()
    logo_resized.thumbnail((200, 200), Image.Resampling.LANCZOS)
    
    # Center the logo
    x = (440 - logo_resized.width) // 2
    y = (280 - logo_resized.height) // 2
    small_promo.paste(logo_resized, (x, y), logo_resized)
    
    small_promo_path = os.path.join(chrome_ext_dir, 'small-promo-tile.png')
    small_promo.save(small_promo_path, 'PNG')
    print("  ✅ Generated small-promo-tile.png (440x280)")
    
    # Marquee promo tile (1400x560)
    marquee_promo = Image.new('RGBA', (1400, 560), dark_purple)
    logo_large = logo.copy()
    logo_large.thumbnail((400, 400), Image.Resampling.LANCZOS)
    
    # Center the logo
    x = (1400 - logo_large.width) // 2
    y = (560 - logo_large.height) // 2
    marquee_promo.paste(logo_large, (x, y), logo_large)
    
    marquee_promo_path = os.path.join(chrome_ext_dir, 'marquee-promo-tile.png')
    marquee_promo.save(marquee_promo_path, 'PNG')
    print("  ✅ Generated marquee-promo-tile.png (1400x560)")
    
    print("\n🎉 All Chrome extension icons generated successfully!")
    print("📁 Files saved to:", chrome_icons_dir)
    print("🛍️ Promo images saved to:", chrome_ext_dir)

if __name__ == "__main__":
    try:
        from PIL import Image
        generate_chrome_icons()
    except ImportError:
        print("❌ Pillow not installed. Installing...")
        import subprocess
        subprocess.run(["pip", "install", "Pillow"])
        from PIL import Image
        generate_chrome_icons()