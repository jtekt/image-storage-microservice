import requests
from time import time

IMAGE_PATH = './example.jpg'
STORAGE_SERVICE_URL = 'https://172.16.98.151:7070'
COLLECTION='example'

url = f'{STORAGE_SERVICE_URL}/collections/{COLLECTION}/images'

# Additional info (not necessary)
fields = {
    'ai_prediction': 'OK',
    'frame_index': 12,
    }


files = { 'image' : (f'{time()}.jpg', open(IMAGE_PATH,'rb').read()) }


# Send the image
print(f'Uploading image to {url}')
response = requests.post(url, data=fields, files=files)


# Check if upload is successful
if response.status_code ==  200:
    print('Upload successful')
    print(response.json())
else:
    print(f'Upload failed with code {response.status_code}')
    print(response.text)
