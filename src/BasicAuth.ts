import type {Authentication} from './Connection';

class BasicAuth implements Authentication {
    private readonly authorizationHeader : Promise<string>;

    public constructor(username : string, password : string) {
        this.authorizationHeader = Promise.resolve(
            `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`
        );
    }

    public async getAuthorizationHeader() : Promise<string> {
        return this.authorizationHeader;
    }
}

export default BasicAuth;
