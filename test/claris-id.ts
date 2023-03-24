import {
    CognitoAccessToken,
    CognitoIdToken,
    CognitoRefreshToken,
    CognitoUser,
    CognitoUserSession,
} from 'amazon-cognito-identity-js';
import {expect, use} from 'chai';
import chaiAsPromised from 'chai-as-promised';
import 'mocha';
import nock, {cleanAll, enableNetConnect} from 'nock';
import type {Headers, Request, Response} from 'node-fetch';
import fetch from 'node-fetch';
import type {SinonSandbox} from 'sinon';
import sinon from 'sinon';
import {ClarisId} from '../src/index.js';

use(chaiAsPromised);

const validUserPoolConfig = JSON.stringify({
    data: {
        UserPool_ID: 'us-west-2_NqkuZcXQY',
        Client_ID: '4l9rvl4mv5es1eep1qe97cautn',
    },
});

const validAccessToken = 'accessToken.' + Buffer.from(JSON.stringify({
    exp: Date.now() + 3600,
    iat: Date.now() - 3600,
})).toString('base64');

const validIdToken = 'accessToken.' + Buffer.from(JSON.stringify({
    exp: Date.now() + 3600,
    iat: Date.now() - 3600,
})).toString('base64');

const expiredAccessToken = 'accessToken.' + Buffer.from(JSON.stringify({
    exp: Date.now() - 3600,
    iat: Date.now() - 3600,
})).toString('base64');

const expiredIdToken = 'accessToken.' + Buffer.from(JSON.stringify({
    exp: Date.now() - 3600,
    iat: Date.now() - 3600,
})).toString('base64');

const validSession = new CognitoUserSession({
    AccessToken: new CognitoAccessToken({AccessToken: validAccessToken}),
    IdToken: new CognitoIdToken({IdToken: validIdToken}),
    RefreshToken: new CognitoRefreshToken({RefreshToken: 'refreshToken'}),
});

const expiredSession = new CognitoUserSession({
    AccessToken: new CognitoAccessToken({AccessToken: expiredAccessToken}),
    IdToken: new CognitoIdToken({IdToken: expiredIdToken}),
    RefreshToken: new CognitoRefreshToken({RefreshToken: 'refreshToken'}),
});

describe('ClarisId', () => {
    let sandbox : SinonSandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
    });

    afterEach(() => {
        sandbox.restore();
        cleanAll();
        enableNetConnect();
    });

    describe('getAuthorizationHeader', () => {
        beforeEach(() => {
            nock('https://www.ifmcloud.com')
                .get('/endpoint/userpool/2.2.0.my.claris.com.json')
                .reply(200, validUserPoolConfig)
                .persist();
        });

        it('should return valid authorization header', async () => {
            sandbox.stub(CognitoUser.prototype, 'authenticateUser').yieldsTo('onSuccess', validSession);
            const clarisId = new ClarisId('foo', 'bar');

            const header = clarisId.getAuthorizationHeader();
            await expect(header).to.eventually.equal(`FMID ${validIdToken}`);
        });

        it('should not retrieve multiple tokens at the same time', async () => {
            const stub = sandbox.stub(CognitoUser.prototype, 'authenticateUser').yieldsTo('onSuccess', validSession);
            const clarisId = new ClarisId('foo', 'bar');

            await Promise.all([
                clarisId.getAuthorizationHeader(),
                clarisId.getAuthorizationHeader(),
            ]);

            expect(stub.callCount).to.equal(1, 'authenticateUser was called in parallel');
        });

        it('should clear idTokenPromise after being done', async () => {
            sandbox.stub(CognitoUser.prototype, 'authenticateUser').yieldsTo('onSuccess', validSession);
            const clarisId = new ClarisId('foo', 'bar');

            await clarisId.getAuthorizationHeader();
            expect(clarisId['idTokenPromise']).to.be.null;
        });

        it('should return stored valid ID token', async () => {
            sandbox.stub(CognitoUser.prototype, 'authenticateUser').yieldsTo('onSuccess', validSession);
            const refreshSessionStub = sandbox.stub(CognitoUser.prototype, 'refreshSession').yields(null, validSession);
            const clarisId = new ClarisId('foo', 'bar');

            await clarisId.getAuthorizationHeader();
            const header = clarisId.getAuthorizationHeader();
            await expect(header).to.eventually.equal(`FMID ${validIdToken}`);
            sinon.assert.notCalled(refreshSessionStub);
        });

        it('should refresh expired ID token', async () => {
            sandbox.stub(CognitoUser.prototype, 'authenticateUser').yieldsTo('onSuccess', expiredSession);
            sandbox.stub(CognitoUser.prototype, 'refreshSession').yields(null, validSession);
            const clarisId = new ClarisId('foo', 'bar');

            await clarisId.getAuthorizationHeader();
            const header = clarisId.getAuthorizationHeader();
            await expect(header).to.eventually.equal(`FMID ${validIdToken}`);
        });

        it('should fetch new session when refresh fails', async () => {
            sandbox.stub(CognitoUser.prototype, 'authenticateUser')
                .onFirstCall().yieldsTo('onSuccess', expiredSession)
                .onSecondCall().yieldsTo('onSuccess', validSession);
            sandbox.stub(CognitoUser.prototype, 'refreshSession').yields('error');
            const clarisId = new ClarisId('foo', 'bar');

            await clarisId.getAuthorizationHeader();
            const header = clarisId.getAuthorizationHeader();
            await expect(header).to.eventually.equal(`FMID ${validIdToken}`);
        });

        it('should throw error when fallback authentication call fails', async () => {
            sandbox.stub(CognitoUser.prototype, 'authenticateUser')
                .onFirstCall().yieldsTo('onSuccess', expiredSession)
                .onSecondCall().yieldsTo('onFailure', 'authenticateError');
            sandbox.stub(CognitoUser.prototype, 'refreshSession').yields('error');
            const clarisId = new ClarisId('foo', 'bar');

            await clarisId.getAuthorizationHeader();
            const header = clarisId.getAuthorizationHeader();
            await expect(header).to.eventually.be.rejectedWith('authenticateError');
        });

        it('should re-throw error when unable to authenticate user', async () => {
            sandbox.stub(CognitoUser.prototype, 'authenticateUser').yieldsTo('onFailure', 'authenticateError');
            const clarisId = new ClarisId('foo', 'bar');

            const header = clarisId.getAuthorizationHeader();
            await expect(header).to.eventually.be.rejectedWith('authenticateError');
        });
    });

    describe('getUserPool', () => {
        it('should throw error when fetching config fails', async () => {
            nock('https://www.ifmcloud.com')
                .get('/endpoint/userpool/2.2.0.my.claris.com.json')
                .reply(400);

            const clarisId = new ClarisId('foo', 'bar');
            await expect(clarisId.getAuthorizationHeader()).to.eventually.rejectedWith(
                'Could not fetch user pool config'
            );
        });

        it('should only load once', async () => {
            nock('https://www.ifmcloud.com')
                .get('/endpoint/userpool/2.2.0.my.claris.com.json')
                .once()
                .reply(200, validUserPoolConfig);
            sandbox.stub(CognitoUser.prototype, 'authenticateUser').yieldsTo('onSuccess', validSession);

            const clarisId = new ClarisId('foo', 'bar');
            await clarisId.getAuthorizationHeader();
            clarisId['userSession'] = null;
            clarisId['cognitoUser'] = null;
            await clarisId.getAuthorizationHeader();
        });
    });

    describe('polyfillGlobalFetch', () => {
        const polyfillGlobal = global as NodeJS.Global & {
            fetch ?: typeof fetch;
            /* eslint-disable @typescript-eslint/naming-convention */
            Response ?: typeof Response;
            Headers ?: typeof Headers;
            Request ?: typeof Request;
            /* eslint-enable @typescript-eslint/naming-convention */
        };

        it('should inject global fetch when not present', () => {
            polyfillGlobal.fetch = undefined;
            new ClarisId('foo', 'bar');
            expect(polyfillGlobal.fetch).to.equal(fetch);
        });

        it('should not override existing polyfill', () => {
            const fetchStub = () => {
                // Empty stub.
            };

            polyfillGlobal.fetch = fetchStub as unknown as typeof fetch;
            new ClarisId('foo', 'bar');
            expect(polyfillGlobal.fetch).to.equal(fetchStub);
        });
    });
});
