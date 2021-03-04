# Storage microservice
Receives images via HTTP POST (multipart/form-data) and store it locally.
The images are served as static assets using Express.
Data related to the image, including its URL, is stored in a MongoDB collection.

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

| Variable | Description |
| --- | --- |
| MONGODB_URL | The URL of the MongoDB database to be used by the service |
| MONGODB_DB | OPTIONAL The name of the database to be used by the service |

## Websockets

This application exposes a socketio websocket server and emits the following messages


| Event | Content |
| --- | --- |
| upload | image information upon upload |
| update | image information upon update |


## Deployment

### Docker

```
docker run -e MONGODB_URL=http://your-db-url 172.16.98.151:5000/storage
```
