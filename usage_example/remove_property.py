import requests


STORAGE_SERVCICE_URL = 'http://localhost:7070'
IMAGE_ID = '63630043e69a96978b2bd2dc'

api_url = f'{STORAGE_SERVCICE_URL}/images/{IMAGE_ID}'

# Removing properties is achieved by setting it to null (None in python)
properties = {"myProperty": None}

response = requests.patch(api_url, json=properties)


# Check if upload is successful
if response.status_code ==  200:
    print('Update successful')
    print(response.json())
else:
    print(f'Update failed with code {response.status_code}')
    print(response.text)
