# Image storage microservice

[![AWS ECR](https://img.shields.io/badge/AWS%20ECR-image--storage--service-blue)](https://gallery.ecr.aws/jtekt-corporation/image-storage-service)
[![Artifact Hub](https://img.shields.io/endpoint?url=https://artifacthub.io/badge/repository/jtekt)](https://artifacthub.io/packages/search?repo=jtekt)

A microservice to store and manage image datasets. It allows to store images with their metadata, the latter being stored in a MongoDB database.

## Data model

The metadata for uploaded images is stored in a MongoDB database with the following schema

```ts
{
  _id: ObjectId,
  file: string,
  time: Date,
  data: any,
  userId?: string
},

```

`file` and `time` are fixed system fields while `data` is used to store user-provided properties without structural constraints.

## API

API documentation is available on `/docs`

| Route             | Method | Description                                                 |
| ----------------- | ------ | ----------------------------------------------------------- |
| /images           | POST   | Upload an image                                             |
| /images           | GET    | Get images matching filter passed as query parameter        |
| /images           | PATCH  | Updates images matching filter passed as query parameter    |
| /images           | DELETE | Deletes images matching filter passed as query parameter    |
| /images/:ID       | GET    | Get image with given ID                                     |
| /images/:ID       | DELETE | Delete image with given ID                                  |
| /images/:ID       | PATCH  | Update data of image with given ID                          |
| /images/:ID/image | GET    | Get image file of the image with ID                         |
| /export           | GET    | Export the current content as a .zip archive (experimental) |
| /import           | POST   | Upload an exported .zip archive (experimental)              |

## Environment variables

| Variable                    | Description                                                                                                   | Default                | Required |
| --------------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------- | -------- |
| `APP_PORT`                  | Port on which the application listens for incoming requests                                                   | `3000`                 | No       |
| `MONGODB_CONNECTION_STRING` | MongoDB connection string used to connect to the database                                                     | —                      | Yes      |
| `UPLOADS_DIRECTORY`         | Local directory to store uploaded files. Disabled if S3 is used                                               | `"uploads"`            | No       |
| `S3_BUCKET`                 | Name of the S3 bucket where images will be uploaded. If unset, local storage is used                          | —                      | No       |
| `S3_ACCESS_KEY_ID`          | Access key ID for connecting to the S3-compatible storage provider                                            | —                      | No       |
| `S3_SECRET_ACCESS_KEY`      | Secret access key for connecting to the S3-compatible storage provider                                        | —                      | No       |
| `S3_REGION`                 | AWS region of the S3 bucket                                                                                   | —                      | No       |
| `S3_ENDPOINT`               | Custom S3-compatible endpoint (e.g., for MinIO)                                                               | —                      | No       |
| `OIDC_JWKS_URI`             | JWKS URI of the OIDC authentication provider. If provided, users must be authenticated to access the storage. | —                      | No       |
| `IMAGE_SCOPE`               | Logical scope of the images, e.g., user-specific . Enables scoped access control. Avowed values [`user`]      | —                      | No       |
| `USER_IDENTIFIER`           | Field name used to extract the user ID from the authentication token. Only used if `IMAGE_SCOPE` is set.      | `"preferred_username"` | No       |

## Running in development

```
npm run dev
```

## Docker

```
docker run -e MONGODB_URL=mongodb://localhost -p 8080:80 public.ecr.aws/u6l4m3e5/image-storage-service:3bded0be
```
