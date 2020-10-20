# Storage microservice
Receives images via HTTP POST (multipart/form-data) and store it locally.
The images are served as static assets using Express.
Data related to the image, including its URL, is stored in a MongoDB collection.

## API

| Route | Method | Query / Body | Description |
| --- | --- | --- | --- |
| / | GET | - | Get the application info |
| /collections | GET | - | Get a list of all available collections |
| /collections/COLLECTION_NAME | GET | limit (number , optional) | Get all documents from the collection called "COLLECTION_NAME", the number of items to be retrieved can be set using the "limit" query parameter |
| /collections/COLLECTION_NAME | POST | multipart/form-data | Upload an image to the collection called "COLLECTION_NAME" |
| /collections/COLLECTION_NAME | DELETE | - | Drop the collection called "COLLECTION_NAME" |
| /collections/COLLECTION_NAME/IMAGE_ID | GET | - | Get the image with the ID "IMAGE_ID" from the collection called "COLLECTION_NAME" |
| /collections/COLLECTION_NAME/IMAGE_ID | DELETE | - | Delete the image with the ID "IMAGE_ID" from the collection called "COLLECTION_NAME" |
| /collections/COLLECTION_NAME/IMAGE_ID | PUT | properties | Replace the properties of  the image with the ID "IMAGE_ID" from the collection called "COLLECTION_NAME" |
| /collections/COLLECTION_NAME/IMAGE_ID | PATCH | properties | Update the properties of the image with the ID "IMAGE_ID" from the collection called "COLLECTION_NAME" |

## Environment variables

| Variable | Description |
| --- | --- |
| MONGODB_URL | The URL of the MongoDB database to be used by the service |
| MONGODB_DB | OPTIONAL The name of the database to be used by the service |

## Websockets

This application exposes a websocket server on port 80 which emits image information upon upload under the topic 'upload'

## Deployment

### Docker

```
docker run -e MONGODB_URL=http://your-db-url 172.16.98.151:5000/storage
```
