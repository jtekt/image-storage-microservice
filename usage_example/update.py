import requests


STORAGE_SERVCICE_URL = 'http://localhost:7070'
IMAGE_ID = '65c2329c32a6620172dc8d58'

api_url = f'{STORAGE_SERVCICE_URL}/images/{IMAGE_ID}'

# properties = {"$unset": {"label": ""}}
properties = {"label": "123"}
response = requests.patch(api_url, json=properties)


# Check if upload is successful
if response.status_code ==  200:
    print('Update successful')
    print(response.json())
else:
    print(f'Update failed with code {response.status_code}')
    print(response.text)
