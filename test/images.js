const request = require("supertest")
const {expect} = require("chai")
const {app} = require("../index.js")


describe("/images", () => {

  let image_id

  beforeEach( async () => {
    // Silencing console
    // console.log = () => {}
  })


  describe("GET /", () => {
    it("Should return all images", async () => {
      const {status} = await request(app)
        .get("/images")

      expect(status).to.equal(200)
    })
  })

  describe("POST /", () => {
    
    it("Should allow posting an image", async () => {
      const {status, body} = await request(app)
        .post("/images")
        .attach('image', 'test/example.jpg')
      
      image_id = body._id

      expect(status).to.equal(200)
    })

    it("Should Not allow posting images without an image field", async () => {
      const {status} = await request(app)
        .post("/images")

      expect(status).to.not.equal(200)
    })

    

  })

  describe("DELETE /", () => {
    
    it("Should allow deleting an image", async () => {
      const {status, body} = await request(app)
        .delete(`/images/${image_id}`)
      
      expect(status).to.equal(200)
    })
    

  })


})
