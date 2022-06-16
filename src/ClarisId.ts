import type {CognitoUserSession} from 'amazon-cognito-identity-js';
import {AuthenticationDetails, CognitoUser, CognitoUserPool} from 'amazon-cognito-identity-js';
import fetch, {Headers, Request, Response} from 'node-fetch';
import type {Authentication} from './Connection';

class ClarisId implements Authentication {
    private readonly authenticationDetails : AuthenticationDetails;
    private userPool : CognitoUserPool | null = null;
    private cognitoUser : CognitoUser | null = null;
    private userSession : CognitoUserSession | null = null;
    private idTokenPromise : Promise<string> | null = null;

    public constructor(username : string, password : string) {
        ClarisId.polyfillGlobalFetch();

        this.authenticationDetails = new AuthenticationDetails({
            Username: username,
            Password: password,
        });
    }

    public async getAuthorizationHeader() : Promise<string> {
        if (this.idTokenPromise) {
            return `FMID ${await this.idTokenPromise}`;
        }

        this.idTokenPromise = this.getIdToken();
        const idToken = await this.idTokenPromise;
        this.idTokenPromise = null;

        return `FMID ${idToken}`;
    }

    private async getIdToken() : Promise<string> {
        if (this.userSession) {
            return this.getStoredIdToken(this.userSession);
        }

        const userSession = await this.retrieveNewSession();
        return userSession.getIdToken().getJwtToken();
    }

    private async getStoredIdToken(userSession : CognitoUserSession) : Promise<string> {
        if (!userSession.isValid()) {
            userSession = await this.refreshSession(userSession);
        }

        return userSession.getIdToken().getJwtToken();
    }

    private async refreshSession(userSession : CognitoUserSession) : Promise<CognitoUserSession> {
        const cognitoUser = await this.getCognitoUser();
        return this.userSession = await new Promise<CognitoUserSession>((resolve, reject) => {
            cognitoUser.refreshSession(
                userSession.getRefreshToken(),
                async (error, session) => {
                    if (error) {
                        // Refresh token might have been expired (unlikely, but could happen).
                        try {
                            resolve(await this.retrieveNewSession()); return;
                        } catch (e) {
                            reject(e);
                        }
                    }

                    resolve(session as CognitoUserSession);
                }
            );
        });
    }

    private async retrieveNewSession() : Promise<CognitoUserSession> {
        const cognitoUser = await this.getCognitoUser();
        return this.userSession = await new Promise<CognitoUserSession>(
            (resolve, reject) => {
                cognitoUser.authenticateUser(this.authenticationDetails, {
                    onSuccess: result => {
                        resolve(result);
                    },
                    onFailure: error => {
                        reject(error);
                    },
                });
            }
        );
    }

    private async getCognitoUser() : Promise<CognitoUser> {
        if (this.cognitoUser) {
            return this.cognitoUser;
        }

        return this.cognitoUser = new CognitoUser({
            Username: this.authenticationDetails.getUsername(),
            Pool: await this.getUserPool(),
        });
    }

    private async getUserPool() : Promise<CognitoUserPool> {
        if (this.userPool) {
            return this.userPool;
        }

        const response = await fetch('https://www.ifmcloud.com/endpoint/userpool/2.2.0.my.claris.com.json');

        if (!response.ok) {
            throw new Error('Could not fetch user pool config');
        }

        const config = await response.json() as {
            data : {
                /* eslint-disable @typescript-eslint/naming-convention */
                UserPool_ID : string;
                Client_ID : string;
                /* eslint-enable @typescript-eslint/naming-convention */
            };
        };

        return this.userPool = new CognitoUserPool({
            UserPoolId: config.data.UserPool_ID,
            ClientId: config.data.Client_ID,
        });
    }

    private static polyfillGlobalFetch() : void {
        const polyfillGlobal = global as NodeJS.Global & {
            fetch ?: typeof fetch;
            /* eslint-disable @typescript-eslint/naming-convention */
            Response ?: typeof Response;
            Headers ?: typeof Headers;
            Request ?: typeof Request;
            /* eslint-enable @typescript-eslint/naming-convention */
        };

        if (!polyfillGlobal.fetch) {
            polyfillGlobal.fetch = fetch;
            polyfillGlobal.Response = Response;
            polyfillGlobal.Headers = Headers;
            polyfillGlobal.Request = Request;
        }
    }
}

export default ClarisId;
