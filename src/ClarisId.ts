import type { CognitoUserSession } from "amazon-cognito-identity-js";
import { AuthenticationDetails, CognitoUser, CognitoUserPool } from "amazon-cognito-identity-js";
import type { Authentication } from "./Connection.js";

class ClarisId implements Authentication {
    private readonly username: string;
    private readonly password: string;
    private authenticationDetails: AuthenticationDetails | undefined;
    private userPool: CognitoUserPool | null = null;
    private cognitoUser: CognitoUser | null = null;
    private userSession: CognitoUserSession | null = null;
    private idTokenPromise: Promise<string> | null = null;

    public constructor(username: string, password: string) {
        this.username = username;
        this.password = password;
    }

    public async getAuthorizationHeader(): Promise<string> {
        if (this.idTokenPromise) {
            return `FMID ${await this.idTokenPromise}`;
        }

        this.idTokenPromise = this.getIdToken();
        const idToken = await this.idTokenPromise;
        this.idTokenPromise = null;

        return `FMID ${idToken}`;
    }

    private getAuthenticationDetails(): AuthenticationDetails {
        if (!this.authenticationDetails) {
            this.authenticationDetails = new AuthenticationDetails({
                Username: this.username,
                Password: this.password,
            });
        }

        return this.authenticationDetails;
    }

    private async getIdToken(): Promise<string> {
        if (this.userSession) {
            return this.getStoredIdToken(this.userSession);
        }

        const userSession = await this.retrieveNewSession();
        return userSession.getIdToken().getJwtToken();
    }

    private async getStoredIdToken(userSession: CognitoUserSession): Promise<string> {
        const currentUserSession: CognitoUserSession = !userSession.isValid()
            ? await this.refreshSession(userSession)
            : userSession;

        return currentUserSession.getIdToken().getJwtToken();
    }

    private async refreshSession(userSession: CognitoUserSession): Promise<CognitoUserSession> {
        const cognitoUser = await this.getCognitoUser();
        this.userSession = await new Promise<CognitoUserSession>((resolve, reject) => {
            cognitoUser.refreshSession(userSession.getRefreshToken(), async (error, session) => {
                if (error) {
                    // Refresh token might have been expired (unlikely, but could happen).
                    try {
                        resolve(await this.retrieveNewSession());
                        return;
                    } catch (e) {
                        reject(e);
                    }
                }

                resolve(session as CognitoUserSession);
            });
        });

        return this.userSession;
    }

    private async retrieveNewSession(): Promise<CognitoUserSession> {
        const cognitoUser = await this.getCognitoUser();
        const authenticationDetails = this.getAuthenticationDetails();
        this.userSession = await new Promise<CognitoUserSession>((resolve, reject) => {
            cognitoUser.authenticateUser(authenticationDetails, {
                onSuccess: (result) => {
                    resolve(result);
                },
                onFailure: (error) => {
                    reject(error);
                },
            });
        });

        return this.userSession;
    }

    private async getCognitoUser(): Promise<CognitoUser> {
        if (this.cognitoUser) {
            return this.cognitoUser;
        }

        this.cognitoUser = new CognitoUser({
            Username: this.getAuthenticationDetails().getUsername(),
            Pool: await this.getUserPool(),
        });

        return this.cognitoUser;
    }

    private async getUserPool(): Promise<CognitoUserPool> {
        if (this.userPool) {
            return this.userPool;
        }

        const response = await fetch(
            "https://www.ifmcloud.com/endpoint/userpool/2.2.0.my.claris.com.json",
        );

        if (!response.ok) {
            throw new Error("Could not fetch user pool config");
        }

        const config = (await response.json()) as {
            data: {
                UserPool_ID: string;
                Client_ID: string;
            };
        };

        this.userPool = new CognitoUserPool({
            UserPoolId: config.data.UserPool_ID,
            ClientId: config.data.Client_ID,
        });

        return this.userPool;
    }
}

export default ClarisId;
