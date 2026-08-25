"""Build the reproducible Earth foundation for Flow Fest Sim.

The browser should not know how to query USGS, decode LAZ, or reproject a
GeoTIFF. This script does that work once, records exactly which public sources
were used, and emits compact runtime layers with an invertible meter frame.

Run from the repository root with the pinned Python environment:

    .cache/flow-fest-sim/venv/Scripts/python.exe \
        scripts/geospatial/build_flow_fest_foundation.py all

The checked source lock is deliberately separate from the generated runtime
manifest. Refreshing upstream data is an explicit migration (`discover`), not
something an ordinary rebuild can do by accident.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.metadata
import json
import math
import os
import platform
import sys
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any

PIPELINE_VERSION = 1
SCRIPT_PATH = Path(__file__).resolve()
REPOSITORY_ROOT = SCRIPT_PATH.parents[2]
DEFAULT_CONFIG = SCRIPT_PATH.with_name("flow-fest-site.json")
USER_AGENT = "FlowFestSimGeospatialFoundation/1.0 (public USGS data build)"


def read_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        value = json.load(handle)
    if not isinstance(value, dict):
        raise RuntimeError(f"Expected an object in {path}")
    return value


def write_json(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    serialized = json.dumps(value, indent=2, ensure_ascii=False) + "\n"
    partial = path.with_suffix(path.suffix + ".partial")
    try:
        partial.write_text(serialized, encoding="utf-8", newline="\n")
        os.replace(partial, path)
    finally:
        if partial.exists():
            partial.unlink()


def atomic_array_to_file(array: Any, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    partial = path.with_suffix(path.suffix + ".partial")
    try:
        array.tofile(partial)
        os.replace(partial, path)
    finally:
        if partial.exists():
            partial.unlink()


def atomic_save_image(image: Any, path: Path, image_format: str, **options: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    partial = path.with_suffix(path.suffix + ".partial")
    try:
        image.save(partial, format=image_format, **options)
        os.replace(partial, path)
    finally:
        if partial.exists():
            partial.unlink()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while chunk := handle.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def repository_path(value: str) -> Path:
    path = (REPOSITORY_ROOT / value).resolve()
    try:
        path.relative_to(REPOSITORY_ROOT)
    except ValueError as error:
        raise RuntimeError(f"Configured path leaves the repository: {value}") from error
    return path


def relative_repository_path(path: Path) -> str:
    return path.resolve().relative_to(REPOSITORY_ROOT).as_posix()


def configure_proj_data(config: dict[str, Any], lock: dict[str, Any]) -> Path:
    """Install the source-locked NADCON5 grids into this process's PROJ search path."""
    from pyproj import datadir

    records = lock.get("datumTransformationGrids", [])
    expected = config["sourcePolicy"]["datumTransformationGrids"]
    locked_identity = [
        (
            record.get("name"),
            record.get("downloadUrl"),
            record.get("declaredSizeBytes"),
        )
        for record in records
    ]
    expected_identity = [
        (record.get("name"), record.get("url"), record.get("declaredSizeBytes"))
        for record in expected
    ]
    if locked_identity != expected_identity:
        raise RuntimeError("Source lock does not contain the configured datum grid chain")
    grid_directory = repository_path(config["outputs"]["cacheDirectory"]) / "proj-grids"
    for record in records:
        cache_path = record.get("cacheRelativePath")
        digest = record.get("sha256")
        if not cache_path or not digest:
            raise RuntimeError(f"Datum grid has not been acquired: {record.get('name')}")
        path = repository_path(str(cache_path))
        if path.parent != grid_directory.resolve() or path.name != record["name"]:
            raise RuntimeError(f"Datum grid cache path is not canonical: {cache_path}")
        if sha256_file(path) != digest:
            raise RuntimeError(f"Datum grid hash drift: {path}")
    datadir.append_data_dir(str(grid_directory))
    return grid_directory


def request_json(url: str) -> dict[str, Any]:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=120) as response:
        payload = response.read()
    value = json.loads(payload)
    if not isinstance(value, dict):
        raise RuntimeError(f"Expected an object response from {url}")
    if value.get("error"):
        raise RuntimeError(f"Remote service rejected {url}: {value['error']}")
    return value


def require_third_party() -> tuple[Any, Any, Any, Any, Any, Any]:
    try:
        import laspy
        import numpy as np
        import rasterio
        from PIL import Image, ImageDraw
        from pyproj import CRS, Transformer
    except ImportError as error:
        raise RuntimeError(
            "Pinned geospatial dependencies are missing. Create the task-local "
            "venv from scripts/geospatial/requirements.txt."
        ) from error
    return laspy, np, rasterio, Image, ImageDraw, (CRS, Transformer)


def grid_geometry(config: dict[str, Any]) -> dict[str, Any]:
    _, _, _, _, _, projection = require_third_party()
    CRS, Transformer = projection
    grid = config["grid"]
    anchor = config["requestedAnchorWgs84"]
    samples = int(grid["samplesPerAxis"])
    spacing = float(grid["sampleSpacingMeters"])
    if samples < 3 or samples % 2 == 0:
        raise RuntimeError("samplesPerAxis must be an odd integer of at least 3")
    if spacing <= 0:
        raise RuntimeError("sampleSpacingMeters must be positive")

    projected_crs = CRS.from_user_input(grid["projectedCrs"])
    to_projected = Transformer.from_crs("EPSG:4326", projected_crs, always_xy=True)
    to_wgs84 = Transformer.from_crs(projected_crs, "EPSG:4326", always_xy=True)
    raw_easting, raw_northing = to_projected.transform(
        float(anchor["longitude"]), float(anchor["latitude"])
    )
    origin_easting = round(raw_easting)
    origin_northing = round(raw_northing)
    resolved_longitude, resolved_latitude = to_wgs84.transform(
        origin_easting, origin_northing
    )

    half_span = spacing * (samples - 1) / 2
    min_easting = origin_easting - half_span
    max_easting = origin_easting + half_span
    min_northing = origin_northing - half_span
    max_northing = origin_northing + half_span
    margin = float(grid["sourceMarginMeters"])
    projected_to_wgs84 = Transformer.from_crs(
        projected_crs, "EPSG:4326", always_xy=True
    )
    sample_west, sample_south, sample_east, sample_north = (
        projected_to_wgs84.transform_bounds(
            min_easting,
            min_northing,
            max_easting,
            max_northing,
            densify_pts=21,
        )
    )
    query_west, query_south, query_east, query_north = projected_to_wgs84.transform_bounds(
        min_easting - margin,
        min_northing - margin,
        max_easting + margin,
        max_northing + margin,
        densify_pts=21,
    )
    return {
        "crs": projected_crs,
        "crsCode": projected_crs.to_string(),
        "samples": samples,
        "spacing": spacing,
        "halfSpan": half_span,
        "originEasting": float(origin_easting),
        "originNorthing": float(origin_northing),
        "requestedAnchorWgs84": {
            "latitude": float(anchor["latitude"]),
            "longitude": float(anchor["longitude"]),
        },
        "resolvedOriginWgs84": {
            "latitude": float(resolved_latitude),
            "longitude": float(resolved_longitude),
        },
        "sampleBoundsProjected": {
            "minEasting": min_easting,
            "maxEasting": max_easting,
            "minNorthing": min_northing,
            "maxNorthing": max_northing,
        },
        "queryBoundsWgs84": {
            "west": query_west,
            "south": query_south,
            "east": query_east,
            "north": query_north,
        },
        "sampleBoundsWgs84": {
            "west": sample_west,
            "south": sample_south,
            "east": sample_east,
            "north": sample_north,
        },
    }


def tnm_query_url(dataset: str, bounds: dict[str, float]) -> str:
    query = urllib.parse.urlencode(
        {
            "datasets": dataset,
            "bbox": (
                f"{bounds['west']:.12f},{bounds['south']:.12f},"
                f"{bounds['east']:.12f},{bounds['north']:.12f}"
            ),
            "max": 100,
        }
    )
    return f"https://tnmaccess.nationalmap.gov/api/v1/products?{query}"


def bounding_boxes_intersect(
    item_bounds: dict[str, float], query_bounds: dict[str, float]
) -> bool:
    return not (
        float(item_bounds["maxX"]) < query_bounds["west"]
        or float(item_bounds["minX"]) > query_bounds["east"]
        or float(item_bounds["maxY"]) < query_bounds["south"]
        or float(item_bounds["minY"]) > query_bounds["north"]
    )


def source_record(item: dict[str, Any]) -> dict[str, Any]:
    return {
        "sourceId": item.get("sourceId"),
        "title": item.get("title"),
        "publicationDate": item.get("publicationDate"),
        "lastUpdated": item.get("lastUpdated"),
        "format": item.get("format"),
        "declaredSizeBytes": item.get("sizeInBytes"),
        "downloadUrl": item.get("downloadURL"),
        "metadataUrl": item.get("vendorMetaUrl") or item.get("metaUrl"),
        "catalogUrl": item.get("metaUrl"),
        "boundingBoxWgs84": item.get("boundingBox"),
        "sha256": None,
        "downloadedSizeBytes": None,
        "cacheRelativePath": None,
        "metadataSha256": None,
        "metadataCacheRelativePath": None,
    }


def discover(config: dict[str, Any], lock_path: Path) -> dict[str, Any]:
    geometry = grid_geometry(config)
    policy = config["sourcePolicy"]
    project = policy["projectTitleIncludes"]
    bounds = geometry["queryBoundsWgs84"]
    selected: dict[str, list[dict[str, Any]]] = {}
    queries: dict[str, str] = {}

    for key, dataset in (
        ("dem", policy["demDataset"]),
        ("lidar", policy["lidarDataset"]),
    ):
        selection_bounds = (
            geometry["sampleBoundsWgs84"] if key == "lidar" else bounds
        )
        url = tnm_query_url(dataset, selection_bounds)
        response = request_json(url)
        candidates = response.get("items", [])
        if not isinstance(candidates, list):
            raise RuntimeError(f"TNM {key} response has no item list")
        items = [
            item
            for item in candidates
            if isinstance(item, dict)
            and project in str(item.get("title", ""))
            and isinstance(item.get("boundingBox"), dict)
            and bounding_boxes_intersect(item["boundingBox"], selection_bounds)
        ]
        records = sorted(
            (source_record(item) for item in items), key=lambda value: value["title"]
        )
        if not records:
            raise RuntimeError(f"No {key} product matched the locked project policy")
        if any(not record["downloadUrl"] for record in records):
            raise RuntimeError(f"A selected {key} product has no download URL")
        selected[key] = records
        queries[key] = url

    anchor = geometry["requestedAnchorWgs84"]
    naip_query = urllib.parse.urlencode(
        {
            "f": "json",
            "where": "Category=1",
            "geometry": f"{anchor['longitude']},{anchor['latitude']}",
            "geometryType": "esriGeometryPoint",
            "inSR": 4326,
            "spatialRel": "esriSpatialRelIntersects",
            "outFields": "*",
            "returnGeometry": "false",
        }
    )
    naip_url = f"{policy['naipService']}/query?{naip_query}"
    naip_response = request_json(naip_url)
    naip_features = [
        feature.get("attributes", {})
        for feature in naip_response.get("features", [])
        if isinstance(feature, dict)
        and isinstance(feature.get("attributes"), dict)
        and int(feature["attributes"].get("Year", -1)) == int(policy["naipYear"])
    ]
    if len(naip_features) != 1:
        raise RuntimeError(
            f"Expected one {policy['naipYear']} NAIP primary raster, got "
            f"{len(naip_features)}"
        )
    naip = naip_features[0]

    lock = {
        "schemaVersion": 1,
        "pipelineVersion": PIPELINE_VERSION,
        "siteId": config["siteId"],
        "gridQuery": {
            "projectedCrs": geometry["crsCode"],
            "originProjectedMeters": {
                "easting": geometry["originEasting"],
                "northing": geometry["originNorthing"],
            },
            "sampleBoundsProjectedMeters": geometry["sampleBoundsProjected"],
            "sampleBoundsWgs84": geometry["sampleBoundsWgs84"],
            "queryBoundsWgs84": bounds,
        },
        "catalogQueries": {**queries, "orthophoto": naip_url},
        "dem": selected["dem"],
        "lidar": selected["lidar"],
        "datumTransformationGrids": [
            {
                "name": record["name"],
                "downloadUrl": record["url"],
                "declaredSizeBytes": int(record["declaredSizeBytes"]),
                "sha256": None,
                "downloadedSizeBytes": None,
                "cacheRelativePath": None,
            }
            for record in policy["datumTransformationGrids"]
        ],
        "orthophoto": {
            "objectId": int(naip["OBJECTID"]),
            "rasterName": naip.get("raster_name") or naip.get("Name"),
            "state": naip.get("State"),
            "year": int(naip["Year"]),
            "acquisitionDateUnixMilliseconds": int(naip["acquisition_date"]),
            "agency": naip.get("agency"),
            "vendor": naip.get("vendor"),
            "sourceResolutionMeters": float(naip["resolution_value"]),
            "sourceBands": int(naip["band_count"]),
            "sensorType": naip.get("sensor_type"),
            "sourceProjection": naip.get("projection_name"),
            "sourceProjectionZone": naip.get("projection_zone"),
            "sourceDatum": naip.get("datum"),
            "catalogDownloadUrl": naip.get("download_url"),
            "serviceUrl": policy["naipService"],
            "exportRequestUrl": None,
            "exportResponse": None,
            "sha256": None,
            "downloadedSizeBytes": None,
            "cacheRelativePath": None,
        },
    }
    write_json(lock_path, lock)
    print(
        f"DISCOVERED dem={len(lock['dem'])} lidar={len(lock['lidar'])} "
        f"naip={lock['orthophoto']['rasterName']}"
    )
    return lock


def validate_source_lock_geometry(
    config: dict[str, Any], lock: dict[str, Any]
) -> dict[str, Any]:
    geometry = grid_geometry(config)
    if lock.get("schemaVersion") != 1:
        raise RuntimeError("Unsupported source-lock schema")
    if lock.get("pipelineVersion") != PIPELINE_VERSION:
        raise RuntimeError("Source lock was created by a different pipeline version")
    if lock.get("siteId") != config["siteId"]:
        raise RuntimeError("Source lock belongs to a different site")
    locked_grid = lock.get("gridQuery", {})
    if locked_grid.get("projectedCrs") != geometry["crsCode"]:
        raise RuntimeError("Source lock CRS differs from the current site contract")
    locked_origin = locked_grid.get("originProjectedMeters", {})
    if (
        locked_origin.get("easting") != geometry["originEasting"]
        or locked_origin.get("northing") != geometry["originNorthing"]
    ):
        raise RuntimeError("Source lock origin differs from the current site contract")
    expected_bounds = geometry["sampleBoundsProjected"]
    locked_bounds = locked_grid.get("sampleBoundsProjectedMeters", {})
    if any(locked_bounds.get(key) != value for key, value in expected_bounds.items()):
        raise RuntimeError("Source lock bounds differ from the current site contract")
    locked_wgs84_bounds = locked_grid.get("sampleBoundsWgs84", {})
    if any(
        locked_wgs84_bounds.get(key) != value
        for key, value in geometry["sampleBoundsWgs84"].items()
    ):
        raise RuntimeError("Source lock WGS84 sample bounds differ from the site contract")
    return geometry


def safe_download_name(record: dict[str, Any]) -> str:
    url = str(record["downloadUrl"])
    name = Path(urllib.parse.urlparse(url).path).name
    if not name or name in {".", ".."}:
        raise RuntimeError(f"Cannot derive a safe filename from {url}")
    return name


def download_file(
    url: str,
    destination: Path,
    declared_size: int | None = None,
    expected_sha256: str | None = None,
) -> tuple[int, str]:
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists():
        size = destination.stat().st_size
        digest = sha256_file(destination)
        size_matches = declared_size is None or size == declared_size
        hash_matches = expected_sha256 is None or digest == expected_sha256
        if size_matches and hash_matches:
            print(f"REUSED {relative_repository_path(destination)}")
            return size, digest
        if expected_sha256 is not None:
            raise RuntimeError(
                f"Locked source drift at {destination}: expected {expected_sha256}, "
                f"found {digest}"
            )

    partial = destination.with_suffix(destination.suffix + ".partial")
    if partial.exists():
        partial.unlink()
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    digest = hashlib.sha256()
    size = 0
    try:
        with urllib.request.urlopen(request, timeout=300) as response, partial.open(
            "wb"
        ) as output:
            while chunk := response.read(1024 * 1024):
                output.write(chunk)
                digest.update(chunk)
                size += len(chunk)
    except Exception:
        if partial.exists():
            partial.unlink()
        raise
    if declared_size is not None and size != declared_size:
        partial.unlink()
        raise RuntimeError(
            f"Downloaded byte count for {url} is {size}, expected {declared_size}"
        )
    actual_sha256 = digest.hexdigest()
    if expected_sha256 is not None and actual_sha256 != expected_sha256:
        partial.unlink()
        raise RuntimeError(
            f"Downloaded hash for {url} is {actual_sha256}, expected {expected_sha256}"
        )
    os.replace(partial, destination)
    print(f"DOWNLOADED {relative_repository_path(destination)} bytes={size}")
    return size, actual_sha256


def acquire_record(record: dict[str, Any], cache: Path, group: str) -> None:
    destination = cache / "sources" / group / safe_download_name(record)
    size, digest = download_file(
        str(record["downloadUrl"]),
        destination,
        int(record["declaredSizeBytes"]) if record["declaredSizeBytes"] else None,
        str(record["sha256"]) if record["sha256"] else None,
    )
    record["downloadedSizeBytes"] = size
    record["sha256"] = digest
    record["cacheRelativePath"] = relative_repository_path(destination)

    metadata_url = record.get("metadataUrl")
    if metadata_url:
        metadata_name = f"{record['sourceId']}.xml"
        metadata_path = cache / "metadata" / metadata_name
        metadata_size, metadata_hash = download_file(
            str(metadata_url),
            metadata_path,
            expected_sha256=(
                str(record["metadataSha256"]) if record["metadataSha256"] else None
            ),
        )
        record["metadataSizeBytes"] = metadata_size
        record["metadataSha256"] = metadata_hash
        record["metadataCacheRelativePath"] = relative_repository_path(metadata_path)


def acquire_datum_grid(record: dict[str, Any], cache: Path) -> None:
    name = str(record["name"])
    if Path(name).name != name or not name.endswith(".tif"):
        raise RuntimeError(f"Unsafe datum grid name: {name}")
    destination = cache / "proj-grids" / name
    size, digest = download_file(
        str(record["downloadUrl"]),
        destination,
        int(record["declaredSizeBytes"]),
        str(record["sha256"]) if record["sha256"] else None,
    )
    record["downloadedSizeBytes"] = size
    record["sha256"] = digest
    record["cacheRelativePath"] = relative_repository_path(destination)


def acquire_orthophoto(
    config: dict[str, Any], lock: dict[str, Any], cache: Path
) -> None:
    geometry = grid_geometry(config)
    bounds = geometry["sampleBoundsProjected"]
    policy = config["sourcePolicy"]
    source_resolution = float(policy["naipSourceResolutionMeters"])
    span = float(bounds["maxEasting"] - bounds["minEasting"])
    source_pixels = math.ceil(span / source_resolution)
    if source_pixels > 4000:
        raise RuntimeError(
            f"Requested NAIP export is {source_pixels}px, above the service 4000px limit"
        )
    object_id = int(lock["orthophoto"]["objectId"])
    mosaic_rule = json.dumps(
        {"mosaicMethod": "esriMosaicLockRaster", "lockRasterIds": [object_id]},
        separators=(",", ":"),
    )
    epsg = int(str(geometry["crsCode"]).split(":")[-1])
    query = urllib.parse.urlencode(
        {
            "f": "json",
            "bbox": (
                f"{bounds['minEasting']},{bounds['minNorthing']},"
                f"{bounds['maxEasting']},{bounds['maxNorthing']}"
            ),
            "bboxSR": epsg,
            "imageSR": epsg,
            "size": f"{source_pixels},{source_pixels}",
            "format": "tiff",
            "pixelType": "U8",
            "interpolation": "RSP_BilinearInterpolation",
            "mosaicRule": mosaic_rule,
        }
    )
    export_url = f"{policy['naipService']}/exportImage?{query}"
    response = request_json(export_url)
    href = response.get("href")
    if not href:
        raise RuntimeError(f"NAIP export did not return an image URL: {response}")
    destination = cache / "sources" / "orthophoto" / "naip-2023-source.tif"
    expected_hash = lock["orthophoto"].get("sha256")
    size, digest = download_file(
        str(href), destination, expected_sha256=str(expected_hash) if expected_hash else None
    )
    lock["orthophoto"].update(
        {
            "exportRequestUrl": export_url,
            "exportResponse": {
                key: response.get(key)
                for key in ("width", "height", "extent", "scale")
                if key in response
            },
            "sha256": digest,
            "downloadedSizeBytes": size,
            "cacheRelativePath": relative_repository_path(destination),
        }
    )


def acquire(config: dict[str, Any], lock_path: Path) -> dict[str, Any]:
    if not lock_path.exists():
        raise RuntimeError("Source lock is missing. Run discover first.")
    lock = read_json(lock_path)
    validate_source_lock_geometry(config, lock)
    cache = repository_path(config["outputs"]["cacheDirectory"])
    work = [
        (group, record)
        for group in ("dem", "lidar")
        for record in lock[group]
    ]
    # USGS serves these as independent immutable tiles. Four bounded workers
    # remove most of the wall-clock cost without turning discovery into an
    # unbounded scraper or loading the server with one connection per tile.
    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = {
            executor.submit(acquire_record, record, cache, group): (group, record)
            for group, record in work
        }
        for future in as_completed(futures):
            group, record = futures[future]
            future.result()
            print(f"ACQUIRED_SOURCE {group} {record['sourceId']}")
            write_json(lock_path, lock)
    for record in lock["datumTransformationGrids"]:
        acquire_datum_grid(record, cache)
        print(f"ACQUIRED_DATUM_GRID {record['name']}")
        write_json(lock_path, lock)
    acquire_orthophoto(config, lock, cache)
    write_json(lock_path, lock)
    print(
        f"ACQUIRED dem={len(lock['dem'])} lidar={len(lock['lidar'])} "
        f"lock={relative_repository_path(lock_path)}"
    )
    return lock


def target_transform(geometry: dict[str, Any], rasterio: Any) -> Any:
    spacing = geometry["spacing"]
    bounds = geometry["sampleBoundsProjected"]
    # Pixel centers, not pixel edges, own the game coordinates. Expanding the
    # affine by half a cell puts the first and last sample exactly at +/-512 m.
    return rasterio.Affine(
        spacing,
        0,
        bounds["minEasting"] - spacing / 2,
        0,
        -spacing,
        bounds["maxNorthing"] + spacing / 2,
    )


def validate_dem_vertical_metadata(record: dict[str, Any]) -> dict[str, str]:
    metadata_path_value = record.get("metadataCacheRelativePath")
    metadata_sha256 = record.get("metadataSha256")
    if not metadata_path_value or not metadata_sha256:
        raise RuntimeError(f"DEM metadata is not acquired: {record.get('sourceId')}")
    metadata_path = repository_path(str(metadata_path_value))
    if sha256_file(metadata_path) != metadata_sha256:
        raise RuntimeError(f"DEM metadata hash drift: {metadata_path}")
    abstract = " ".join(
        text.strip()
        for element in ET.parse(metadata_path).getroot().iter()
        if element.tag.lower().endswith("abstract")
        for text in [element.text or ""]
        if text.strip()
    )
    normalized = " ".join(abstract.lower().split())
    required_claims = {
        "surfaceModel": "bare-earth surface",
        "verticalUnits": "all bare earth elevation values are in meters",
        "verticalDatum": "north american vertical datum of 1988 (navd88)",
    }
    missing = [label for label, phrase in required_claims.items() if phrase not in normalized]
    if missing:
        raise RuntimeError(
            f"DEM metadata lacks required vertical claims {missing}: {metadata_path}"
        )
    return {
        "surfaceModel": "bare-earth DTM",
        "verticalUnits": "meter",
        "verticalDatum": "NAVD88",
        "metadataSha256": str(metadata_sha256),
    }


def build_dtm(
    config: dict[str, Any], lock: dict[str, Any], geometry: dict[str, Any]
) -> tuple[Any, dict[str, Any]]:
    _, np, rasterio, _, _, _ = require_third_party()
    from rasterio.warp import Resampling, reproject

    samples = geometry["samples"]
    transform = target_transform(geometry, rasterio)
    accumulator = np.zeros((samples, samples), dtype=np.float64)
    counts = np.zeros((samples, samples), dtype=np.uint16)
    overlap_min = np.full((samples, samples), np.inf, dtype=np.float32)
    overlap_max = np.full((samples, samples), -np.inf, dtype=np.float32)
    source_metadata: list[dict[str, Any]] = []
    expected_crs = geometry["crs"]
    edge_trim_pixels = int(config["grid"]["demSourceEdgeTrimPixels"])
    if edge_trim_pixels < 0:
        raise RuntimeError("demSourceEdgeTrimPixels cannot be negative")
    target_eastings = (
        geometry["sampleBoundsProjected"]["minEasting"]
        + np.arange(samples) * geometry["spacing"]
    )
    target_northings = (
        geometry["sampleBoundsProjected"]["maxNorthing"]
        - np.arange(samples) * geometry["spacing"]
    )

    for record in lock["dem"]:
        source_path = repository_path(record["cacheRelativePath"])
        if sha256_file(source_path) != record["sha256"]:
            raise RuntimeError(f"DEM source hash drift: {source_path}")
        vertical_metadata = validate_dem_vertical_metadata(record)
        with rasterio.open(source_path) as source:
            if source.crs is None:
                raise RuntimeError(f"DEM has no CRS: {source_path}")
            if source.crs.to_epsg() != expected_crs.to_epsg():
                raise RuntimeError(
                    f"DEM CRS {source.crs} does not match policy {expected_crs}: "
                    f"{source_path}"
                )
            linear_unit_name, linear_unit_to_meters = source.crs.linear_units_factor
            if (
                linear_unit_name.lower() not in {"metre", "meter"}
                or abs(float(linear_unit_to_meters) - 1.0) > 1e-12
            ):
                raise RuntimeError(
                    "DEM horizontal CRS is not meter-linear: "
                    f"{source.crs.linear_units_factor}"
                )
            temporary = np.full((samples, samples), np.nan, dtype=np.float32)
            reproject(
                source=rasterio.band(source, 1),
                destination=temporary,
                src_transform=source.transform,
                src_crs=source.crs,
                src_nodata=source.nodata,
                dst_transform=transform,
                dst_crs=expected_crs,
                dst_nodata=np.nan,
                resampling=Resampling.bilinear,
                init_dest_nodata=True,
                num_threads=2,
            )
            valid = np.isfinite(temporary)
            if edge_trim_pixels:
                trim_x = edge_trim_pixels * abs(float(source.transform.a))
                trim_y = edge_trim_pixels * abs(float(source.transform.e))
                interior_columns = (target_eastings >= source.bounds.left + trim_x) & (
                    target_eastings <= source.bounds.right - trim_x
                )
                interior_rows = (target_northings >= source.bounds.bottom + trim_y) & (
                    target_northings <= source.bounds.top - trim_y
                )
                valid &= interior_rows[:, None] & interior_columns[None, :]
                temporary[~valid] = np.nan
            accumulator[valid] += temporary[valid]
            counts[valid] += 1
            overlap_min[valid] = np.minimum(overlap_min[valid], temporary[valid])
            overlap_max[valid] = np.maximum(overlap_max[valid], temporary[valid])
            source_metadata.append(
                {
                    "sourceId": record["sourceId"],
                    "crs": source.crs.to_string(),
                    "crsWkt": source.crs.to_wkt(),
                    "width": source.width,
                    "height": source.height,
                    "dtype": source.dtypes[0],
                    "noData": source.nodata,
                    "units": list(source.units),
                    "verticalMetadata": vertical_metadata,
                    "boundsProjectedMeters": {
                        "left": source.bounds.left,
                        "bottom": source.bounds.bottom,
                        "right": source.bounds.right,
                        "top": source.bounds.top,
                    },
                }
            )

    missing = int(np.count_nonzero(counts == 0))
    if missing:
        raise RuntimeError(f"DTM grid has {missing} no-data samples")
    dtm = (accumulator / counts).astype(np.float32)
    overlap = counts > 1
    overlap_samples = int(np.count_nonzero(overlap))
    overlap_delta = overlap_max[overlap] - overlap_min[overlap]
    maximum_overlap_delta = float(np.max(overlap_delta)) if overlap_samples else 0.0
    overlap_rmse = (
        float(np.sqrt(np.mean(np.square(overlap_delta)))) if overlap_samples else 0.0
    )
    overlap_p95 = (
        float(np.percentile(overlap_delta, 95)) if overlap_samples else 0.0
    )
    overlap_p99 = (
        float(np.percentile(overlap_delta, 99)) if overlap_samples else 0.0
    )
    if overlap_p95 > 0.02 or overlap_rmse > 0.05 or maximum_overlap_delta > 0.05:
        raise RuntimeError(
            "DEM overlap disagreement exceeds the robust seam budget: "
            f"p95={overlap_p95:.3f}m rmse={overlap_rmse:.3f}m "
            f"max={maximum_overlap_delta:.3f}m"
        )
    return dtm, {
        "sources": source_metadata,
        "sourceEdgeTrimPixels": edge_trim_pixels,
        "overlapSamples": overlap_samples,
        "overlapP95DeltaMeters": overlap_p95,
        "overlapP99DeltaMeters": overlap_p99,
        "overlapRmseMeters": overlap_rmse,
        "maximumOverlapDeltaMeters": maximum_overlap_delta,
        "minimumElevationMeters": float(np.min(dtm)),
        "maximumElevationMeters": float(np.max(dtm)),
        "reliefMeters": float(np.max(dtm) - np.min(dtm)),
    }


def build_surface_offsets(
    config: dict[str, Any],
    lock: dict[str, Any],
    geometry: dict[str, Any],
    dtm: Any,
) -> tuple[Any, dict[str, Any]]:
    laspy, np, _, _, _, projection = require_third_party()
    CRS, _ = projection
    from pyproj.aoi import AreaOfInterest
    from pyproj.transformer import TransformerGroup
    samples = geometry["samples"]
    spacing = geometry["spacing"]
    bounds = geometry["sampleBoundsProjected"]
    target_crs = geometry["crs"]
    surface = np.full((samples, samples), -np.inf, dtype=np.float64)
    classification_histogram: Counter[int] = Counter()
    accepted_points = 0
    inspected_points = 0
    ground_residual_chunks: list[Any] = []
    source_metadata: list[dict[str, Any]] = []

    for record in lock["lidar"]:
        source_path = repository_path(record["cacheRelativePath"])
        if sha256_file(source_path) != record["sha256"]:
            raise RuntimeError(f"Lidar source hash drift: {source_path}")
        with laspy.open(source_path) as reader:
            source_crs = reader.header.parse_crs()
            if source_crs is None:
                raise RuntimeError(f"Lidar source has no CRS: {source_path}")
            source_crs = CRS.from_user_input(source_crs)
            if len(source_crs.axis_info) < 3:
                raise RuntimeError(f"Lidar CRS has no declared vertical axis: {source_path}")
            vertical_axis = source_crs.axis_info[2]
            if "NAVD88" not in source_crs.name:
                raise RuntimeError(f"Lidar vertical datum is not NAVD88: {source_crs.name}")
            vertical_to_meters = float(vertical_axis.unit_conversion_factor)
            if vertical_to_meters <= 0:
                raise RuntimeError(f"Lidar vertical unit cannot be converted: {source_path}")
            horizontal_crs = (
                source_crs.sub_crs_list[0] if source_crs.is_compound else source_crs
            )
            transformer_group = TransformerGroup(
                horizontal_crs,
                target_crs,
                always_xy=True,
                area_of_interest=AreaOfInterest(
                    west_lon_degree=geometry["queryBoundsWgs84"]["west"],
                    south_lat_degree=geometry["queryBoundsWgs84"]["south"],
                    east_lon_degree=geometry["queryBoundsWgs84"]["east"],
                    north_lat_degree=geometry["queryBoundsWgs84"]["north"],
                ),
                allow_ballpark=False,
            )
            if not transformer_group.best_available or not transformer_group.transformers:
                missing = sorted(
                    {
                        grid.short_name
                        for operation in transformer_group.unavailable_operations
                        for grid in operation.grids
                        if not grid.available
                    }
                )
                raise RuntimeError(
                    "Accurate lidar horizontal transform is unavailable; missing "
                    + ", ".join(missing)
                )
            transformer = transformer_group.transformers[0]
            if transformer.accuracy < 0 or transformer.accuracy > 0.25:
                raise RuntimeError(
                    "Lidar horizontal transform accuracy exceeds 0.25 m: "
                    f"{transformer.accuracy}"
                )
            source_accepted = 0
            source_inspected = 0
            for points in reader.chunk_iterator(2_000_000):
                x = np.asarray(points.x, dtype=np.float64)
                y = np.asarray(points.y, dtype=np.float64)
                z = np.asarray(points.z, dtype=np.float64) * vertical_to_meters
                source_inspected += len(x)
                x, y = transformer.transform(x, y)
                classification = np.asarray(points.classification, dtype=np.uint8)
                return_number = np.asarray(points.return_number, dtype=np.uint8)
                in_bounds = (
                    (x >= bounds["minEasting"] - spacing / 2)
                    & (x <= bounds["maxEasting"] + spacing / 2)
                    & (y >= bounds["minNorthing"] - spacing / 2)
                    & (y <= bounds["maxNorthing"] + spacing / 2)
                )
                valid = (
                    in_bounds
                    & np.isfinite(z)
                    & (return_number == 1)
                    & ~np.isin(classification, np.array([7, 18], dtype=np.uint8))
                )
                if hasattr(points, "withheld"):
                    valid &= np.asarray(points.withheld, dtype=np.uint8) == 0
                if not np.any(valid):
                    continue
                selected_classification = classification[valid]
                classes, class_counts = np.unique(
                    selected_classification, return_counts=True
                )
                classification_histogram.update(
                    {
                        int(value): int(count)
                        for value, count in zip(classes.tolist(), class_counts.tolist())
                    }
                )
                selected_x = x[valid]
                selected_y = y[valid]
                selected_z = z[valid]
                columns = np.rint(
                    (selected_x - bounds["minEasting"]) / spacing
                ).astype(np.int64)
                rows = np.rint(
                    (bounds["maxNorthing"] - selected_y) / spacing
                ).astype(np.int64)
                cell_valid = (
                    (columns >= 0)
                    & (columns < samples)
                    & (rows >= 0)
                    & (rows < samples)
                )
                valid_rows = rows[cell_valid]
                valid_columns = columns[cell_valid]
                valid_z = selected_z[cell_valid]
                valid_classification = selected_classification[cell_valid]
                indices = valid_rows * samples + valid_columns
                np.maximum.at(surface.reshape(-1), indices, valid_z)
                ground = valid_classification == 2
                if np.any(ground):
                    ground_residual_chunks.append(
                        (
                            valid_z[ground]
                            - dtm[valid_rows[ground], valid_columns[ground]]
                        ).astype(np.float32)
                    )
                count = int(np.count_nonzero(cell_valid))
                source_accepted += count
                accepted_points += count
            inspected_points += source_inspected
            source_metadata.append(
                {
                    "sourceId": record["sourceId"],
                    "crs": source_crs.to_string(),
                    "crsWkt": source_crs.to_wkt(),
                    "verticalDatum": "NAVD88",
                    "verticalSourceUnit": vertical_axis.unit_name,
                    "verticalToMeters": vertical_to_meters,
                    "horizontalTransform": transformer.description,
                    "horizontalTransformAccuracyMeters": transformer.accuracy,
                    "horizontalTransformUsesBallparkOffset": False,
                    "pointsInspected": source_inspected,
                    "firstReturnsAccepted": source_accepted,
                }
            )

    if not ground_residual_chunks:
        raise RuntimeError("No class-2 lidar returns overlap the DTM grid")
    ground_residuals = np.concatenate(ground_residual_chunks)
    absolute_ground_residuals = np.abs(ground_residuals)
    ground_residual_evidence = {
        "samples": int(ground_residuals.size),
        "signedP05Meters": float(np.percentile(ground_residuals, 5)),
        "signedP50Meters": float(np.percentile(ground_residuals, 50)),
        "signedP95Meters": float(np.percentile(ground_residuals, 95)),
        "absoluteP50Meters": float(np.percentile(absolute_ground_residuals, 50)),
        "absoluteP95Meters": float(np.percentile(absolute_ground_residuals, 95)),
        "maximumAbsoluteMeters": float(np.max(absolute_ground_residuals)),
    }
    if (
        abs(ground_residual_evidence["signedP50Meters"]) > 0.10
        or ground_residual_evidence["absoluteP95Meters"] > 0.25
    ):
        raise RuntimeError(
            "Measured lidar/DTM ground registration exceeds budget: "
            f"median={ground_residual_evidence['signedP50Meters']:.3f}m "
            f"absoluteP95={ground_residual_evidence['absoluteP95Meters']:.3f}m"
        )

    populated = np.isfinite(surface)
    offsets = np.full((samples, samples), 65535, dtype=np.uint16)
    centimeters = np.rint(np.maximum(0.0, surface[populated] - dtm[populated]) * 100)
    centimeters = np.clip(centimeters, 0, 65534).astype(np.uint16)
    offsets[populated] = centimeters
    populated_cells = int(np.count_nonzero(populated))
    return offsets, {
        "sources": source_metadata,
        "pointsInspected": inspected_points,
        "firstReturnsAccepted": accepted_points,
        "populatedCells": populated_cells,
        "coverageRatio": populated_cells / (samples * samples),
        "classificationHistogram": {
            str(key): classification_histogram[key]
            for key in sorted(classification_histogram)
        },
        "groundToDtmResidual": ground_residual_evidence,
        "maximumSurfaceOffsetMeters": (
            float(np.max(centimeters)) / 100 if populated_cells else 0.0
        ),
    }


def build_orthophoto(
    config: dict[str, Any], lock: dict[str, Any], geometry: dict[str, Any]
) -> tuple[Any, dict[str, Any]]:
    _, np, rasterio, Image, _, _ = require_third_party()
    from rasterio.warp import Resampling, reproject

    source_path = repository_path(lock["orthophoto"]["cacheRelativePath"])
    if sha256_file(source_path) != lock["orthophoto"]["sha256"]:
        raise RuntimeError(f"Orthophoto source hash drift: {source_path}")
    pixels = int(config["sourcePolicy"]["naipRuntimePixelsPerAxis"])
    bounds = geometry["sampleBoundsProjected"]
    width = float(bounds["maxEasting"] - bounds["minEasting"])
    pixel_size = width / pixels
    destination_transform = rasterio.Affine(
        pixel_size,
        0,
        bounds["minEasting"],
        0,
        -pixel_size,
        bounds["maxNorthing"],
    )
    rgb = np.zeros((3, pixels, pixels), dtype=np.uint8)
    validity = np.zeros((pixels, pixels), dtype=np.uint8)
    with rasterio.open(source_path) as source:
        if source.crs is None:
            raise RuntimeError("Orthophoto export has no CRS")
        if source.count < 3:
            raise RuntimeError(f"Orthophoto export has only {source.count} bands")
        for band in range(3):
            reproject(
                source=rasterio.band(source, band + 1),
                destination=rgb[band],
                src_transform=source.transform,
                src_crs=source.crs,
                dst_transform=destination_transform,
                dst_crs=geometry["crs"],
                resampling=Resampling.bilinear,
                dst_nodata=0,
                num_threads=2,
            )
        reproject(
            source=source.dataset_mask(),
            destination=validity,
            src_transform=source.transform,
            src_crs=source.crs,
            dst_transform=destination_transform,
            dst_crs=geometry["crs"],
            resampling=Resampling.nearest,
            dst_nodata=0,
            num_threads=2,
        )
        missing_pixels = int(np.count_nonzero(validity == 0))
        if missing_pixels:
            raise RuntimeError(f"Orthophoto has {missing_pixels} no-data pixels")
        metadata = {
            "sourceCrs": source.crs.to_string(),
            "sourceWidth": source.width,
            "sourceHeight": source.height,
            "sourceBands": source.count,
            "runtimeWidth": pixels,
            "runtimeHeight": pixels,
            "runtimePixelSizeMeters": pixel_size,
            "rowOrder": "north-to-south",
            "columnOrder": "west-to-east",
            "encoder": f"Pillow WebP quality=92 method=6",
        }
    image = Image.fromarray(np.moveaxis(rgb, 0, 2), mode="RGB")
    return image, metadata


def write_hillshade(dtm: Any, spacing: float, path: Path) -> Any:
    _, np, _, Image, _, _ = require_third_party()
    row_gradient, column_gradient = np.gradient(dtm.astype(np.float64), spacing)
    slope = np.arctan(np.hypot(column_gradient, row_gradient))
    aspect = np.arctan2(-column_gradient, row_gradient)
    azimuth = math.radians(315)
    altitude = math.radians(45)
    shaded = (
        math.sin(altitude) * np.cos(slope)
        + math.cos(altitude) * np.sin(slope) * np.cos(azimuth - aspect)
    )
    normalized = np.clip((shaded + 1) * 127.5, 0, 255).astype(np.uint8)
    image = Image.fromarray(normalized, mode="L")
    path.parent.mkdir(parents=True, exist_ok=True)
    atomic_save_image(image, path, "PNG", optimize=False)
    return image


def write_section(
    values: Any, title: str, span_meters: float, path: Path
) -> None:
    _, np, _, Image, ImageDraw, _ = require_third_party()
    width, height = 1600, 480
    margin_x, margin_y = 90, 60
    image = Image.new("RGB", (width, height), "#111827")
    draw = ImageDraw.Draw(image)
    minimum = float(np.min(values))
    maximum = float(np.max(values))
    relief = max(0.001, maximum - minimum)
    for index in range(5):
        y = margin_y + index * (height - 2 * margin_y) / 4
        elevation = maximum - index * relief / 4
        draw.line((margin_x, y, width - margin_x, y), fill="#334155", width=1)
        draw.text((8, y - 7), f"{elevation:.1f} m", fill="#cbd5e1")
    points = []
    for index, value in enumerate(values):
        x = margin_x + index * (width - 2 * margin_x) / (len(values) - 1)
        y = margin_y + (maximum - float(value)) / relief * (height - 2 * margin_y)
        points.append((x, y))
    draw.line(points, fill="#86efac", width=3)
    draw.text((margin_x, 20), title, fill="white")
    draw.text(
        (margin_x, height - 30),
        f"0 m{' ' * 86}{span_meters:.0f} m | relief {relief:.2f} m",
        fill="#cbd5e1",
    )
    path.parent.mkdir(parents=True, exist_ok=True)
    atomic_save_image(image, path, "PNG", optimize=False)


def write_registration_contact_sheet(
    ortho: Any, hillshade: Any, path: Path
) -> None:
    _, _, _, Image, ImageDraw, _ = require_third_party()
    size = 768
    ortho_panel = ortho.resize((size, size), Image.Resampling.LANCZOS)
    shade_panel = hillshade.convert("RGB").resize(
        (size, size), Image.Resampling.LANCZOS
    )
    overlay = Image.blend(ortho_panel, shade_panel, 0.35)
    header = 44
    sheet = Image.new("RGB", (size * 3, size + header), "#0f172a")
    sheet.paste(ortho_panel, (0, header))
    sheet.paste(shade_panel, (size, header))
    sheet.paste(overlay, (size * 2, header))
    draw = ImageDraw.Draw(sheet)
    draw.text((16, 14), "NAIP 2023 north-up", fill="white")
    draw.text((size + 16, 14), "USGS 3DEP hillshade", fill="white")
    draw.text((size * 2 + 16, 14), "registration overlay", fill="white")
    path.parent.mkdir(parents=True, exist_ok=True)
    atomic_save_image(sheet, path, "PNG", optimize=False)


def write_lidar_registration_contact_sheet(
    ortho: Any, surface_offsets: Any, path: Path
) -> None:
    """Show whether lidar canopy/building returns land on the matching imagery."""
    _, np, _, Image, ImageDraw, _ = require_third_party()
    size = 768
    ortho_panel = ortho.resize((size, size), Image.Resampling.LANCZOS).convert("RGB")
    valid = surface_offsets != 65535
    normalized = np.zeros(surface_offsets.shape, dtype=np.uint8)
    normalized[valid] = np.clip(
        surface_offsets[valid].astype(np.float64) / 3000 * 255, 0, 255
    ).astype(np.uint8)
    heat_rgb = np.stack(
        (
            normalized,
            np.minimum(normalized.astype(np.uint16) * 2, 255).astype(np.uint8),
            np.full_like(normalized, 80),
        ),
        axis=2,
    )
    surface_panel = Image.fromarray(heat_rgb, mode="RGB").resize(
        (size, size), Image.Resampling.NEAREST
    )
    canopy_mask = Image.fromarray(
        np.where(valid & (surface_offsets >= 200), 120, 0).astype(np.uint8),
        mode="L",
    ).resize((size, size), Image.Resampling.NEAREST)
    overlay = ortho_panel.convert("RGBA")
    mask_layer = Image.new("RGBA", (size, size), (255, 94, 0, 0))
    mask_layer.putalpha(canopy_mask)
    overlay.alpha_composite(mask_layer)
    header = 44
    sheet = Image.new("RGB", (size * 3, size + header), "#0f172a")
    sheet.paste(ortho_panel, (0, header))
    sheet.paste(surface_panel, (size, header))
    sheet.paste(overlay.convert("RGB"), (size * 2, header))
    draw = ImageDraw.Draw(sheet)
    draw.text((16, 14), "NAIP 2023 north-up", fill="white")
    draw.text((size + 16, 14), "2021 lidar height above DTM (0-30 m)", fill="white")
    draw.text((size * 2 + 16, 14), "returns >=2 m over imagery", fill="white")
    path.parent.mkdir(parents=True, exist_ok=True)
    atomic_save_image(sheet, path, "PNG", optimize=False)


def runtime_asset_url(path: Path, runtime_directory: Path) -> str:
    relative = path.resolve().relative_to(runtime_directory.resolve()).as_posix()
    return f"/data/flow-fest-sim/{relative}"


def build(config: dict[str, Any], lock_path: Path) -> dict[str, Any]:
    _, np, _, _, _, _ = require_third_party()
    lock = read_json(lock_path)
    for group in ("dem", "lidar"):
        if any(not record.get("sha256") for record in lock[group]):
            raise RuntimeError(f"{group} sources have not been acquired")
    if not lock["orthophoto"].get("sha256"):
        raise RuntimeError("Orthophoto source has not been acquired")
    configure_proj_data(config, lock)

    geometry = validate_source_lock_geometry(config, lock)
    runtime_directory = repository_path(config["outputs"]["runtimeDirectory"])
    evidence_directory = repository_path(config["outputs"]["evidenceDirectory"])
    runtime_directory.mkdir(parents=True, exist_ok=True)
    evidence_directory.mkdir(parents=True, exist_ok=True)

    dtm, dtm_evidence = build_dtm(config, lock, geometry)
    vertical_step = float(config["worldFrame"]["verticalOriginStepMeters"])
    vertical_origin = math.floor(float(np.min(dtm)) / vertical_step) * vertical_step
    height_path = runtime_directory / "terrain-height.f32"
    atomic_array_to_file(dtm.astype("<f4", copy=False), height_path)

    surface_offsets, surface_evidence = build_surface_offsets(
        config, lock, geometry, dtm
    )
    surface_path = runtime_directory / "surface-offset.u16"
    atomic_array_to_file(surface_offsets.astype("<u2", copy=False), surface_path)

    orthophoto, orthophoto_evidence = build_orthophoto(config, lock, geometry)
    orthophoto_path = runtime_directory / "ortho.webp"
    atomic_save_image(
        orthophoto, orthophoto_path, "WEBP", quality=92, method=6
    )

    hillshade_path = evidence_directory / "terrain-hillshade.png"
    hillshade = write_hillshade(dtm, geometry["spacing"], hillshade_path)
    center = geometry["samples"] // 2
    span = geometry["halfSpan"] * 2
    write_section(
        dtm[center, :],
        "Flow Fest Sim terrain: west to east through world origin",
        span,
        evidence_directory / "terrain-section-west-east.png",
    )
    write_section(
        dtm[:, center],
        "Flow Fest Sim terrain: north to south through world origin",
        span,
        evidence_directory / "terrain-section-north-south.png",
    )
    write_registration_contact_sheet(
        orthophoto,
        hillshade,
        evidence_directory / "terrain-registration-contact-sheet.png",
    )
    lidar_registration_path = (
        evidence_directory / "lidar-surface-registration-contact-sheet.png"
    )
    write_lidar_registration_contact_sheet(
        orthophoto, surface_offsets, lidar_registration_path
    )

    half_span = geometry["halfSpan"]
    lock_sha256 = sha256_file(lock_path)
    manifest = {
        "schemaVersion": 2,
        "pipelineVersion": PIPELINE_VERSION,
        "siteId": config["siteId"],
        "displayName": config["displayName"],
        "toolchain": {
            "python": platform.python_version(),
            **{
                package: importlib.metadata.version(package)
                for package in (
                    "affine",
                    "attrs",
                    "certifi",
                    "click",
                    "colorama",
                    "laspy",
                    "lazrs",
                    "numpy",
                    "pillow",
                    "pyparsing",
                    "pyproj",
                    "rasterio",
                )
            },
        },
        "sourceLock": {
            "path": relative_repository_path(lock_path),
            "sha256": lock_sha256,
        },
        "worldFrame": {
            "units": "meter",
            "metersPerUnit": 1,
            "handedness": "right",
            "axes": {"x": "east", "y": "up", "z": "south"},
            "projectedCrs": {
                "authority": "EPSG",
                "code": int(str(geometry["crsCode"]).split(":")[-1]),
                "name": geometry["crs"].name,
                "wkt": geometry["crs"].to_wkt(),
            },
            "requestedAnchorWgs84": geometry["requestedAnchorWgs84"],
            "resolvedOriginWgs84": geometry["resolvedOriginWgs84"],
            "originProjectedMeters": {
                "easting": geometry["originEasting"],
                "northing": geometry["originNorthing"],
            },
            "vertical": {
                "datum": config["worldFrame"]["verticalDatum"],
                "originElevationMeters": vertical_origin,
                "scale": 1,
            },
            "transform": {
                "worldX": "projectedEasting - originEasting",
                "worldZ": "originNorthing - projectedNorthing",
                "worldY": "navd88Elevation - originElevation",
            },
        },
        "terrain": {
            "height": {
                "path": runtime_asset_url(height_path, runtime_directory),
                "productType": "DTM",
                "encoding": "float32-le",
                "layout": "row-major",
                "rowOrder": "north-to-south",
                "columnOrder": "west-to-east",
                "width": geometry["samples"],
                "height": geometry["samples"],
                "sampleSpacingMeters": geometry["spacing"],
                "nativeGroundSampleDistanceMeters": 1,
                "resamplingKernel": "bilinear",
                "minimumElevationMeters": float(np.min(dtm)),
                "maximumElevationMeters": float(np.max(dtm)),
                "reliefMeters": float(np.max(dtm) - np.min(dtm)),
                "noDataSamples": 0,
                "byteLength": height_path.stat().st_size,
                "sha256": sha256_file(height_path),
            },
            "sampleBoundsWorldMeters": {
                "minX": -half_span,
                "maxX": half_span,
                "minZ": -half_span,
                "maxZ": half_span,
            },
            "coverageBoundaryWorldMeters": [
                {"x": -half_span, "z": -half_span},
                {"x": half_span, "z": -half_span},
                {"x": half_span, "z": half_span},
                {"x": -half_span, "z": half_span},
            ],
        },
        "surfaceEvidence": {
            "path": runtime_asset_url(surface_path, runtime_directory),
            "encoding": "uint16-le-centimeters-above-dtm",
            "noDataValue": 65535,
            "width": geometry["samples"],
            "height": geometry["samples"],
            "byteLength": surface_path.stat().st_size,
            "sha256": sha256_file(surface_path),
            "coverageRatio": surface_evidence["coverageRatio"],
            "maximumOffsetMeters": surface_evidence["maximumSurfaceOffsetMeters"],
            "sampleSpacingMeters": geometry["spacing"],
            "sampleBoundsWorldMeters": {
                "minX": -half_span,
                "maxX": half_span,
                "minZ": -half_span,
                "maxZ": half_span,
            },
        },
        "orthophoto": {
            "path": runtime_asset_url(orthophoto_path, runtime_directory),
            "format": "webp",
            "width": orthophoto.width,
            "height": orthophoto.height,
            "rowOrder": "north-to-south",
            "columnOrder": "west-to-east",
            "sourceYear": lock["orthophoto"]["year"],
            "sourceAcquisitionDateUnixMilliseconds": lock["orthophoto"][
                "acquisitionDateUnixMilliseconds"
            ],
            "sourceResolutionMeters": lock["orthophoto"]["sourceResolutionMeters"],
            "runtimePixelSizeMeters": orthophoto_evidence[
                "runtimePixelSizeMeters"
            ],
            "projectedCrs": {
                "authority": "EPSG",
                "code": int(str(geometry["crsCode"]).split(":")[-1]),
            },
            "sampleBoundsWorldMeters": {
                "minX": -half_span,
                "maxX": half_span,
                "minZ": -half_span,
                "maxZ": half_span,
            },
            "byteLength": orthophoto_path.stat().st_size,
            "sha256": sha256_file(orthophoto_path),
        },
        "sources": {
            "dem": [
                {
                    key: record.get(key)
                    for key in (
                        "sourceId",
                        "title",
                        "publicationDate",
                        "downloadUrl",
                        "metadataUrl",
                        "sha256",
                    )
                }
                for record in lock["dem"]
            ],
            "lidar": [
                {
                    key: record.get(key)
                    for key in (
                        "sourceId",
                        "title",
                        "publicationDate",
                        "downloadUrl",
                        "metadataUrl",
                        "sha256",
                    )
                }
                for record in lock["lidar"]
            ],
            "datumTransformationGrids": [
                {
                    key: record.get(key)
                    for key in (
                        "name",
                        "downloadUrl",
                        "declaredSizeBytes",
                        "sha256",
                    )
                }
                for record in lock["datumTransformationGrids"]
            ],
            "orthophoto": {
                key: lock["orthophoto"].get(key)
                for key in (
                    "objectId",
                    "rasterName",
                    "year",
                    "acquisitionDateUnixMilliseconds",
                    "agency",
                    "vendor",
                    "sourceResolutionMeters",
                    "serviceUrl",
                    "sha256",
                )
            },
            "rights": {
                "dem": config["sourcePolicy"]["demRights"],
                "lidar": config["sourcePolicy"]["lidarRights"],
                "datumTransformationGrids": config["sourcePolicy"][
                    "datumTransformationRights"
                ],
                "orthophoto": config["sourcePolicy"]["naipRights"],
            },
        },
        "evidence": {
            "dtm": dtm_evidence,
            "lidarSurface": surface_evidence,
            "orthophoto": orthophoto_evidence,
            "hillshade": relative_repository_path(hillshade_path),
            "registrationContactSheet": relative_repository_path(
                evidence_directory / "terrain-registration-contact-sheet.png"
            ),
            "lidarSurfaceRegistrationContactSheet": {
                "path": relative_repository_path(lidar_registration_path),
                "sha256": sha256_file(lidar_registration_path),
            },
        },
    }
    manifest_path = runtime_directory / "terrain.manifest.json"
    write_json(manifest_path, manifest)
    print(
        f"BUILT samples={geometry['samples']}x{geometry['samples']} "
        f"relief={manifest['terrain']['height']['reliefMeters']:.3f}m "
        f"manifest={relative_repository_path(manifest_path)}"
    )
    return manifest


def check(condition: bool, label: str, failures: list[str]) -> None:
    if condition:
        print(f"  PASS {label}")
    else:
        print(f"  FAIL {label}")
        failures.append(label)


def verify(config: dict[str, Any], lock_path: Path) -> dict[str, Any]:
    _, np, _, Image, _, projection = require_third_party()
    _, Transformer = projection
    failures: list[str] = []
    runtime_directory = repository_path(config["outputs"]["runtimeDirectory"])
    evidence_directory = repository_path(config["outputs"]["evidenceDirectory"])
    manifest_path = runtime_directory / "terrain.manifest.json"
    manifest = read_json(manifest_path)
    lock = read_json(lock_path)
    configure_proj_data(config, lock)
    geometry = validate_source_lock_geometry(config, lock)
    height = manifest["terrain"]["height"]
    height_path = repository_path("static" + str(height["path"]))
    samples = int(config["grid"]["samplesPerAxis"])
    expected_bytes = samples * samples * 4
    print("runtime contract")
    check(manifest.get("schemaVersion") == 2, "schema version is 2", failures)
    check(
        height["path"] == "/data/flow-fest-sim/terrain-height.f32"
        and "hannons-camp-terrain.json" not in height["path"],
        "runtime manifest cannot select the quarantined legacy artifact",
        failures,
    )
    check(height["width"] == samples, "height width matches config", failures)
    check(height["height"] == samples, "height height matches config", failures)
    check(height_path.stat().st_size == expected_bytes, "height byte length", failures)
    check(sha256_file(height_path) == height["sha256"], "height SHA-256", failures)
    values = np.fromfile(height_path, dtype="<f4").reshape((samples, samples))
    check(bool(np.all(np.isfinite(values))), "all DTM samples are finite", failures)
    check(
        abs(float(np.min(values)) - float(height["minimumElevationMeters"])) < 1e-5,
        "minimum elevation matches binary",
        failures,
    )
    check(
        abs(float(np.max(values)) - float(height["maximumElevationMeters"])) < 1e-5,
        "maximum elevation matches binary",
        failures,
    )
    check(
        abs(
            float(np.max(values) - np.min(values)) - float(height["reliefMeters"])
        )
        < 1e-5,
        "relief matches binary",
        failures,
    )
    check(
        manifest["worldFrame"]["vertical"]["scale"] == 1,
        "vertical scale is exactly 1",
        failures,
    )
    check(
        manifest["worldFrame"]["axes"] == {"x": "east", "y": "up", "z": "south"},
        "axis contract is east/up/south",
        failures,
    )
    expected_epsg = int(str(geometry["crsCode"]).split(":")[-1])
    check(
        all(
            source["crs"] == geometry["crsCode"]
            and source["verticalMetadata"]["verticalUnits"] == "meter"
            and source["verticalMetadata"]["verticalDatum"] == "NAVD88"
            and source["verticalMetadata"]["surfaceModel"] == "bare-earth DTM"
            for source in manifest["evidence"]["dtm"]["sources"]
        ),
        "DTM evidence reasserts policy CRS, bare-earth model, NAVD88, and meters",
        failures,
    )
    check(
        manifest["worldFrame"]["projectedCrs"]["code"] == expected_epsg,
        "published projected CRS matches the site policy",
        failures,
    )

    print("world transform")
    origin = manifest["worldFrame"]["originProjectedMeters"]
    bounds = manifest["terrain"]["sampleBoundsWorldMeters"]
    projected_bounds = geometry["sampleBoundsProjected"]
    for label, world_x, world_z, expected_easting, expected_northing in (
        (
            "northwest",
            bounds["minX"],
            bounds["minZ"],
            projected_bounds["minEasting"],
            projected_bounds["maxNorthing"],
        ),
        (
            "northeast",
            bounds["maxX"],
            bounds["minZ"],
            projected_bounds["maxEasting"],
            projected_bounds["maxNorthing"],
        ),
        (
            "southeast",
            bounds["maxX"],
            bounds["maxZ"],
            projected_bounds["maxEasting"],
            projected_bounds["minNorthing"],
        ),
        (
            "southwest",
            bounds["minX"],
            bounds["maxZ"],
            projected_bounds["minEasting"],
            projected_bounds["minNorthing"],
        ),
        (
            "origin",
            0.0,
            0.0,
            geometry["originEasting"],
            geometry["originNorthing"],
        ),
    ):
        easting = origin["easting"] + world_x
        northing = origin["northing"] - world_z
        check(
            abs(easting - expected_easting) < 1e-9
            and abs(northing - expected_northing) < 1e-9,
            f"{label} published world coordinate matches source-grid geometry",
            failures,
        )
    to_projected = Transformer.from_crs(
        "EPSG:4326", geometry["crs"], always_xy=True
    )
    resolved = manifest["worldFrame"]["resolvedOriginWgs84"]
    resolved_easting, resolved_northing = to_projected.transform(
        resolved["longitude"], resolved["latitude"]
    )
    check(
        abs(resolved_easting - origin["easting"]) < 0.001
        and abs(resolved_northing - origin["northing"]) < 0.001,
        "resolved WGS84 origin returns within 1 mm",
        failures,
    )
    requested = manifest["worldFrame"]["requestedAnchorWgs84"]
    requested_easting, requested_northing = to_projected.transform(
        requested["longitude"], requested["latitude"]
    )
    check(
        math.hypot(
            requested_easting - origin["easting"],
            requested_northing - origin["northing"],
        )
        <= math.sqrt(0.5**2 + 0.5**2) + 1e-9,
        "requested WGS84 anchor lies within the integer-meter origin snap",
        failures,
    )

    print("derived layers and source lock")
    surface = manifest["surfaceEvidence"]
    surface_path = repository_path("static" + str(surface["path"]))
    check(
        surface_path.stat().st_size == samples * samples * 2,
        "surface byte length",
        failures,
    )
    check(
        sha256_file(surface_path) == surface["sha256"],
        "surface SHA-256",
        failures,
    )
    orthophoto = manifest["orthophoto"]
    orthophoto_path = repository_path("static" + str(orthophoto["path"]))
    check(
        sha256_file(orthophoto_path) == orthophoto["sha256"],
        "orthophoto SHA-256",
        failures,
    )
    with Image.open(orthophoto_path) as image:
        check(
            image.size == (orthophoto["width"], orthophoto["height"]),
            "orthophoto dimensions",
            failures,
        )
    ortho_extent = lock["orthophoto"]["exportResponse"]["extent"]
    ortho_extent_matches = (
        ortho_extent["xmin"] == projected_bounds["minEasting"]
        and ortho_extent["xmax"] == projected_bounds["maxEasting"]
        and ortho_extent["ymin"] == projected_bounds["minNorthing"]
        and ortho_extent["ymax"] == projected_bounds["maxNorthing"]
        and ortho_extent["spatialReference"]["wkid"]
        == int(str(geometry["crsCode"]).split(":")[-1])
        and orthophoto["sampleBoundsWorldMeters"]
        == manifest["terrain"]["sampleBoundsWorldMeters"]
        and abs(
            orthophoto["runtimePixelSizeMeters"] * orthophoto["width"]
            - (projected_bounds["maxEasting"] - projected_bounds["minEasting"])
        )
        < 1e-9
    )
    check(
        ortho_extent_matches,
        "orthophoto footprint, CRS, and pixel size match terrain",
        failures,
    )
    lidar_registration = manifest["evidence"][
        "lidarSurfaceRegistrationContactSheet"
    ]
    lidar_registration_path = repository_path(lidar_registration["path"])
    check(
        sha256_file(lidar_registration_path) == lidar_registration["sha256"],
        "lidar/imagery registration evidence SHA-256",
        failures,
    )
    check(
        sha256_file(lock_path) == manifest["sourceLock"]["sha256"],
        "source-lock SHA-256",
        failures,
    )
    for group in ("dem", "lidar"):
        for record in lock[group]:
            source_path = repository_path(record["cacheRelativePath"])
            check(
                sha256_file(source_path) == record["sha256"],
                f"{group} source {record['sourceId']} SHA-256",
                failures,
            )
            metadata_path = repository_path(record["metadataCacheRelativePath"])
            check(
                sha256_file(metadata_path) == record["metadataSha256"],
                f"{group} metadata {record['sourceId']} SHA-256",
                failures,
            )
            if group == "dem":
                try:
                    validate_dem_vertical_metadata(record)
                    metadata_valid = True
                except RuntimeError:
                    metadata_valid = False
                check(
                    metadata_valid,
                    f"dem metadata {record['sourceId']} declares bare-earth NAVD88 meters",
                    failures,
                )
    for record in lock["datumTransformationGrids"]:
        source_path = repository_path(record["cacheRelativePath"])
        check(
            sha256_file(source_path) == record["sha256"],
            f"datum grid {record['name']} SHA-256",
            failures,
        )
    lidar_evidence = manifest["evidence"]["lidarSurface"]
    check(
        all(
            source["horizontalTransformAccuracyMeters"] >= 0
            and source["horizontalTransformAccuracyMeters"] <= 0.25
            and not source["horizontalTransformUsesBallparkOffset"]
            for source in lidar_evidence["sources"]
        ),
        "lidar transforms use source-locked NADCON5 grids at <=0.25 m accuracy",
        failures,
    )
    ground_residual = lidar_evidence["groundToDtmResidual"]
    check(
        ground_residual["samples"] > 0
        and abs(ground_residual["signedP50Meters"]) <= 0.10
        and ground_residual["absoluteP95Meters"] <= 0.25,
        "measured class-2 lidar/DTM ground residual stays within budget",
        failures,
    )

    report = {
        "schemaVersion": 1,
        "siteId": config["siteId"],
        "status": "PASS" if not failures else "FAIL",
        "failures": failures,
        "terrain": {
            "samplesPerAxis": samples,
            "sampleSpacingMeters": config["grid"]["sampleSpacingMeters"],
            "minimumElevationMeters": float(np.min(values)),
            "maximumElevationMeters": float(np.max(values)),
            "reliefMeters": float(np.max(values) - np.min(values)),
            "verticalScale": manifest["worldFrame"]["vertical"]["scale"],
            "sha256": height["sha256"],
        },
        "surfaceEvidence": {
            "coverageRatio": surface["coverageRatio"],
            "maximumOffsetMeters": surface["maximumOffsetMeters"],
            "sha256": surface["sha256"],
            "pointsInspected": lidar_evidence["pointsInspected"],
            "firstReturnsAccepted": lidar_evidence["firstReturnsAccepted"],
            "horizontalTransformMaximumAccuracyMeters": max(
                source["horizontalTransformAccuracyMeters"]
                for source in lidar_evidence["sources"]
            ),
            "usesBallparkHorizontalTransform": any(
                source["horizontalTransformUsesBallparkOffset"]
                for source in lidar_evidence["sources"]
            ),
            "groundToDtmResidual": ground_residual,
        },
        "orthophoto": {
            "width": orthophoto["width"],
            "height": orthophoto["height"],
            "sourceYear": orthophoto["sourceYear"],
            "sha256": orthophoto["sha256"],
        },
        "sourceCounts": {
            "dem": len(lock["dem"]),
            "lidar": len(lock["lidar"]),
            "datumTransformationGrids": len(lock["datumTransformationGrids"]),
            "orthophoto": 1,
        },
        "sourceLockSha256": manifest["sourceLock"]["sha256"],
    }
    report_path = evidence_directory / "geospatial-validation.json"
    write_json(report_path, report)
    if failures:
        raise RuntimeError(f"Geospatial verification failed: {', '.join(failures)}")
    print(f"VERIFIED report={relative_repository_path(report_path)}")
    return report


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "command", choices=("discover", "acquire", "build", "verify", "all")
    )
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG)
    parser.add_argument(
        "--refresh",
        action="store_true",
        help="Refresh the checked source selection before an all build",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    config_path = args.config.resolve()
    config = read_json(config_path)
    if config.get("schemaVersion") != 1:
        raise RuntimeError("Unsupported site config schema")
    lock_path = repository_path(config["outputs"]["sourceLock"])

    if args.command == "discover":
        discover(config, lock_path)
    elif args.command == "acquire":
        acquire(config, lock_path)
    elif args.command == "build":
        build(config, lock_path)
    elif args.command == "verify":
        verify(config, lock_path)
    else:
        if args.refresh or not lock_path.exists():
            discover(config, lock_path)
        acquire(config, lock_path)
        build(config, lock_path)
        verify(config, lock_path)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("Interrupted", file=sys.stderr)
        raise SystemExit(130)
    except Exception as error:
        print(f"GEOSPATIAL_BUILD_FAILED {error}", file=sys.stderr)
        raise
