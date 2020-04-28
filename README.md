# Storage microservices

## Objective
Receives images via HTTP POST (multipart/form-data) and store it locally.
The images are served as static assets using Express
Data related to the image, including its URL, is stored in a MongoDB collection