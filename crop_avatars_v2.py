from PIL import Image
import os

# Source paths (Original generated images)
sources = {
    "avatar-1.png": r"C:\Users\KN222\.gemini\antigravity\brain\524f6fcf-6889-4c5c-8459-52c5d2e53ac7\avatar_1_wang_comic_1764032613098.png",
    "avatar-2.png": r"C:\Users\KN222\.gemini\antigravity\brain\524f6fcf-6889-4c5c-8459-52c5d2e53ac7\avatar_2_li_comic_1764032627826.png",
    "avatar-3.png": r"C:\Users\KN222\.gemini\antigravity\brain\524f6fcf-6889-4c5c-8459-52c5d2e53ac7\avatar_3_chen_comic_1764032641644.png"
}

# Destination directory
dest_dir = r"c:\Users\KN222\Documents\GitHub\test-lazybacktest\v0 design code\public\app\avatars"

def crop_headshot(source_path, dest_path, crop_factor=0.35):
    try:
        img = Image.open(source_path)
        width, height = img.size
        
        # Calculate new dimensions (zoom in to 35% of original size)
        new_width = width * crop_factor
        new_height = height * crop_factor
        
        # Assume head is centered horizontally and near the top
        left = (width - new_width) / 2
        
        # For top, we want to start near the top to catch the head
        # Let's add a small margin from the very top (e.g. 5% of original height)
        # But if the head is big, we might cut the hair.
        # Let's try centering around the top 25% mark.
        
        # Center of crop area
        center_y = height * 0.25 
        
        top = center_y - (new_height / 2)
        
        # Clamp top
        if top < 0: top = 0
        
        right = left + new_width
        bottom = top + new_height
        
        # Perform crop
        img_cropped = img.crop((left, top, right, bottom))
        
        # Resize to a standard avatar size (e.g. 256x256) for better quality
        img_final = img_cropped.resize((256, 256), Image.Resampling.LANCZOS)
        
        # Save
        img_final.save(dest_path)
        print(f"Successfully cropped {os.path.basename(dest_path)}")
        
    except Exception as e:
        print(f"Error processing {source_path}: {e}")

for filename, source_path in sources.items():
    dest_path = os.path.join(dest_dir, filename)
    if os.path.exists(source_path):
        crop_headshot(source_path, dest_path, crop_factor=0.35)
    else:
        print(f"Source file not found: {source_path}")
