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
 * Use debug: false and silent to turn off all logging and messages, however the spinner warning and successthey  will still show up in the console
 */
const logger = winston.createLogger({
  transports: [
    new winston.transports.Console({
      // format: winston.format.printf(log => log.message),
      format: winston.format.combine(
        winston.format.prettyPrint({
          colorize: true
        })
      ),
      silent: false,
      name: "console",
      level: "silly",
      json: true,
      timestamp: true,
      showLevel: false
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
const fetch = require("fetch-retry")(require("node-fetch"), {
  retryOn: function (attempt, error, response) {
    if (attempt < 10 && error) {
      spinner.fail("Failed to fetch.");
      spinner.start()
      spinner.warn("Retry attempt " + (attempt + 1))
      logger.warn(`Retry attempt ${attempt + 1} ${JSON.stringify(error)}`)
      spinner.start()
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
    attachments: (!options || !options.attachments) ? false : true, //whether or not to check the service for attachments, overridden by leaving esriIdField blank
    debug: (!options || options.debug) ? true : false, //debugging is now on be default, which just means it writes to a log file, and the console if silent is set to false 
    esriIdField: (!options || !options.esriIdField) ? false : options.esriIdField, //field to use for the esriIdField, used in the query parameters
    filter: (!options || !options.filter) ? false : options.filter, //string to filter layer names
    folder: (!options || !options.folder) ? "geojson-cache" : options.folder, //folder to write the log file and geojson cache, relative to working directory or absolute path
    layerByLayer: (!options || !options.layerByLayer) ? false : true, //use await on each layer, helpful for debugging
    prefix: (!options || !options.prefix) ? "" : options.prefix, //prefix to add to the start of layer names
    silent: (options && options.silent) ? true : (options && !options.silent) ? false : true, //turn off viewing log messages in the console, disabled if debug is set to false, however spinner is always on
    token: (env && env.TOKEN) ? env.TOKEN : null, //token to use for secured routes,
    pretty: (!options || !options.pretty) ? false : true, //if true, the JSON output file will be formatted for human reading
    timeout: (options && options.timeout) ? options.timeout: 5000, //fetch timeout, increase as needed
    format: (options && options.format && (["json","geojson"].includes(options.format.toLowerCase()))) ? options.format.toLowerCase() : "geojson"
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
    logger.info(JSON.stringify(config))
  }

  spinner.start()

  /**
   * Not using path.join here, so the folder path has to be absolute or relative to the working directory
   */
  if (!fs.existsSync(config.folder)) fs.mkdirSync(config.folder)

  if (!config.silent) spinner.info("Service URL: " + featureServiceUrl).start()

  const service = await getFeatureService(featureServiceUrl, config);

  if (service.error) {
    let msg = "Could not find feature service definition!"
    spinner.fail(msg)
    logger.error(service.error);
    process.exit(0)
  }

  const layers = getLayers(service);

  if (config.debug) {
    spinner.stop() 
    logger.silly(layers);
    spinner.start()
  }

  const asyncHandleLayers = async () => {
    let total = layers.length - 1

    if (!total) {
      spinner.fail("Fatal error, no layers found!");
      logger.error("Fatal error,  no layers found.");
      reject("Fatal error,  no layers found.")
      process.exit(0)
    }
  
    if (!config.silent) spinner.info("Layers found: " + layers.length).start()
  
    /*-------------*/
    //LAYER BY LAYER
    /*-------------*/
    if (options.layerByLayer) {
  
      for (let i = 0; i < layers.length; i++) {
        let l = layers[i];
        if (config.debug) logger.info("total " + total)
        if (config.debug) logger.info(l.name)
        if (config.filter) {
          if (!l.name.includes(config.filter)) {
            total = total - 1;
            continue
          }
        }
        try {
          if (!config.silent) spinner.start("Querying: " + l.name);
          if (config.debug) logger.info("total " + total)
          await getFeatures(`${featureServiceUrl}${l.id}/`, l.name, config, l.id, l.geometryType, l.renderer);
          total = total - 1;
          if (!total) {
            spinner.stop()
            if (callback) {
              if (isFunction(callback)) {
                callback(layers)
              }else{
                throw new Error({Error: "callback is not a function"})
              }
            }else{
              console.log("Complete - No callback")
            }
          }
        }catch(error) {
          spinner.fail("Error");
          logger.error(error.toString());
          if (!config.silent) spinner.start("Querying" + l.name);
          total = total - 1;
          if (!total) {
            spinner.stop()
            if (callback) {
              if (isFunction(callback)) {
                callback(layers)
              }else{
                throw new Error({Error: "callback is not a function"})
              }
            }else{
              console.log("Complete - No callback")
            }
          }
          continue
        }
      }
      return {layers: layers}
    }
    /*-------------*/
    //LAYERS FOR EACH
    /*-------------*/
    else {
      layers.forEach(async l => {
        if (config.filter) {
          if (!l.name.includes(config.filter)) {
            total = total - 1;
            return
          }
        }
        try {
          if (!config.silent) spinner.start("Querying " + l.name);
  
          await getFeatures(`${featureServiceUrl}${l.id}/`, l.name, config, l.id, l.geometryType, l.renderer);
          total = total - 1;
          if (!total) {
            spinner.stop();
            if (callback) {
              if (isFunction(callback)) {
                callback(layers)
              }else{
                spinner.fail()
                throw new Error({Error: "callback is not a function"})
              }
            }else{
              spinner.stop()
              console.log("Complete - No callback")
            }
          }
        }catch(error) {
          spinner.fail("Error");
          logger.error(error.toString());
          if (!config.silent) spinner.start("Querying " + l.name);
          total = total - 1;
          if (!total) {
            spinner.stop();
            if (callback) {
              if (isFunction(callback)) {
                callback(layers)
              }else{
                throw new Error({Error: "callback is not a function"})
              }
            }else{
              console.log("Complete - No callback")
            }
          }
        }
      })
      return {layers: layers}
    }    
  };
  return await asyncHandleLayers()
}

async function getFeatureService(serviceURL, opts) {
  const url = (opts && opts.token) ? serviceURL + "/?token=" + opts.token + "&f=json" : serviceURL + "?f=json";
  try {
    const res = await fetch(url, {
      timeout: opts.timeout
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
    // logger.info(l.drawingInfo)
    if (!l.subLayerIds) {
      layers.push({
        id: l.id,
        name: convertName(l.name),
        geometryType: (l.geometryType) ? l.geometryType : null,
        renderer: (l.drawingInfo && l.drawingInfo.renderer) ? l.drawingInfo.renderer : null
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
 * @param {string} [options.geometryType] - string with esri geometry type when using JSON endpoint
 * @param {number|string} [options.indent=0] - number of spaces or text before each JSON line.
 * @returns {Transform} A Transform stream.
 */
function createJsonStream(options, opts) {
  const beforeAll = options.beforeAll || ''
  const afterAll = options.afterAll || ''
  const separator = options.separator || '\n'
  const indent = options.indent || 0
  //TODO need to add option for each geom type and make sure that it lines with the returned geometry
  const geometryType = (options.geometryType === "esriGeometryPoint") ? "Point"
    : (options.geometryType === "esriGeometryPolyline") ? "MultiLineString"
    : (options.geometryType === "esriGeometryPolygon") ? "Polygon"
    : (options.geometryType.indexOf("point") > -1) ? "MultiPoint"
    : (options.geometryType.indexOf("line") > -1) ? "MultiLineString"
    : "MultiPolygon";
  const renderer = options.renderer;
  if (opts.debug) logger.info(renderer)
  let inFeatures = 0
  let outFeatures = 0

  const stream = new Transform({
    writableObjectMode: true,  // takes in objects...
    readableObjectMode: false, // ...and outputs strings.

    transform(chunk, _, callback) {
      inFeatures += 1;
      let json;
      try {
        if (opts.format === "json") {
          const props = chunk.attributes;
          const coords = (geometryType === "Polygon" || geometryType === "MultiPolygon") ? chunk.geometry.rings
            : (chunk.geometry.paths) ? chunk.geometry.paths
            : [chunk.geometry.x, chunk.geometry.y];
          json = JSON.stringify({
            type: "Feature",
            properties: props,
            geometry: {
              type: geometryType,
              coordinates: coords
            }
          },0,2)
        }else{
          json = JSON.stringify(chunk, null, indent)
        }
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

async function getFeatures(layerUrl, layerName, opts, id, geometryType, renderer) {
  if (opts.debug) {
    logger.info("---")
    logger.info("gettings features for " + geometryType + " " + layerName )
  }
  let idFieldObject = [];
  let hasErrors = false
  let nbrFeatures = 0;

  const jsonStart = `{"type": "FeatureCollection", "agolLayerId": ${id}, "features": [`;

  const filename = `${opts.prefix}${layerName}`;
  const filepath = `${opts.folder}/${filename}.geojson`;
  const outputStream = fs.createWriteStream(filepath);
  if (opts.format === "json" && !geometryType) throw new Error ("using json format: layer is missing geometryType")
  // features go to jsonInStream with .write and are piped to outputStream
  const jsonInStream = createJsonStream({
    beforeAll: opts.pretty ? jsonStart : jsonStart.replace(/ /g, ''),
    afterAll: opts.pretty ? '\n]}' : ']}',
    separator: opts.pretty ? ',\n' : ',',
    indent: opts.pretty ? 2 : 0,
    warnFn: (err, row, jsonObject) => {
      if (opts.debug) logger.warn(`record ${row} of ${layerName} is invalid.`);
      hasErrors = true;
    },
    geometryType: geometryType,
    renderer: renderer
  }, opts);
  jsonInStream.pipe(outputStream);
  jsonInStream.on('error', (error) => {
    hasErrors = true
    if (opts.debug) logger.error(error.toString())
  });

  var writeDonePromise = new Promise((resolve, reject) => {
    outputStream.on('finish', resolve);
    outputStream.on('error', reject);
  });

  if (!opts.esriIdField || opts.hasAttachments) {
    if (!opts.esriIdField && !opts.silent) spinner.info("Attempting to determing missing esriIdField for " + layerName).start()
    if (opts.hasAttachments && !opts.silent) spinner.info("Attachments set to true in options.").start()

    try {
      if (opts.debug) logger.info(`${layerUrl}?f=pjson${(opts.token) ? `&token=${opts.token}` : ""}`)
      const res = await fetch(`${layerUrl}?f=pjson${(opts.token) ? `&token=${opts.token}` : ""}`, {
        timeout: opts.timeout
      });
      const queryRes = await res.json();

      if (!queryRes || !queryRes.fields || !queryRes.fields.length) {
        spinner.warn(`No fields found when querying layer.`);
        if (opts.debug) logger.error("No fields found when querying layer.")
        spinner.start("Processing")
      }

      if (!queryRes.hasAttachments) {
        getAttachments = false
        if (opts.attachments && !getAttachments) {
          spinner.warn("Attachments requested but the layer does not have attachments.").start()
          if (opts.debug) logger.error("Attachments requested but the layer does not have attachments")
        }
      }

      idFieldObject = queryRes.fields.filter(f => {
        return f.type === "esriFieldTypeOID"
      })

      if (!idFieldObject.length) {
        spinner.warn("No esriFieldTypeOID field found for " + layerName)
        if (opts.debug) logger.error("No esriFieldTypeOID field found " + layerName)
        spinner.start("Processing")
      }else{
        if (!opts.silent) spinner.info("Found esriIdField for " + layerName + ": " + idFieldObject[0].name).start()
      }

    }catch(error) {
      if (opts.debug) logger.error(error.toString())
    }
  }

  const idField = (!opts.esriIdField) ? idFieldObject[0].name.toLowerCase() : opts.esriIdField;
 
  const { START, END, error } = await getStartEnd(`${layerUrl}query?where=${idField}+>+-1${(opts.token) ? `&token=${opts.token}` : ""}&returnIdsOnly=true&orderByFields=${idField}`, opts)
  
  if (!START || !END) throw new Error(error)

  const max = 999 < (END - 1) ? 999 : END - 1;

  const ids = {
    start: 0,
    end: max
  }

  ids.start = START;
  ids.end = ids.start + max;
  let completed = false;

  while (!completed) {
    let geojson = {};
    try {
      if (!opts.silent) spinner.start("Querying features " + ids.start + "-" + ids.end)

      geojson = await queryAGOL(layerUrl, idField, ids.start, ids.end, opts, layerName);

      if ( (!geojson || !geojson.features || !geojson.features.length || geojson.error) && ids.end > END) {
        if (opts.debug) logger.info("finished downloading layers")
        completed = true
      } else {
        if (geojson.features && geojson.features.length > 0) {
          if (!opts.silent) spinner.start("Processing features " + ids.start + "-" + ids.end)
          geojson.features.forEach(f => {
            jsonInStream.write(f);
            nbrFeatures = nbrFeatures + 1;
          });
          if (!opts.silent) spinner.info("Processed " + layerName + " features " + ids.start + "-" + ids.end).start()
        }
      }

      ids.start = ids.start + max + 1;
      ids.end = ids.end + max + 1;
    }
    catch(error) {
      if (opts.debug) logger.error("Error in queryAGOL " + error.toString())
      hasErrors = true
      completed = true
    }
  }

  jsonInStream.end(); // signal no more data
  
  if (!nbrFeatures) hasErrors = true

  if (hasErrors) {
    spinner.warn(`Warning! ${nbrFeatures} features found, there were errors with ${filename}`).start()
    if (opts.debug) logger.error(`Warning! ${nbrFeatures} features found, there were errors with ${filename}`)
  } else{
    spinner.succeed(`Success! Wrote ${nbrFeatures} features to ${filename}.geojson`).start()
    if (opts.debug) logger.debug(`Success! Wrote ${nbrFeatures} features to ${filename}.geojson`)
  }

  try {
    await writeDonePromise; // and wait for everything to finish
  } catch (error) {
    hasErrors = true
    if (opts.debug) logger.error("Error in queryAGOL " + error.toString())
  }


}

async function queryAGOL(url, idField, start, end, opts, layerName) {
  const query = `${url}query?where=${idField}+between+${start}+and+${end}&outSR=4326&outFields=*&f=${opts.format}${(opts.token) ? `&token=${opts.token}` : ""}`;
  if (opts.debug) {
    logger.info("---")
    logger.info(query)
  }
  let data = {};
  try {
    const res = await fetch(query, {
      timeout: opts.timeout
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

async function getStartEnd(query, opts) {
  try {
    const startRes = await fetch(query + "%20ASC&resultRecordCount=1&f=pjson", {
      timeout: opts.timeout
    })
    const startId = await startRes.json();
    const endRes = await fetch(query + "%20DESC&resultRecordCount=1&f=pjson", {
      timeout: opts.timeout
    })
    const endId = await endRes.json();
    return {
      START: Object.values(startId)[1][0],
      END: Object.values(endId)[1][0],
      error: null
    }
  }catch(err) {
    return {
      START: 0,
      END: 0,
      error: err
    }
  }
}

module.exports = {
  featureServiceToGeoJSON,
  getFeatureService,
  getLayers,
  logger
}