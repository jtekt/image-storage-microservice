import requests


STORAGE_SERVICE_URL = 'http://172.16.98.151:7070'
COLLECTION='example'
IMAGE_ID = '61945fc0c4fc6c4e20f7a6f1'

url = f'{STORAGE_SERVICE_URL}/collections/{COLLECTION}/images/{IMAGE_ID}'

properties = {
"string": 'Hello',
"number": 1,
"array": ['Apple','Banana','Cherry'],
"object": {"key": "value"}
}

# Send the image
print(f'Updating image {url}')
response = requests.patch(url, json=properties)


# Check if upload is successful
if response.status_code ==  200:
    print('Update successful')
    print(response.json())
else:
    print(f'Update failed with code {response.status_code}')
    print(response.text)
