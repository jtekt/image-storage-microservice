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
  data: any
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

## Filtering user-defined fields

Images can be filtered by their user-defined `data` fields using explicit field path syntax in query parameters.

### Supported syntax

**Dot notation**

```
GET /images?data.label=cat
```

**Bracket notation**

```
GET /images?data[label]=cat
```

**Nested fields**

```
GET /images?data[parentKey][nestedKey]=value
GET /images?data.parentKey.nestedKey=value
```

Both notations are equivalent and may be combined with other query parameters such as `sort`, `select`, `filter`, `limit`, `skip`, `from`, and `to`.

### Deprecated shorthand syntax

> **Deprecated** — The shorthand syntax `?key=value` (without the `data.` prefix) is deprecated and will be removed in the next major version.

The shorthand syntax still works in the current version for backward compatibility:

```
GET /images?label=cat   # deprecated — use ?data.label=cat instead
```

When a request uses the shorthand syntax, the server:

- Returns a `Deprecation: true` response header.
- Logs a warning on the server side.

Migrate to the explicit `data.` prefix to avoid issues with the next major version and to filter fields whose names would otherwise conflict with reserved query parameters (`file`, `sort`, `order`, `limit`, `skip`, `from`, `to`, `regex`, `filter`, `select`, `ids`).

## Environment variables

| Variable                    | Description                                                                                               | Default                | Required |
| --------------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------- | -------- |
| `APP_PORT`                  | Port on which the application listens for incoming requests                                               | `3000`                 | No       |
| `MONGODB_CONNECTION_STRING` | MongoDB connection string used to connect to the database                                                 | —                      | Yes      |
| `UPLOADS_DIRECTORY`         | Local directory to store uploaded files. Disabled if S3 is used                                           | `"uploads"`            | No       |
| `S3_BUCKET`                 | Name of the S3 bucket where images will be uploaded. If unset, local storage is used                      | —                      | No       |
| `S3_ACCESS_KEY_ID`          | Access key ID for connecting to the S3-compatible storage provider                                        | —                      | No       |
| `S3_SECRET_ACCESS_KEY`      | Secret access key for connecting to the S3-compatible storage provider                                    | —                      | No       |
| `S3_REGION`                 | AWS region of the S3 bucket                                                                               | —                      | No       |
| `S3_ENDPOINT`               | Custom S3-compatible endpoint (e.g., for MinIO)                                                           | —                      | No       |
| `OIDC_ISSUER_BASE_URL`      | Base URL of OIDC authentication provider. If provided, users must be authenticated to access the storage. | —                      | No       |
| `OIDC_AUDIENCE`             | Comma-separated accepted token audiences (`aud` claim). Only used if `OIDC_ISSUER_BASE_URL` is set.       | `"account"`            | No       |

## Running in development

```
npm run dev
```

## Docker

```
docker run -e MONGODB_URL=mongodb://localhost -p 8080:80 public.ecr.aws/u6l4m3e5/image-storage-service:3bded0be
```
