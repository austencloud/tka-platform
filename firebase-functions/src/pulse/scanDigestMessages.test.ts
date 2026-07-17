import {
  singleScanMessage,
  digestMessage,
  locationSuffix,
} from "./scanDigestMessages";

describe("locationSuffix", () => {
  it("joins city and country", () => {
    expect(locationSuffix("Portland", "US")).toBe(" in Portland, US");
  });
  it("uses whichever part is present", () => {
    expect(locationSuffix("Portland", null)).toBe(" in Portland");
    expect(locationSuffix(null, "US")).toBe(" in US");
  });
  it("is empty when nothing is known", () => {
    expect(locationSuffix(null, null)).toBe("");
    expect(locationSuffix("", "")).toBe("");
  });
});

describe("singleScanMessage", () => {
  it("attributes a signed-in scanner by name", () => {
    expect(
      singleScanMessage({
        label: "FΨ",
        scannerName: "Austen",
        city: "Portland",
        country: "US",
      })
    ).toBe('Austen scanned "FΨ" in Portland, US');
  });

  it("stays anonymous when there is no scanner name", () => {
    expect(
      singleScanMessage({
        label: "FΨ",
        scannerName: null,
        city: "Portland",
        country: "US",
      })
    ).toBe('"FΨ" scanned in Portland, US');
  });

  it("omits the location clause when unknown", () => {
    expect(
      singleScanMessage({
        label: "FΨ",
        scannerName: null,
        city: null,
        country: null,
      })
    ).toBe('"FΨ" scanned');
  });
});

describe("digestMessage", () => {
  it("summarizes count, distinct cities, and window", () => {
    expect(digestMessage(9, 3, 10)).toBe("9 scans · 3 cities · last 10 min");
  });

  it("singularizes one city", () => {
    expect(digestMessage(4, 1, 10)).toBe("4 scans · 1 city · last 10 min");
  });

  it("drops the cities clause when no located scan is known", () => {
    expect(digestMessage(2, 0, 10)).toBe("2 scans · last 10 min");
  });
});
