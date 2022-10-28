# Image storage microservice

A microservice to store and manage image data

## API
| Route  | Method | Description |
| --- | --- | --- |
| /images  | GET | Get all images |
| /images  | POST | Upload an image |
| /images/:ID  | GET | Get image with given ID |
| /images/:ID  | DELETE | Delete image with given ID |
| /images/:ID  | PATCH | Update data of image with given ID |
| /images/:ID/image  | GET | Get image file of the image with ID |
| /export  | GET | Export the current content as a .zip archive |
| /import  | POST | Upload an exported .zip archive |

## Environment variables
| Variable  | Description |
| --- | --- |
| MONGODB_URL  | The URL of the MongoDB instance |
| MONGODB_DB  | The name of the DB in MongoDB, defaults to  "image_storage" |
| UPLOADS_DIRECTORY  | Uploads directory name, defaults to  "uploads" |

## Docker

```
docker run -e MONGODB_URL=mongodb://localhost -p 8080:80 public.ecr.aws/u6l4m3e5/image-storage-service:3bded0be
```