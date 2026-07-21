/**
 * One active export intent, one terminal outcome. Tokens make late async work
 * harmless after cancel, mode change, route teardown, or a newer attempt.
 */
export class ExportAttemptGuard {
  #nextToken = 0;
  #activeToken: number | null = null;

  begin(): number | null {
    if (this.#activeToken !== null) return null;
    this.#activeToken = ++this.#nextToken;
    return this.#activeToken;
  }

  get active(): boolean {
    return this.#activeToken !== null;
  }

  get token(): number | null {
    return this.#activeToken;
  }

  isActive(token: number): boolean {
    return this.#activeToken === token;
  }

  finish(token: number): boolean {
    if (!this.isActive(token)) return false;
    this.#activeToken = null;
    return true;
  }

  abandon(): number | null {
    const token = this.#activeToken;
    this.#activeToken = null;
    return token;
  }
}
