from PIL import Image
import os

# Define paths
base_path = r"c:\Users\KN222\Documents\GitHub\test-lazybacktest\v0 design code\public\app\avatars"
files = ["avatar-1.png", "avatar-2.png", "avatar-3.png"]

def crop_center(image_path, crop_factor=0.6):
    try:
        img = Image.open(image_path)
        width, height = img.size
        
        # Calculate new dimensions (zoom in)
        new_width = width * crop_factor
        new_height = height * crop_factor
        
        # Calculate coordinates to keep center-top (faces are usually in the top half or center)
        # Let's try to crop the top-center part where the head usually is for a half-body shot
        
        left = (width - new_width) / 2
        top = (height - new_height) / 4 # Bias towards top slightly
        right = (width + new_width) / 2
        bottom = (height + new_height) / 4 + new_height
        
        # Adjust if out of bounds
        if top < 0: top = 0
        if bottom > height: bottom = height
        
        # Perform crop
        img_cropped = img.crop((left, top, right, bottom))
        
        # Resize back to original size for consistency (optional, but good for display)
        img_resized = img_cropped.resize((width, height), Image.Resampling.LANCZOS)
        
        # Save
        img_resized.save(image_path)
        print(f"Successfully cropped {image_path}")
        
    except Exception as e:
        print(f"Error processing {image_path}: {e}")

for f in files:
    full_path = os.path.join(base_path, f)
    if os.path.exists(full_path):
        crop_center(full_path, 0.5) # Crop to 50% size (2x zoom)
    else:
        print(f"File not found: {full_path}")
