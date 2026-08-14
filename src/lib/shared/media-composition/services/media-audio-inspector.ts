import { ALL_FORMATS, Input, UrlSource } from "mediabunny";

/**
 * A video URL is not proof that the file contains usable sound. Post Studio
 * asks the same demuxer used by export whether a decodable audio track exists,
 * then only offers Original sound when export can actually keep it.
 */
export async function hasDecodableAudioTrack(
  mediaUrl: string
): Promise<boolean | null> {
  if (!mediaUrl.trim()) return false;
  const input = new Input({
    formats: ALL_FORMATS,
    source: new UrlSource(mediaUrl),
  });

  try {
    const track = await input.getPrimaryAudioTrack();
    return track ? await track.canDecode() : false;
  } catch {
    // A blocked or unreadable remote source cannot be promised as exportable
    // original sound. Null keeps that uncertainty distinct from a silent file.
    return null;
  } finally {
    input.dispose();
  }
}
