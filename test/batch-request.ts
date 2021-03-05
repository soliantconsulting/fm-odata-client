import {expect, use} from 'chai';
import chaiAsPromised from 'chai-as-promised'
import 'mocha';
import {Headers, Request} from 'node-fetch';
import BatchRequest from '../src/BatchRequest';

use(chaiAsPromised);

describe('BatchRequest', () => {
    describe('toRequest', () => {
        it('should include include basic headers', () => {
            const request = new BatchRequest('http://localhost', 'foo', [
                new Request('http://localhost/foo'),
            ]).toRequest();
            expect(request.method).to.equal('POST');
            expect(request.headers.get('OData-Version')).to.equal('4.0');
            expect(request.headers.get('Content-Type')).to.match(/^multipart\/mixed; boundary=(batch_[a-z0-9]{32})$/);
            expect(request.headers.get('Authorization')).to.equal('foo');
        });

        it('should include start and end boundary', async () => {
            const request = new BatchRequest('http://localhost', 'foo', [
                new Request('http://localhost/foo'),
            ]).toRequest();
            const [, boundary] = request.headers.get('Content-Type')!
                .match(/^multipart\/mixed; boundary=(batch_[a-z0-9]{32})$/)!;

            await expect(request.text()).to.eventually.equal([
                `--${boundary}`,
                'Content-Type: application/http',
                'Content-Transfer-Encoding: binary',
                '',
                'GET http://localhost/foo HTTP/1.1',
                '',
                '',
                `--${boundary}--`,
            ].join('\r\n'));
        });

        it('should add headers from sub request', async () => {
            const request = new BatchRequest('http://localhost', 'foo', [
                new Request('http://localhost/foo', {headers: {'Content-Type': 'text/plain'}}),
            ]).toRequest();

            await expect(request.text()).to.eventually.contain([
                'GET http://localhost/foo HTTP/1.1',
                'content-type: text/plain',
                '',
                '',
            ].join('\r\n'));
        });

        it('should exclude authorization header from sub request', async () => {
            const request = new BatchRequest('http://localhost', 'foo', [
                new Request('http://localhost/foo', {headers: {'Authorization': 'foobar'}}),
            ]).toRequest();

            await expect(request.text()).to.eventually.contain([
                'GET http://localhost/foo HTTP/1.1',
                '',
                '',
            ].join('\r\n'));
        });

        it('should include supplied body', async () => {
            const request = new BatchRequest('http://localhost', 'foo', [
                new Request('http://localhost/foo', {
                    method: 'POST',
                    body: '{}',
                    headers: {'Content-Type': 'application/json'},
                }),
            ]).toRequest();

            await expect(request.text()).to.eventually.contain([
                'POST http://localhost/foo HTTP/1.1',
                'content-type: application/json',
                '',
                '{}',
                '',
            ].join('\r\n'));
        });

        it('should place update operations in a changeset', async () => {
            const request = new BatchRequest('http://localhost', 'foo', [
                new Request('http://localhost/foo', {method: 'POST'}),
            ]).toRequest();

            const body = await request.text();
            const [, boundary] = request.headers.get('Content-Type')!
                .match(/^multipart\/mixed; boundary=(batch_[a-z0-9]{32})$/)!;

            const batchParts = body.split(`--${boundary}`).slice(1, -1);
            const changeSetBoundaryRegexp = /^Content-Type: multipart\/mixed; boundary=(changeset_[a-z0-9]{32})\r\n/;

            const changeset = batchParts[0].trim();

            expect(changeset).to.match(changeSetBoundaryRegexp);
            const [, changesetBoundary] = changeset.match(changeSetBoundaryRegexp)!;
            const changesetParts = changeset.split(`--${changesetBoundary}`).slice(1, -1);

            expect(changesetParts).to.eql([[
                '',
                'Content-Type: application/http',
                'Content-Transfer-Encoding: binary',
                '',
                'POST http://localhost/foo HTTP/1.1',
                '',
                '',
                '',
            ].join('\r\n')]);
        });

        it('should split changesets', async () => {
            const request = new BatchRequest('http://localhost', 'foo', [
                new Request('http://localhost/foo1', {method: 'POST'}),
                new Request('http://localhost/foo2', {method: 'POST'}),
                new Request('http://localhost/foo3', {method: 'GET'}),
                new Request('http://localhost/foo4', {method: 'POST'}),
            ]).toRequest();

            const body = await request.text();
            const [, boundary] = request.headers.get('Content-Type')!
                .match(/^multipart\/mixed; boundary=(batch_[a-z0-9]{32})$/)!;

            const batchParts = body.split(`--${boundary}`).slice(1, -1);

            expect(batchParts[0]).to.include('foo1');
            expect(batchParts[0]).to.include('foo2');
            expect(batchParts[1]).to.include('foo3');
            expect(batchParts[2]).to.include('foo4');
        });
    });

    describe('parseMultipartResponse', () => {
        it('should parse individual response', async () => {
            const [response] = BatchRequest.parseMultipartResponse([
                '--foo',
                'Content-Type: application/http',
                '',
                'HTTP/1.1 200 OK',
                'Content-Type: text/plain',
                '',
                'foo',
                '--foo--'
            ].join('\r\n'), new Headers({'Content-Type': 'multipart/mixed; boundary=foo'}))

            expect(response.headers.get('Content-Type')).to.equal('text/plain');
            await expect(response.text()).to.eventually.equal('foo');
        });

        it('should ignore missing end boundary', async () => {
            const [response] = BatchRequest.parseMultipartResponse([
                '--foo',
                'Content-Type: application/http',
                '',
                'HTTP/1.1 200 OK',
                '',
                'foo',
            ].join('\r\n'), new Headers({'Content-Type': 'multipart/mixed; boundary=foo'}))

            await expect(response.text()).to.eventually.equal('foo');
        });

        it('should parse inner changeset response', async () => {
            const [response] = BatchRequest.parseMultipartResponse([
                '--foo',
                'Content-Type: multipart/mixed; boundary=bar',
                '',
                '--bar',
                'Content-Type: application/http',
                '',
                'HTTP/1.1 200 OK',
                '',
                'foo',
                '--bar--',
                '--foo--',
            ].join('\r\n'), new Headers({'Content-Type': 'multipart/mixed; boundary=foo'}))

            await expect(response.text()).to.eventually.equal('foo');
        });

        it('should throw error on missing parent content-type header', async () => {
            expect(BatchRequest.parseMultipartResponse.bind(
                BatchRequest,
                '',
                new Headers())
            ).to.throw('Response is missing Content-Type header');
        });

        it('should throw error on missing boundary on content-type header', async () => {
            expect(BatchRequest.parseMultipartResponse.bind(
                BatchRequest,
                '',
                new Headers({'Content-Type': 'multipart'}))
            ).to.throw('Content-Type header is missing boundary');
        });

        it('should throw error on missing content-type header', async () => {
            expect(BatchRequest.parseMultipartResponse.bind(BatchRequest, [
                '--foo',
                '',
                'HTTP/1.1 200 OK',
                '',
                'foo',
            ].join('\r\n'), new Headers({'Content-Type': 'multipart/mixed; boundary=foo'})))
                .to.throw('Multipart part is missing content-type header');
        });

        it('should throw error on unknown content-type header', async () => {
            expect(BatchRequest.parseMultipartResponse.bind(BatchRequest, [
                '--foo',
                'Content-Type: text/plain',
                '',
                'HTTP/1.1 200 OK',
                '',
                'foo',
            ].join('\r\n'), new Headers({'Content-Type': 'multipart/mixed; boundary=foo'})))
                .to.throw('Unknown content-type: text/plain');
        });
    });
});
