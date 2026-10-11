import request from 'supertest'
import { expect } from 'chai'
import { app } from '../index'
import mongoose from 'mongoose'
import { Image } from '../models/image'
import { describe, it, before, after, afterEach } from 'mocha'
import path from 'path'
import fs from 'fs'

// ---------------------------------------------------------------------------
// Storage stub
//
// Replace Multer's storage engine with a no-op memory store so tests never
// touch the local filesystem (or S3).  The stub assigns req.file exactly as
// Multer's DiskStorage would, minus the actual write.
// ---------------------------------------------------------------------------

import * as localModule from '../fileStorage/local'
import * as s3Module from '../fileStorage/s3'
import { StorageEngine } from 'multer'

const memoryStorage: StorageEngine = {
    _handleFile(req, file, cb) {
        // Drain the stream so the request doesn't stall
        const chunks: Buffer[] = []
        file.stream.on('data', (chunk: Buffer) => chunks.push(chunk))
        file.stream.on('end', () => {
            const buf = Buffer.concat(chunks)
            ;(req as any).file = {
                fieldname: file.fieldname,
                originalname: file.originalname,
                mimetype: file.mimetype,
                buffer: buf,
                size: buf.length,
                // The controller only needs req.file to be truthy and originalname
                // to be set; downstream code uses `image.file` from MongoDB, not
                // the multer path.
                path: `/test-mem/${file.originalname}`,
                filename: file.originalname,
                destination: '/test-mem',
            }
            cb(null, req.file as any)
        })
        file.stream.on('error', cb)
    },
    _removeFile(_req, _file, cb) {
        cb(null)
    },
}

// Patch the storage engines before the routes module resolves them.
// The routes/images.ts picks `s3Storage || localStorage` at module-load time,
// so we must override the exported references early.
;(s3Module as any).s3Storage = undefined
;(s3Module as any).s3Client = undefined
;(localModule as any).localStorage = memoryStorage

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SAMPLE_JPG = path.resolve(__dirname, 'sample.jpg')
const SAMPLE2_JPG = path.resolve(__dirname, 'sample2.jpg')
const EXPORT_ZIP = path.resolve(__dirname, 'export.zip')

/** POST /images with a real JPEG, returns the created document */
async function uploadImage(
    fields: Record<string, string> = {},
    imagePath = SAMPLE_JPG
) {
    let req = request(app)
        .post('/images')
        .attach('image', imagePath)

    for (const [k, v] of Object.entries(fields)) {
        req = req.field(k, v)
    }

    return req
}

/** Insert a document directly into MongoDB (bypasses storage) */
async function insertImage(data: Record<string, any> = {}, file = 'test.jpg') {
    return Image.create({ file, data })
}

/** Delete all images created during a test */
async function cleanAll() {
    await Image.deleteMany({})
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('Image Storage API', () => {
    before(async () => {
        // Wait for the Mongoose connection to become ready (up to 10 s)
        const deadline = Date.now() + 10_000
        while (mongoose.connection.readyState !== 1) {
            if (Date.now() > deadline)
                throw new Error('MongoDB did not connect within 10 s')
            await new Promise((r) => setTimeout(r, 100))
        }
    })

    afterEach(cleanAll)

    // -----------------------------------------------------------------------
    // POST /images
    // -----------------------------------------------------------------------

    describe('POST /images', () => {
        it('creates an image record with plain key/value fields', async () => {
            const { status, body } = await uploadImage({
                key1: 'value1',
                key2: 'value2',
                key3: 'value3',
            })

            expect(status).to.equal(200)
            expect(body).to.have.property('_id')
            expect(body.data.key1).to.equal('value1')
            expect(body.data.key2).to.equal('value2')
            expect(body.data.key3).to.equal('value3')
        })

        it('creates an image record with a user-specified file path', async () => {
            const { status, body } = await uploadImage({
                file: 'myFolder/myImage.jpg',
                key3: 'value3',
            })

            expect(status).to.equal(200)
            expect(body.file).to.equal('myFolder/myImage.jpg')
        })

        it('creates an image record with nested JSON fields (json field)', async () => {
            const jsonData = {
                parentKey: {
                    nestedKey1: 'nestedValue1',
                    nestedKey2: 'nestedValue2',
                },
            }

            const { status, body } = await request(app)
                .post('/images')
                .field('json', JSON.stringify(jsonData))
                .attach('image', SAMPLE2_JPG)

            expect(status).to.equal(200)
            expect(body.data.parentKey.nestedKey1).to.equal('nestedValue1')
        })

        it('creates an image record with nested JSON fields (data field)', async () => {
            const jsonData = { category: 'test', score: 99 }

            const { status, body } = await request(app)
                .post('/images')
                .field('data', JSON.stringify(jsonData))
                .attach('image', SAMPLE_JPG)

            expect(status).to.equal(200)
            expect(body.data.category).to.equal('test')
        })

        it('upserts when the same file name is uploaded twice', async () => {
            await uploadImage({ key1: 'first' })
            // Upload the same logical file again with different metadata
            const { status, body } = await uploadImage({ key1: 'second' })

            expect(status).to.equal(200)
            expect(body.data.key1).to.equal('second')

            const count = await Image.countDocuments({})
            expect(count).to.equal(1)
        })

        it('returns 400 when no image file is attached', async () => {
            const { status } = await request(app).post('/images')
            expect(status).to.equal(400)
        })
    })

    // -----------------------------------------------------------------------
    // GET /images
    // -----------------------------------------------------------------------

    describe('GET /images', () => {
        beforeEach(async () => {
            // Seed exactly 3 images so each test controls its own state
            await insertImage({ key1: 'value1', key3: 'value3' }, 'img1.jpg')
            await insertImage({ key2: 'value2', key3: 'value3' }, 'img2.jpg')
            await insertImage({ key4: 'value4' }, 'img3.jpg')
        })

        it('returns all seeded images', async () => {
            const { status, body } = await request(app).get('/images')

            expect(status).to.equal(200)
            expect(body).to.have.property('total')
            expect(body).to.have.property('items')
            expect(body.total).to.equal(3)
            expect(body.items).to.have.lengthOf(3)
        })

        it('returns the correct response envelope shape', async () => {
            const { body } = await request(app).get('/images')

            expect(body).to.include.keys('total', 'items', 'limit', 'skip')
        })

        it('filters images by a data field', async () => {
            const { status, body } = await request(app).get(
                '/images?key3=value3'
            )

            expect(status).to.equal(200)
            expect(body.total).to.equal(2)
        })

        it('filters images by dot notation (data.key)', async () => {
            const { status, body } = await request(app).get(
                '/images?data.key3=value3'
            )

            expect(status).to.equal(200)
            expect(body.total).to.equal(2)
        })

        it('filters images by bracket notation (data[key])', async () => {
            const { status, body } = await request(app).get(
                '/images?data[key3]=value3'
            )

            expect(status).to.equal(200)
            expect(body.total).to.equal(2)
        })

        it('filters images by nested bracket notation (data[parentKey][nestedKey])', async () => {
            await insertImage(
                { parentKey: { nestedKey1: 'nestedValue1' } },
                'nested.jpg'
            )

            const { status, body } = await request(app).get(
                '/images?data[parentKey][nestedKey1]=nestedValue1'
            )

            expect(status).to.equal(200)
            expect(body.total).to.equal(1)
        })

        it('returns zero results for a filter that matches nothing', async () => {
            const { status, body } = await request(app).get(
                '/images?key1=no_such_value'
            )

            expect(status).to.equal(200)
            expect(body.total).to.equal(0)
            expect(body.items).to.deep.equal([])
        })

        it('filters images by a JSON filter parameter', async () => {
            const filter = JSON.stringify({ 'data.key2': { $ne: null } })
            const { status, body } = await request(app).get(
                `/images?filter=${encodeURIComponent(filter)}`
            )

            expect(status).to.equal(200)
            expect(body.total).to.equal(1)
        })

        it('queries images by a list of IDs', async () => {
            // Fetch first to get real _ids
            const { body: allBody } = await request(app).get('/images')
            const id = allBody.items[0]._id

            const { status, body } = await request(app).get(
                `/images?ids=${id}`
            )

            expect(status).to.equal(200)
            expect(body.total).to.equal(1)
            expect(body.items[0]._id).to.equal(id)
        })

        it('respects the limit query parameter', async () => {
            const { status, body } = await request(app).get('/images?limit=2')

            expect(status).to.equal(200)
            expect(body.items.length).to.be.at.most(2)
        })

        it('respects the skip query parameter', async () => {
            const { status, body } = await request(app).get('/images?skip=2')

            expect(status).to.equal(200)
            // 3 images - skip 2 = 1 remaining
            expect(body.items.length).to.equal(1)
        })

        it('returns 400 for a malformed JSON filter', async () => {
            const { status } = await request(app).get(
                '/images?filter={bad json}'
            )

            expect(status).to.equal(400)
        })

        it('returns 400 for a disallowed operator in the JSON filter', async () => {
            const filter = JSON.stringify({ $where: 'true' })
            const { status } = await request(app).get(
                `/images?filter=${encodeURIComponent(filter)}`
            )

            expect(status).to.equal(400)
        })

        it('returns 400 for a disallowed operator nested in the JSON filter', async () => {
            const filter = JSON.stringify({
                $or: [{ 'data.key1': 'value1' }, { $expr: { $eq: [1, 1] } }],
            })
            const { status } = await request(app).get(
                `/images?filter=${encodeURIComponent(filter)}`
            )

            expect(status).to.equal(400)
        })

        it('returns 400 for a disallowed operator in a query parameter', async () => {
            const { status } = await request(app).get(
                '/images?data[key3][$where]=true'
            )

            expect(status).to.equal(400)
        })

        it('returns 400 for a field path containing an operator', async () => {
            const filter = JSON.stringify({ 'data.$where': 'true' })
            const { status } = await request(app).get(
                `/images?filter=${encodeURIComponent(filter)}`
            )

            expect(status).to.equal(400)
        })

        it('accepts allowed operators in the JSON filter', async () => {
            const filter = JSON.stringify({
                $or: [
                    { 'data.key1': { $in: ['value1'] } },
                    { 'data.key4': { $exists: true } },
                ],
            })
            const { status, body } = await request(app).get(
                `/images?filter=${encodeURIComponent(filter)}`
            )

            expect(status).to.equal(200)
            expect(body.total).to.equal(2)
        })

        it('accepts allowed operators in a query parameter', async () => {
            const { status, body } = await request(app).get(
                '/images?data[key3][$ne]=value3'
            )

            expect(status).to.equal(200)
            expect(body.total).to.equal(1)
        })

        it('still supports partial matching with regex=true', async () => {
            const { status, body } = await request(app).get(
                '/images?data.key3=VALUE&regex=true'
            )

            expect(status).to.equal(200)
            expect(body.total).to.equal(2)
        })
    })

    // -----------------------------------------------------------------------
    // GET /images/:id
    // -----------------------------------------------------------------------

    describe('GET /images/:id', () => {
        it('returns the image document for a valid ID', async () => {
            const doc = await insertImage({ key1: 'value1' }, 'single.jpg')

            const { status, body } = await request(app).get(
                `/images/${doc._id}`
            )

            expect(status).to.equal(200)
            expect(body._id).to.equal(doc._id.toString())
            expect(body.data.key1).to.equal('value1')
        })

        it('returns 404 for a non-existent ID', async () => {
            const fakeId = new mongoose.Types.ObjectId().toString()

            const { status } = await request(app).get(`/images/${fakeId}`)

            expect(status).to.equal(404)
        })
    })

    // -----------------------------------------------------------------------
    // GET /images/:id/image  &  /images/:id/file
    // -----------------------------------------------------------------------

    describe('GET /images/:id/image', () => {
        it('downloads the image file for a record uploaded in the same test', async () => {
            // Upload via the API so the file is written to the storage layer
            const { body: uploaded } = await uploadImage(
                { key1: 'download-test' },
                SAMPLE_JPG
            )
            const id = uploaded._id

            const { status } = await request(app).get(`/images/${id}/image`)

            // Local storage calls res.download() which returns 200
            expect(status).to.equal(200)
        })

        it('returns 404 for a non-existent ID', async () => {
            const fakeId = new mongoose.Types.ObjectId().toString()

            const { status } = await request(app).get(`/images/${fakeId}/image`)

            expect(status).to.equal(404)
        })

        it('/images/:id/file is an alias for /images/:id/image', async () => {
            const { body: uploaded } = await uploadImage({}, SAMPLE_JPG)
            const id = uploaded._id

            const { status } = await request(app).get(`/images/${id}/file`)

            expect(status).to.equal(200)
        })
    })

    // -----------------------------------------------------------------------
    // PATCH /images  (bulk update)
    // -----------------------------------------------------------------------

    describe('PATCH /images', () => {
        it('adds a field to every image when no filter is supplied', async () => {
            await insertImage({ key1: 'a' }, 'a.jpg')
            await insertImage({ key1: 'b' }, 'b.jpg')

            const { status, body } = await request(app)
                .patch('/images')
                .send({ commonKey: 'commonValue' })

            expect(status).to.equal(200)
            expect(body.modifiedCount).to.equal(2)

            const docs = await Image.find({})
            for (const doc of docs) {
                expect(doc.data.commonKey).to.equal('commonValue')
            }
        })

        it('updates only images matching a filter', async () => {
            await insertImage({ env: 'prod' }, 'prod.jpg')
            await insertImage({ env: 'dev' }, 'dev.jpg')

            const { status, body } = await request(app)
                .patch('/images?env=prod')
                .send({ patched: 'yes' })

            expect(status).to.equal(200)
            expect(body.modifiedCount).to.equal(1)

            const prodDoc = await Image.findOne({ 'data.env': 'prod' })
            expect(prodDoc?.data.patched).to.equal('yes')

            const devDoc = await Image.findOne({ 'data.env': 'dev' })
            expect(devDoc?.data.patched).to.be.undefined
        })

        it('returns modifiedCount 0 when no documents match the filter', async () => {
            await insertImage({ x: '1' }, 'x.jpg')

            const { status, body } = await request(app)
                .patch('/images?x=no_such_value')
                .send({ y: '2' })

            expect(status).to.equal(200)
            expect(body.modifiedCount).to.equal(0)
        })
    })

    // -----------------------------------------------------------------------
    // PATCH /images/:id  (single update)
    // -----------------------------------------------------------------------

    describe('PATCH /images/:id', () => {
        it('adds a new field to an existing image', async () => {
            const doc = await insertImage({ key1: 'value1' }, 'patch-me.jpg')

            const { status, body } = await request(app)
                .patch(`/images/${doc._id}`)
                .send({ newField: 'newValue' })

            expect(status).to.equal(200)
            expect(body.data.key1).to.equal('value1')
            expect(body.data.newField).to.equal('newValue')
        })

        it('overwrites an existing field', async () => {
            const doc = await insertImage(
                { editable: 'original' },
                'edit-me.jpg'
            )

            const { status, body } = await request(app)
                .patch(`/images/${doc._id}`)
                .send({ editable: 'updated' })

            expect(status).to.equal(200)
            expect(body.data.editable).to.equal('updated')
        })

        it('can unset a field using the $unset body key', async () => {
            const doc = await insertImage(
                { keep: 'yes', remove: 'bye' },
                'unset-me.jpg'
            )

            const { status, body } = await request(app)
                .patch(`/images/${doc._id}`)
                .send({ $unset: { remove: '' } })

            expect(status).to.equal(200)
            expect(body.data.keep).to.equal('yes')
            // The unset field should be absent or undefined
            expect(body.data).to.not.have.property('remove')
        })

        it('returns 404 for a non-existent ID', async () => {
            const fakeId = new mongoose.Types.ObjectId().toString()

            const { status } = await request(app)
                .patch(`/images/${fakeId}`)
                .send({ x: '1' })

            expect(status).to.equal(404)
        })
    })

    // -----------------------------------------------------------------------
    // PUT /images/:id  (replace data)
    // -----------------------------------------------------------------------

    describe('PUT /images/:id', () => {
        it('replaces the data field entirely', async () => {
            const doc = await insertImage(
                { old: 'data', extra: 'stuff' },
                'replace-me.jpg'
            )

            const { status } = await request(app)
                .put(`/images/${doc._id}`)
                .send({ brand: 'new' })

            // replace_image_data uses findOneAndUpdate (without {new:true}),
            // so it returns the *old* document — status 200 is what matters here.
            expect(status).to.equal(200)

            const updated = await Image.findById(doc._id)
            expect(updated?.data.brand).to.equal('new')
            expect(updated?.data.old).to.be.undefined
        })

        it('returns 404 for a non-existent ID', async () => {
            const fakeId = new mongoose.Types.ObjectId().toString()

            const { status } = await request(app)
                .put(`/images/${fakeId}`)
                .send({ x: '1' })

            expect(status).to.equal(404)
        })
    })

    // -----------------------------------------------------------------------
    // DELETE /images/:id
    // -----------------------------------------------------------------------

    describe('DELETE /images/:id', () => {
        it('deletes an existing image and returns its _id', async () => {
            const doc = await insertImage({}, 'delete-me.jpg')

            const { status, body } = await request(app).delete(
                `/images/${doc._id}`
            )

            expect(status).to.equal(200)
            expect(body._id).to.equal(doc._id.toString())

            const remaining = await Image.findById(doc._id)
            expect(remaining).to.be.null
        })

        it('returns 404 for a non-existent ID', async () => {
            const fakeId = new mongoose.Types.ObjectId().toString()

            const { status } = await request(app).delete(`/images/${fakeId}`)

            expect(status).to.equal(404)
        })
    })

    // -----------------------------------------------------------------------
    // DELETE /images  (bulk delete)
    // -----------------------------------------------------------------------

    describe('DELETE /images', () => {
        it('deletes images matching a specific filter', async () => {
            await insertImage({ env: 'prod' }, 'del-prod.jpg')
            await insertImage({ env: 'dev' }, 'del-dev.jpg')
            await insertImage({ env: 'dev' }, 'del-dev2.jpg')

            const { status, body } = await request(app).delete(
                '/images?env=dev'
            )

            expect(status).to.equal(200)
            expect(body.deletedCount).to.equal(2)

            const remaining = await Image.countDocuments({})
            expect(remaining).to.equal(1)
        })

        it('deletes all images when no filter is provided', async () => {
            await insertImage({}, 'all1.jpg')
            await insertImage({}, 'all2.jpg')
            await insertImage({}, 'all3.jpg')

            const { status, body } = await request(app).delete('/images')

            expect(status).to.equal(200)
            expect(body.deletedCount).to.equal(3)

            const remaining = await Image.countDocuments({})
            expect(remaining).to.equal(0)
        })

        it('returns deletedCount 0 when filter matches nothing', async () => {
            await insertImage({ x: 'a' }, 'nodelete.jpg')

            const { status, body } = await request(app).delete(
                '/images?x=no_such_value'
            )

            expect(status).to.equal(200)
            expect(body.deletedCount).to.equal(0)

            expect(await Image.countDocuments({})).to.equal(1)
        })

        it('returns 400 and deletes nothing for a disallowed operator', async () => {
            await insertImage({ x: 'a' }, 'nodelete.jpg')

            const filter = JSON.stringify({ $where: 'true' })
            const { status } = await request(app).delete(
                `/images?filter=${encodeURIComponent(filter)}`
            )

            expect(status).to.equal(400)
            expect(await Image.countDocuments({})).to.equal(1)
        })
    })

    // -----------------------------------------------------------------------
    // GET /fields
    // -----------------------------------------------------------------------

    describe('GET /fields', () => {
        it('returns an empty array when there are no images', async () => {
            const { status, body } = await request(app).get('/fields')

            expect(status).to.equal(200)
            expect(body).to.deep.equal([])
        })

        it('returns sorted unique field names from image data', async () => {
            await insertImage({ alpha: '1', beta: '2' }, 'f1.jpg')
            await insertImage({ beta: '3', gamma: '4' }, 'f2.jpg')

            const { status, body } = await request(app).get('/fields')

            expect(status).to.equal(200)
            expect(body).to.include.members(['alpha', 'beta', 'gamma'])
            // Should be sorted
            expect(body).to.deep.equal([...body].sort())
        })
    })

    // -----------------------------------------------------------------------
    // GET /fields/:field
    // -----------------------------------------------------------------------

    describe('GET /fields/:field', () => {
        it('returns the distinct values for a field', async () => {
            await insertImage({ env: 'prod' }, 'fv1.jpg')
            await insertImage({ env: 'dev' }, 'fv2.jpg')
            await insertImage({ env: 'prod' }, 'fv3.jpg')

            const { status, body } = await request(app).get('/fields/env')

            expect(status).to.equal(200)
            expect(body).to.have.members(['prod', 'dev'])
        })

        it('returns an empty array for a field that exists on no image', async () => {
            await insertImage({ other: 'val' }, 'empty-field.jpg')

            const { status, body } = await request(app).get(
                '/fields/nonexistent_field'
            )

            expect(status).to.equal(200)
            expect(body).to.deep.equal([])
        })

        it('excludes null values from distinct results', async () => {
            await insertImage({ tag: 'visible' }, 'tag1.jpg')
            // Insert a doc where tag is explicitly null
            await Image.create({
                file: 'null-tag.jpg',
                data: { tag: null },
            })

            const { status, body } = await request(app).get('/fields/tag')

            expect(status).to.equal(200)
            expect(body).to.include('visible')
            expect(body).to.not.include(null)
        })
    })

    // -----------------------------------------------------------------------
    // GET /export
    // -----------------------------------------------------------------------

    describe('GET /export', () => {
        it('returns a zip archive when there are no images', async () => {
            const { status, headers } = await request(app).get('/export')

            expect(status).to.equal(200)
            expect(headers['content-type']).to.include('application/zip')
        })

        it('returns a zip archive containing the seeded images', async () => {
            await insertImage({ exported: 'yes' }, 'exp1.jpg')
            await insertImage({ exported: 'yes' }, 'exp2.jpg')

            const { status, headers } = await request(app).get('/export')

            expect(status).to.equal(200)
            expect(headers['content-type']).to.include('application/zip')
            expect(headers['content-disposition']).to.include('export.zip')
        })

        it('returns 400 if the explicit limit query param exceeds the max', async () => {
            // maxExportLimit is frozen at module load (config.ts), so read the
            // env var directly here to compute a value that will always exceed it.
            // In CI, EXPORT_MAX_LIMIT=5 so this sends limit=6.
            // Locally (no env var) the default is 10000 so this sends limit=10001.
            const max = Number(process.env.EXPORT_MAX_LIMIT) || 10000
            const { status } = await request(app).get(`/export?limit=${max + 1}`)

            expect(status).to.equal(400)
        })
    })

    // -----------------------------------------------------------------------
    // POST /import
    // -----------------------------------------------------------------------

    describe('POST /import', () => {
        it('returns 200 and imports images from a zip archive', async () => {
            if (!fs.existsSync(EXPORT_ZIP)) {
                // Skip gracefully when the test asset is absent
                return
            }

            const { status } = await request(app)
                .post('/import')
                .attach('archive', EXPORT_ZIP)

            expect(status).to.equal(200)
        })

        it('returns 400 when no archive file is provided', async () => {
            const { status } = await request(app).post('/import')

            expect(status).to.equal(400)
        })
    })

    // -----------------------------------------------------------------------
    // GET /  (health / info endpoint)
    // -----------------------------------------------------------------------

    describe('GET /', () => {
        it('returns application info without requiring auth', async () => {
            const { status, body } = await request(app).get('/')

            expect(status).to.equal(200)
            expect(body).to.have.property('version')
            expect(body).to.have.property('mongodb')
        })
    })
})
