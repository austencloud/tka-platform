/**
 * Client for making authenticated API calls to /api/account/* endpoints
 */
export interface IProfileApiClient {
  /**
   * Makes an authenticated POST request to the specified API endpoint
   * @param path - API path (e.g., '/api/account/update-password')
   * @param body - Optional request body
   * @returns Parsed response data
   * @throws Error if not authenticated or request fails
   */
  request<T = unknown>(path: string, body?: unknown): Promise<T>;
}
