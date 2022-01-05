const { getFeatureService, logger } = require("./featureServiceToGeoJSON.js");
const spinner = require('ora')();
const fs = require("fs")

spinner.start()

// if (fs.existsSync("./agol-cache.log")) fs.unlinkSync("./agol-cache.log")

const toCSV = (fields, rows) => {
  let csv = "";
  
  fields.forEach((f,i) => {
    const splitter = (i === (fields.length -1)) ? "\n": ","
    csv += f + splitter
  });

  rows.forEach(r => {
    for (let v in r) {
      const row = (v === fields[fields.length-1]) ? "\n" : "," 
      csv += r[v] + row
    }
  })
  return csv
}

const getAllServices = async (url, opts) => {

  logger.transports.forEach(transport => {
    if (transport.name && transport.name === "console") transport.silent = opts.silent;
    if (transport.name && transport.name === "logfile") transport.silent = !opts.debug;
  });
  
  if (opts.debug) {
    logger.info("---------// agol-cache log //---------")
    logger.info(JSON.stringify(opts))
  }

  try {
    spinner.info("Using REST Endpoint: " + url)
    spinner.start();
    const services = [];
    const service = await getFeatureService(url, opts);

    if (service.error) throw new Error(service.error.message)
    
    spinner.succeed("Received services config");
    if (opts.debug) logger.info("Received services from " + url)
    
    spinner.start();

    if (service.services) {
      service.services.forEach(s => {
        s["folder"] = "root";
        s["url"] = url + "/" + s.name + "/" + s.type
        services.push(s)
      })
    }

    if (service.folders) {
      if (opts.debug) logger.info("Found subfolders...processing.")
      spinner.info("Processing service subfolders")
      spinner.start();
      const folders = [];
      service.folders.forEach(f => folders.push(url + "/" + f));
      for (let i in folders) {
        const subservice = await getFeatureService(folders[i], opts);
        subservice.services.forEach(s => {
          s["folder"] = s.name.split("/")[0];
          s["url"] = url + "/" + s.name + "/" + s.type
          services.push(s)
        })
      }
    }

    fs.writeFileSync("./agol-services.json", JSON.stringify(services,0,2));
    fs.writeFileSync("./agol-services.csv", toCSV(["name", "type", "folder", "url"], services), "utf8");

    if (opts.debug) logger.info("Completed. Wrote services to JSON and CSV.")
    spinner.succeed("Completed!")
  }catch(err) {
    spinner.fail(err.toString())
    if (opts.debug) logger.error(err.toString())
  }
}

module.exports = {
  getAllServices
}