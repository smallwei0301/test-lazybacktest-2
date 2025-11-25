import cv2
import numpy as np
import os

# Source path for Avatar 3
source_path = r"C:\Users\KN222\.gemini\antigravity\brain\524f6fcf-6889-4c5c-8459-52c5d2e53ac7\avatar_3_chen_comic_1764032641644.png"
dest_path = r"c:\Users\KN222\Documents\GitHub\test-lazybacktest\v0 design code\public\app\avatars\avatar-3.png"

def crop_face_tight(source_path, dest_path):
    try:
        # Load image
        img = cv2.imread(source_path)
        if img is None:
            print(f"Failed to load {source_path}")
            return

        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        faces = face_cascade.detectMultiScale(gray, 1.1, 4)

        if len(faces) == 0:
            print(f"No face detected in {source_path}")
            return

        # Pick largest face
        faces = sorted(faces, key=lambda f: f[2] * f[3], reverse=True)
        x, y, w_f, h_f = faces[0]
        
        # Tighter crop calculation
        # Previous was / 0.65. To zoom in more (show less background), we increase the divisor.
        # Try 0.85 to show mostly head and neck.
        crop_ratio = 0.85
        crop_size = int(max(w_f, h_f) / crop_ratio)
        
        center_x = x + w_f // 2
        center_y = y + h_f // 2
        
        # Calculate crop coordinates
        x1 = center_x - crop_size // 2
        y1 = center_y - crop_size // 2
        x2 = x1 + crop_size
        y2 = y1 + crop_size
        
        # Handle boundaries (shift if needed)
        h_img, w_img = img.shape[:2]
        
        if x1 < 0:
            x2 -= x1
            x1 = 0
        if y1 < 0:
            y2 -= y1
            y1 = 0
        if x2 > w_img:
            x1 -= (x2 - w_img)
            x2 = w_img
        if y2 > h_img:
            y1 -= (y2 - h_img)
            y2 = h_img
            
        cropped = img[int(y1):int(y2), int(x1):int(x2)]
        resized = cv2.resize(cropped, (512, 512), interpolation=cv2.INTER_LANCZOS4)
        
        cv2.imwrite(dest_path, resized)
        print(f"Saved tighter crop to {dest_path}")

    except Exception as e:
        print(f"Error processing {source_path}: {e}")

if os.path.exists(source_path):
    crop_face_tight(source_path, dest_path)
else:
    print(f"Source file not found: {source_path}")
