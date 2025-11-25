import cv2
import numpy as np
import os

# Source path for Avatar 3
source_path = r"C:\Users\KN222\.gemini\antigravity\brain\524f6fcf-6889-4c5c-8459-52c5d2e53ac7\avatar_3_chen_comic_1764032641644.png"
dest_path = r"c:\Users\KN222\Documents\GitHub\test-lazybacktest\v0 design code\public\app\avatars\avatar-3.png"

def crop_manual_tight(source_path, dest_path):
    try:
        img = cv2.imread(source_path)
        if img is None:
            print(f"Failed to load {source_path}")
            return

        h, w = img.shape[:2]
        
        # Manual crop targeting head and neck
        # Head is usually centered horizontally
        center_x = w // 2
        
        # Head is usually in the top 1/3. Let's aim for top 25% as center of face.
        center_y = int(h * 0.22) 
        
        # We want a tight crop. Let's say the head is about 1/3 of the image width in the original generation.
        # To fill 75% of the circle, the crop width should be roughly 1.33 * head_width.
        # Let's estimate crop size as 30% of original image width (very zoomed in).
        crop_size = int(w * 0.35)
        
        x1 = center_x - crop_size // 2
        y1 = center_y - crop_size // 2
        x2 = x1 + crop_size
        y2 = y1 + crop_size
        
        # Clamp
        x1 = max(0, x1)
        y1 = max(0, y1)
        x2 = min(w, x2)
        y2 = min(h, y2)
        
        cropped = img[int(y1):int(y2), int(x1):int(x2)]
        resized = cv2.resize(cropped, (512, 512), interpolation=cv2.INTER_LANCZOS4)
        
        cv2.imwrite(dest_path, resized)
        print(f"Saved manual tight crop to {dest_path}")

    except Exception as e:
        print(f"Error processing {source_path}: {e}")

if os.path.exists(source_path):
    crop_manual_tight(source_path, dest_path)
else:
    print(f"Source file not found: {source_path}")
