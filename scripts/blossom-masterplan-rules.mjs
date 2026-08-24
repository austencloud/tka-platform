function xy(point) {
  return [point[0], point[1]];
}

function distance2d(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function distance3d(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function distanceToSegment(point, start, end) {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return distance2d(point, start);

  const progress = Math.max(
    0,
    Math.min(
      1,
      ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / lengthSquared
    )
  );
  return distance2d(point, [
    start[0] + progress * dx,
    start[1] + progress * dy,
  ]);
}

function pointAlongSegment(start, end, progress) {
  return start.map(
    (coordinate, index) => coordinate + (end[index] - coordinate) * progress
  );
}

function orientation(a, b, c) {
  return (b[1] - a[1]) * (c[0] - b[0]) - (b[0] - a[0]) * (c[1] - b[1]);
}

function segmentsIntersect(a, b, c, d) {
  const first = orientation(a, b, c);
  const second = orientation(a, b, d);
  const third = orientation(c, d, a);
  const fourth = orientation(c, d, b);
  return first * second < 0 && third * fourth < 0;
}

function distanceBetweenSegments(a, b, c, d) {
  if (segmentsIntersect(a, b, c, d)) return 0;
  return Math.min(
    distanceToSegment(a, c, d),
    distanceToSegment(b, c, d),
    distanceToSegment(c, a, b),
    distanceToSegment(d, a, b)
  );
}

function distanceBetweenPolylines(first, second) {
  let minimum = Number.POSITIVE_INFINITY;
  for (let firstIndex = 0; firstIndex < first.length - 1; firstIndex += 1) {
    for (
      let secondIndex = 0;
      secondIndex < second.length - 1;
      secondIndex += 1
    ) {
      minimum = Math.min(
        minimum,
        distanceBetweenSegments(
          xy(first[firstIndex]),
          xy(first[firstIndex + 1]),
          xy(second[secondIndex]),
          xy(second[secondIndex + 1])
        )
      );
    }
  }
  return minimum;
}

export function distanceToPolyline(point, centerline) {
  let minimum = Number.POSITIVE_INFINITY;
  for (let index = 0; index < centerline.length - 1; index += 1) {
    minimum = Math.min(
      minimum,
      distanceToSegment(
        xy(point),
        xy(centerline[index]),
        xy(centerline[index + 1])
      )
    );
  }
  return minimum;
}

export function pointInPolygon(point, polygon) {
  let inside = false;
  for (
    let current = 0, previous = polygon.length - 1;
    current < polygon.length;
    previous = current, current += 1
  ) {
    const [currentX, currentY] = polygon[current];
    const [previousX, previousY] = polygon[previous];
    const crosses =
      currentY > point[1] !== previousY > point[1] &&
      point[0] <
        ((previousX - currentX) * (point[1] - currentY)) /
          (previousY - currentY) +
          currentX;
    if (crosses) inside = !inside;
  }
  return inside;
}

function distanceToPolygonEdge(point, polygon) {
  let minimum = Number.POSITIVE_INFINITY;
  for (let index = 0; index < polygon.length; index += 1) {
    minimum = Math.min(
      minimum,
      distanceToSegment(
        point,
        polygon[index],
        polygon[(index + 1) % polygon.length]
      )
    );
  }
  return minimum;
}

function pointInOrOnPolygon(point, polygon, tolerance = 0.02) {
  return (
    pointInPolygon(point, polygon) ||
    distanceToPolygonEdge(point, polygon) <= tolerance
  );
}

export function polygonArea(polygon) {
  let twiceArea = 0;
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index];
    const next = polygon[(index + 1) % polygon.length];
    twiceArea += current[0] * next[1] - next[0] * current[1];
  }
  return Math.abs(twiceArea) / 2;
}

export function distanceToRectangle(point, rectangle) {
  const dx = Math.max(rectangle.minX - point[0], 0, point[0] - rectangle.maxX);
  const dy = Math.max(rectangle.minY - point[1], 0, point[1] - rectangle.maxY);
  return Math.hypot(dx, dy);
}

function rectangleCorners(rectangle) {
  return [
    [rectangle.minX, rectangle.minY],
    [rectangle.minX, rectangle.maxY],
    [rectangle.maxX, rectangle.minY],
    [rectangle.maxX, rectangle.maxY],
  ];
}

function polygonToRectangleDistance(polygon, rectangle) {
  return Math.min(
    ...polygon.map((point) => distanceToRectangle(point, rectangle)),
    ...rectangleCorners(rectangle).map((point) =>
      pointInPolygon(point, polygon) ? 0 : distanceToPolygonEdge(point, polygon)
    )
  );
}

export function connectedCirculationNodes(paths, startNode) {
  const graph = new Map();
  const connect = (from, to) => {
    const neighbors = graph.get(from) ?? new Set();
    neighbors.add(to);
    graph.set(from, neighbors);
  };

  for (const path of paths) {
    connect(path.from, path.to);
    connect(path.to, path.from);
  }

  const visited = new Set([startNode]);
  const queue = [startNode];
  while (queue.length > 0) {
    const node = queue.shift();
    for (const neighbor of graph.get(node) ?? []) {
      if (visited.has(neighbor)) continue;
      visited.add(neighbor);
      queue.push(neighbor);
    }
  }
  return visited;
}

export function resolveLanternPosition(plan, lantern) {
  const path = plan.circulation.paths.find(
    (candidate) => candidate.id === lantern.attachment.pathId
  );
  if (!path) return null;
  const start = path.centerline[lantern.attachment.segmentIndex];
  const end = path.centerline[lantern.attachment.segmentIndex + 1];
  if (!start || !end) return null;

  const center = pointAlongSegment(start, end, lantern.attachment.progress);
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const length = Math.hypot(dx, dy);
  if (length === 0) return null;
  const side = lantern.attachment.side === "left" ? 1 : -1;
  const offset =
    path.width / 2 + lantern.padRadius + lantern.attachment.pathEdgeClearance;
  return [
    center[0] + side * (-dy / length) * offset,
    center[1] + side * (dx / length) * offset,
    center[2],
  ];
}

function pathMaximumSlopePercent(path) {
  let maximum = 0;
  for (let index = 0; index < path.centerline.length - 1; index += 1) {
    const start = path.centerline[index];
    const end = path.centerline[index + 1];
    const horizontal = distance2d(start, end);
    const slope =
      horizontal === 0
        ? Number.POSITIVE_INFINITY
        : (Math.abs(end[2] - start[2]) / horizontal) * 100;
    maximum = Math.max(maximum, slope);
  }
  return maximum;
}

function segmentHitsTree(start, end, tree, clearance) {
  const sampleCount = 80;
  for (let sample = 1; sample < sampleCount; sample += 1) {
    const point = pointAlongSegment(start, end, sample / sampleCount);
    const horizontalDistance = distance2d(point, tree.position);
    if (
      point[2] >= 0 &&
      point[2] <= tree.canopyBottom &&
      horizontalDistance <= tree.trunkRadius + clearance
    ) {
      return true;
    }
    if (
      point[2] >= tree.canopyBottom &&
      point[2] <= tree.height &&
      horizontalDistance <= tree.canopyRadius + clearance
    ) {
      return true;
    }
  }
  return false;
}

function segmentHitsLantern(start, end, position, lantern, clearance) {
  const sampleCount = 80;
  for (let sample = 1; sample < sampleCount; sample += 1) {
    const point = pointAlongSegment(start, end, sample / sampleCount);
    if (
      point[2] >= 0 &&
      point[2] <= lantern.height &&
      distance2d(point, position) <= 0.22 + clearance
    ) {
      return true;
    }
  }
  return false;
}

function validateSightlineRake(zone, plan, check) {
  if (!zone.sightlineRows) return;
  const rows = [...zone.sightlineRows].sort((a, b) => b.y - a.y);
  const targetY = 0;
  const targetZ = 1.65;
  for (let viewerIndex = 1; viewerIndex < rows.length; viewerIndex += 1) {
    const viewer = rows[viewerIndex];
    for (let forwardIndex = 0; forwardIndex < viewerIndex; forwardIndex += 1) {
      const forward = rows[forwardIndex];
      const progress = (forward.y - viewer.y) / (targetY - viewer.y);
      const rayHeight = viewer.eyeZ + (targetZ - viewer.eyeZ) * progress;
      check(
        rayHeight >= forward.headTopZ + plan.audience.minimumRakeHeadClearance,
        `${zone.id} ${viewer.id} row cannot see over ${forward.id} row`
      );
    }
  }
}

function computeOrbitEnvelope(plan) {
  const controls = plan.camera.controls;
  const horizontalRadius =
    controls.maximumDistance *
    Math.sin((controls.maximumPolarAngleDegrees * Math.PI) / 180);
  const margin = controls.frustumGroundMargin;
  return {
    minX: controls.panTargetBounds.minX - horizontalRadius - margin,
    maxX: controls.panTargetBounds.maxX + horizontalRadius + margin,
    minY: controls.panTargetBounds.minY - horizontalRadius - margin,
    maxY: controls.panTargetBounds.maxY + horizontalRadius + margin,
    horizontalRadius,
  };
}

export function validateBlossomMasterplan(plan) {
  const failures = [];
  const check = (condition, message) => {
    if (!condition) failures.push(message);
  };

  check(plan.schemaVersion === 3, "Unsupported Blossom master-plan schema");
  check(
    plan.planId === "blossom-masterplan-r2.1",
    "The adversarial R2.1 revision is not active"
  );
  check(
    [
      "awaiting-spatial-approval",
      "approved-for-production",
      "rejected-visual-review",
    ].includes(plan.status),
    "R2.1 must be at a recognized production gate"
  );
  check(
    plan.approvalGate.productionChangesAllowed ===
      (plan.status === "approved-for-production"),
    "R2.1 production permission does not match its approval status"
  );

  const performanceEnvelope = plan.stage.performanceEnvelope;
  const protectedWidth =
    plan.stage.protectedClearance.maxX - plan.stage.protectedClearance.minX;
  const protectedDepth =
    plan.stage.protectedClearance.maxY - plan.stage.protectedClearance.minY;
  for (const mode of plan.stage.operations.supportedModes) {
    check(
      mode.formationFootprint.width <=
        performanceEnvelope.maxX - performanceEnvelope.minX &&
        mode.formationFootprint.depth <=
          performanceEnvelope.maxY - performanceEnvelope.minY,
      `${mode.id} formation does not fit the performance envelope`
    );
    check(
      mode.formationFootprint.width + mode.maximumPropReachRadius * 2 <=
        protectedWidth &&
        mode.formationFootprint.depth + mode.maximumPropReachRadius * 2 <=
          protectedDepth,
      `${mode.id} prop reach escapes the protected stage clearance`
    );
    check(
      mode.requiredClearHeight <=
        performanceEnvelope.maxZ - performanceEnvelope.minZ,
      `${mode.id} exceeds the overhead safety volume`
    );
  }
  check(
    distanceToRectangle(
      [
        plan.stage.operations.backstageStagingArea.minX,
        plan.stage.operations.backstageStagingArea.minY,
      ],
      plan.stage.protectedClearance
    ) > 0,
    "Backstage staging invades the protected performance clearance"
  );
  check(
    distanceToRectangle(
      [
        plan.stage.operations.propStorageArea.minX,
        plan.stage.operations.propStorageArea.minY,
      ],
      plan.stage.protectedClearance
    ) > 0,
    "Prop storage invades the protected performance clearance"
  );

  let calculatedCapacity = 0;
  for (const zone of plan.audience.zones) {
    const area = polygonArea(zone.polygon);
    let derivedCapacity;
    if (zone.accessibleLayout) {
      const pairs = Math.min(
        zone.accessibleLayout.wheelchairBays,
        zone.accessibleLayout.companionPositions
      );
      check(
        area >= pairs * zone.accessibleLayout.minimumSquareMetresPerPair,
        `${zone.id} cannot fit its wheelchair and companion bays`
      );
      check(
        zone.accessibleLayout.turningCircleDiameter >= 1.8 &&
          zone.accessibleLayout.clearAisleWidth >=
            plan.circulation.minimumAccessibleWidth,
        `${zone.id} has no compliant turning and aisle geometry`
      );
      derivedCapacity =
        zone.accessibleLayout.wheelchairBays +
        zone.accessibleLayout.companionPositions;
    } else {
      derivedCapacity = Math.floor(
        (area * (1 - zone.capacityModel.circulationReserveFraction)) /
          zone.capacityModel.minimumSquareMetresPerPerson
      );
    }
    check(
      zone.capacity === derivedCapacity,
      `${zone.id} declares ${zone.capacity} people but its usable area supports ${derivedCapacity}`
    );
    calculatedCapacity += derivedCapacity;
    check(zone.polygon.length >= 4, `${zone.id} has no usable footprint`);
    check(
      pointInOrOnPolygon(zone.viewpoint, zone.polygon),
      `${zone.id} viewpoint falls outside its audience zone`
    );
    check(
      polygonToRectangleDistance(zone.polygon, {
        minX: -plan.stage.width / 2,
        maxX: plan.stage.width / 2,
        minY: -plan.stage.depth / 2,
        maxY: plan.stage.depth / 2,
      }) >= plan.stage.operations.minimumAudienceSetbackFromDeck,
      `${zone.id} is inside the performance audience setback`
    );
    validateSightlineRake(zone, plan, check);
  }
  check(
    calculatedCapacity === plan.audience.capacity,
    `Audience capacity is ${calculatedCapacity}, expected ${plan.audience.capacity}`
  );

  const nodeById = new Map(
    plan.circulation.nodes.map((node) => [node.id, node])
  );
  const zoneById = new Map(plan.audience.zones.map((zone) => [zone.id, zone]));
  for (const node of plan.circulation.nodes) {
    if (!node.zoneId) continue;
    const zone = zoneById.get(node.zoneId);
    check(Boolean(zone), `${node.id} references a missing audience zone`);
    if (zone) {
      check(
        pointInOrOnPolygon(node.position, zone.polygon),
        `${node.id} does not physically enter ${node.zoneId}`
      );
      check(
        zone.accessNodeId === node.id,
        `${node.zoneId} does not own its physical access node`
      );
    }
  }

  for (const path of plan.circulation.paths) {
    const from = nodeById.get(path.from);
    const to = nodeById.get(path.to);
    check(Boolean(from), `${path.id} starts at a missing node`);
    check(Boolean(to), `${path.id} ends at a missing node`);
    if (from && to) {
      check(
        distance3d(path.centerline[0], from.position) <= 0.02,
        `${path.id} does not physically start at ${path.from}`
      );
      check(
        distance3d(path.centerline.at(-1), to.position) <= 0.02,
        `${path.id} does not physically end at ${path.to}`
      );
    }
    check(
      path.centerline.length >= 2,
      `${path.id} has no traversable centerline`
    );
    if (path.kind === "primary-accessible") {
      check(
        path.width >= plan.circulation.minimumAccessibleWidth,
        `${path.id} is narrower than the accessible minimum`
      );
      check(
        pathMaximumSlopePercent(path) <=
          plan.circulation.maximumAccessibleSlopePercent,
        `${path.id} exceeds the accessible running slope`
      );
      check(
        path.crossSlopePercent <=
          plan.circulation.maximumAccessibleCrossSlopePercent,
        `${path.id} exceeds the accessible cross slope`
      );
    }
  }

  const publicPaths = plan.circulation.paths.filter(
    (path) => path.kind === "primary-accessible"
  );
  const connected = connectedCirculationNodes(
    publicPaths,
    plan.circulation.requiredPublicNodes[0]
  );
  for (const node of plan.circulation.requiredPublicNodes) {
    check(
      connected.has(node),
      `${node} is disconnected from public circulation`
    );
  }
  const backstagePath = plan.circulation.paths.find(
    (path) => path.id === plan.stage.operations.backstageServicePathId
  );
  check(
    backstagePath?.kind === "restricted-service",
    "Backstage access is not separated from public circulation"
  );
  if (backstagePath) {
    for (const publicPath of publicPaths) {
      check(
        distanceBetweenPolylines(
          backstagePath.centerline,
          publicPath.centerline
        ) >=
          (backstagePath.width + publicPath.width) / 2,
        `Backstage service conflicts with public route ${publicPath.id}`
      );
    }
  }

  const crossingDistance = distanceToPolyline(
    plan.bridge.center,
    plan.water.centerline
  );
  check(crossingDistance <= 0.75, "Bridge is not centered over the river");
  check(
    plan.bridge.length >=
      plan.water.surfaceWidth + plan.water.bankTransitionWidth * 2,
    "Bridge does not span the water and both bank transitions"
  );

  const bridgeProtectedRectangles = [
    plan.bridge.southLanding,
    plan.bridge.northLanding,
    {
      minX: plan.bridge.center[0] - plan.bridge.width / 2,
      maxX: plan.bridge.center[0] + plan.bridge.width / 2,
      minY: plan.bridge.center[1] - plan.bridge.length / 2,
      maxY: plan.bridge.center[1] + plan.bridge.length / 2,
    },
  ];

  for (const tree of plan.grove.trees) {
    check(
      distanceToRectangle(tree.position, plan.stage.protectedClearance) >
        tree.canopyRadius,
      `${tree.id} canopy enters the stage clearance`
    );
    for (const rectangle of bridgeProtectedRectangles) {
      check(
        distanceToRectangle(tree.position, rectangle) - tree.canopyRadius >=
          plan.bridge.minimumCanopyEdgeClearance,
        `${tree.id} canopy blocks the bridge or a landing`
      );
    }
    for (const path of plan.circulation.paths) {
      check(
        distanceToPolyline(tree.position, path.centerline) >=
          path.width / 2 +
            tree.trunkRadius +
            plan.circulation.minimumTreeTrunkEdgeClearance,
        `${tree.id} trunk blocks ${path.id}`
      );
    }
  }

  const resolvedLanterns = [];
  for (const lantern of plan.lanterns) {
    const position = resolveLanternPosition(plan, lantern);
    check(Boolean(position), `${lantern.id} has an invalid path attachment`);
    if (!position) continue;
    resolvedLanterns.push({ lantern, position });
    check(
      lantern.attachment.pathEdgeClearance >=
        plan.bridge.minimumRouteEdgeFurnitureClearance,
      `${lantern.id} pad enters its walking surface`
    );
    if (lantern.id.includes("bridge")) {
      const landing = lantern.id.includes("south")
        ? plan.bridge.southLanding
        : plan.bridge.northLanding;
      check(
        distanceToRectangle(position, landing) - lantern.padRadius >=
          plan.bridge.minimumLandingEdgeFurnitureClearance,
        `${lantern.id} blocks its bridge landing`
      );
    }
  }

  let sightlineRayCount = 0;
  for (const zone of plan.audience.zones) {
    for (const viewSample of zone.viewSamples) {
      for (const target of plan.audience.sightlineTargets) {
        sightlineRayCount += 1;
        for (const tree of plan.grove.trees) {
          check(
            !segmentHitsTree(
              viewSample,
              target,
              tree,
              plan.audience.minimumSightlineClearance
            ),
            `${tree.id} blocks a 3D sightline from ${zone.id}`
          );
        }
        for (const { lantern, position } of resolvedLanterns) {
          check(
            !segmentHitsLantern(
              viewSample,
              target,
              position,
              lantern,
              plan.audience.minimumSightlineClearance
            ),
            `${lantern.id} blocks a 3D sightline from ${zone.id}`
          );
        }
      }
    }
  }

  const wideningById = new Map(
    plan.water.localWidenings.map((widening) => [widening.id, widening])
  );
  const bridgeBody = bridgeProtectedRectangles[2];
  for (const habitat of plan.water.fishHabitats) {
    const widening = wideningById.get(habitat.waterWideningId);
    check(Boolean(widening), `${habitat.id} has no authored water widening`);
    if (!widening) continue;
    check(
      distance2d(habitat.center, widening.center) +
        habitat.radius +
        habitat.minimumEdgeClearance <=
        widening.surfaceRadius,
      `${habitat.id} extends outside its widened water surface`
    );
    check(
      widening.minimumDepth >= habitat.minimumDepth,
      `${habitat.id} has insufficient water depth`
    );
    check(
      distanceToRectangle(habitat.center, bridgeBody) - habitat.radius >=
        habitat.minimumBridgeClearance,
      `${habitat.id} enters the bridge avoidance zone`
    );
  }

  const treeIds = new Set(plan.grove.trees.map((tree) => tree.id));
  for (const sourceTreeId of plan.petals.sourceTreeIds) {
    check(
      treeIds.has(sourceTreeId),
      `Petal source ${sourceTreeId} does not exist`
    );
  }
  check(
    plan.petals.maximumStageParticleShare <= 0.15,
    "Too many petals are permitted to drift over the performance area"
  );

  const variantCounts = new Map();
  for (const tree of plan.grove.trees) {
    variantCounts.set(
      tree.variantSlot,
      (variantCounts.get(tree.variantSlot) ?? 0) + 1
    );
  }
  check(
    variantCounts.size >=
      plan.grove.assetPolicy.minimumDistinctApprovedVariants,
    "The hero grove does not have enough distinct PlantFactory variants"
  );
  for (const [variant, count] of variantCounts) {
    check(
      count <= plan.grove.assetPolicy.maximumInstancesPerVariant,
      `${variant} repeats too many times in the hero grove`
    );
  }
  check(
    plan.grove.assetPolicy.meshyTreesAllowed === false &&
      plan.grove.assetPolicy.proceduralBlobTreesAllowed === false,
    "The tree asset policy permits a rejected tree source"
  );
  check(
    plan.grove.backgroundLayers.reduce(
      (sum, layer) => sum + layer.minimumInstances,
      0
    ) >= 100,
    "The established grove has no credible midground and horizon population"
  );

  const orbitEnvelope = computeOrbitEnvelope(plan);
  const declaredEnvelope = plan.camera.validatedOrbitEnvelope;
  for (const key of ["minX", "maxX", "minY", "maxY"]) {
    check(
      Math.abs(orbitEnvelope[key] - declaredEnvelope[key]) <= 0.15,
      `Declared camera envelope ${key} does not match the orbit controls`
    );
  }
  check(
    plan.site.terrainBounds.minX <= orbitEnvelope.minX &&
      plan.site.terrainBounds.maxX >= orbitEnvelope.maxX &&
      plan.site.terrainBounds.minY <= orbitEnvelope.minY &&
      plan.site.terrainBounds.maxY >= orbitEnvelope.maxY,
    "The legal camera orbit can expose the terrain edge"
  );
  for (const view of [plan.camera.default, ...plan.camera.reviewViews]) {
    check(
      view.position[0] > plan.site.terrainBounds.minX &&
        view.position[0] < plan.site.terrainBounds.maxX &&
        view.position[1] > plan.site.terrainBounds.minY &&
        view.position[1] < plan.site.terrainBounds.maxY,
      `${view.id ?? "default camera"} sits beyond the authored terrain`
    );
  }

  check(
    plan.migration.newOwners.length >= 5 &&
      plan.migration.fieldMigration.length >= 6 &&
      plan.migration.retirementOrder.length >= 4,
    "R1-to-R2.1 runtime ownership is not fully mapped"
  );

  return {
    valid: failures.length === 0,
    failures: [...new Set(failures)],
    measurements: {
      audienceCapacity: calculatedCapacity,
      audienceZoneCount: plan.audience.zones.length,
      wheelchairBays: plan.audience.zones.reduce(
        (sum, zone) => sum + (zone.accessibleLayout?.wheelchairBays ?? 0),
        0
      ),
      connectedPublicNodes: connected.size,
      publicPathCount: publicPaths.length,
      restrictedPathCount: plan.circulation.paths.length - publicPaths.length,
      groveHeroAnchors: plan.grove.trees.length,
      groveBackgroundInstances: plan.grove.backgroundLayers.reduce(
        (sum, layer) => sum + layer.minimumInstances,
        0
      ),
      distinctHeroVariants: variantCounts.size,
      bridgeCenterlineOffsetMetres: Number(crossingDistance.toFixed(3)),
      lanternCount: resolvedLanterns.length,
      fishHabitatCount: plan.water.fishHabitats.length,
      sightlineRayCount,
      maximumCameraDistance: plan.camera.controls.maximumDistance,
      cameraEnvelope: {
        minX: Number(orbitEnvelope.minX.toFixed(1)),
        maxX: Number(orbitEnvelope.maxX.toFixed(1)),
        minY: Number(orbitEnvelope.minY.toFixed(1)),
        maxY: Number(orbitEnvelope.maxY.toFixed(1)),
      },
    },
  };
}
