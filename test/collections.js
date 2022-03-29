const request = require("supertest")
const {expect} = require("chai")
const {app} = require("../main.js")

const collection = 'tdd'

describe("/collections/", () => {

  before( async () => {
    // Silencing console
    //console.log = () => {}
  })

  describe("POST /collections/:collection/import", () => {

    it("Should allow importing a collection", async () => {
      const {status} = await request(app)
        .post(`/collections/${collection}/import`)
        .attach('archive', 'test/example_export.zip', { contentType: 'application/x-zip-compressed' })

      expect(status).to.equal(200)
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

  describe("GET /collections/:collection/export", () => {
    it("Should allowthe export of a collection", async () => {
      const {status} = await request(app)
        .get(`/collections/${collection}/export`)

      expect(status).to.equal(200)
    })
  })


  describe("DELETE /collections/:collection", () => {

    it("Should allow deleting a collection", async () => {
      const {status} = await request(app)
        .delete(`/collections/${collection}`)

      expect(status).to.equal(200)
    })
  })




})
