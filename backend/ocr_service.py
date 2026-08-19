import sys
import json
import base64
import numpy as np
import cv2
import warnings
from http.server import HTTPServer, BaseHTTPRequestHandler

# Suppress warnings
warnings.filterwarnings("ignore")

# Load EasyOCR model ONCE at startup (this is the slow part)
print("Loading EasyOCR model... (first time may download weights)")
import easyocr
import torch
use_gpu = torch.cuda.is_available()
reader = easyocr.Reader(['en'], gpu=use_gpu, quantize=True, verbose=False)
print(f"EasyOCR model loaded and ready! (GPU: {use_gpu})")


class OCRHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            data = json.loads(body)
            image_base64 = data.get("imageBase64", "")
            is_crop = data.get("isCrop", False)

            # Decode base64 image
            if image_base64.startswith("data:image"):
                image_base64 = image_base64.split(",")[1]

            img_bytes = base64.b64decode(image_base64)
            np_arr = np.frombuffer(img_bytes, np.uint8)
            img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

            if img is None:
                self._respond(200, {"error": "Could not decode image"})
                return

            # Optimize for speed: resize image if it's very large
            max_dim = 1600 # Increased for better quality
            h, w = img.shape[:2]
            scale = 1.0
            if max(h, w) > max_dim:
                scale = max_dim / float(max(h, w))
                new_w = int(w * scale)
                new_h = int(h * scale)
                img = cv2.resize(img, (new_w, new_h))

            # Skipped CLAHE to prevent washing out very thin lines since JS already boosts contrast
            pass

            # Run detection using the pre-loaded model. 
            # Only use 90 degrees (vertical text) instead of 180/270 to double the speed!
            results = reader.readtext(
                img,
                rotation_info=[90]
            )

            detections = []
            
            for (bbox, text, prob) in results:
                # Scale bounding boxes back up to original image coordinates
                x0_scaled = min(bbox[0][0], bbox[3][0])
                y0_scaled = min(bbox[0][1], bbox[1][1])
                
                # Exclude pure noise (1 character that isn't a digit) ONLY if full page
                # but ALLOW characters that are often misread as shapes/symbols (v=depth, O/Q=diameter, R=radius, U=c-bore, etc)
                if not is_crop and len(text.strip()) <= 1 and not text.strip().isdigit():
                    char_upper = text.strip().upper()
                    allowed_chars = {'V', 'O', 'Q', 'R', 'M', 'U', 'X', 'Y', 'Z', 'W'} 
                    # Note: We don't exclude A-Z if it might be a datum, but limiting to common shapes reduces noise.
                    if char_upper not in allowed_chars and not char_upper.isalpha():
                        continue
                    # Actually, if it's ANY letter, maybe it's a datum (A, B, C). Let's just allow all alphabet chars,
                    # and only exclude punctuation/specks like '.', ',', '-', '~', etc.
                    if not char_upper.isalpha():
                        continue

                x0 = x0_scaled / scale
                y0 = y0_scaled / scale
                x1 = max(bbox[1][0], bbox[2][0]) / scale
                y1 = max(bbox[2][1], bbox[3][1]) / scale

                detections.append({
                    "text": text,
                    "confidence": float(prob * 100),
                    "bbox": {
                        "x0": float(x0),
                        "y0": float(y0),
                        "x1": float(x1),
                        "y1": float(y1)
                    }
                })

            self._respond(200, {"detections": detections})

        except Exception as e:
            self._respond(500, {"error": str(e)})

    def _respond(self, code, data):
        response = json.dumps(data).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(response)))
        self.end_headers()
        self.wfile.write(response)

    def log_message(self, format, *args):
        # Only log errors, not every request
        if args and '500' in str(args):
            super().log_message(format, *args)


if __name__ == "__main__":
    port = 5050
    server = HTTPServer(('127.0.0.1', port), OCRHandler)
    print(f"OCR server running on http://127.0.0.1:{port}")
    sys.stdout.flush()
    server.serve_forever()
