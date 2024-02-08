import requests
from time import time

IMAGE_PATH = './example_image.jpg'
STORAGE_SERVCICE_URL = 'http://localhost:7070'

api_url = f'{STORAGE_SERVCICE_URL}/images'

# Additional info (not necessary)
fields = {
    'part_number': '200-004',
    'label': 'golgo13',
    # 'time': '2020-01-01',
    'file': 'golgo/banana.jpg'
    }



filename = f'{time()}.jpg'
files = { 'image' : (filename, open(IMAGE_PATH,'rb').read()) }


# Send the image
print(f'Uploading image to {api_url}')
response = requests.post(api_url, data=fields, files=files)

# Check if upload is successful
if response.status_code ==  200:
    print(f'Upload successful of image {filename}')
    print(response.json())
else:
    print(f'Upload failed with code {response.status_code}')
    print(response.text)
