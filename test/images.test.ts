import request from 'supertest'
import { expect } from 'chai'
import { app } from '../index'
import { get_connected } from '../db'
import { describe, it } from 'mocha'

const { S3_BUCKET } = process.env

let image_id: string, field_name: string

const waitForDB = () =>
    new Promise((resolve) => {
        while (!get_connected()) {
            // Do nothing
        }
        resolve(null)
    })

describe('/images', () => {
    before(async () => {
        // Silencing console (not working)
        // console.log = () => {}
        // await waitForDB()
    })

    describe('POST /images', () => {
        it('Should allow posting an image with plain fields', async () => {
            const { status, body } = await request(app)
                .post('/images')
                .field('key1', 'value1')
                .field('key2', 'value2')
                .field('key3', 'value3')
                .attach('image', 'test/sample.jpg')

            image_id = body._id

            expect(status).to.equal(200)
            expect(body.data.key1).to.equal('value1')
        })

        it('Should allow posting an image with a user specified filename', async () => {
            const { status, body } = await request(app)
                .post('/images')
                .field('file', `myFolder/myImage.jpg`)
                .field('key3', 'value3')
                .attach('image', 'test/sample.jpg')

            expect(status).to.equal(200)
            expect(body.file).to.equal(`myFolder/myImage.jpg`)
        })

        it('Should allow posting an image with nested fields', async () => {
            const jsonData = {
                parentKey: {
                    nestedKey1: 'nestedValue1',
                    nestedKey2: 'nestedValue1',
                },
            }

            const { status, body } = await request(app)
                .post('/images')
                .field('json', JSON.stringify(jsonData))
                .attach('image', 'test/sample2.jpg')

            expect(status).to.equal(200)
            expect(body.data.parentKey.nestedKey1).to.equal('nestedValue1')
        })

        it('Should Not allow posting images without an image field', async () => {
            const { status } = await request(app).post('/images')
            expect(status).to.not.equal(200)
        })
    })

    describe('GET /images', () => {
        it('Should return all images', async () => {
            const { status, body } = await request(app).get('/images')
            expect(status).to.equal(200)
            expect(body.total).to.equal(3)
        })

        it('Should allow querying images with list of IDs', async () => {
            const { status, body } = await request(app).get(
                `/images?ids=${image_id}`
            )
            expect(status).to.equal(200)
            expect(body.total).to.equal(1)
        })

        it('Should allow querying images with basic filters', async () => {
            const { status, body } = await request(app).get(
                '/images?key3=value3'
            )
            expect(status).to.equal(200)
            expect(body.total).to.equal(2)
        })

        it('Should allow not find images that do not match filters', async () => {
            const { status, body } = await request(app).get(
                '/images?key1=value2'
            )
            expect(status).to.equal(200)
            expect(body.total).to.equal(0)
        })

        it('Should allow querying JSON filter', async () => {
            const { status, body } = await request(app).get(
                `/images?filter={"data.key2":{"$ne":null}}`
            )
            expect(status).to.equal(200)
            expect(body.total).to.equal(1)
        })
    })

    describe('GET /images/:id', () => {
        it('Should query the image uploaded previously', async () => {
            const { status, body } = await request(app).get(
                `/images/${image_id}`
            )
            expect(status).to.equal(200)
            expect(body.data.key1).to.equal('value1')
        })
    })

    describe('GET /images/:id/image', () => {
        it('Should download the image uploaded previously', async () => {
            const { status, headers } = await request(app).get(
                `/images/${image_id}/image`
            )
            expect(status).to.equal(200)
        })
    })

    describe('GET /fields', () => {
        it('Should allow the query of fields', async () => {
            const { status, body } = await request(app).get(`/fields`)
            // Pick a random field name, for testing
            field_name = body[0]
            expect(status).to.equal(200)
        })
    })

    describe('GET /fields/:field', () => {
        it('Should allow the query of a single field', async () => {
            const { status } = await request(app).get(`/fields/${field_name}`)
            expect(status).to.equal(200)
        })
    })

    describe('PATCH /images/', () => {
        it('Should allow the metadata update of all images', async () => {
            const properties = { commonKey: 'commonValue' }
            const { status } = await request(app)
                .patch(`/images`)
                .send(properties)

            expect(status).to.equal(200)
        })

        it('Should allow the metadata update images matching a specific filter', async () => {
            const properties = { sharedKey: 'sharedValue' }
            const { status, body } = await request(app)
                .patch(`/images?key1=value1`)
                .send(properties)

            expect(status).to.equal(200)
            expect(body.modifiedCount).to.equal(1)
        })
    })

    describe('PATCH /images/:id', () => {
        it('Should allow adding a field to an image metadata', async () => {
            const properties = { newField: 'newValue' }
            const { status, body } = await request(app)
                .patch(`/images/${image_id}`)
                .send(properties)

            expect(status).to.equal(200)
            expect(body.data.key1).to.equal('value1')
            expect(body.data.newField).to.equal('newValue')
            expect(body.data.commonKey).to.equal('commonValue')
        })

        it('Should allow the editing of a field to an image metadata', async () => {
            const properties = { newField: 'newValueEdited' }
            const { status, body } = await request(app)
                .patch(`/images/${image_id}`)
                .send(properties)

            expect(status).to.equal(200)
            expect(body.data.key1).to.equal('value1')
            expect(body.data.newField).to.equal('newValueEdited')
            expect(body.data.commonKey).to.equal('commonValue')
        })
    })

    describe('GET /export', () => {
        it('Should allow the export of data', async () => {
            const { status } = await request(app).get(`/export`)
            expect(status).to.equal(200)
        })
    })

    describe('POST /import', () => {
        it('Should allow the import of data', async () => {
            const { status } = await request(app)
                .post(`/import`)
                .attach('archive', 'test/export.zip')

            expect(status).to.equal(200)
        })
    })

    describe('DELETE /images/:id', () => {
        it('Should allow deleting the image uploaded previously', async () => {
            const { status } = await request(app).delete(`/images/${image_id}`)
            expect(status).to.equal(200)
        })
    })

    describe('DELETE /images/', () => {
        it('Should allow deleting images matching a specific filter', async () => {
            const { status, body } = await request(app).delete(
                `/images?key3=value3`
            )
            expect(status).to.equal(200)
            expect(body.deletedCount).to.equal(1)
        })

        it('Should allow deleting all images ', async () => {
            const { status } = await request(app).delete(`/images`)
            expect(status).to.equal(200)
        })
    })
})
