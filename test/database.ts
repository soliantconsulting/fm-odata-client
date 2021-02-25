import {expect, use} from 'chai';
import chaiAsPromised from 'chai-as-promised'
import 'mocha';
import sinon, {SinonStubbedInstance} from 'sinon';
import {Blob, Connection, Database, FetchParams} from '../src';

use(chaiAsPromised);

describe('Database', () => {
    let connectionStub : SinonStubbedInstance<Connection>;
    let database : Database;

    beforeEach(() => {
        connectionStub = sinon.createStubInstance(Connection);
        database = new Database(connectionStub as unknown as Connection, 'foo');
    });

    describe('schemaManager', () => {
        it('should return a schema manager instance of the given database', () => {
            const schemaManager = database.schemaManager();
            expect(schemaManager['database']).to.be.equal(database);
        });
    });

    describe('table', () => {
        it('should return a table instance of the given name', () => {
            const table = database.table('bar');
            expect(table['name']).to.be.equal('bar');
            expect(table['database']).to.be.equal(database);
        });
    });

    describe('listTables', () => {
        it('should return a list of tables', async () => {
            connectionStub.fetchJson.returns(Promise.resolve({
                value: [{name: 'baz', kind: 'EntitySet', url: 'https://localhost/fmi/odata/v4/foo/bar'}],
            }));
            const tables = await database.listTables();
            expect(tables).to.be.eql([{name: 'baz', kind: 'EntitySet', url: 'https://localhost/fmi/odata/v4/foo/bar'}]);
            sinon.assert.calledWith(connectionStub.fetchJson, '/foo', {});
        });
    });

    describe('getMetadata', () => {
        it('should return response metadata', async () => {
            connectionStub.fetchJson.returns(Promise.resolve({
                foo: {baz: {$Kind: 'EntityType', $Key: ['ID'], ID: {$Type: 'Edm.Decimal'}}},
            }));
            const metadata = await database.getMetadata();
            expect(metadata).to.be.eql({baz: {$Kind: 'EntityType', $Key: ['ID'], ID: {$Type: 'Edm.Decimal'}}});
        });

        it('should fail when no metadata for the database are returned', async () => {
            connectionStub.fetchJson.returns(Promise.resolve({}));
            await expect(database.getMetadata()).to.eventually.rejectedWith(
                'Response did not include any table information'
            );
            sinon.assert.calledWith(connectionStub.fetchJson, '/foo/$metadata', {});
        });
    });

    describe('runScript', () => {
        it('should return script result', async () => {
            connectionStub.fetchJson.returns(Promise.resolve({
                scriptResult: {code: 0, resultParameter: ''}
            }));
            const result = await database.runScript('baz');
            expect(result).to.be.eql({code: 0, resultParameter: ''});
            sinon.assert.calledWith(connectionStub.fetchJson, '/foo/Script.baz', {method: 'POST', body: '{}'});
        });

        it('should return include script parameter', async () => {
            connectionStub.fetchJson.returns(Promise.resolve({
                scriptResult: {code: 0, resultParameter: ''}
            }));
            await database.runScript('baz', 'param');
            sinon.assert.calledWith(connectionStub.fetchJson, '/foo/Script.baz', {
                method: 'POST',
                body: '{"scriptParameterValue":"param"}',
            });
        });
    });

    describe('fetchNone', () => {
        it('should forward path', async () => {
            await database.fetchNone('/bar');
            sinon.assert.calledWith(connectionStub.fetchNone, '/foo/bar');
        });

        it('should forward fetch params', async () => {
            const fetchParams : FetchParams = {};
            await database.fetchNone('/bar', fetchParams);
            sinon.assert.calledWith(connectionStub.fetchNone, '/foo/bar', fetchParams);
        });
    });

    describe('fetchJson', () => {
        it('should forward path', async () => {
            connectionStub.fetchJson.returns(Promise.resolve({}));
            await database.fetchJson('/bar');
            sinon.assert.calledWith(connectionStub.fetchJson, '/foo/bar');
        });

        it('should forward fetch params', async () => {
            connectionStub.fetchJson.returns(Promise.resolve({}));
            const fetchParams : FetchParams = {};
            await database.fetchJson('/bar', fetchParams);
            sinon.assert.calledWith(connectionStub.fetchJson, '/foo/bar', fetchParams);
        });
    });

    describe('fetchBlob', () => {
        const blob : Blob = {type: 'foo', buffer: Buffer.from('foo')};

        it('should forward path', async () => {
            connectionStub.fetchBlob.returns(Promise.resolve(blob));
            await database.fetchBlob('/bar');
            sinon.assert.calledWith(connectionStub.fetchBlob, '/foo/bar');
        });

        it('should forward fetch params', async () => {
            connectionStub.fetchBlob.returns(Promise.resolve(blob));
            const fetchParams : FetchParams = {};
            await database.fetchBlob('/bar', fetchParams);
            sinon.assert.calledWith(connectionStub.fetchBlob, '/foo/bar', fetchParams);
        });
    });
});
