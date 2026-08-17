
import easyocr
import cv2

reader = easyocr.Reader(['en'], gpu=False)
img = cv2.imread('C:/Users/saran/.gemini/antigravity/brain/a5366bc2-d12a-40fc-b7d4-c5507d3113e1/.user_uploaded/media_1786691875656.png')

print('Testing without rotation_info:')
results = reader.readtext(img)
for r in results:
    print(r[1])

print('\nTesting with rotation_info=[90, 180, 270]:')
results = reader.readtext(img, rotation_info=[90, 180, 270])
for r in results:
    print(r[1])

