const request = require("supertest")
const {expect} = require("chai")
const {app} = require("../main.js")

const collection = 'tdd'

describe("/collections/:collection/images", () => {

  let image_id

  before( async () => {
    // Silencing console
    //console.log = () => {}
  })

  describe("POST /collections/:collection/images", () => {

    it("Should allow posting an image", async () => {
      const {status, body} = await request(app)
        .post(`/collections/${collection}/images`)
        .attach('image', 'test/example.jpg')

      image_id = body._id

      expect(status).to.equal(200)
    })

    it("Should Not allow posting images without an image field", async () => {
      const {status} = await request(app)
        .post(`/collections/${collection}/images`)

      expect(status).to.not.equal(200)
    })
  })

  describe("GET /collections/", () => {
    it("Should return all collections", async () => {
      const {status, body} = await request(app)
        .get(`/collections`)

      expect(status).to.equal(200)
      expect(body).to.have.lengthOf.above(0)
    })
  })

  describe("GET /collections/:collection", () => {
    it("Should return a collection info", async () => {
      const {status, body} = await request(app)
        .get(`/collections/${collection}`)

      expect(status).to.equal(200)
    })
  })

  describe("GET /collections/:collection/images", () => {
    it("Should return all images in a collection", async () => {
      const {status, body} = await request(app)
        .get(`/collections/${collection}/images`)

      expect(status).to.equal(200)
      expect(body).to.have.lengthOf.above(0)
    })
  })

  describe("GET /collections/:collection/images/:image_id", () => {
    it("Should allow the query of a single image", async () => {
      const {status, body} = await request(app)
        .get(`/collections/${collection}/images/${image_id}`)

      expect(status).to.equal(200)
    })
  })

  describe("DELETE /collections/:collection/images/:image_id", () => {

    it("Should allow deleting an image", async () => {
      const {status, body} = await request(app)
        .delete(`/collections/${collection}/images/${image_id}`)

      expect(status).to.equal(200)
    })
  })

  describe("DELETE /collections/:collection", () => {

    it("Should allow deleting a collection", async () => {
      const {status, body} = await request(app)
        .delete(`/collections/${collection}`)

      expect(status).to.equal(200)
    })
  })


})
