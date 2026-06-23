import { describe, it, expect } from "vitest";
import {
  parseCloudflareGeo,
  formatLocationLabel,
} from "$lib/shared/presence/domain/models/presence-models";

describe("parseCloudflareGeo", () => {
  const h = (entries: Record<string, string>) => new Headers(entries);

  it("returns null when no geo headers present", () => {
    expect(parseCloudflareGeo(h({}))).toBeNull();
  });

  it("parses country/city/lat/lng", () => {
    const geo = parseCloudflareGeo(
      h({
        "cf-ipcountry": "DE",
        "cf-ipcity": "Berlin",
        "cf-iplatitude": "52.52",
        "cf-iplongitude": "13.405",
      })
    );
    expect(geo).toEqual({ country: "DE", city: "Berlin", lat: 52.52, lng: 13.405 });
  });

  it("returns geo with nulls for missing coords but present country", () => {
    const geo = parseCloudflareGeo(h({ "cf-ipcountry": "US" }));
    expect(geo).toEqual({ country: "US", city: null, lat: null, lng: null });
  });

  it("ignores non-finite coords", () => {
    const geo = parseCloudflareGeo(
      h({ "cf-ipcountry": "US", "cf-iplatitude": "abc", "cf-iplongitude": "" })
    );
    expect(geo?.lat).toBeNull();
    expect(geo?.lng).toBeNull();
  });
});

describe("formatLocationLabel", () => {
  it("formats city + country", () => {
    expect(formatLocationLabel({ city: "Berlin", country: "DE", lat: 1, lng: 2 })).toBe(
      "Berlin, DE"
    );
  });
  it("country only when no city", () => {
    expect(formatLocationLabel({ city: null, country: "US", lat: null, lng: null })).toBe(
      "US"
    );
  });
  it("empty string when neither", () => {
    expect(formatLocationLabel(null)).toBe("");
    expect(formatLocationLabel({ city: null, country: null, lat: 1, lng: 2 })).toBe("");
  });
});
