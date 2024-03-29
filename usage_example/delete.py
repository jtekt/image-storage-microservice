import requests


STORAGE_SERVCICE_URL = 'http://localhost:7070'
IMAGE_ID = '65c1642132a6620172dc5e9d'

api_url = f'{STORAGE_SERVCICE_URL}/images/{IMAGE_ID}'


# Send the image
print(f'Deleting image {api_url}')
response = requests.delete(api_url)


# Check if upload is successful
if response.status_code ==  200:
    print('Deletion successful')
    print(response.json())
else:
    print(f'Upload failed with code {response.status_code}')
    print(response.text)
