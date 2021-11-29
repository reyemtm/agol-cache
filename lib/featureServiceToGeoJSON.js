const fs = require('fs');
const spinner = require('ora')();
const env = require('dotenv').config().parsed;
const winston = require('winston');
const { Transform } = require('stream');

// if (fs.existsSync("agol-cache.log")) fs.unlinkSync("agol-cache.log")

/**
 * Winston Logger
 * I needed to implement logging as I have been running into timeout errors and am not sure why. 
 * This script runs unattended nightly and I need to see if it ran successfully, and if not view the errors.
 * Use debug: false to turn off all logging, however the spinner will still show up in the console
 */
const logger = winston.createLogger({
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.prettyPrint({
          colorize: true
        })
      ),
      silent: false,
      name: "console",
      level: "silly"
    }),
    new winston.transports.File({ 
      filename: 'agol-cache.log',
      level: "debug",
      name: "logfile",
      format: winston.format.combine(
        winston.format.printf(({level, message}) => {
          const date = new Date()
          return `${date.toISOString()} ${level}: ${message}`
        })
      )
    })
  ],
});

logger.on("error", (error) => {
  throw new Error("An eror has occurred with the winston logger.", error);
});

/**
 * fetch with fetch-retry for fixing an error where fetch will not exit
 * attempts set globally, timeouts are set at 5 seconds on each fetch call
 */
const _fetch = require("node-fetch");
const fetch = require("fetch-retry")(_fetch, {
  retryOn: function (attempt, error, response) {
    if (attempt < 5 && error) {
      spinner.text = `Retry attempt ${attempt + 1}`;
      logger.error(`Retry attempt ${attempt + 1} ${JSON.stringify(error)}`)
      return true
    }
    return false
  }
});

/**
 * 
 * @param {string} featureServiceUrl 
 * @param {object} options 
 * @param {function} callback 
 */
async function featureServiceToGeoJSON(featureServiceUrl, options, callback) {
  if (featureServiceUrl.charAt(featureServiceUrl.length-1) != "/") featureServiceUrl = featureServiceUrl + "/";

  const featureServer = (!featureServiceUrl.includes("MapServer") && featureServiceUrl.includes("FeatureServer")) ? true : false;
  const mapServer = (featureServiceUrl.includes("MapServer") && !featureServiceUrl.includes("FeatureServer")) ? true : false;

  if (!mapServer && !featureServer) {
    throw new Error("Error, this script only works with FeatureServer and MapServer services");
  }

  const config = {
    attachments: (!options || !options.attachments) ? false : true, //wheher or not to check the service for attachments, overridden by leaving esriIdField blank
    debug: (!options || options.debug) ? true : false, //debugging is now on be default, which just means it writes to a log file, and the console if silent is set to false 
    esriIdField: (!options || !options.esriIdField) ? false : options.esriIdField, //field to use for the esriIdField, used in the query parameters
    filter: (!options || !options.filter) ? false : options.filter, //string to filter layer names
    folder: (!options || !options.folder) ? "geojson-cache" : options.folder, //folder to write the log file and geojson cache, relative to working directory or absolute path
    layerByLayer: (!options || !options.layerByLayer) ? false : true, //use await on each layer, helpful for debugging
    prefix: (!options || !options.prefix) ? "" : options.prefix, //prefix to add to the start of layer names
    silent: (options && options.silent) ? true : (options && !options.silent) ? false : true, //turn off viewing log messages in the console, disabled if debug is set to false, however spinner is always on
    token: (env && env.TOKEN) ? env.TOKEN : null, //token to use for secured routes,
    pretty: (!options || !options.pretty) ? false : true, //if true, the JSON output file will be formatted for human reading
  }

  /**
   * Set the silent option on the console logger
   */
  logger.transports.forEach(transport => {
    if (transport.name && transport.name === "console") transport.silent = config.silent;
    if (transport.name && transport.name === "logfile") transport.silent = !config.debug;
  });

  if (config.debug) {
    logger.info("---------// agol-cache log //---------")
  }

  spinner.start("Processing")

  /**
   * Not using path.join here, so the folder path has to be absolute or relative to the working directory
   */
  if (!fs.existsSync(config.folder)) fs.mkdirSync(config.folder)

  const service = await getFeatureService(featureServiceUrl, config);

  if (service.error) {
    let msg = "Could not find feature service definition!"
    spinner.fail(msg)
    if (config.debug) logger.error(service.error);
    process.exit()
  }

  const layers = getLayers(service);

  if (config.debug) {
    spinner.stop() 
    logger.silly(layers);
    spinner.start()
  }

  let total = layers.length

  if (!total) {
    spinner.fail("Fatal error, no layers found!");
    if (config.debug) logger.error("Fatal error,  no layers found.");
    process.exit()
  }

  if (options.layerByLayer) {

    //layer by layer method, slower by could be useful for tracking down timeout errors
    for (let i = 0; i < layers.length; i++) {
      let l = layers[i];

      if (config.filter) {
        if (!l.name.includes(config.filter)) {
          total = total - 1;
          continue
        }
      }
      try {
        spinner.text = "Processing: " + l.name
        await getFeatures(`${featureServiceUrl}${l.id}/`, l.name, config, l.id);
        total = total - 1;
        if (!total) {
          if (callback && isFunction(callback)) {
            spinner.stop()
            callback(layers)
          }else{
            throw new Error({Error: "callback is not a function"});
          }
        }
      }catch(error) {
        spinner.fail("Error on " + l.name);
        spinner.start("Processing");
        if (config.debug) logger.error(error.toString());
        total = total - 1;
        if (!total) {
          if (callback && isFunction(callback)) {
            spinner.stop()
            callback(layers)
          }else{
            throw new Error({Error: "callback is not a function"});
          }
        }
        continue
      }
    }
  }else{
    layers.forEach(async l => {
      if (config.filter) {
        if (!l.name.includes(config.filter)) {
          total = total - 1;
          return
        }
      }
      try {
        spinner.text = "Processing";
        await getFeatures(`${featureServiceUrl}${l.id}/`, l.name, config, l.id);
        total = total - 1;
        if (!total) {
          spinner.stop();
          if (callback && isFunction(callback)) {
            callback(layers)
          }else{
            throw new Error({Error: "callback is not a function"});
          }
        }
      }catch(error) {
        spinner.fail("Error on Layer " + total.toString());
        spinner.start("Processing")
        if (config.debug) logger.error(error.toString());
        total = total - 1;
        if (!total) {
          spinner.stop();
          if (callback && isFunction(callback)) {
            callback(layers)
          }else{
            throw new Error({Error: "callback is not a function"});
          }
        }
      }
    })
  }
}

async function getFeatureService(serviceURL, opts) {
  const url = (opts && opts.token) ? serviceURL + "/?token=" + opts.token + "&f=json" : serviceURL + "?f=json";
  // console.log(url)
  try {
    const res = await fetch(url, {
      timeout: 5000
    });
    return await res.json();
  }
  catch(error) {
    error["function"] = "getFeatureService"
    if (opts.debug) logger.error(error.toString())
    return false
  }
}

function getLayers(serviceDefinition) {
  let layers = [];

  if (!serviceDefinition.layers || !serviceDefinition.layers.length) return layers

  serviceDefinition.layers.forEach(l => {
    if (!l.subLayerIds) {
      layers.push({
        id: l.id,
        name: convertName(l.name)
      })
    }
  })
  return layers;
}

function convertName(name) {
  return name.toLowerCase().replace(/ /g, '_').replace(/-/g, '_')
}

/**
 * Returns a Node.js stream that can be fed in JSON objects and
 * will stringify them as output.
 * @param {Object} options - Configuration for the stream processing.
 * @param {function} options.warnFn - called when an object is not stringify-able JSON.
 * @param {string} [options.beforeAll] - string to add at the start of the file.
 * @param {string} [options.afterAll] - string to add at the end of the file.
 * @param {string} [options.separator=\n] - string after each JSON, defaults to newline.
 * @param {number|string} [options.indent=0] - number of spaces or text before each JSON line.
 * @returns {Transform} A Transform stream.
 */
function createJsonStream(options) {
  const beforeAll = options.beforeAll || ''
  const afterAll = options.afterAll || ''
  const separator = options.separator || '\n'
  const indent = options.indent || 0

  let inFeatures = 0
  let outFeatures = 0

  const stream = new Transform({
    writableObjectMode: true,  // takes in objects...
    readableObjectMode: false, // ...and outputs strings.

    transform(chunk, _, callback) {
      inFeatures += 1;
      var json;
      try {
        json = JSON.stringify(chunk, null, indent)
      } catch (err) {
        if (options.warnFn) {
          options.warnFn(err, inFeatures, chunk);
        }
        callback();
        return;
      }
      if (!outFeatures) {
        this.push(beforeAll + json)
      }
      else {
        this.push(separator + json)
      }
      outFeatures += 1;
      callback();
    },

    // end of JSON input
    flush(callback) {
      if(outFeatures === 0) {
        this.push(open + afterAll);
      } else {
        this.push(afterAll);
      }
      callback();
    }

  });

  return stream;
}

async function getFeatures(layerUrl, layerName, opts, id) {
  let idFieldObject = [];
  let completed = false
  let hasErrors = false
  let nbrFeatures = 0;

  const jsonStart = `{"type": "FeatureCollection", "agolLayerId": ${id}, "features": [`;

  const filename = `${opts.prefix}${layerName}`;
  const filepath = `${opts.folder}/${filename}.geojson`;
  const outputStream = fs.createWriteStream(filepath);

  // features go to jsonInStream with .write and are piped to outputStream
  const jsonInStream = createJsonStream({
    beforeAll: opts.pretty ? jsonStart : jsonStart.replace(/ /g, ''),
    afterAll: opts.pretty ? '\n]}' : ']}',
    separator: opts.pretty ? ',\n' : ',',
    indent: opts.pretty ? 2 : 0,
    warnFn: (err, row, jsonObject) => {
      if (opts.debug) logger.warn(`record ${row} of ${layerName} is invalid.`);
      hasErrors = true;
    }
  });
  jsonInStream.pipe(outputStream);
  jsonInStream.on('error', (error) => {
    hasErrors = true
    if (opts.debug) logger.error(error.toString())
  });

  var writeDonePromise = new Promise((resolve, reject) => {
    outputStream.on('finish', resolve);
    outputStream.on('error', reject);
  });

  // let getAttachments = opts.attachments;
  if (!opts.esriIdField || opts.hasAttachments) {
    try {

      const res = await fetch(`${layerUrl}?f=pjson&token=${(opts.token) ? `${opts.token}` : ""}`, {
        timeout: 5000
      });
      const queryRes = await res.json();

      if (!queryRes || !queryRes.fields || !queryRes.fields.length) {
        spinner.warn(`No fields found when querying layer.`);
        if (opts.debug) logger.error("No fields found when querying layer.")
        spinner.start("Processing")
      }

      if (!queryRes.hasAttachments) {
        getAttachments = false
      }

      idFieldObject = queryRes.fields.filter(f => {
        return f.type === "esriFieldTypeOID"
      })

      if (!idFieldObject.length) {
        spinner.warn("No esriFieldTypeOID field found!")
        if (opts.debug) logger.error("No esriFieldTypeOID field found!")
        spinner.start("Processing")
      }
    }catch(error) {
      if (opts.debug) logger.error(error.toString())
    }
  }

  const idField = (!opts.esriIdField) ? idFieldObject[0].name.toLowerCase() : opts.esriIdField;

  const max = 999;

  const ids = {
    start: 0,
    end: max
  }

  while (!completed) {
    let geojson = {};
    try {
      geojson = await queryAGOL(layerUrl, idField, ids.start, ids.end, opts, layerName);
      if (geojson.error) {
        completed = true
      }
      if (!geojson || !geojson.features || !geojson.features.length) {
        completed = true;
      } else {
        geojson.features.forEach(f => {
          jsonInStream.write(f);
          nbrFeatures = nbrFeatures + 1;
        });
        spinner.text = `Processing ${nbrFeatures} features`;
      }

      ids.start = ids.start + max + 1;
      ids.end = ids.end + max + 1;
    }
    catch(error) {
      if (opts.debug) logger.error(error.toString())
      hasErrors = true
      completed = true
    }
  }
  jsonInStream.end(); // signal no more data
  try {
    await writeDonePromise; // and wait for everything to finish
  } catch (error) {
    hasErrors = true
    if (opts.debug) logger.error(error.toString())
  }

  if (hasErrors) {
    spinner.warn(`Warning! ${nbrFeatures} features found, there were errors with ${filename}`);
    if (opts.debug) logger.error(`Warning! ${nbrFeatures} features found, there were errors with ${filename}`)
  } else{
    spinner.succeed(`Success! Wrote ${nbrFeatures} features to ${filename}.geojson`);
    if (opts.debug) logger.debug(`Success! Wrote ${nbrFeatures} features to ${filename}.geojson`)
  }
  spinner.start("Processing");
}

async function queryAGOL(url, idField, start, end, opts, layerName) {
  const query = `${url}query?where=${idField}+between+${start}+and+${end}&outFields=*&f=geojson&token=${(opts.token) ? `${opts.token}` : ""}`;

  let data = {};
  try {
    const res = await fetch(query, {
      timeout: 5000,
    });
    data = await res.json();
    return data
  }
  catch(error) {
    if (opts.debug) logger.error(error.toString());
    data["error"] = true
    return data
  }
}

/*stack overflow https://stackoverflow.com/questions/5999998/check-if-a-variable-is-of-function-type*/
function isFunction(fn) {
  return fn && {}.toString.call(fn) === '[object Function]';
}

module.exports = {
  featureServiceToGeoJSON,
  getFeatureService,
  getLayers
}