import {expect, use} from 'chai';
import chaiAsPromised from 'chai-as-promised';
import 'mocha';
import {BasicAuth} from '../src/index.js';

use(chaiAsPromised);

describe('BasicAuth', () => {
    const basicAuth = new BasicAuth('foo', 'bar');

    describe('getAuthorizationHeader', () => {
        it('should return basic auth header', async () => {
            await expect(basicAuth.getAuthorizationHeader()).to.eventually.equal('Basic Zm9vOmJhcg==');
        });
    });
});
