/**
 * Sends recorded audio to the server for speech-to-text transcription.
 */
export interface ITranscriptionClient {
	/**
	 * Transcribe an audio blob via the Cloud Function.
	 *
	 * @param blob - The recorded audio data
	 * @param mimeType - The MIME type of the audio (e.g. "audio/webm;codecs=opus")
	 * @returns The transcribed text
	 */
	transcribe(blob: Blob, mimeType: string): Promise<string>;
}
