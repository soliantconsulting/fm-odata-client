import {URLSearchParams} from 'url';
import {expect, use} from 'chai';
import chaiAsPromised from 'chai-as-promised';
import 'mocha';
import type {MockPool} from 'undici';
import {MockAgent, setGlobalDispatcher} from 'undici';
import type {Authentication} from '../src/index.js';
import {Connection} from '../src/index.js';

use(chaiAsPromised);

class FakeAuth implements Authentication {
    public async getAuthorizationHeader() : Promise<string> {
        return Promise.resolve('foobar');
    }
}

describe('Connection', () => {
    const auth = new FakeAuth();
    const connection = new Connection('localhost', auth);

    let mockAgent : MockAgent;
    let mockPool : MockPool;

    beforeEach(() => {
        mockAgent = new MockAgent();
        mockAgent.disableNetConnect();
        mockPool = mockAgent.get('https://localhost');
        setGlobalDispatcher(mockAgent);
    });

    afterEach(async () => {
        await mockAgent.close();
    });

    describe('listDatabases', () => {
        it('should return a list of databases', async () => {
            mockPool.intercept({path: '/fmi/odata/v4'}).reply(200, JSON.stringify({
                '@odata.context': 'https://localhost/fmi/odata/v4/$metadata',
                value: [{name: 'Foo', kind: 'EntityContainer', url: 'https://localhost/fmi/odata/v4/Foo'}],
            }));

            const databases = await connection.listDatabases();
            expect(databases).to.be.eql(
                [{name: 'Foo', kind: 'EntityContainer', url: 'https://localhost/fmi/odata/v4/Foo'}]
            );
        });

        it('should throw an error in batched context', async () => {
            const batchedConnection = connection.batchConnection('foo');
            await expect(batchedConnection.listDatabases()).to.eventually.be.rejectedWith(
                'Databases cannot be listed from a batched connection'
            );
        });
    });

    describe('database', () => {
        it('should return a database instance of the given name', () => {
            const database = connection.database('foo');
            expect(database['connection']).to.be.equal(connection);
            expect(database['name']).to.be.equal('foo');
        });

        it('should throw an error in batched context', () => {
            const batchedConnection = connection.batchConnection('foo');
            expect(batchedConnection.database.bind(batchedConnection, 'foo')).to.throw(
                'Database objects cannot be created from a batched connection'
            );
        });
    });

    describe('batchConnection', () => {
        it('should return a batched connection', () => {
            const batchedConnection = connection.batchConnection('foo');
            expect(batchedConnection['hostname']).to.equal('localhost');
            expect(batchedConnection['authentication']).to.equal(auth);
            expect(batchedConnection['batch']).to.eql({
                databaseName: 'foo',
                operations: [],
            });
        });
    });

    describe('executeBatch', () => {
        it('should throw an error outside batched context', async () => {
            await expect(connection.executeBatch()).to.eventually.be.rejectedWith('A batch has not been started');
        });

        it('should not run without operations', async () => {
            mockPool.intercept({path: '/fmi/odata/v4/foo/$batch', method: 'POST'}).reply(204);

            const batchedConnection = connection.batchConnection('foo');
            await batchedConnection.executeBatch();

            expect(mockAgent.pendingInterceptors().length).to.equal(1);
        });

        it('should throw error on non successful response', async () => {
            mockPool.intercept({path: '/fmi/odata/v4/foo/$batch', method: 'POST'}).reply(400);

            const batchedConnection = connection.batchConnection('foo');
            void batchedConnection.fetchNone('/foo');

            await expect(batchedConnection.executeBatch()).to.eventually.be.rejectedWith('Batch request failed');
        });

        it('should reject with insufficient responses', async () => {
            mockPool.intercept({path: '/fmi/odata/v4/foo/$batch', method: 'POST'}).reply(200, [
                '--foo',
                'Content-Type: application/http',
                '',
                'HTTP/1.1 200 OK',
                'Content-Type: text/plain',
                '',
                'foo',
                '--foo--',
            ].join('\r\n'), {
                headers: {
                    'Content-Type': 'multipart/mixed; boundary=foo',
                },
            });

            const batchedConnection = connection.batchConnection('foo');
            void batchedConnection.fetchNone('/foo');
            const secondResponse = batchedConnection.fetchNone('/foo');
            await batchedConnection.executeBatch();

            await expect(secondResponse).to.eventually.be.rejectedWith('No matching response in batch response');
        });

        it('should resolve pending operations', async () => {
            mockPool.intercept({path: '/fmi/odata/v4/foo/$batch', method: 'POST'}).reply(200, [
                '--foo',
                'Content-Type: application/http',
                '',
                'HTTP/1.1 200 OK',
                'Content-Type: application/json',
                '',
                '{"foo": "bar"}',
                '--foo--',
            ].join('\r\n'), {
                headers: {
                    'Content-Type': 'multipart/mixed; boundary=foo',
                },
            });

            const batchedConnection = connection.batchConnection('foo');
            const response = batchedConnection.fetchJson('/foo');
            await batchedConnection.executeBatch();

            await expect(response).to.eventually.become({foo: 'bar'});
        });
    });

    describe('fetchNone', () => {
        it('should compile complete path', async () => {
            mockPool.intercept({path: '/fmi/odata/v4/foo'}).reply(204);
            return connection.fetchNone('/foo');
        });

        it('should add search to request', async () => {
            mockPool.intercept({path: '/fmi/odata/v4?foo=bar'}).reply(204);
            return connection.fetchNone('', {search: new URLSearchParams({foo: 'bar'})});
        });

        it('should replace special characters in search params', async () => {
            mockPool.intercept({path: '/fmi/odata/v4?$foo=a%20b%20c&$bar=d%20e%20f'}).reply(204);
            return connection.fetchNone('', {search: new URLSearchParams({
                '$foo': 'a b c',
                '$bar': 'd e f',
            })});
        });

        it('should default to GET', async () => {
            mockPool.intercept({path: '/fmi/odata/v4'}).reply(204);
            return connection.fetchNone('');
        });

        it('should use supplied method', async () => {
            mockPool.intercept({path: '/fmi/odata/v4', method: 'POST'}).reply(204);
            return connection.fetchNone('', {method: 'POST'});
        });

        it('should have no content type with GET and DELETE', async () => {
            mockPool
                .intercept({
                    path: '/fmi/odata/v4',
                    headers: headers => !Object.keys(headers).includes('content-type'),
                })
                .reply(204);
            mockPool
                .intercept({
                    path: '/fmi/odata/v4',
                    method: 'DELETE',
                    headers: headers => !Object.keys(headers).includes('content-type'),
                })
                .reply(204);

            return Promise.all([
                connection.fetchNone('', {method: 'GET'}),
                connection.fetchNone('', {method: 'DELETE'}),
            ]);
        });

        it('should default to application/json with POST and PATCH', async () => {
            mockPool
                .intercept({path: '/fmi/odata/v4', method: 'POST', headers: {'Content-Type': 'application/json'}})
                .reply(204);
            mockPool
                .intercept({path: '/fmi/odata/v4', method: 'PATCH', headers: {'Content-Type': 'application/json'}})
                .reply(204);

            return Promise.all([
                connection.fetchNone('', {method: 'POST'}),
                connection.fetchNone('', {method: 'PATCH'}),
            ]);
        });

        it('should send custom content type', async () => {
            mockPool
                .intercept({path: '/fmi/odata/v4', method: 'POST', headers: {'Content-Type': 'image/jpeg'}})
                .reply(204);
            return connection.fetchNone('', {method: 'POST', contentType: 'image/jpeg'});
        });

        it('should send application/json accept header', async () => {
            mockPool.intercept({path: '/fmi/odata/v4', headers: {'Accept': 'application/json'}}).reply(204);
            return connection.fetchNone('');
        });

        it('should include body in request', async () => {
            mockPool.intercept({path: '/fmi/odata/v4', method: 'POST', body: 'test'}).reply(204);
            return connection.fetchNone('', {method: 'POST', body: 'test'});
        });

        it('should include binary body in request', async () => {
            mockPool.intercept({
                path: '/fmi/odata/v4',
                method: 'POST',
                body: (body : unknown) => body instanceof Uint8Array,
            }).reply(204);
            return connection.fetchNone('', {method: 'POST', body: Buffer.from('\x01\x02')});
        });

        it('should throw generic error on invalid response', async () => {
            mockPool.intercept({path: '/fmi/odata/v4'}).reply(400);
            await expect(connection.fetchNone('')).to.eventually.be.rejectedWith('An unknown error occurred');
        });

        it('should throw response error', async () => {
            mockPool.intercept({path: '/fmi/odata/v4'}).reply(400, JSON.stringify({
                error: {
                    message: 'foo',
                    code: '-1',
                },
            }));
            await expect(connection.fetchNone('')).to.eventually.be.rejectedWith('foo');
        });

        it('should send authorization header from supplied Authentication', async () => {
            mockPool.intercept({path: '/fmi/odata/v4', headers: {'Authorization': 'foobar'}}).reply(204);
            return connection.fetchNone('');
        });

        it('should queue operation in batched context', () => {
            const batchedConnection = connection.batchConnection('foo');
            void batchedConnection.fetchNone('/foo');

            /* eslint-disable-next-line @typescript-eslint/no-non-null-assertion */
            expect(batchedConnection['batch']!.operations).to.be.lengthOf(1);
        });
    });

    describe('fetchBlob', () => {
        it('should return a blob with unknown content type', async () => {
            mockPool.intercept({path: '/fmi/odata/v4'}).reply(200, 'foobar');
            const response = await connection.fetchBlob('');
            expect(response.buffer.toString()).to.be.equal('foobar');
            expect(response.type).to.be.equal('application/octet-stream');
        });

        it('should return a blob with known content type', async () => {
            mockPool.intercept({path: '/fmi/odata/v4'}).reply(200, 'foobar', {headers: {'Content-Type': 'image/jpeg'}});
            const response = await connection.fetchBlob('');
            expect(response.buffer.toString()).to.be.equal('foobar');
            expect(response.type).to.be.equal('image/jpeg');
        });

        it('should forward fetch params', async () => {
            mockPool.intercept({path: '/fmi/odata/v4', method: 'POST'}).reply(204);
            return await connection.fetchBlob('', {method: 'POST'});
        });
    });

    describe('fetchJson', () => {
        it('should return an object', async () => {
            mockPool.intercept({path: '/fmi/odata/v4'}).reply(200, JSON.stringify({foo: 'bar'}));
            const response = await connection.fetchJson('');
            expect(response).to.be.eql({foo: 'bar'});
        });

        it('should forward fetch params', async () => {
            mockPool.intercept({path: '/fmi/odata/v4', method: 'POST'}).reply(200, '{}');
            await connection.fetchJson('', {method: 'POST'});
        });

        it('should throw error on 204 response', async () => {
            mockPool.intercept({path: '/fmi/odata/v4'}).reply(204);
            await expect(connection.fetchJson('')).to.eventually.rejectedWith('Response included no content');
        });
    });

    describe('laxParsing', () => {
        it('should error with non encoded newlines without lax parsing in JSON response', async () => {
            mockPool.intercept({path: '/fmi/odata/v4'}).reply(200, '{"foo": "bar\nbaz"}');
            const response = connection.fetchJson('');
            await expect(response).to.eventually.be.rejectedWith('Unexpected token');
        });

        it('should error with non encoded newlines without lax parsing in error response', async () => {
            mockPool.intercept({path: '/fmi/odata/v4'}).reply(
                400,
                '{"error": {"code": "101", "message": "bar\nbaz"}}'
            );
            const response = connection.fetchJson('');
            await expect(response).to.eventually.be.rejectedWith('An unknown error occurred');
        });

        const laxConnection = new Connection('localhost', auth, true);

        it('should succeed with non encoded newlines with lax parsing in JSON response', async () => {
            mockPool.intercept({path: '/fmi/odata/v4'}).reply(200, '{"foo": "bar\nbaz"}');
            const response = await laxConnection.fetchJson('');
            expect(response).to.be.eql({foo: 'bar\nbaz'});
        });

        it('should not encode newlines outside of strings', async () => {
            mockPool.intercept({path: '/fmi/odata/v4'}).reply(200, '{"foo":\n"bar"}');
            const response = await laxConnection.fetchJson('');
            expect(response).to.be.eql({foo: 'bar'});
        });

        it('should not double encoded newlines inside of strings', async () => {
            mockPool.intercept({path: '/fmi/odata/v4'}).reply(200, '{"foo": "bar\\nbaz"}');
            const response = await laxConnection.fetchJson('');
            expect(response).to.be.eql({foo: 'bar\nbaz'});
        });

        it('should encode newlines prefixed by double backslash', async () => {
            mockPool.intercept({path: '/fmi/odata/v4'}).reply(200, '{"foo": "bar\\\\\nbaz"}');
            const response = await laxConnection.fetchJson('');
            expect(response).to.be.eql({foo: 'bar\\\nbaz'});
        });

        it('should succeed with non encoded newlines in error response', async () => {
            mockPool.intercept({path: '/fmi/odata/v4'}).reply(
                400,
                '{"error": {"code": "101", "message": "bar\nbaz"}}'
            );
            const response = laxConnection.fetchJson('');
            await expect(response).to.eventually.be.rejectedWith('bar\nbaz');
        });
    });
});
