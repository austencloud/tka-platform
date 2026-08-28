import { describe, expect, it } from "vitest";

import {
  createMeshyImageTaskBody,
  sortMeshyImageNames,
} from "../../../scripts/lib/meshy-image-generator.mjs";
import { createMeshyRetextureTaskBody } from "../../../scripts/lib/meshy-retexture-generator.mjs";
import { createMeshyRemeshTaskBody } from "../../../scripts/lib/meshy-remesh-generator.mjs";

const images = [
  { dataUri: "data:image/png;base64,front", name: "front.png" },
  { dataUri: "data:image/png;base64,right", name: "right.png" },
];

describe("Meshy image task requests", () => {
  it("keeps the registered front view first for Meshy 7", () => {
    expect(
      sortMeshyImageNames(
        ["back.png", "front.png", "right.png"],
        ["front.png", "right.png", "back.png"]
      )
    ).toEqual(["front.png", "right.png", "back.png"]);
  });

  it("keeps a Meshy 7 geometry audition untextured and unremeshed", () => {
    const { url, body } = createMeshyImageTaskBody(
      {
        aiModel: "meshy-7",
        shouldTexture: false,
        shouldRemesh: false,
      },
      { id: "ember-candidate" },
      images
    );

    expect(url).toContain("multi-image-to-3d");
    expect(body).toMatchObject({
      ai_model: "meshy-7",
      should_texture: false,
      should_remesh: false,
      image_urls: images.map(({ dataUri }) => dataUri),
    });
    expect(body).not.toHaveProperty("enable_pbr");
    expect(body).not.toHaveProperty("texture_resolution");
    expect(body).not.toHaveProperty("remove_lighting");
    expect(body).not.toHaveProperty("target_polycount");
  });

  it("preserves the existing Meshy 6 textured production request", () => {
    const { body } = createMeshyImageTaskBody(
      { aiModel: "meshy-6" },
      {
        id: "textured-asset",
        polycount: 24000,
        texturePrompt: "Neutral volcanic basalt albedo.",
      },
      [images[0]]
    );

    expect(body).toMatchObject({
      ai_model: "meshy-6",
      model_type: "standard",
      should_texture: true,
      enable_pbr: true,
      texture_resolution: "2k",
      texture_prompt: "Neutral volcanic basalt albedo.",
      remove_lighting: true,
      should_remesh: true,
      topology: "triangle",
      target_polycount: 24000,
      image_url: images[0].dataUri,
    });
  });
});

describe("Meshy retexture task requests", () => {
  it("uses registered multiview style images without Meshy 6-only controls", () => {
    const body = createMeshyRetextureTaskBody({
      manifest: { aiModel: "meshy-7", textureResolution: "2k" },
      asset: { id: "ember-winner" },
      sourceTaskId: "source-task",
      styleImages: images,
    });

    expect(body).toMatchObject({
      input_task_id: "source-task",
      ai_model: "meshy-7",
      enable_original_uv: true,
      enable_pbr: true,
      texture_resolution: "2k",
      multiview_image_urls: images.map(({ dataUri }) => dataUri),
    });
    expect(body).not.toHaveProperty("text_style_prompt");
    expect(body).not.toHaveProperty("remove_lighting");
  });

  it("preserves Meshy 6 text retexture behavior for the forest owner", () => {
    const body = createMeshyRetextureTaskBody({
      manifest: { aiModel: "meshy-6", textureResolution: "4k" },
      asset: { id: "forest-tree", textStylePrompt: "Dry gray-brown bark." },
      sourceTaskId: "forest-source-task",
    });

    expect(body).toMatchObject({
      input_task_id: "forest-source-task",
      ai_model: "meshy-6",
      texture_resolution: "4k",
      text_style_prompt: "Dry gray-brown bark.",
      remove_lighting: true,
    });
    expect(body).not.toHaveProperty("multiview_image_urls");
  });

  it("rejects ambiguous retexture styles before a paid POST", () => {
    expect(() =>
      createMeshyRetextureTaskBody({
        manifest: { aiModel: "meshy-7" },
        asset: { id: "ambiguous", textStylePrompt: "Basalt." },
        sourceTaskId: "source-task",
        styleImages: images,
      })
    ).toThrow("exactly one retexture style input");
  });
});

describe("Meshy remesh task requests", () => {
  it("uses the successful textured task and the audited production budget", () => {
    expect(
      createMeshyRemeshTaskBody(
        { topology: "triangle" },
        { id: "ember-hero", targetPolycount: 48000 },
        "textured-task"
      )
    ).toEqual({
      input_task_id: "textured-task",
      target_formats: ["glb"],
      topology: "triangle",
      target_polycount: 48000,
      auto_size: true,
      origin_at: "bottom",
      alpha_thumbnail: true,
    });
  });
});
