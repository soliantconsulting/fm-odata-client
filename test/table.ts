import {expect, use} from 'chai';
import chaiAsPromised from 'chai-as-promised'
import 'mocha';
import {promises as fs} from 'fs';
import * as path from 'path';
import sinon, {SinonStubbedInstance} from 'sinon';
import {URLSearchParams} from 'url';
import {Database, Table} from '../src';

use(chaiAsPromised);

describe('Table', () => {
    let databaseStub : SinonStubbedInstance<Database>;
    let table : Table;

    beforeEach(() => {
        databaseStub = sinon.createStubInstance(Database);
        table = new Table(databaseStub as unknown as Database, 'foo');
    });

    describe('create', () => {
        it('should send simple post request', async () => {
            databaseStub.fetchJson.returns(Promise.resolve({}));
            await table.create({foo: 'bar'});
            sinon.assert.calledWith(databaseStub.fetchJson, '/foo');
            await expect(databaseStub.fetchJson.getCall(0).args[1]).to.eventually.eql({
                method: 'POST',
                body: '{"foo":"bar"}',
            });
        });

        it('should call fetchNone when batched', async () => {
            const batchedTable = new Table(databaseStub as unknown as Database, 'foo', true);
            await batchedTable.create({});
            sinon.assert.calledOnce(databaseStub.fetchNone);
        });

        it('should compile repetition object', async () => {
            databaseStub.fetchJson.returns(Promise.resolve({}));
            await table.create({foo: {repetition: 1, value: 'bar'}});
            sinon.assert.calledWith(databaseStub.fetchJson, '/foo');
            await expect(databaseStub.fetchJson.getCall(0).args[1]).to.eventually.eql({
                method: 'POST',
                body: '{"foo[1]":"bar"}',
            });
        });

        it('should encode buffer as base64', async () => {
            databaseStub.fetchJson.returns(Promise.resolve({}));
            await table.create({foo: Buffer.from('\x47\x49\x46')});
            sinon.assert.calledWith(databaseStub.fetchJson, '/foo');
            await expect(databaseStub.fetchJson.getCall(0).args[1]).to.eventually.eql({
                method: 'POST',
                body: '{"foo":"R0lG"}',
            });
        });

        it('should validate buffer', async () => {
            databaseStub.fetchJson.returns(Promise.resolve({}));
            await table.create({foo: Buffer.from('foo')});
            sinon.assert.calledWith(databaseStub.fetchJson, '/foo');
            await expect(databaseStub.fetchJson.getCall(0).args[1]).to.eventually.be.rejected;
        });
    });

    describe('update', () => {
        it('should send simple post request', async () => {
            databaseStub.fetchJson.returns(Promise.resolve({}));
            await table.update('bar', {foo: 'bar'});
            sinon.assert.calledWith(databaseStub.fetchJson, "/foo('bar')");
            await expect(databaseStub.fetchJson.getCall(0).args[1]).to.eventually.eql({
                method: 'PATCH',
                body: '{"foo":"bar"}',
            });
        });

        it('should call fetchNone when batched', async () => {
            const batchedTable = new Table(databaseStub as unknown as Database, "/foo('bar')", true);
            await batchedTable.update('bar', {});
            sinon.assert.calledOnce(databaseStub.fetchNone);
        });
    });

    describe('updateMany', () => {
        it('should send simple post request', async () => {
            databaseStub.fetchJson.returns(Promise.resolve({}));
            await table.updateMany('bar', {foo: 'bar'});
            sinon.assert.calledWith(databaseStub.fetchJson, '/foo');
            await expect(databaseStub.fetchJson.getCall(0).args[1]).to.eventually.eql({
                method: 'PATCH',
                body: '{"foo":"bar"}',
                search: new URLSearchParams({$filter: 'bar'}),
            });
        });

        it('should call fetchNone when batched', async () => {
            const batchedTable = new Table(databaseStub as unknown as Database, '/foo', true);
            await batchedTable.updateMany('bar', {});
            sinon.assert.calledOnce(databaseStub.fetchNone);
        });
    });

    describe('delete', () => {
        it('should send delete request', async () => {
            databaseStub.fetchNone.returns(Promise.resolve());
            await table.delete('foo');
            sinon.assert.calledWith(databaseStub.fetchNone, "/foo('foo')", {method: 'DELETE'});
        });
    });

    describe('deleteMany', () => {
        it('should send delete request with filter', async () => {
            databaseStub.fetchNone.returns(Promise.resolve());
            await table.deleteMany('foo');
            sinon.assert.calledWith(
                databaseStub.fetchNone,
                '/foo',
                {method: 'DELETE', search: new URLSearchParams({$filter: 'foo'})}
            );
        });
    });

    describe('uploadBinary', () => {
        it('should reject unsupported mime-type', async () => {
            databaseStub.fetchNone.returns(Promise.resolve());
            await table.uploadBinary('foo', 'bar', Buffer.from('foo'));
            await expect(databaseStub.fetchNone.getCall(0).args[1]).to.eventually.be.rejectedWith(
                'Invalid data, must be one of the following types:'
            );
        });

        it('should accept GIF', async () => {
            databaseStub.fetchNone.returns(Promise.resolve());
            const data = await fs.readFile(path.join(__dirname, 'fixture/binary.gif'));
            await table.uploadBinary('foo', 'bar', data);
            await expect(databaseStub.fetchNone.getCall(0).args[1]).to.eventually.be.eql({
                method: 'PATCH',
                body: data,
                contentType: 'image/gif',
            });
        });

        it('should accept PNG', async () => {
            databaseStub.fetchNone.returns(Promise.resolve());
            const data = await fs.readFile(path.join(__dirname, 'fixture/binary.png'));
            await table.uploadBinary('foo', 'bar', data);
            await expect(databaseStub.fetchNone.getCall(0).args[1]).to.eventually.be.eql({
                method: 'PATCH',
                body: data,
                contentType: 'image/png',
            });
        });

        it('should accept JPEG', async () => {
            databaseStub.fetchNone.returns(Promise.resolve());
            const data = await fs.readFile(path.join(__dirname, 'fixture/binary.jpg'));
            await table.uploadBinary('foo', 'bar', data);
            await expect(databaseStub.fetchNone.getCall(0).args[1]).to.eventually.be.eql({
                method: 'PATCH',
                body: data,
                contentType: 'image/jpeg',
            });
        });

        it('should accept TIFF', async () => {
            databaseStub.fetchNone.returns(Promise.resolve());
            const data = await fs.readFile(path.join(__dirname, 'fixture/binary.tif'));
            await table.uploadBinary('foo', 'bar', data);
            await expect(databaseStub.fetchNone.getCall(0).args[1]).to.eventually.be.eql({
                method: 'PATCH',
                body: data,
                contentType: 'image/tiff',
            });
        });

        it('should accept PDF', async () => {
            databaseStub.fetchNone.returns(Promise.resolve());
            const data = await fs.readFile(path.join(__dirname, 'fixture/binary.pdf'));
            await table.uploadBinary('foo', 'bar', data);
            await expect(databaseStub.fetchNone.getCall(0).args[1]).to.eventually.be.eql({
                method: 'PATCH',
                body: data,
                contentType: 'application/pdf',
            });
        });
    });

    describe('count', () => {
        it('should not include search without filter', async () => {
            databaseStub.fetchJson.returns(Promise.resolve(1));
            const count = await table.count();
            expect(count).to.equal(1);
            sinon.assert.calledWith(databaseStub.fetchJson, '/foo/$count', {search: undefined});
        });

        it('should include search withh filter', async () => {
            databaseStub.fetchJson.returns(Promise.resolve(1));
            const count = await table.count('bar eq 2');
            expect(count).to.equal(1);
            sinon.assert.calledWith(
                databaseStub.fetchJson,
                '/foo/$count',
                {search: new URLSearchParams({$filter: 'bar eq 2'})}
            );
        });
    });

    describe('fetchById', () => {
        it('should return the result', async () => {
            databaseStub.fetchJson.returns(Promise.resolve({foo: 'bar'}));
            const result = table.fetchById('bar');
            await expect(result).to.eventually.eql({foo: 'bar'});
        });

        it('should return null on 404 response with specific error code', async () => {
            databaseStub.fetchJson.rejects({statusCode: 404, errorCode: '-1023'});
            const result = table.fetchById('bar');
            await expect(result).to.eventually.be.null;
        });

        it('should rethrow unknown error', async () => {
            databaseStub.fetchJson.rejects(new Error('error'));
            const result = table.fetchById('bar');
            await expect(result).to.eventually.be.rejectedWith('error');
        });

        it('should encode a single numeric value', async () => {
            databaseStub.fetchJson.returns(Promise.resolve({}));
            await table.fetchById(1);
            sinon.assert.calledWith(
                databaseStub.fetchJson,
                '/foo(1)',
            );
        });

        it('should encode a single string value', async () => {
            databaseStub.fetchJson.returns(Promise.resolve({}));
            await table.fetchById('bar');
            sinon.assert.calledWith(
                databaseStub.fetchJson,
                "/foo('bar')",
            );
        });

        it('should encode an object value', async () => {
            databaseStub.fetchJson.returns(Promise.resolve({}));
            await table.fetchById({bar: 'baz', bat: 1});
            sinon.assert.calledWith(
                databaseStub.fetchJson,
                "/foo(bar='baz',bat=1)",
            );
        });
    });

    describe('fetchField', () => {
        it('should return the result', async () => {
            databaseStub.fetchBlob.returns(Promise.resolve({type: 'text/plain', buffer: Buffer.from('foo')}));
            const result = table.fetchField('bar', 'baz');
            await expect(result).to.eventually.eql({type: 'text/plain', buffer: Buffer.from('foo')});
            sinon.assert.calledWith(
                databaseStub.fetchBlob,
                "/foo('bar')/baz/$value",
            );
        });
    });

    describe('fetchOne', () => {
        it('should limit query to one result', async () => {
            databaseStub.fetchJson.returns(Promise.resolve({value: []}));
            await table.fetchOne();
            sinon.assert.calledWith(
                databaseStub.fetchJson,
                '/foo',
                {search: new URLSearchParams({$top: '1'})}
            );
        });

        it('should pass down params', async () => {
            databaseStub.fetchJson.returns(Promise.resolve({value: []}));
            await table.fetchOne({skip: 1});
            sinon.assert.calledWith(
                databaseStub.fetchJson,
                '/foo',
                {search: new URLSearchParams({$top: '1', $skip: '1'})}
            );
        });

        it('should return first result', async () => {
            databaseStub.fetchJson.returns(Promise.resolve({value: [{foo: 'bar'}]}));
            const result = table.fetchOne();
            await expect(result).to.eventually.eql({foo: 'bar'});
        });

        it('should return null without result', async () => {
            databaseStub.fetchJson.returns(Promise.resolve({value: []}));
            const result = table.fetchOne();
            await expect(result).to.eventually.be.null;
        });
    });

    describe('query', () => {
        it('should return results', async () => {
            databaseStub.fetchJson.returns(Promise.resolve({value: [{foo: 'bar'}]}));
            const result = table.query();
            await expect(result).to.eventually.eql([{foo: 'bar'}]);
        });

        it('should add filter when provided', async () => {
            databaseStub.fetchJson.returns(Promise.resolve({value: []}));
            await table.query({filter: 'foo'});
            sinon.assert.calledWith(
                databaseStub.fetchJson,
                '/foo',
                {search: new URLSearchParams({$filter: 'foo'})}
            );
        });

        it('should add string type order by', async () => {
            databaseStub.fetchJson.returns(Promise.resolve({value: []}));
            await table.query({orderBy: 'foo'});
            sinon.assert.calledWith(
                databaseStub.fetchJson,
                '/foo',
                {search: new URLSearchParams({$orderby: 'foo'})}
            );
        });

        it('should add order by with field and direction', async () => {
            databaseStub.fetchJson.returns(Promise.resolve({value: []}));
            await table.query({orderBy: {field: 'foo', direction: 'desc'}});
            sinon.assert.calledWith(
                databaseStub.fetchJson,
                '/foo',
                {search: new URLSearchParams({$orderby: 'foo desc'})}
            );
        });

        it('should add order by with only field', async () => {
            databaseStub.fetchJson.returns(Promise.resolve({value: []}));
            await table.query({orderBy: {field: 'foo'}});
            sinon.assert.calledWith(
                databaseStub.fetchJson,
                '/foo',
                {search: new URLSearchParams({$orderby: 'foo'})}
            );
        });

        it('should add order by with multiple fields', async () => {
            databaseStub.fetchJson.returns(Promise.resolve({value: []}));
            await table.query({orderBy: [{field: 'foo'}, {field: 'bar', direction: 'desc'}]});
            sinon.assert.calledWith(
                databaseStub.fetchJson,
                '/foo',
                {search: new URLSearchParams({$orderby: 'foo,bar desc'})}
            );
        });

        it('should add top when provided', async () => {
            databaseStub.fetchJson.returns(Promise.resolve({value: []}));
            await table.query({top: 1});
            sinon.assert.calledWith(
                databaseStub.fetchJson,
                '/foo',
                {search: new URLSearchParams({$top: '1'})}
            );
        });

        it('should add skip when provided', async () => {
            databaseStub.fetchJson.returns(Promise.resolve({value: []}));
            await table.query({skip: 1});
            sinon.assert.calledWith(
                databaseStub.fetchJson,
                '/foo',
                {search: new URLSearchParams({$skip: '1'})}
            );
        });

        it('should add count when provided', async () => {
            databaseStub.fetchJson.returns(Promise.resolve({'@odata.count': 5, value: []}));
            const result = table.query({count: true});
            await expect(result).to.eventually.eql({count: 5, rows: []});
            sinon.assert.calledWith(
                databaseStub.fetchJson,
                '/foo',
                {search: new URLSearchParams({$count: 'true'})}
            );
        });

        it('should add select when provided', async () => {
            databaseStub.fetchJson.returns(Promise.resolve({value: []}));
            await table.query({select: ['foo', 'bar']});
            sinon.assert.calledWith(
                databaseStub.fetchJson,
                '/foo',
                {search: new URLSearchParams({$select: 'foo,bar'})}
            );
        });

        it('should query simple related table when provided', async () => {
            databaseStub.fetchJson.returns(Promise.resolve({value: []}));
            await table.query({relatedTable: 'ba+r'});
            sinon.assert.calledWith(
                databaseStub.fetchJson,
                '/foo/ba%2Br',
                {search: new URLSearchParams()}
            );
        });

        it('should query link of related tables when provided', async () => {
            databaseStub.fetchJson.returns(Promise.resolve({value: []}));
            await table.query({relatedTable: ['ba+r', 'baz']});
            sinon.assert.calledWith(
                databaseStub.fetchJson,
                '/foo/ba%2Br/baz',
                {search: new URLSearchParams()}
            );
        });

        it('should query related table of individual record when provided', async () => {
            databaseStub.fetchJson.returns(Promise.resolve({value: []}));
            await table.query({relatedTable: {primaryKey: 1, table: 'bar'}});
            sinon.assert.calledWith(
                databaseStub.fetchJson,
                '/foo(1)/bar',
                {search: new URLSearchParams()}
            );
        });
    });

    describe('crossJoin', () => {
        it('should join single table', async () => {
            databaseStub.fetchJson.returns(Promise.resolve({value: [{foo: 'bar'}]}));
            const result = table.crossJoin('bar');
            await expect(result).to.eventually.eql([{foo: 'bar'}]);
            sinon.assert.calledWith(
                databaseStub.fetchJson,
                '/$crossjoin(foo,bar)',
                {search: new URLSearchParams()}
            );
        });

        it('should join single table', async () => {
            databaseStub.fetchJson.returns(Promise.resolve({value: []}));
            await table.crossJoin(['bar', 'baz']);
            sinon.assert.calledWith(
                databaseStub.fetchJson,
                '/$crossjoin(foo,bar,baz)',
                {search: new URLSearchParams()}
            );
        });

        it('should add expand join when provided', async () => {
            databaseStub.fetchJson.returns(Promise.resolve({value: []}));
            await table.crossJoin('bar', {select: {foo: ['bar', 'baz']}});
            sinon.assert.calledWith(
                databaseStub.fetchJson,
                '/$crossjoin(foo,bar)',
                {search: new URLSearchParams({
                    $expand: 'foo($select=bar,baz)',
                })}
            );
        });

        it('should return count when enabled', async () => {
            databaseStub.fetchJson.returns(Promise.resolve({'@odata.count': 5, value: []}));
            const result = table.crossJoin('bar', {count: true});
            await expect(result).to.eventually.eql({count: 5, rows: []});
        });
    });
});
