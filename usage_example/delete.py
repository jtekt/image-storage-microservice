import requests


IMAGE_ID = '6178a016767f7b1522b50402'
STORAGE_SERVCICE_URL = 'http://172.16.98.151:7070'

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
