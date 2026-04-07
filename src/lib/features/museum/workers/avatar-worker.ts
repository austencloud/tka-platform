export interface AvatarParseRequest {
  type: "parse";
  modelId: string;
  url: string;
}

export interface AvatarParseResponse {
  type: "parsed";
  modelId: string;
  ready: boolean;
}

self.onmessage = async (event: MessageEvent<AvatarParseRequest>) => {
  const { modelId, url } = event.data;

  try {
    await fetch(url);
    const response: AvatarParseResponse = { type: "parsed", modelId, ready: true };
    (self as unknown as Worker).postMessage(response);
  } catch {
    const response: AvatarParseResponse = { type: "parsed", modelId, ready: false };
    (self as unknown as Worker).postMessage(response);
  }
};
