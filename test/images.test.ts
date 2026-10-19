import request from 'supertest'
import { expect } from 'chai'
import { app } from '../index'
import mongoose from 'mongoose'
import { Image } from '../models/image'
import { describe, it, before, after, afterEach } from 'mocha'
import path from 'path'
import fs from 'fs'
import os from 'os'
import archiver from 'archiver'
import unzipper from 'unzipper'

// ---------------------------------------------------------------------------
// Storage stub
//
// Replace Multer's storage engine with a no-op memory store so tests never
// touch the local filesystem (or S3).  The stub assigns req.file exactly as
// Multer's DiskStorage would, minus the actual write.
// ---------------------------------------------------------------------------

import * as localModule from '../fileStorage/local'
import { uploadsDirectoryPath } from '../fileStorage/local'
import * as s3Module from '../fileStorage/s3'
import { StorageEngine } from 'multer'

// ---------------------------------------------------------------------------
// Test storage directory
//
// All files written during tests go to /iss-test-images/ (not /uploads/) so
// they are completely isolated from real data.  The entire directory is wiped
// in the after() hook.  We also override TEST_UPLOADS_DIR so that
// downloadLocalFile() resolves paths against the same directory.
// ---------------------------------------------------------------------------

const TEST_UPLOADS_DIR = path.join(uploadsDirectoryPath, 'iss-test-images')

const memoryStorage: StorageEngine = {
    _handleFile(req, file, cb) {
        const chunks: Buffer[] = []
        file.stream.on('data', (chunk: Buffer) => chunks.push(chunk))
        file.stream.on('end', () => {
            const buf = Buffer.concat(chunks)
            const filePath = path.join(TEST_UPLOADS_DIR, file.originalname)
            if (!fs.existsSync(TEST_UPLOADS_DIR))
                fs.mkdirSync(TEST_UPLOADS_DIR, { recursive: true })
            fs.writeFileSync(filePath, buf)
            ;(req as any).file = {
                fieldname: file.fieldname,
                originalname: file.originalname,
                mimetype: file.mimetype,
                buffer: buf,
                size: buf.length,
                path: filePath,
                filename: file.originalname,
                destination: TEST_UPLOADS_DIR,
            }
            cb(null, req.file as any)
        })
        file.stream.on('error', cb)
    },
    _removeFile(_req, file: any, cb) {
        try {
            if (file.path && fs.existsSync(file.path))
                fs.rmSync(file.path, { force: true })
        } catch {
            /* ignore */
        }
        cb(null)
    },
}

// Patch the storage engines before the routes module resolves them.
;(s3Module as any).s3Storage = undefined
;(s3Module as any).s3Client = undefined
;(localModule as any).localStorage = memoryStorage

// Patch downloadLocalFile to resolve against TEST_UPLOADS_DIR instead of the
// real uploadsDirectoryPath (which is a const baked into local.ts at load time).
const { resolveInside } = require('../fileStorage/paths')
;(localModule as any).downloadLocalFile = (res: any, file: string) => {
    res.download(resolveInside(TEST_UPLOADS_DIR, file), file)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SAMPLE_JPG = path.resolve(__dirname, 'sample.jpg')
const SAMPLE2_JPG = path.resolve(__dirname, 'sample2.jpg')

const TEST_RUN_ID = `test_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`

// Track all ObjectIds created during the current test
let createdIds: string[] = []

/** POST /images with a real JPEG, returns the created document */
async function uploadImage(
    fields: Record<string, string> = {},
    imagePath = SAMPLE_JPG
) {
    // Add test marker to all uploads
    fields.__test_marker = TEST_RUN_ID

    let req = request(app).post('/images').attach('image', imagePath)
    for (const [k, v] of Object.entries(fields)) {
        req = req.field(k, v)
    }
    const response = await req
    if (response.body && response.body._id) {
        createdIds.push(response.body._id)
    }
    return response
}

/** Insert a document directly into MongoDB (bypasses storage) */
async function insertImage(data: Record<string, any> = {}, file = 'test.jpg') {
    // Add test marker to all inserts
    const doc = await Image.create({
        file,
        data: { ...data, __test_marker: TEST_RUN_ID },
    })
    createdIds.push(doc._id.toString())
    return doc
}

/** Delete only images created during this test run, including their files */
async function cleanAll() {
    // Use the API so the controller also removes the physical files from
    // /uploads (and S3).  Bypassing the controller (deleteMany directly)
    // would leave orphaned files on disk.
    for (const id of createdIds) {
        await request(app).delete(`/images/${id}`)
    }
    // Fallback: remove any docs that were inserted but whose _id was never
    // tracked (e.g. via direct insertImage calls that somehow missed the push)
    await Image.deleteMany({ 'data.__test_marker': TEST_RUN_ID })
}

/** Count only images created during this test run */
async function countTestImages(filter: Record<string, any> = {}) {
    return Image.countDocuments({
        'data.__test_marker': TEST_RUN_ID,
        ...filter,
    })
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('Image Storage API', () => {
    before(async () => {
        // Create isolated test uploads directory
        if (!fs.existsSync(TEST_UPLOADS_DIR))
            fs.mkdirSync(TEST_UPLOADS_DIR, { recursive: true })

        // Wait for the Mongoose connection to become ready (up to 10 s)
        const deadline = Date.now() + 10_000
        while (mongoose.connection.readyState !== 1) {
            if (Date.now() > deadline)
                throw new Error('MongoDB did not connect within 10 s')
            await new Promise((r) => setTimeout(r, 100))
        }
    })

    after(() => {
        // Remove the entire test uploads directory
        if (fs.existsSync(TEST_UPLOADS_DIR))
            fs.rmSync(TEST_UPLOADS_DIR, { recursive: true, force: true })
    })

    beforeEach(() => {
        createdIds = []
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
                __test_marker: TEST_RUN_ID,
            }

            const { status, body } = await request(app)
                .post('/images')
                .field('json', JSON.stringify(jsonData))
                .attach('image', SAMPLE2_JPG)

            expect(status).to.equal(200)
            expect(body.data.parentKey.nestedKey1).to.equal('nestedValue1')
            if (body._id) createdIds.push(body._id)
        })

        it('creates an image record with nested JSON fields (data field)', async () => {
            const jsonData = {
                category: 'test',
                score: 99,
                __test_marker: TEST_RUN_ID,
            }

            const { status, body } = await request(app)
                .post('/images')
                .field('data', JSON.stringify(jsonData))
                .attach('image', SAMPLE_JPG)

            expect(status).to.equal(200)
            expect(body.data.category).to.equal('test')
            if (body._id) createdIds.push(body._id)
        })

        it('upserts when the same file name is uploaded twice', async () => {
            await uploadImage({ key1: 'first' })
            // Upload the same logical file again with different metadata
            const { status, body } = await uploadImage({ key1: 'second' })

            expect(status).to.equal(200)
            expect(body.data.key1).to.equal('second')
            const count = await countTestImages()
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
            const { status, body } = await request(app).get(
                `/images?__test_marker=${TEST_RUN_ID}`
            )
            expect(status).to.equal(200)
            expect(body.total).to.equal(3)
            expect(body.items).to.have.lengthOf(3)
        })

        it('returns the correct response envelope shape', async () => {
            const { body } = await request(app).get('/images')

            expect(body).to.include.keys('total', 'items', 'limit', 'skip')
        })

        it('filters images by a data field', async () => {
            const { status, body } = await request(app).get(
                `/images?key3=value3&__test_marker=${TEST_RUN_ID}`
            )

            expect(status).to.equal(200)
            expect(body.total).to.equal(2)
        })

        it('filters images by dot notation (data.key)', async () => {
            const { status, body } = await request(app).get(
                `/images?data.key3=value3&__test_marker=${TEST_RUN_ID}`
            )

            expect(status).to.equal(200)
            expect(body.total).to.equal(2)
        })

        it('filters images by bracket notation (data[key])', async () => {
            const { status, body } = await request(app).get(
                `/images?data[key3]=value3&__test_marker=${TEST_RUN_ID}`
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
                `/images?data[parentKey][nestedKey1]=nestedValue1&__test_marker=${TEST_RUN_ID}`
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
            const filter = JSON.stringify({
                'data.key2': { $ne: null },
                'data.__test_marker': TEST_RUN_ID,
            })
            const { status, body } = await request(app).get(
                `/images?filter=${encodeURIComponent(filter)}`
            )

            expect(status).to.equal(200)
            expect(body.total).to.equal(1)
        })

        it('queries images by a list of IDs', async () => {
            // Fetch scoped to this test run to get a known _id
            const { body: allBody } = await request(app).get(
                `/images?__test_marker=${TEST_RUN_ID}`
            )
            const id = allBody.items[0]._id

            const { status, body } = await request(app).get(`/images?ids=${id}`)

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
            const { status, body } = await request(app).get(
                `/images?__test_marker=${TEST_RUN_ID}&skip=2`
            )
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
                'data.__test_marker': TEST_RUN_ID,
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
                `/images?data[key3][$ne]=value3&__test_marker=${TEST_RUN_ID}`
            )

            expect(status).to.equal(200)
            expect(body.total).to.equal(1)
        })

        it('still supports partial matching with regex=true', async () => {
            const { status, body } = await request(app).get(
                `/images?data.key3=VALUE&__test_marker=${TEST_RUN_ID}&regex=true`
            )

            expect(status).to.equal(200)
            expect(body.total).to.equal(2)
        })
    })

    // -----------------------------------------------------------------------
    // GET /images — pagination validation
    // -----------------------------------------------------------------------

    describe('GET /images — pagination validation', () => {
        beforeEach(async () => {
            await insertImage({}, 'pag1.jpg')
            await insertImage({}, 'pag2.jpg')
            await insertImage({}, 'pag3.jpg')
        })

        it('uses the default limit (100) when limit is omitted', async () => {
            const { status, body } = await request(app).get(
                `/images?__test_marker=${TEST_RUN_ID}`
            )
            expect(status).to.equal(200)
            expect(body.limit).to.equal(100)
        })

        it('accepts a valid limit within the maximum', async () => {
            const { status, body } = await request(app).get(
                `/images?__test_marker=${TEST_RUN_ID}&limit=2`
            )
            expect(status).to.equal(200)
            expect(body.limit).to.equal(2)
            expect(body.items.length).to.be.at.most(2)
        })

        it('accepts limit equal to the maximum (1000)', async () => {
            const max = Number(process.env.LIST_MAX_LIMIT) || 1000
            const { status, body } = await request(app).get(
                `/images?__test_marker=${TEST_RUN_ID}&limit=${max}`
            )
            expect(status).to.equal(200)
            expect(body.limit).to.equal(max)
        })

        it('returns 400 when limit exceeds the maximum', async () => {
            const max = Number(process.env.LIST_MAX_LIMIT) || 1000
            const { status } = await request(app).get(
                `/images?limit=${max + 1}`
            )
            expect(status).to.equal(400)
        })

        it('uses the default limit when limit=0 (cannot disable the MongoDB limit)', async () => {
            const { status, body } = await request(app).get(
                `/images?__test_marker=${TEST_RUN_ID}&limit=0`
            )
            expect(status).to.equal(200)
            expect(body.limit).to.equal(100)
            // Must never return an unbounded result set
            expect(body.limit).to.be.greaterThan(0)
        })

        it('uses the default limit when limit is negative', async () => {
            const { status, body } = await request(app).get(
                `/images?__test_marker=${TEST_RUN_ID}&limit=-5`
            )
            expect(status).to.equal(200)
            expect(body.limit).to.equal(100)
        })

        it('uses the default limit when limit is non-numeric', async () => {
            const { status, body } = await request(app).get(
                `/images?__test_marker=${TEST_RUN_ID}&limit=abc`
            )
            expect(status).to.equal(200)
            expect(body.limit).to.equal(100)
        })

        it('uses the default limit when limit is a decimal', async () => {
            const { status, body } = await request(app).get(
                `/images?__test_marker=${TEST_RUN_ID}&limit=2.5`
            )
            expect(status).to.equal(200)
            expect(body.limit).to.equal(100)
        })

        it('treats negative skip as 0 (no error, returns results from start)', async () => {
            const { status, body } = await request(app).get(
                `/images?__test_marker=${TEST_RUN_ID}&skip=-1`
            )
            expect(status).to.equal(200)
            expect(body.items.length).to.equal(3)
        })

        it('treats non-numeric skip as 0', async () => {
            const { status, body } = await request(app).get(
                `/images?__test_marker=${TEST_RUN_ID}&skip=abc`
            )
            expect(status).to.equal(200)
            expect(body.items.length).to.equal(3)
        })

        it('treats decimal skip as its floor value', async () => {
            const { status, body } = await request(app).get(
                `/images?__test_marker=${TEST_RUN_ID}&skip=1.9`
            )
            expect(status).to.equal(200)
            // floor(1.9) = 1, so skip 1 of 3 → 2 results
            expect(body.items.length).to.equal(2)
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
                .patch(`/images?__test_marker=${TEST_RUN_ID}`)
                .send({ commonKey: 'commonValue' })

            expect(status).to.equal(200)
            expect(body.modifiedCount).to.equal(2)

            const docs = await Image.find({ 'data.__test_marker': TEST_RUN_ID })
            for (const doc of docs) {
                expect(doc.data.commonKey).to.equal('commonValue')
            }
        })

        it('updates only images matching a filter', async () => {
            await insertImage({ env: 'prod' }, 'prod.jpg')
            await insertImage({ env: 'dev' }, 'dev.jpg')

            const { status, body } = await request(app)
                .patch(`/images?env=prod&__test_marker=${TEST_RUN_ID}`)
                .send({ patched: 'yes' })

            expect(status).to.equal(200)
            expect(body.modifiedCount).to.equal(1)

            const prodDoc = await Image.findOne({
                'data.env': 'prod',
                'data.__test_marker': TEST_RUN_ID,
            })
            expect(prodDoc?.data.patched).to.equal('yes')

            const devDoc = await Image.findOne({
                'data.env': 'dev',
                'data.__test_marker': TEST_RUN_ID,
            })
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
                `replace-me-${TEST_RUN_ID}.jpg`
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
                `/images?env=dev&__test_marker=${TEST_RUN_ID}`
            )

            expect(status).to.equal(200)
            expect(body.deletedCount).to.equal(2)
            const remaining = await countTestImages()
            expect(remaining).to.equal(1)
        })

        it('deletes all images when no filter is provided', async () => {
            await insertImage({}, 'all1.jpg')
            await insertImage({}, 'all2.jpg')
            await insertImage({}, 'all3.jpg')
            const { status, body } = await request(app).delete(
                `/images?__test_marker=${TEST_RUN_ID}`
            )
            expect(status).to.equal(200)
            expect(body.deletedCount).to.equal(3)
            const remaining = await countTestImages()
            expect(remaining).to.equal(0)
        })

        it('returns deletedCount 0 when filter matches nothing', async () => {
            await insertImage({ x: 'a' }, 'nodelete.jpg')

            const { status, body } = await request(app).delete(
                `/images?x=no_such_value&__test_marker=${TEST_RUN_ID}`
            )

            expect(status).to.equal(200)
            expect(body.deletedCount).to.equal(0)
            expect(await countTestImages()).to.equal(1)
        })

        it('returns 400 and deletes nothing for a disallowed operator', async () => {
            await insertImage({ x: 'a' }, 'nodelete.jpg')

            const filter = JSON.stringify({ $where: 'true' })
            const { status } = await request(app).delete(
                `/images?filter=${encodeURIComponent(filter)}`
            )

            expect(status).to.equal(400)
            expect(await countTestImages()).to.equal(1)
        })
    })

    // -----------------------------------------------------------------------
    // GET /fields
    // -----------------------------------------------------------------------

    describe('GET /fields', () => {
        it('returns an empty array when there are no test-run images', async () => {
            const { status, body } = await request(app).get('/fields')

            expect(status).to.equal(200)
            expect(body).to.be.an('array')
            // No documents seeded for this test run — verify via direct DB count
            const count = await Image.countDocuments({
                'data.__test_marker': TEST_RUN_ID,
            })
            expect(count).to.equal(0)
        })

        it('returns sorted unique field names from image data', async () => {
            await insertImage({ alpha: '1', beta: '2' }, 'f1.jpg')
            await insertImage({ beta: '3', gamma: '4' }, 'f2.jpg')

            const { status, body } = await request(app).get('/fields')

            expect(status).to.equal(200)
            expect(body).to.include.members([
                'alpha',
                'beta',
                'gamma',
                '__test_marker',
            ])
            // Should be sorted
            expect(body).to.deep.equal([...body].sort())
        })
    })

    // -----------------------------------------------------------------------
    // GET /fields/:field
    // -----------------------------------------------------------------------

    describe('GET /fields/:field', () => {
        it('returns the distinct values for a field', async () => {
            const prodVal = `prod_${TEST_RUN_ID}`
            const devVal = `dev_${TEST_RUN_ID}`
            await insertImage({ env: prodVal }, 'fv1.jpg')
            await insertImage({ env: devVal }, 'fv2.jpg')
            await insertImage({ env: prodVal }, 'fv3.jpg')

            const { status, body } = await request(app).get('/fields/env')

            expect(status).to.equal(200)
            expect(body).to.include.members([prodVal, devVal])
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
            const visibleVal = `visible_${TEST_RUN_ID}`
            await insertImage({ tag: visibleVal }, 'tag1.jpg')
            await insertImage({ tag: null }, `null-tag-${TEST_RUN_ID}.jpg`)

            const { status, body } = await request(app).get('/fields/tag')

            expect(status).to.equal(200)
            expect(body).to.include(visibleVal)
            expect(body).to.not.include(null)
        })
    })

    // -----------------------------------------------------------------------
    // GET /export
    // -----------------------------------------------------------------------

    describe('GET /export', () => {
        it('returns a zip archive when there are no images', async () => {
            // Scope to this test run so pre-existing DB documents do not
            // push the total past EXPORT_MAX_LIMIT on a shared database.
            const { status, headers } = await request(app).get(
                `/export?__test_marker=${TEST_RUN_ID}`
            )

            expect(status).to.equal(200)
            expect(headers['content-type']).to.include('application/zip')
        })

        it('returns a zip archive containing the seeded images', async () => {
            await insertImage({ exported: 'yes' }, 'exp1.jpg')
            await insertImage({ exported: 'yes' }, 'exp2.jpg')

            const { status, headers } = await request(app).get(
                `/export?__test_marker=${TEST_RUN_ID}`
            )

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
            const { status } = await request(app).get(
                `/export?limit=${max + 1}`
            )

            expect(status).to.equal(400)
        })
    })

    // -----------------------------------------------------------------------
    // POST /import
    // -----------------------------------------------------------------------

    describe('POST /import', () => {
        // The import controller writes extracted files to the real uploadsDirectoryPath
        // (a const in local.ts — not patchable at runtime).  We embed TEST_RUN_ID in
        // mongodb_data.json so cleanAll() can delete the MongoDB record, and we
        // explicitly remove the extracted file from /uploads/ in afterEach.
        const IMPORT_FILE = `import_test_${TEST_RUN_ID}.jpg`

        /** Build a minimal zip with TEST_RUN_ID embedded in mongodb_data.json */
        async function buildImportZip(): Promise<Buffer> {
            const archive = archiver('zip', { store: true })
            const chunks: Buffer[] = []
            archive.on('data', (chunk: Buffer) => chunks.push(chunk))
            const done = new Promise<void>((resolve) =>
                archive.on('end', resolve)
            )

            // Tiny 1x1 JPEG
            const tinyJpeg = fs.readFileSync(SAMPLE_JPG)
            const mongoData = JSON.stringify([
                {
                    file: IMPORT_FILE,
                    time: new Date().toISOString(),
                    data: { __test_marker: TEST_RUN_ID },
                },
            ])

            archive.append(tinyJpeg, { name: IMPORT_FILE })
            archive.append(mongoData, { name: 'mongodb_data.json' })
            await archive.finalize()
            await done
            return Buffer.concat(chunks)
        }

        afterEach(() => {
            // The import controller extracts to the real /uploads/ dir — clean it up
            const {
                uploadsDirectoryPath: realUploads,
            } = require('../fileStorage/local')
            const extracted = path.join(realUploads, IMPORT_FILE)
            if (fs.existsSync(extracted)) fs.rmSync(extracted, { force: true })
        })

        it('returns 200 and imports images from a zip archive', async () => {
            const zip = await buildImportZip()

            const { status } = await request(app)
                .post('/import')
                .attach('archive', zip, {
                    filename: 'import_test.zip',
                    contentType: 'application/zip',
                })

            expect(status).to.equal(200)
        })

        it('returns 400 when no archive file is provided', async () => {
            const { status } = await request(app).post('/import')

            expect(status).to.equal(400)
        })
    })

    // -----------------------------------------------------------------------
    // Path traversal
    // -----------------------------------------------------------------------

    describe('Path traversal', () => {
        // A file outside the uploads directory that must never be read,
        // written or deleted through the API
        const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'iss-test-'))
        const outsideFile = path.join(outsideDir, 'outside.txt')
        const outsideRelative = path.relative(TEST_UPLOADS_DIR, outsideFile)

        beforeEach(() => fs.writeFileSync(outsideFile, 'do not touch'))
        after(() => fs.rmSync(outsideDir, { recursive: true, force: true }))

        /** Zip archive built in memory; archiver strips "../" from entry
         *  names, so "@@/" is swapped for "../" in the raw bytes */
        async function buildZip(entries: Record<string, string>) {
            const archive = archiver('zip', { store: true })
            const chunks: Buffer[] = []
            archive.on('data', (chunk: Buffer) => chunks.push(chunk))
            const done = new Promise((resolve) => archive.on('end', resolve))
            for (const [name, content] of Object.entries(entries))
                archive.append(content, { name })
            await archive.finalize()
            await done
            const zip = Buffer.concat(chunks)
            for (
                let i = zip.indexOf('@@/');
                i !== -1;
                i = zip.indexOf('@@/', i)
            )
                zip.write('../', i)
            return zip
        }

        it('rejects an upload with a file path containing ..', async () => {
            const { status } = await uploadImage({ file: '../evil.jpg' })

            expect(status).to.equal(400)
            expect(await countTestImages()).to.equal(0)
        })

        it('rejects an upload with an absolute file path', async () => {
            const { status } = await uploadImage({ file: '/tmp/evil.jpg' })

            expect(status).to.equal(400)
            expect(await countTestImages()).to.equal(0)
        })

        it('still accepts an upload into a subfolder', async () => {
            const { status, body } = await uploadImage({
                file: 'folder/ok.jpg',
            })

            expect(status).to.equal(200)
            expect(body.file).to.equal('folder/ok.jpg')
        })

        it('refuses to download a file outside the uploads directory', async () => {
            const doc = await insertImage({}, outsideRelative)

            const { status, text } = await request(app).get(
                `/images/${doc._id}/image`
            )

            expect(status).to.equal(400)
            expect(text).not.to.include('do not touch')
        })

        it('does not delete a file outside the uploads directory', async () => {
            const doc = await insertImage({}, outsideRelative)

            await request(app).delete(`/images/${doc._id}`)

            expect(fs.existsSync(outsideFile)).to.equal(true)
        })

        it('does not delete files outside the uploads directory in bulk', async () => {
            await insertImage({ bulk: 'yes' }, outsideRelative)

            await request(app).delete('/images?bulk=yes')
            // Files are removed in the background
            await new Promise((resolve) => setTimeout(resolve, 200))

            expect(fs.existsSync(outsideFile)).to.equal(true)
        })

        it('skips files outside the uploads directory on export', async () => {
            await insertImage({}, outsideRelative)

            const { status, body } = await request(app)
                .get(`/export?__test_marker=${TEST_RUN_ID}`)
                .buffer(true)
                .parse((res, callback) => {
                    const chunks: Buffer[] = []
                    res.on('data', (chunk: Buffer) => chunks.push(chunk))
                    res.on('end', () => callback(null, Buffer.concat(chunks)))
                })

            expect(status).to.equal(200)
            const archive = await unzipper.Open.buffer(body)
            const names = archive.files.map((f) => f.path)
            expect(names.some((name) => name.includes('outside.txt'))).to.equal(
                false
            )
        })

        it('rejects an import archive with a .. entry', async () => {
            const zip = await buildZip({ '@@/evil.txt': 'evil' })

            const { status } = await request(app)
                .post('/import')
                .attach('archive', zip, {
                    filename: 'evil.zip',
                    contentType: 'application/zip',
                })

            expect(status).to.equal(400)
            expect(
                fs.existsSync(path.resolve(TEST_UPLOADS_DIR, '../evil.txt'))
            ).to.equal(false)
            expect(await countTestImages()).to.equal(0)
        })

        it('rejects an import whose MongoDB data has a .. file path', async () => {
            const zip = await buildZip({
                'outside.txt': 'overwritten',
                'mongodb_data.json': JSON.stringify([
                    { file: outsideRelative, data: {} },
                ]),
            })

            const { status } = await request(app)
                .post('/import')
                .attach('archive', zip, {
                    filename: 'evil.zip',
                    contentType: 'application/zip',
                })

            expect(status).to.equal(400)
            expect(fs.readFileSync(outsideFile, 'utf-8')).to.equal(
                'do not touch'
            )
            expect(await countTestImages()).to.equal(0)
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

    // -----------------------------------------------------------------------
    // Issue 1: regex=true escaping (ReDoS prevention)
    // -----------------------------------------------------------------------

    describe('GET /images — regex=true escaping', () => {
        beforeEach(async () => {
            await insertImage({ tag: 'value3' }, 'regex-a.jpg')
            await insertImage({ tag: 'value.3' }, 'regex-b.jpg') // literal dot in value
            await insertImage({ tag: 'VALUE3' }, 'regex-c.jpg') // different case
        })

        it('regex=true still performs case-insensitive partial matching', async () => {
            const { status, body } = await request(app).get(
                `/images?tag=value3&__test_marker=${TEST_RUN_ID}&regex=true`
            )
            expect(status).to.equal(200)
            // Matches "value3" and "VALUE3" (case-insensitive), not "value.3"
            expect(body.total).to.equal(2)
        })

        it('regex=true treats a dot in the search term as a literal dot, not a wildcard', async () => {
            const { status, body } = await request(app).get(
                `/images?tag=value.3&__test_marker=${TEST_RUN_ID}&regex=true`
            )
            expect(status).to.equal(200)
            // Only "value.3" matches — the dot must not act as a regex wildcard
            expect(body.total).to.equal(1)
            expect(body.items[0].data.tag).to.equal('value.3')
        })

        it('regex=true with a catastrophic-regex-like string completes without hanging', async () => {
            // "(a+)+" would be catastrophic as a raw regex — as a literal string it
            // simply matches nothing and must return promptly.
            const { status, body } = await request(app).get(
                `/images?tag=${encodeURIComponent('(a+)+')}&__test_marker=${TEST_RUN_ID}&regex=true`
            )
            expect(status).to.equal(200)
            expect(body.total).to.equal(0)
        })

        it('regex=true with special chars [, *, ^ matches literally', async () => {
            await insertImage({ tag: 'a[b]c' }, 'regex-special.jpg')

            const { status, body } = await request(app).get(
                `/images?tag=${encodeURIComponent('a[b]c')}&__test_marker=${TEST_RUN_ID}&regex=true`
            )
            expect(status).to.equal(200)
            expect(body.total).to.equal(1)
        })

        it('regex=false (default) is unaffected — plain equality match', async () => {
            const { status, body } = await request(app).get(
                `/images?tag=value3&__test_marker=${TEST_RUN_ID}`
            )
            expect(status).to.equal(200)
            // Only exact match "value3", not "VALUE3" or "value.3"
            expect(body.total).to.equal(1)
        })
    })

    // -----------------------------------------------------------------------
    // Issue 2: parseUpdateBody — reject $-prefixed keys with 400
    // -----------------------------------------------------------------------

    describe('PATCH /images/:id — operator key rejection', () => {
        it('returns 400 when the body contains a $-prefixed key (e.g. $push)', async () => {
            const doc = await insertImage({ x: '1' }, 'op-key.jpg')

            const { status } = await request(app)
                .patch(`/images/${doc._id}`)
                .send({ $push: { x: '2' } })

            expect(status).to.equal(400)
        })

        it('returns 400 when the $unset object contains a $-prefixed key', async () => {
            const doc = await insertImage({ x: '1' }, 'op-unset.jpg')

            const { status } = await request(app)
                .patch(`/images/${doc._id}`)
                .send({ $unset: { $where: '' } })

            expect(status).to.equal(400)
        })

        it('still accepts $unset with valid field names', async () => {
            const doc = await insertImage(
                { keep: 'yes', remove: 'bye' },
                'valid-unset.jpg'
            )

            const { status, body } = await request(app)
                .patch(`/images/${doc._id}`)
                .send({ $unset: { remove: '' } })

            expect(status).to.equal(200)
            expect(body.data).to.not.have.property('remove')
            expect(body.data.keep).to.equal('yes')
        })

        it('still accepts nested-object values in PATCH body (dot-notation behavior unchanged)', async () => {
            const doc = await insertImage({ x: '1' }, 'nested-patch.jpg')

            const { status, body } = await request(app)
                .patch(`/images/${doc._id}`)
                .send({ nested: { prop1: 'a', prop2: 'b' } })

            expect(status).to.equal(200)
            expect(body.data.nested.prop1).to.equal('a')
        })
    })

    describe('PATCH /images — bulk operator key rejection', () => {
        it('returns 400 when the bulk PATCH body contains a $-prefixed key', async () => {
            await insertImage({ x: '1' }, 'bulk-op.jpg')

            const { status } = await request(app)
                .patch(`/images?__test_marker=${TEST_RUN_ID}`)
                .send({ $inc: { x: 1 } })

            expect(status).to.equal(400)
        })
    })

    // -----------------------------------------------------------------------
    // Issue 3: coerce=true — opt-in type coercion for query-string values
    // -----------------------------------------------------------------------

    describe('GET /images — coerce=true type coercion', () => {
        beforeEach(async () => {
            // Insert via Image.create so numeric/boolean types are stored as-is
            const numDoc = await Image.create({
                file: `coerce-num-${TEST_RUN_ID}.jpg`,
                data: { score: 99, active: true, __test_marker: TEST_RUN_ID },
            })
            const strDoc = await Image.create({
                file: `coerce-str-${TEST_RUN_ID}.jpg`,
                data: {
                    score: '99',
                    active: 'false',
                    __test_marker: TEST_RUN_ID,
                },
            })
            createdIds.push(numDoc._id.toString(), strDoc._id.toString())
        })

        it('without coerce=true, score=99 matches only the string "99", not the number 99', async () => {
            const { status, body } = await request(app).get(
                `/images?score=99&__test_marker=${TEST_RUN_ID}`
            )
            expect(status).to.equal(200)
            // Only the string-stored doc matches
            expect(body.total).to.equal(1)
            expect(body.items[0].data.score).to.equal('99')
        })

        it('with coerce=true, score=99 matches the number 99 stored in MongoDB', async () => {
            const { status, body } = await request(app).get(
                `/images?score=99&__test_marker=${TEST_RUN_ID}&coerce=true`
            )
            expect(status).to.equal(200)
            // Only the number-stored doc matches
            expect(body.total).to.equal(1)
            expect(body.items[0].data.score).to.equal(99)
        })

        it('with coerce=true, active=true matches the boolean true stored in MongoDB', async () => {
            const { status, body } = await request(app).get(
                `/images?active=true&__test_marker=${TEST_RUN_ID}&coerce=true`
            )
            expect(status).to.equal(200)
            expect(body.total).to.equal(1)
            expect(body.items[0].data.active).to.equal(true)
        })

        it('with coerce=true, active=false matches the string "false", not the boolean false', async () => {
            // active=false: coerced to boolean false — matches the string-stored doc
            // that has active: 'false' only if 'false' === false, which it does not.
            // This test documents that coerce changes the filter value, not stored data.
            const { status, body } = await request(app).get(
                `/images?active=false&__test_marker=${TEST_RUN_ID}&coerce=true`
            )
            expect(status).to.equal(200)
            // boolean false does NOT equal string 'false' in MongoDB strict equality
            expect(body.total).to.equal(0)
        })

        it('with coerce=true, a plain string value is left as a string', async () => {
            await insertImage({ label: 'hello' }, `coerce-str2-${TEST_RUN_ID}.jpg`)

            const { status, body } = await request(app).get(
                `/images?label=hello&__test_marker=${TEST_RUN_ID}&coerce=true`
            )
            expect(status).to.equal(200)
            expect(body.total).to.equal(1)
            expect(body.items[0].data.label).to.equal('hello')
        })

        it('with coerce=true, a mixed alphanumeric string like "123abc" stays a string', async () => {
            await insertImage(
                { code: '123abc' },
                `coerce-alphanum-${TEST_RUN_ID}.jpg`
            )

            const { status, body } = await request(app).get(
                `/images?code=123abc&__test_marker=${TEST_RUN_ID}&coerce=true`
            )
            expect(status).to.equal(200)
            expect(body.total).to.equal(1)
            expect(body.items[0].data.code).to.equal('123abc')
        })
    })
})
