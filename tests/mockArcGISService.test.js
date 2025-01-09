const { mockArcGISService } = require("./mockArcGISService");
const fetch = require("node-fetch");

jest.mock("node-fetch");

describe("mockArcGISService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return 400 for unsupported formats", async () => {
    mockArcGISService([
      {
        name: "Layer1",
        fields: [
          { name: "objectId", type: "esriFieldTypeOID" },
        ],
        features: [{ attributes: { objectId: 1 } }],
      },
    ]);

    const invalidFormatQuery = "https://example.com/FeatureServer/0/query?where=1%3D1&f=xml";
    const res = await fetch(invalidFormatQuery);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Invalid format for testing. Supported formats are f=json, f=pjson, or f=geojson.");
  });

  it("should handle valid formats correctly", async () => {
    mockArcGISService([
      {
        name: "Layer1",
        fields: [
          { name: "objectId", type: "esriFieldTypeOID" },
        ],
        features: [{ attributes: { objectId: 1 } }],
      },
    ]);

    const validQuery = "https://example.com/FeatureServer/0/query?where=1%3D1&f=json";
    const res = await fetch(validQuery);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.features[0].attributes.objectId).toBe(1);
  });

  it("should handle metadata requests for a specific layer", async () => {
    mockArcGISService([
      {
        name: "Layer1",
        fields: [
          { name: "objectId", type: "esriFieldTypeOID" },
        ],
        features: [],
      },
    ]);

    const query = "https://example.com/FeatureServer/0/?f=pjson";
    const res = await fetch(query);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.name).toBe("Layer1");
  });

  it("should handle feature queries for a specific layer", async () => {
    mockArcGISService([
      {
        name: "Layer1",
        fields: [
          { name: "objectId", type: "esriFieldTypeOID" },
        ],
        features: [{ attributes: { objectId: 1 }, geometry: { x: 0, y: 0 } }],
      },
    ]);

    const query = "https://example.com/FeatureServer/0/query?f=pjson&where=1=1";
    const res = await fetch(query);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.features.length).toBe(1);
    expect(data.features[0].attributes.objectId).toBe(1);
  });

  it("should return valid GeoJSON when f=geojson is requested", async () => {
    mockArcGISService([
      {
        name: "Layer1",
        fields: [{ name: "OBJECTID", type: "esriFieldTypeOID" }],
        features: [
          { attributes: { OBJECTID: 1 }, geometry: { x: 0, y: 0 } },
          { attributes: { OBJECTID: 2 }, geometry: { x: 1, y: 1 } },
        ],
      },
    ]);

    const query = "https://example.com/FeatureServer/0/query?where=1=1&f=geojson";
    const res = await fetch(query);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.type).toBe("FeatureCollection");
    expect(data.features.length).toBe(2);
    expect(data.features).toEqual([
      {
        type: "Feature",
        geometry: { x: 0, y: 0 },
        properties: { OBJECTID: 1 },
      },
      {
        type: "Feature",
        geometry: { x: 1, y: 1 },
        properties: { OBJECTID: 2 },
      },
    ]);
  });

  it("should handle feature count queries", async () => {
    mockArcGISService([
      {
        name: "Layer1",
        fields: [
          { name: "objectId", type: "esriFieldTypeOID" },
        ],
        features: [
          { attributes: { objectId: 1 }, geometry: { x: 0, y: 0 } },
          { attributes: { objectId: 2 }, geometry: { x: 1, y: 1 } },
          { attributes: { objectId: 3 }, geometry: { x: 2, y: 2 } },
        ],
      },
    ]);

    const query =
      "https://example.com/FeatureServer/0/query?f=json&where=1=1&returnCountOnly=true";
    const res = await fetch(query);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.count).toBe(3);
  });

  it("should handle returnIdsOnly queries", async () => {
    mockArcGISService([
      {
        name: "Layer1",
        fields: [
          { name: "OBJECTID", type: "esriFieldTypeOID" },
        ],
        features: [
          { attributes: { OBJECTID: 104330 }, geometry: { x: 0, y: 0 } },
          { attributes: { OBJECTID: 104331 }, geometry: { x: 1, y: 1 } },
          { attributes: { OBJECTID: 104332 }, geometry: { x: 2, y: 2 } },
        ],
      },
    ]);

    const query =
      "https://example.com/FeatureServer/0/query?where=1%3D1&returnIdsOnly=true&f=json";
    const res = await fetch(query);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.objectIdFieldName).toBe("OBJECTID");
    expect(data.objectIds).toEqual([104330, 104331, 104332]);
  });

  it("should respect the resultRecordCount parameter", async () => {
    mockArcGISService([
      {
        name: "Layer1",
        fields: [
          { name: "OBJECTID", type: "esriFieldTypeOID" },
        ],
        features: [
          { attributes: { OBJECTID: 104330 }, geometry: { x: 0, y: 0 } },
          { attributes: { OBJECTID: 104331 }, geometry: { x: 1, y: 1 } },
          { attributes: { OBJECTID: 104332 }, geometry: { x: 2, y: 2 } },
        ],
      },
    ]);

    const query =
      "https://example.com/FeatureServer/0/query?where=1%3D1&returnIdsOnly=true&resultRecordCount=2&f=json";
    const res = await fetch(query);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.objectIds).toEqual([104330, 104331]);
  });

  it("should respect maxRecordCount for each layer", async () => {
    mockArcGISService([
      {
        name: "Layer1",
        fields: [{ name: "objectId", type: "esriFieldTypeOID" }],
        features: Array.from({ length: 15 }, (_, i) => ({
          attributes: { objectId: i + 1 },
          geometry: { x: i, y: i },
        })),
        maxRecordCount: 5,
      },
      {
        name: "Layer2",
        fields: [{ name: "objectId", type: "esriFieldTypeOID" }],
        features: Array.from({ length: 20 }, (_, i) => ({
          attributes: { objectId: i + 1 },
          geometry: { x: i, y: i },
        })),
        maxRecordCount: 10,
      },
    ]);
  
    const layer1Query = "https://example.com/FeatureServer/0/query?where=1%3D1&f=json";
    const layer1Res = await fetch(layer1Query);
    const layer1Data = await layer1Res.json();
    expect(layer1Res.status).toBe(200);
    expect(layer1Data.features.length).toBe(5);
  
    const layer2Query = "https://example.com/FeatureServer/1/query?where=1%3D1&f=json";
    const layer2Res = await fetch(layer2Query);
    const layer2Data = await layer2Res.json();
    expect(layer2Res.status).toBe(200);
    expect(layer2Data.features.length).toBe(10);
  });

  it("should handle ascending and descending ID queries", async () => {
    mockArcGISService([
      {
        name: "Layer1",
        fields: [
          { name: "objectId", type: "esriFieldTypeOID" },
        ],
        features: [
          { attributes: { objectId: 1 }, geometry: { x: 0, y: 0 } },
          { attributes: { objectId: 2 }, geometry: { x: 1, y: 1 } },
          { attributes: { objectId: 3 }, geometry: { x: 2, y: 2 } },
        ],
      },
    ]);

    // Simulate ascending query
    const ascQuery =
      "https://example.com/FeatureServer/0/query?where=objectId+>+-1&returnIdsOnly=true&orderByFields=objectId%20ASC&resultRecordCount=1&f=pjson";
    const ascRes = await fetch(ascQuery);
    const ascData = await ascRes.json();
    expect(ascRes.status).toBe(200);
    expect(ascData.objectIds).toEqual([1]);

    // Simulate descending query
    const descQuery =
      "https://example.com/FeatureServer/0/query?where=objectId+>+-1&returnIdsOnly=true&orderByFields=objectId%20DESC&resultRecordCount=1&f=pjson";
    const descRes = await fetch(descQuery);
    const descData = await descRes.json();
    expect(descRes.status).toBe(200);
    expect(descData.objectIds).toEqual([3]);
  });

  it("should handle between ID queries", async () => {
    mockArcGISService([
      {
        name: "Layer1",
        fields: [
          { name: "objectId", type: "esriFieldTypeOID" },
          { name: "name", type: "esriFieldTypeString" },
        ],
        features: [
          { attributes: { objectId: 1, name: "Feature1" }, geometry: { x: 0, y: 0 } },
          { attributes: { objectId: 2, name: "Feature2" }, geometry: { x: 1, y: 1 } },
          { attributes: { objectId: 3, name: "Feature3" }, geometry: { x: 2, y: 2 } },
        ],
      },
    ]);

    const betweenQuery =
      "https://example.com/FeatureServer/0/query?where=objectId+between+1+and+2&f=json";
    const res = await fetch(betweenQuery);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.features.length).toBe(2);
    expect(data.features.map((f) => f.attributes.objectId)).toEqual([1, 2]);
  });

  it("should handle case-insensitive field names in orderByFields", async () => {
    mockArcGISService([
      {
        name: "Layer1",
        fields: [
          { name: "ObjectID", type: "esriFieldTypeOID" },
          { name: "name", type: "esriFieldTypeString" },
        ],
        features: [
          { attributes: { ObjectID: 3, name: "Feature3" }, geometry: { x: 0, y: 0 } },
          { attributes: { ObjectID: 1, name: "Feature1" }, geometry: { x: 1, y: 1 } },
          { attributes: { ObjectID: 2, name: "Feature2" }, geometry: { x: 2, y: 2 } },
        ],
      },
    ]);

    const query =
      "https://example.com/FeatureServer/0/query?where=ObjectID+>+-1&returnIdsOnly=true&orderByFields=objectid%20ASC&f=json";
    const res = await fetch(query);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.objectIds).toEqual([1, 2, 3]);
  });

  it("should handle case-insensitive field names in where clause", async () => {
    mockArcGISService([
      {
        name: "Layer1",
        fields: [
          { name: "OBJECTID", type: "esriFieldTypeOID" },
          { name: "name", type: "esriFieldTypeString" },
        ],
        features: [
          { attributes: { OBJECTID: 1, name: "Feature1" }, geometry: { x: 0, y: 0 } },
          { attributes: { OBJECTID: 2, name: "Feature2" }, geometry: { x: 1, y: 1 } },
          { attributes: { OBJECTID: 3, name: "Feature3" }, geometry: { x: 2, y: 2 } },
        ],
      },
    ]);

    const query =
      "https://example.com/FeatureServer/0/query?where=objectid > 1&f=json";
    const res = await fetch(query);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.features.length).toBe(2); // Matches OBJECTID 2 and 3
    expect(data.features.map((f) => f.attributes.OBJECTID)).toEqual([2, 3]);
  });

  it("should handle mixed-case field names in where clause", async () => {
    mockArcGISService([
      {
        name: "Layer1",
        fields: [
          { name: "OBJECTID", type: "esriFieldTypeOID" },
          { name: "name", type: "esriFieldTypeString" },
        ],
        features: [
          { attributes: { OBJECTID: 1, name: "Feature1" }, geometry: { x: 0, y: 0 } },
          { attributes: { OBJECTID: 2, name: "Feature2" }, geometry: { x: 1, y: 1 } },
          { attributes: { OBJECTID: 3, name: "Feature3" }, geometry: { x: 2, y: 2 } },
        ],
      },
    ]);

    const query =
      "https://example.com/FeatureServer/0/query?where=ObJeCtId between 1 and 2&f=json";
    const res = await fetch(query);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.features.length).toBe(2); // Matches OBJECTID 1 and 2
    expect(data.features.map((f) => f.attributes.OBJECTID)).toEqual([1, 2]);
  });
});
