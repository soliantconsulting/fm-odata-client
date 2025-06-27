import type { Authentication } from "./Connection.js";

class OttoAPIKey implements Authentication {
    private readonly authorizationHeader: Promise<string>;

    public constructor(apiKey: `dk_${string}`) {
        this.authorizationHeader = Promise.resolve(`Bearer ${apiKey}`);
    }

    public async getAuthorizationHeader(): Promise<string> {
        return this.authorizationHeader;
    }
}

export default OttoAPIKey;
