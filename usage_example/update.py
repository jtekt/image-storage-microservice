import requests


STORAGE_SERVCICE_URL = 'http://localhost:31221'
IMAGE_ID = '617b5731bdfab1340cadc44e'

api_url = f'{STORAGE_SERVCICE_URL}/images/{IMAGE_ID}'

properties = {"updated": "success"}

# Send the image
print(f'Updating image {api_url}')
response = requests.patch(api_url, json=properties)


# Check if upload is successful
if response.status_code ==  200:
    print('Update successful')
    print(response.json())
else:
    print(f'Update failed with code {response.status_code}')
    print(response.text)
