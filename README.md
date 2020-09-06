# Storage microservice
Receives images via HTTP POST (multipart/form-data) and store it locally.
The images are served as static assets using Express.
Data related to the image, including its URL, is stored in a MongoDB collection.

## API

| Route | Method | Query / Body | Description |
| --- | --- | --- | --- |
| /collections | GET | - | Get a list of all available collections |
| /collections/COLLECTION_NAME | POST | multipart/form-data | Upload an image to the collection called "COLLECTION_NAME" |
| /collections/COLLECTION_NAME | GET | - | Get all documents from the collection called "COLLECTION_NAME" |
| /collections/COLLECTION_NAME | DELETE | - | Drop the collection called "COLLECTION_NAME" |
| /collections/COLLECTION_NAME/IMAGE_ID | GET | - | Get the image with the ID "IMAGE_ID" from the collection called "COLLECTION_NAME" |
| /collections/COLLECTION_NAME/IMAGE_ID | DELETE | - | Delete the image with the ID "IMAGE_ID" from the collection called "COLLECTION_NAME" |
| /collections/COLLECTION_NAME/IMAGE_ID | PUT | properties | Replace the properties of  the image with the ID "IMAGE_ID" from the collection called "COLLECTION_NAME" |
| /collections/COLLECTION_NAME/IMAGE_ID | PATCH | properties | Update the properties of the image with the ID "IMAGE_ID" from the collection called "COLLECTION_NAME" |
