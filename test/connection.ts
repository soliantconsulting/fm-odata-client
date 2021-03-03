import {expect, use} from 'chai';
import chaiAsPromised from 'chai-as-promised'
import 'mocha';
import nock from 'nock';
import {URLSearchParams} from 'url';
import {Connection} from '../src';

use(chaiAsPromised);

describe('Connection', () => {
    const connection = new Connection('localhost', {type: 'claris-id-token', token: 'foobar'});

    describe('listDatabases', () => {
        it('should return a list of databases', async () => {
            nock('https://localhost').get('/fmi/odata/v4').reply(200, JSON.stringify({
                '@odata.context': 'https://localhost/fmi/odata/v4/$metadata',
                value: [{name: 'Foo', kind: 'EntityContainer', url: 'https://localhost/fmi/odata/v4/Foo'}],
            }));

            const databases = await connection.listDatabases();
            expect(databases).to.be.eql(
                [{name: 'Foo', kind: 'EntityContainer', url: 'https://localhost/fmi/odata/v4/Foo'}]
            );
        });
    });

    describe('database', () => {
        it('should return a database instance of the given name', () => {
            const database = connection.database('foo');
            expect(database['connection']).to.be.equal(connection);
            expect(database['name']).to.be.equal('foo');
        });
    });

    describe('fetchNone', () => {
        it('should compile complete path', () => {
            nock('https://localhost').get('/fmi/odata/v4/foo').reply(204);
            return connection.fetchNone('/foo');
        });

        it('should add search to request', () => {
            nock('https://localhost').get('/fmi/odata/v4?foo=bar').reply(204);
            return connection.fetchNone('', {search: new URLSearchParams({foo: 'bar'})});
        });

        it('should replace special characters in search params', () => {
            nock('https://localhost').get('/fmi/odata/v4?$foo=a%20b%20c&$bar=d%20e%20f').reply(204);
            return connection.fetchNone('', {search: new URLSearchParams({
                '$foo': 'a b c',
                '$bar': 'd e f',
            })});
        });

        it('should default to GET', () => {
            nock('https://localhost').get('/fmi/odata/v4').reply(204);
            return connection.fetchNone('');
        });

        it('should use supplied method', () => {
            nock('https://localhost').post('/fmi/odata/v4').reply(204);
            return connection.fetchNone('', {method: 'POST'});
        });

        it('should have no content type with GET and DELETE', () => {
            nock('https://localhost')
                .get('/fmi/odata/v4')
                .matchHeader('Content-Type', v => v === undefined)
                .reply(204);
            nock('https://localhost')
                .delete('/fmi/odata/v4')
                .matchHeader('Content-Type', v => v === undefined)
                .reply(204);

            return Promise.all([
                connection.fetchNone('', {method: 'GET'}),
                connection.fetchNone('', {method: 'DELETE'}),
            ]);
        });

        it('should default to application/json with POST and PATCH', () => {
            nock('https://localhost').post('/fmi/odata/v4').matchHeader('Content-Type', 'application/json').reply(204);
            nock('https://localhost').patch('/fmi/odata/v4').matchHeader('Content-Type', 'application/json').reply(204);

            return Promise.all([
                connection.fetchNone('', {method: 'POST'}),
                connection.fetchNone('', {method: 'PATCH'}),
            ]);
        });

        it('should send custom content type', () => {
            nock('https://localhost').post('/fmi/odata/v4').matchHeader('Content-Type', 'image/jpeg').reply(204);
            return connection.fetchNone('', {method: 'POST', contentType: 'image/jpeg'});
        });

        it('should send application/json accept header', () => {
            nock('https://localhost').get('/fmi/odata/v4').matchHeader('Accept', 'application/json').reply(204);
            return connection.fetchNone('');
        });

        it('should include body in request', () => {
            nock('https://localhost').post('/fmi/odata/v4', 'test').reply(204);
            return connection.fetchNone('', {method: 'POST', body: 'test'});
        });

        it('should include binary body in request', () => {
            nock('https://localhost').post('/fmi/odata/v4', Buffer.from('\x01\x02')).reply(204);
            return connection.fetchNone('', {method: 'POST', body: Buffer.from('\x01\x02')});
        });

        it('should throw generic error on invalid response', async () => {
            nock('https://localhost').get('/fmi/odata/v4').reply(400);
            await expect(connection.fetchNone('')).to.eventually.be.rejectedWith('An unknown error occurred');
        });

        it('should throw response error', async () => {
            nock('https://localhost').get('/fmi/odata/v4').reply(400, JSON.stringify({
                error: {
                    message: 'foo',
                    code: '-1',
                },
            }));
            await expect(connection.fetchNone('')).to.eventually.be.rejectedWith('foo');
        });

        it('should send Claris ID token when supplied', () => {
            const connection = new Connection('localhost', {type: 'claris-id-token', token: 'foobar'});
            nock('https://localhost').get('/fmi/odata/v4').matchHeader('Authorization', 'FMID foobar').reply(204);
            return connection.fetchNone('');
        });

        it('should send username and password when supplied', () => {
            const connection = new Connection(
                'localhost',
                {type: 'username-password', username: 'foo', password: 'bar'}
            );
            nock('https://localhost')
                .get('/fmi/odata/v4')
                .matchHeader('Authorization', 'Basic Zm9vOmJhcg==')
                .reply(204);
            return connection.fetchNone('');
        });
    });

    describe('fetchBlob', () => {
        it('should return a blob with unknown content type', async () => {
            nock('https://localhost').get('/fmi/odata/v4').reply(200, 'foobar');
            const response = await connection.fetchBlob('');
            expect(response.buffer.toString()).to.be.equal('foobar');
            expect(response.type).to.be.equal('application/octet-stream');
        });

        it('should return a blob with known content type', async () => {
            nock('https://localhost').get('/fmi/odata/v4').reply(200, 'foobar', {'Content-Type': 'image/jpeg'});
            const response = await connection.fetchBlob('');
            expect(response.buffer.toString()).to.be.equal('foobar');
            expect(response.type).to.be.equal('image/jpeg');
        });

        it('should forward fetch params', async () => {
            nock('https://localhost').post('/fmi/odata/v4').reply(204);
            return await connection.fetchBlob('', {method: 'POST'});
        });
    });

    describe('fetchJson', () => {
        it('should return an object', async () => {
            nock('https://localhost').get('/fmi/odata/v4').reply(200, JSON.stringify({foo: 'bar'}));
            const response = await connection.fetchJson('');
            expect(response).to.be.eql({foo: 'bar'});
        });

        it('should forward fetch params', async () => {
            nock('https://localhost').post('/fmi/odata/v4').reply(200, '{}');
            return await connection.fetchJson('', {method: 'POST'});
        });
    });
});
