const archiver = require("archiver") // NOTE: Archiver is advertized as having a low memory footprint
const Image = require("../models/image.js")
const path = require("path")
const fs = require("fs")
const XLSX = require("xlsx")
const { v4: uuidv4 } = require("uuid")
const { parse_query, remove_file } = require("../utils.js")
const {
  directories,
  mongodb_export_file_name,
  export_excel_file_name,
} = require("../config.js")

const generate_excel = (data, path) => {
  const formatted_data = data.map((item) => {
    // Convert nested data properties

    // Important: create a copy so as to not affect original data
    const { data, ...baseMetaData } = item

    const output = {
      ...baseMetaData,
      _id: baseMetaData._id.toString(),
    }

    // Remove unused properties
    delete output.data

    for (let key in data) {
      if (data[key]) output[key] = data[key].toString()
    }

    return output
  })

  const workbook = XLSX.utils.book_new()
  const worksheet = XLSX.utils.json_to_sheet(formatted_data)
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1")
  XLSX.writeFile(workbook, path)
}

const generate_json = (data, path) => {
  fs.writeFileSync(path, JSON.stringify(data))
}

exports.export_images = async (req, res) => {
  // Making zip name unique so as to allow parallel exports
  const export_id = uuidv4()

  // Create temp directory if it does not exist
  if (!fs.existsSync(directories.temp)) fs.mkdirSync(directories.temp)

  // TODO: Store everything in a dedicated directory
  const temp_zip_path = path.join(directories.temp, `${export_id}.zip`)
  const json_file_path = path.join(directories.temp, `${export_id}.json`)
  const excel_file_path = path.join(directories.temp, `${export_id}.xlsx`)

  // Limiting here because parse_query also used in images controller
  const { query, sort, order, limit = 0, skip } = parse_query(req.query)

  // const images = await Image.find({})
  const images = await Image.find(query)
    .sort({ [sort]: order })
    .skip(Number(skip))
    .limit(Math.max(Number(limit), 0))

  const images_json = images.map((i) => i.toJSON())

  generate_excel(images_json, excel_file_path)
  generate_json(images_json, json_file_path)

  const output = fs.createWriteStream(temp_zip_path)
  const archiver_options = { zlib: { level: 9 } }
  const archive = archiver("zip", archiver_options)

  // TODO: use async await
  output.on("close", async () => {
    res.download(temp_zip_path)

    // Cleanup of generated files
    await remove_file(excel_file_path)
    await remove_file(json_file_path)
    await remove_file(temp_zip_path)

    console.log(`[Export] Images exported`)
  })

  // This event is fired when the data source is drained no matter what was the data source.
  // It is not part of this library but rather from the NodeJS Stream API.
  // @see: https://nodejs.org/api/stream.html#stream_event_end
  output.on("end", function () {
    console.log("[Export] Data has been drained")
  })

  // good practice to catch warnings (ie stat failures and other non-blocking errors)
  archive.on("warning", function (err) {
    if (err.code === "ENOENT") {
      // log warning
      console.log(err)
    } else throw err
  })

  // good practice to catch this error explicitly
  archive.on("error", function (err) {
    throw err
  })

  console.log(`[Export] Exporting started`)

  archive.pipe(output)
  // Adding files one by one instead of whole folder because query parameters might be used as filters
  images.forEach(({ file }) =>
    archive.file(path.join(directories.uploads, file), { name: file })
  )

  // Adding excel and json files
  archive.file(json_file_path, { name: mongodb_export_file_name })
  archive.file(excel_file_path, { name: export_excel_file_name })

  archive.finalize()
}
