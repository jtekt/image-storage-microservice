import requests


STORAGE_SERVCICE_URL = 'http://localhost:7070'

api_url = f'{STORAGE_SERVCICE_URL}/images?part_number=200-004'

properties = {"label": "golgo12", "myProperty": "test", "nested": {"prop1": "1", "prop2": "2"}}
response = requests.patch(api_url, json=properties)


# Check if upload is successful
if response.status_code ==  200:
    print('Update successful')
    print(response.json())
else:
    print(f'Update failed with code {response.status_code}')
    print(response.text)
