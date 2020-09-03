# Storage microservice
Receives images via HTTP POST (multipart/form-data) and store it locally.
The images are served as static assets using Express.
Data related to the image, including its URL, is stored in a MongoDB collection.

## API

| Route | Method | Query / Body | Description |
| --- | --- | --- | --- |
| /images | POST | multipart/form-data | Image upload |
| /images | GET | - | Get all documents from the collection |
| /images | DELETE | - | Drop the collection |
| /images/{image ID} | GET | - | Get an image from the collection |
| /images/{image ID} | DELETE | - | Delete an image from the collection |
