import requests

STORAGE_SERVCICE_URL = 'http://localhost:31221'

url = f'{STORAGE_SERVCICE_URL}/images'

# Send the image
print(f'Getting image list from {url}')
response = requests.get(url)


# Check if upload is successful
if response.status_code ==  200:
    print(response.json())
else:
    print(f'Upload failed with code {response.status_code}')
    print(response.text)
