const request = require("supertest")
const {expect} = require("chai")
const {app} = require("../index.js")


describe("/images", () => {

  let image_id

  before( async () => {
    // Silencing console
    console.log = () => {}
  })


  

  describe("POST /images", () => {
    
    it("Should allow posting an image", async () => {
      const {status, body} = await request(app)
        .post("/images")
        .attach('image', 'test/example.jpg')
      
      image_id = body._id

      expect(status).to.equal(200)
    })

    it("Should Not allow posting images without an image field", async () => {
      const {status} = await request(app).post("/images")
      expect(status).to.not.equal(200)
    })

  })

  describe("GET /images", () => {
    it("Should return all images", async () => {
      const { status } = await request(app).get("/images")
      expect(status).to.equal(200)
    })
  })

  describe("GET /images/:id", () => {
    it("Should query the image uploaded previously", async () => {
      const { status } = await request(app).get(`/images/${image_id}`)
      expect(status).to.equal(200)
    })
  })


  describe("DELETE /images/:id", () => {
    
    it("Should allow deleting the image uploaded previosuly", async () => {
      const {status, body} = await request(app).delete(`/images/${image_id}`)
      expect(status).to.equal(200)
    })
    
  })


})
