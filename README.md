# Image storage microservice (Mongoose version)

An image storage microservice built using Mongoose.

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
| MONGODB_DB  | The name of the DB in MongoDB, defaults to  "image_storage_mongoose" |
