import requests


STORAGE_SERVCICE_URL = 'http://localhost:7070'

api_url = f'{STORAGE_SERVCICE_URL}/images/'


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
