import requests

IMAGE_PATH = './example_image.jpg'
STORAGE_SERVCICE_URL = 'http://172.16.98.151:7070'

api_url = f'{STORAGE_SERVCICE_URL}/images'

# Additional info (not necessary)
fields = {
    'work': '100-001',
    'ai_prediction': 'OK',
    'frame_index': 12,
    }


files = { 'image' : open(IMAGE_PATH, "rb") }


# Send the image
print(f'Uploading image to {api_url}')
response = requests.post(api_url, data=fields, files=files)


# Check if upload is successful
if response.status_code ==  200:
    print('Upload successful')
    print(response.json())
else:
    print(f'Upload failed with code {response.status_code}')
    print(response.text)
