const request = require("supertest")
const { expect } = require("chai")
const { app } = require("../index.js")
const { get_connected } = require("../db")

const waitForDB = () =>
  new Promise((resolve) => {
    while (!get_connected()) {
      // Do nothing
    }
    resolve()
  })

describe("/images", () => {
  let image_id, field_name

  before(async () => {
    // Silencing console (not working)
    // console.log = () => {}
    // await waitForDB()
  })

  describe("POST /images", () => {
    it("Should allow posting an image", async () => {
      const { status, body } = await request(app)
        .post("/images")
        .field("test_key", "test_value")
        .attach("image", "test/sample.jpg")

      image_id = body._id

      expect(status).to.equal(200)
    })

    it("Should Not allow posting images without an image field", async () => {
      const { status } = await request(app).post("/images")
      expect(status).to.not.equal(200)
    })
  })

  describe("GET /images", () => {
    it("Should return all images", async () => {
      const { status } = await request(app).get("/images")
      expect(status).to.equal(200)
    })

    it("Should allow querying using filters", async () => {
      const { status } = await request(app).get("/images?test_key=test_value")
      expect(status).to.equal(200)
    })
  })

  describe("GET /images/:id", () => {
    it("Should query the image uploaded previously", async () => {
      const { status } = await request(app).get(`/images/${image_id}`)
      expect(status).to.equal(200)
    })
  })

  describe("GET /images/:id/image", () => {
    it("Should download the image uploaded previously", async () => {
      const { status } = await request(app).get(`/images/${image_id}/image`)
      expect(status).to.equal(200)
    })
  })

  describe("GET /fields", () => {
    it("Should allow the query of fields", async () => {
      const { status, body } = await request(app).get(`/fields`)
      expect(status).to.equal(200)
      field_name = body[0]
    })
  })

  describe("GET /fields/:field", () => {
    it("Should allow the query of a single field", async () => {
      const { status } = await request(app).get(`/fields/${field_name}`)
      expect(status).to.equal(200)
    })
  })

  describe("PATCH /images/:id", () => {
    it("Should allow the update of an image metadata", async () => {
      const properties = { newField: "test" }
      const { status, body } = await request(app)
        .patch(`/images/${image_id}`)
        .send(properties)

      expect(status).to.equal(200)
      expect(body.data.newField).to.equal("test")
    })
  })

  describe("GET /export", () => {
    it("Should allow the export of data", async () => {
      const { status } = await request(app).get(`/export`)
      expect(status).to.equal(200)
    })
  })

  describe("POST /import", () => {
    it("Should allow the import of data", async () => {
      const { status } = await request(app)
        .post(`/import`)
        .attach("archive", "test/export.zip")

      expect(status).to.equal(200)
    })
  })

  describe("DELETE /images/:id", () => {
    it("Should allow deleting the image uploaded previously", async () => {
      const { status } = await request(app).delete(`/images/${image_id}`)
      expect(status).to.equal(200)
    })
  })
})
