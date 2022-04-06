# Image storage microservice

This is a microservice used to store and retrieve images as well as their related metadata via HTTP requests.
The service stores images as files and metadata as MongoDB documents.

## API

| Route | Method | Query / Body | Description |
| --- | --- | --- | --- |
| / | GET | - | Get the application info |
| /collections | GET | - | Get a list of all available collections |
| /collections/COLLECTION_NAME | GET | - | Get information about the collection identified by COLLECTION_NAME |
| /collections/COLLECTION_NAME | DELETE | - | Drop the collection called "COLLECTION_NAME" |
| /collections/COLLECTION_NAME/images | GET | limit (number , optional) | Get all documents from the collection called "COLLECTION_NAME", the number of items to be retrieved can be set using the "limit" query parameter |
| /collections/COLLECTION_NAME/images | POST | multipart/form-data | Upload an image to the collection called "COLLECTION_NAME" |
| /collections/COLLECTION_NAME/images/IMAGE_ID | GET | - | Get the data related to the image with the ID "IMAGE_ID" from the collection called "COLLECTION_NAME" |
| /collections/COLLECTION_NAME/images/IMAGE_ID | DELETE | - | Delete the entry with the ID "IMAGE_ID" from the collection called "COLLECTION_NAME" |
| /collections/COLLECTION_NAME/images/IMAGE_ID | PUT | properties | Replace the properties of  the entry with the ID "IMAGE_ID" from the collection called "COLLECTION_NAME" |
| /collections/COLLECTION_NAME/images/IMAGE_ID | PATCH | properties | Update the properties of the entry with the ID "IMAGE_ID" from the collection called "COLLECTION_NAME" |
| /collections/COLLECTION_NAME/images/IMAGE_ID/image | GET | - | Get the image file of the corresponding entry |

## Environment variables

| Variable | required | Description |
| --- | --- | --- |
| APP_PORT | false | The port to which the application listens to, defaults to 80 |
| MONGODB_URL | true | The URL of the MongoDB database to be used by the service |
| MONGODB_DB | false| The name of the database to be used by the service |
| USE_AUTHENTICATION | false | Set this variable to any value to enforce authentciation |
| IDENTIFICATION_URL | false | When using authentication, holds the URL used to identify the user |


## Image upload example (Python)

```python
import requests

IMAGE_PATH = './example_image.jpg' # Path of the image to upload
STORAGE_MS_URL = 'http://172.16.98.151:7070' # URL of the microservice
COLLECTION = 'example' # Collection to upload the data in

url = f'{STORAGE_MS_URL}/collections/{COLLECTION}/images'

fields = { 'ai_prediction': 'OK' }
files = { 'image' : open(IMAGE_PATH, "rb") }

response = requests.post(api_url, data=fields, files=files)

print(response.status_code)
```
