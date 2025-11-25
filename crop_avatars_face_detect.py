import cv2
import numpy as np
import os

# Source paths (Original generated images)
sources = {
    "avatar-1.png": r"C:\Users\KN222\.gemini\antigravity\brain\524f6fcf-6889-4c5c-8459-52c5d2e53ac7\avatar_1_wang_comic_1764032613098.png",
    "avatar-2.png": r"C:\Users\KN222\.gemini\antigravity\brain\524f6fcf-6889-4c5c-8459-52c5d2e53ac7\avatar_2_li_comic_1764032627826.png",
    "avatar-3.png": r"C:\Users\KN222\.gemini\antigravity\brain\524f6fcf-6889-4c5c-8459-52c5d2e53ac7\avatar_3_chen_comic_1764032641644.png"
}

# Destination directory
dest_dir = r"c:\Users\KN222\Documents\GitHub\test-lazybacktest\v0 design code\public\app\avatars"

def crop_face(source_path, dest_path):
    try:
        # Load image
        img = cv2.imread(source_path)
        if img is None:
            print(f"Failed to load {source_path}")
            return

        # Convert to grayscale for detection
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        # Load Haar cascade for face detection
        # We need to find where the cascade file is. OpenCV usually includes it.
        # We'll try to load it from cv2.data.haarcascades
        face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')

        # Detect faces
        faces = face_cascade.detectMultiScale(gray, 1.1, 4)

        if len(faces) == 0:
            print(f"No face detected in {source_path}, falling back to center crop")
            # Fallback: Center crop
            h, w = img.shape[:2]
            center_x, center_y = w // 2, h // 4 # Assume top center
            face_w = w // 3 # Guess size
            face_h = face_w
            x = center_x - face_w // 2
            y = center_y - face_h // 2
            w_f, h_f = face_w, face_h
        else:
            # Pick the largest face (assuming it's the main character)
            faces = sorted(faces, key=lambda f: f[2] * f[3], reverse=True)
            x, y, w_f, h_f = faces[0]
            print(f"Face detected in {os.path.basename(source_path)} at {x},{y} size {w_f}x{h_f}")

        # Calculate crop box
        # User wants head to be 75% of the circle.
        # So the crop box size should be FaceSize / 0.75
        
        crop_size = int(max(w_f, h_f) / 0.65) # 65% to be safe and include some hair/neck
        
        # Center of the face
        center_x = x + w_f // 2
        center_y = y + h_f // 2
        
        # Calculate crop coordinates
        x1 = center_x - crop_size // 2
        y1 = center_y - crop_size // 2
        x2 = x1 + crop_size
        y2 = y1 + crop_size
        
        # Handle boundaries (pad with edge color or just clamp? Clamp might distort center)
        # Better to clamp and shift if possible, or just pad.
        # For simplicity, let's try to shift the box to fit if it goes out
        h_img, w_img = img.shape[:2]
        
        if x1 < 0:
            x2 -= x1 # shift right
            x1 = 0
        if y1 < 0:
            y2 -= y1 # shift down
            y1 = 0
        if x2 > w_img:
            x1 -= (x2 - w_img) # shift left
            x2 = w_img
        if y2 > h_img:
            y1 -= (y2 - h_img) # shift up
            y2 = h_img
            
        # Ensure square (if shifted against two edges, might not be square, but resize handles it)
        # Actually, let's just crop what we can
        x1 = max(0, x1)
        y1 = max(0, y1)
        x2 = min(w_img, x2)
        y2 = min(h_img, y2)
        
        cropped = img[int(y1):int(y2), int(x1):int(x2)]
        
        # Resize to 512x512
        resized = cv2.resize(cropped, (512, 512), interpolation=cv2.INTER_LANCZOS4)
        
        # Save
        cv2.imwrite(dest_path, resized)
        print(f"Saved {dest_path}")

    except Exception as e:
        print(f"Error processing {source_path}: {e}")

for filename, source_path in sources.items():
    dest_path = os.path.join(dest_dir, filename)
    if os.path.exists(source_path):
        crop_face(source_path, dest_path)
    else:
        print(f"Source file not found: {source_path}")
