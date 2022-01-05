const { getAllServices } = require("./lib/getAllServices.js")

const config =   {
  debug: true,
  silent: true,
  timeout: 5000,
  token: ''
};

getAllServices('https://sampleserver6.arcgisonline.com/arcgis/rest/services', config)