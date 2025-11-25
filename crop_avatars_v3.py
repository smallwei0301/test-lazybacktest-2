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

def crop_headshot(source_path, dest_path, crop_factor=0.28, center_y_ratio=0.22):
    try:
        img = Image.open(source_path)
        width, height = img.size
        
        # Calculate new dimensions (zoom in tighter)
        new_width = width * crop_factor
        new_height = height * crop_factor
        
        # Horizontal center
        left = (width - new_width) / 2
        
        # Vertical center
        # We want the "center of the head" to be the "center of the crop"
        # Assuming head center is around 20-25% of image height for a standing figure
        center_y = height * center_y_ratio
        
        top = center_y - (new_height / 2)
        
        # Clamp top
        if top < 0: top = 0
        
        right = left + new_width
        bottom = top + new_height
        
        # Perform crop
        img_cropped = img.crop((left, top, right, bottom))
        
        # Resize to a standard avatar size (e.g. 512x512 for high quality)
        img_final = img_cropped.resize((512, 512), Image.Resampling.LANCZOS)
        
        # Save
        img_final.save(dest_path)
        print(f"Successfully cropped {os.path.basename(dest_path)} with factor {crop_factor} at y={center_y_ratio}")
        
    except Exception as e:
        print(f"Error processing {source_path}: {e}")

for filename, source_path in sources.items():
    dest_path = os.path.join(dest_dir, filename)
    if os.path.exists(source_path):
        # Using 0.28 crop factor (approx 3.5x zoom) and 0.22 vertical center
        crop_headshot(source_path, dest_path, crop_factor=0.28, center_y_ratio=0.22)
    else:
        print(f"Source file not found: {source_path}")
