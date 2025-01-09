const fetch = require("node-fetch");

function mockArcGISService(layers = [], tables = []) {
  const mockResponses = new Map();

  mockResponses.set("layers", {
    layers: layers.map((layer, index) => {
      const { features, ...layerWithoutFeatures } = layer; // Exclude features
      return { ...layerWithoutFeatures, id: index };
    }),
  });

  layers.forEach((layer, index) => {
    const features = layer.features;
    const maxRecordCount = layer.maxRecordCount || 1000;

    const oidField = layer.fields.find((field) => field.type === "esriFieldTypeOID")?.name;
    if (!oidField) {
      throw new Error(`Layer ${layer.name} does not have an Object ID field.`);
    }

    const featureResponse = { ...layer };

    const metadataResponse = { ...featureResponse };
    delete metadataResponse.features;

    mockResponses.set(`layer${index}-metadata`, metadataResponse);
    mockResponses.set(`layer${index}-query`, (queryParams, format) => {
      const { where, returnIdsOnly, orderByFields, resultRecordCount, returnCountOnly } = queryParams;
      let filteredFeatures = [...features];

      if (where) {
        const normalizedWhere = where.toLowerCase();

        if (normalizedWhere === "1=1") {
          // all features
        } else {
          // Handle `oidField between x and y`
          const oidCondition = new RegExp(`${oidField.toLowerCase()}\\s+between\\s+(\\d+)\\s+and\\s+(\\d+)`, "i");
          const betweenMatch = normalizedWhere.match(oidCondition);
          if (betweenMatch) {
            const lowerBound = parseInt(betweenMatch[1], 10);
            const upperBound = parseInt(betweenMatch[2], 10);
            filteredFeatures = filteredFeatures.filter(
              (feature) =>
                feature.attributes[oidField] >= lowerBound &&
                feature.attributes[oidField] <= upperBound
            );
          }

          // Handle other conditions like "field > value"
          const conditionMatch = normalizedWhere.match(/(\w+)\s*([><=]+)\s*(\d+)/);
          if (conditionMatch) {
            const field = conditionMatch[1];
            const operator = conditionMatch[2];
            const value = parseInt(conditionMatch[3], 10);

            filteredFeatures = filteredFeatures.filter((feature) => {
              const featureField = Object.keys(feature.attributes).find(
                (key) => key.toLowerCase() === field
              );
              if (!featureField) return false;

              const fieldValue = feature.attributes[featureField];
              if (operator === ">") return fieldValue > value;
              if (operator === "<") return fieldValue < value;
              if (operator === "=" || operator === "==") return fieldValue === value;
              return false;
            });
          }
        }
      }

      if (returnCountOnly === "true") {
        return { count: filteredFeatures.length };
      }

      if (orderByFields) {
        const [fieldRaw, directionRaw] = orderByFields.split(" ");
        const field = fieldRaw?.toLowerCase();
        const direction = directionRaw?.toUpperCase();

        filteredFeatures.sort((a, b) => {
          const fieldA = Object.keys(a.attributes).find(
            (key) => key.toLowerCase() === field
          );
          const fieldB = Object.keys(b.attributes).find(
            (key) => key.toLowerCase() === field
          );

          if (!fieldA || !fieldB) return 0;

          if (direction === "ASC") {
            return a.attributes[fieldA] - b.attributes[fieldB];
          } else if (direction === "DESC") {
            return b.attributes[fieldB] - a.attributes[fieldA];
          }
          return 0;
        });
      }

      const limit = resultRecordCount
        ? Math.min(parseInt(resultRecordCount, 10), maxRecordCount)
        : maxRecordCount;

      filteredFeatures = filteredFeatures.slice(0, limit);

      if (returnIdsOnly) {
        return {
          objectIdFieldName: oidField,
          objectIds: filteredFeatures.map((feature) => feature.attributes[oidField]),
        };
      }

      if (format === "geojson") {
        return {
          type: "FeatureCollection",
          features: filteredFeatures.map((feature) => ({
            type: "Feature",
            geometry: feature.geometry,
            properties: feature.attributes,
          })),
        };
      }

      return { features: filteredFeatures };
    });
  });

  tables.forEach((table, index) => {
    mockResponses.set(`table${index}`, { features: table.features });
  });

  // Mock the fetch function
  fetch.mockImplementation((url) => {
    let key;
    let dynamicResponse;

    // console.log(`Mock fetch request: ${url}`);

    const queryParams = new URLSearchParams(url.split("?")[1]);

    const format = queryParams.get("f");
    if (format !== "json" && format !== "pjson" && format !== "geojson") {
      return Promise.resolve({
        ok: false,
        status: 400,
        json: jest.fn().mockResolvedValue({
          error: "Invalid format for testing. Supported formats are f=json, f=pjson, or f=geojson.",
        }),
        headers: {
          get: jest.fn().mockReturnValue("application/json"),
        },
      });
    }

    if (url.match(/FeatureServer\/?\?f=(?:p?json|geojson)$/)) {
      key = "layers";
    } else if (url.match(/FeatureServer\/(\d+)\/\?f=(?:p?json|geojson)$/)) {
      const match = url.match(/FeatureServer\/(\d+)\/\?f=(?:p?json|geojson)$/);
      const layerId = match[1];
      key = `layer${layerId}-metadata`;
    } else if (url.match(/FeatureServer\/(\d+)\/query/)) {
      const match = url.match(/FeatureServer\/(\d+)\/query/);
      const layerId = match[1];
      const where = queryParams.get("where");
      const returnIdsOnly = queryParams.get("returnIdsOnly") === "true";
      const orderByFields = queryParams.get("orderByFields");
      const resultRecordCount = queryParams.get("resultRecordCount");
      const returnCountOnly = queryParams.get("returnCountOnly");

      key = `layer${layerId}-query`;
      dynamicResponse = mockResponses.get(key)?.({
        where,
        returnIdsOnly,
        orderByFields,
        resultRecordCount,
        returnCountOnly,
      }, format);
    }

    // Return the appropriate mock response
    const response = dynamicResponse || mockResponses.get(key);
    if (response) {
      // console.log(`Mock response: ${JSON.stringify(response)}`);
      return Promise.resolve({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue(response),
        headers: {
          get: jest.fn().mockReturnValue(
            format === "geojson" ? "application/geo+json" : "application/json"
          ),
        },
      });
    }

    // Fallback for unrecognized requests
    return Promise.resolve({
      ok: false,
      status: 404,
      json: jest.fn().mockResolvedValue({ error: "Not Found" }),
      headers: {
        get: jest.fn().mockReturnValue("application/json"),
      },
    });
  });
}

module.exports = { mockArcGISService };
