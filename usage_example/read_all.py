import requests

STORAGE_SERVICE_URL = 'http://localhost:7070'

# url = f'{STORAGE_SERVICE_URL}/images?ids=65c310a332a6620172dcbdc9&ids=65c30feb32a6620172dcbd7b'
url = f'{STORAGE_SERVICE_URL}/images?ids=65c310a332a6620172dcbdc9'
url = f'{STORAGE_SERVICE_URL}/images'

# Send the image
print(f'Getting image list from {url}')
response = requests.get(url)


# Check if upload is successful
if response.status_code ==  200:
    print(response.json()["total"])
else:
    print(f'Upload failed with code {response.status_code}')
    print(response.text)
