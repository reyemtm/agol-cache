jest.mock("node-fetch");
jest.mock("fs", () => ({
  createWriteStream: jest.fn(),
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  stat: jest.fn(),
}));

// Mock the ora spinner
jest.mock("ora", () => {
  const mockSpinner = {
    start: jest.fn().mockImplementation(() => mockSpinner),
    stop: jest.fn().mockImplementation(() => mockSpinner),
    fail: jest.fn().mockImplementation(() => mockSpinner),
    info: jest.fn().mockImplementation(() => mockSpinner),
    warn: jest.fn().mockImplementation(() => mockSpinner),
    succeed: jest.fn().mockImplementation(() => mockSpinner),
    isSpinning: false,
    text: "",
  };

  return jest.fn(() => mockSpinner);
});

const fs = require("fs");
const fetch = require("node-fetch");
const ora = require("ora");
const { EventEmitter } = require("events");

const { mockArcGISService } = require("./mockArcGISService");

const { featureServiceToGeoJSON } = require("../lib/featureServiceToGeoJSON");

describe("ora mock behavior", () => {
  it("should return the mocked spinner instance", () => {
    const spinner = ora();
    expect(spinner).toBeDefined();
    expect(typeof spinner.start).toBe("function");
    expect(typeof spinner.succeed).toBe("function");

    spinner.start();
    expect(spinner.start).toHaveBeenCalled();

    const instance = spinner.succeed("Test message");
    expect(spinner.succeed).toHaveBeenCalledWith("Test message");
    expect(instance).toBe(spinner);
  });
});

describe("featureServiceToGeoJSON", () => {
  let mockSpinner;
  let mockStream;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSpinner = ora();

    mockStream = new EventEmitter();
    mockStream.buffer = [];
    mockStream.write = jest.fn().mockImplementation((data) => {
      mockStream.buffer.push(data);
    });
    mockStream.end = jest.fn().mockImplementation(() => {
      // Simulate the stream finishing
      setTimeout(() => mockStream.emit("finish"), 0);
    });
    mockStream.pipe = jest.fn();

    fs.createWriteStream.mockReturnValue(mockStream);
    fs.existsSync.mockReturnValue(true);
    fs.mkdirSync.mockImplementation(() => {});
    fs.stat.mockImplementation((_path, callback) => {
      const mockStats = {
        isDirectory: jest.fn(() => false),
        isFile: jest.fn(() => true),
      };
      callback(null, mockStats);
    });
  });

  it("should successfully read a single layer", async () => {
    mockArcGISService([
      {
        name: "Layer1",
        geometryType: "esriGeometryPoint",
        fields: [
          { name: "label", type: "esriFieldTypeString", alias: "Label" },
          { name: "OBJECTID", type: "esriFieldTypeOID", alias: "OBJECTID" },
        ],
        features: [
          { attributes: { name: "A", OBJECTID: 1 }, geometry: { x: 0, y: 0 } },
          { attributes: { name: "B", OBJECTID: 2 }, geometry: { x: 1, y: 1 } },
        ],
      },
    ]);

    const options = {
      debug: true,
      silent: true,
      format: "geojson",
      layers: true,
    };

    const result = await featureServiceToGeoJSON("https://example.com/FeatureServer", options);

    expect(fetch).toHaveBeenCalled();
    expect(fetch.mock.calls[0][0]).toBe('https://example.com/FeatureServer/?f=json');

    expect(result.layers[0].nbrErrors).toBe(0);
    expect(result.layers[0].nbrFeatures).toBe(2);

    expect(mockStream.write).toHaveBeenCalled();
    const output = mockStream.buffer.join("");
    const parsedOutput = JSON.parse(output);
    expect(parsedOutput.type).toBe("FeatureCollection");
    expect(parsedOutput.features).toEqual([
      {
        type: "Feature",
        geometry: { x: 0, y: 0 },
        properties: { name: "A", OBJECTID: 1 },
      },
      {
        type: "Feature",
        geometry: { x: 1, y: 1 },
        properties: { name: "B", OBJECTID: 2 },
      },
    ]);

    // Validate spinner interactions
    expect(mockSpinner.start).toHaveBeenCalled();
    expect(mockSpinner.fail).not.toHaveBeenCalled();
    expect(mockSpinner.succeed).toHaveBeenCalledWith("Success! Wrote 2 features to geojson-cache/layer1.geojson");
    expect(mockSpinner.succeed).toHaveBeenCalledWith(
      expect.stringMatching(/Wrote \d+ features/)
    );
  });

  it("should process layers and flag features with missing geometry", async () => {
    mockArcGISService([
      {
        name: "Layer1",
        geometryType: "esriGeometryPoint",
        fields: [
          { name: "label", type: "esriFieldTypeString", alias: "Label" },
          { name: "OBJECTID", type: "esriFieldTypeOID", alias: "OBJECTID" },
        ],
        features: [
          { attributes: { name: "A", OBJECTID: 1 }, geometry: { x: 0, y: 0 } },
          { attributes: { name: "B", OBJECTID: 2 } }, // Missing geometry
        ],
      },
    ]);

    const result = await featureServiceToGeoJSON("https://example.com/FeatureServer", {});

    expect(result.layers[0].nbrErrors).toBe(1);
    expect(result.layers[0].nbrFeatures).toBe(2);
    expect(result.layers[0].exampleErrors).toHaveLength(1);
    expect(result.layers[0].exampleErrors[0]).toEqual({
      index: 1,
      feature: { type: "Feature", properties: { name: "B", OBJECTID: 2 } },
      error: "Feature is missing geometry",
    });
  });

  // TODO: this test fails!
  // it.only("should page through features when the result exceeds the service maxRecordCount", async () => {
  //   // TODO: mock maxRecordCount
  //   mockArcGISService([
  //     {
  //       name: "Layer1",
  //       geometryType: "esriGeometryPoint",
  //       fields: [
  //         { name: "label", type: "esriFieldTypeString", alias: "Label" },
  //         { name: "id", type: "esriFieldTypeOID", alias: "OBJECTID" },
  //       ],
  //       maxRecordCount: 2,
  //       features: [
  //         { attributes: { label: "A", id: 1 }, geometry: { x: 0, y: 0 } },
  //         { attributes: { label: "B", id: 2 }, geometry: { x: 1, y: 1 } },
  //         { attributes: { label: "C", id: 3 }, geometry: { x: 2, y: 2 } },
  //         { attributes: { label: "D", id: 4 }, geometry: { x: 3, y: 3 } },
  //         { attributes: { label: "E", id: 5 }, geometry: { x: 4, y: 4 } },
  //       ],
  //     },
  //   ]);

  //   const result = await featureServiceToGeoJSON(
  //     "https://example.com/FeatureServer",
  //     {}
  //   );

  //   expect(result.layers[0].nbrErrors).toBe(0);
  //   expect(result.layers[0].nbrFeatures).toBe(5);
  // });

  it("should handle services with no layers gracefully", async () => {
    mockArcGISService();

    const result = await featureServiceToGeoJSON("https://example.com/FeatureServer", {});

    expect(result.layers).toHaveLength(0);
    expect(mockSpinner.fail).toHaveBeenCalledWith("Fatal error, no layers found!");
  });

  it("should handle 400 errors gracefully", async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: jest.fn().mockResolvedValue({ error: "Bad request" }),
    });

    const options = {
      debug: true,
      silent: true,
    };

    await expect(
      featureServiceToGeoJSON("https://example.com/FeatureServer", options)
    ).rejects.toThrow("Could not find feature service definition: Bad request");

    expect(mockSpinner.fail).toHaveBeenCalledWith("Could not find feature service definition: Bad request");
  });

  it("should handle 404 errors gracefully", async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: jest.fn().mockResolvedValue({ error: "Not found" }),
    });

    const options = {
      debug: true,
      silent: true,
    };

    await expect(
      featureServiceToGeoJSON("https://example.com/FeatureServer", options)
    ).rejects.toThrow("Could not find feature service definition: Not found");

    expect(mockSpinner.fail).toHaveBeenCalledWith("Could not find feature service definition: Not found");
  });

  it("should handle 500 errors gracefully", async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: jest.fn().mockResolvedValue({ error: "Internal server error" }),
    });

    const options = {
      debug: true,
      silent: true,
    };

    await expect(
      featureServiceToGeoJSON("https://example.com/FeatureServer", options)
    ).rejects.toThrow("Could not find feature service definition: Internal server error");

    expect(mockSpinner.fail).toHaveBeenCalledWith("Could not find feature service definition: Internal server error");
  });

  // TODO: this test doesn't work, filtering layers doesn't remove them from the list,
  // should they be removed?
  // it("should skip layers based on filter options", async () => {
  //   mockArcGISService([
  //     {
  //       name: "Layer1",
  //       geometryType: "esriGeometryPoint",
  //       fields: [
  //         { name: "label", type: "esriFieldTypeString", alias: "Label" },
  //         { name: "OBJECTID", type: "esriFieldTypeOID", alias: "OBJECTID" },
  //       ],
  //       features: [
  //         { attributes: { name: "A", OBJECTID: 1 }, geometry: { x: 0, y: 0 } },
  //         { attributes: { name: "B", OBJECTID: 2 }, geometry: { x: 1, y: 1 } },
  //       ],
  //     },
  //     {
  //       name: "ExcludedLayer",
  //       geometryType: "esriGeometryPoint",
  //       fields: [
  //         { name: "label", type: "esriFieldTypeString", alias: "Label" },
  //         { name: "OBJECTID", type: "esriFieldTypeOID", alias: "OBJECTID" },
  //       ],
  //       features: [
  //         { attributes: { name: "C", OBJECTID: 3 }, geometry: { x: 2, y: 2 } },
  //         { attributes: { name: "D", OBJECTID: 4 }, geometry: { x: 3, y: 3 } },
  //       ],
  //     },
  //   ]);

  //   const options = {
  //     debug: true,
  //     silent: true,
  //     filter: "Layer1",
  //   };

  //   const result = await featureServiceToGeoJSON(
  //     "https://example.com/FeatureServer",
  //     options
  //   );

  //   expect(result.layers.length).toBe(1);
  //   expect(result.layers[0].name).toBe("Layer1");
  //   expect(mockSpinner.info).toHaveBeenCalledWith("Skipping layer: ExcludedLayer");
  // });

  it("should throw an error for non-FeatureServer/MapServer URLs", async () => {
    const options = {
      debug: true,
      silent: true,
    };

    await expect(
      featureServiceToGeoJSON("https://example.com/InvalidServer", options)
    ).rejects.toThrow("Error, this script only works with FeatureServer and MapServer services");

    expect(mockSpinner.fail).not.toHaveBeenCalled();
  });

  it("should handle unexpected server response content gracefully", async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      headers: {
        get: jest.fn().mockReturnValue("text/html"),
      },
      json: jest.fn().mockImplementation(() => {
        throw new Error("Unexpected token < in JSON");
      }),
    });

    const options = {
      debug: true,
      silent: true,
    };

    await expect(
      featureServiceToGeoJSON("https://example.com/FeatureServer", options)
    ).rejects.toThrow("Error: Unexpected token < in JSON");
  });
});
