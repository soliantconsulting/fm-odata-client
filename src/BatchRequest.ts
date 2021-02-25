import * as Crypto from 'crypto';
import {Headers, Request, Response} from 'node-fetch';

/**
 * @internal
 */
class BatchRequest
{
    private operations : Array<Request | Request[]> = [];
    private lastChangeset : Request[] | null = null;

    public constructor(
        private serviceEndpoint : string,
        private authorizationHeader : string,
        operations : Request[],
    )
    {
        for (const operation of operations) {
            this.addRequest(operation);
        }
    }

    public toRequest() : Request
    {
        const boundary = `batch_${Crypto.randomBytes(16).toString('hex')}`;
        const headers = new Headers({
            Authorization: this.authorizationHeader,
            'OData-Version': '4.0',
            'Content-Type': `multipart/mixed; boundary=${boundary}`,
        });

        const body = this.operations.map(request => {
            if (Array.isArray(request)) {
                const changesetBoundary = `changeset_${Crypto.randomBytes(16).toString('hex')}`;

                return [
                    `--${boundary}`,
                    `Content-Type: multipart/mixed; boundary=${changesetBoundary}`,
                    '',
                    ...request.map(request => `--${changesetBoundary}\r\n${BatchRequest.formatRequest(request)}`),
                    `--${changesetBoundary}--`,
                ].join('\r\n');
            }

            return `--${boundary}\r\n${BatchRequest.formatRequest(request)}`;
        }).join('\r\n');

        return new Request(`${this.serviceEndpoint}/$batch`, {
            method: 'POST',
            headers,
            body: `${body}\r\n--${boundary}--`,
        });
    }

    public static parseMultipartResponse(body : string, headers : Headers) : Response[]
    {
        const boundary = BatchRequest.getBoundary(headers);
        const endBoundaryIndex = body.indexOf(`--${boundary}--`);

        if (endBoundaryIndex >= 0) {
            body = body.slice(0, endBoundaryIndex);
        }

        const parts = body
            .split(`--${boundary}\r\n`)
            .slice(1)
            .map(BatchRequest.splitPart);

        const responses : Response[] = [];

        for (const [headers, body] of parts) {
            const contentType = headers.get('Content-Type');

            if (!contentType) {
                throw new Error('Multipart part is missing content-type header');
            }

            if (contentType === 'application/http') {
                responses.push(BatchRequest.parseHttpResponse(body));
                continue;
            }

            if (contentType.startsWith('multipart/mixed')) {
                const changesetResponses = BatchRequest.parseMultipartResponse(body, headers);
                responses.push(...changesetResponses);
                continue;
            }

            throw new Error(`Unknown content-type: ${contentType}`);
        }

        return responses;
    }

    public static parseHttpResponse(rawResponse : string) : Response
    {
        const firstBreakIndex = rawResponse.indexOf('\r\n');
        const statusLine = rawResponse.slice(0, firstBreakIndex);
        rawResponse = rawResponse.slice(firstBreakIndex + 2);

        const [, statusCode, ...statusText] = statusLine.split(' ');
        const [headers, body] = BatchRequest.splitPart(rawResponse);

        return new Response(body.trim(), {
            headers,
            status: parseInt(statusCode, 10),
            statusText: statusText.join(' '),
        });
    }

    public static splitPart(part : string) : [Headers, string]
    {
        const breakIndex = part.indexOf('\r\n\r\n');
        const rawHeaders = part.slice(0, breakIndex);
        const rawBody = part.slice(breakIndex + 4);

        const headers = new Headers();

        for (const rawHeader of rawHeaders.split('\r\n')) {
            const separatorIndex = rawHeader.indexOf(':');
            headers.append(rawHeader.slice(0, separatorIndex), rawHeader.slice(separatorIndex + 1).trim());
        }

        return [headers, rawBody];
    }

    private static getBoundary(headers : Headers) : string
    {
        const contentType = headers.get('Content-Type');

        if (!contentType) {
            throw new Error('Response is missing Content-Type header');
        }

        const boundaryPart = contentType.split(';').map(part => part.trim()).find(part => part.startsWith('boundary='));

        if (!boundaryPart) {
            throw new Error('Content-Type header is missing boundary');
        }

        const [, boundary] = boundaryPart.split('=');
        return boundary;
    }

    private static formatRequest(request : Request) : string
    {
        return [
            'Content-Type: application/http',
            'Content-Transfer-Encoding: binary',
            '',
            `${request.method} ${request.url} HTTP/1.1`,
            ...BatchRequest.formatRequestHeaders(request.headers),
            '',
            request.body,
        ].join('\r\n');
    }

    private static formatRequestHeaders(headers : Headers) : string[]
    {
        const result : string[] = [];

        for (const [key, value] of headers.entries()) {
            if (key.toLowerCase() === 'authorization') {
                continue;
            }

            result.push(`${key}: ${value}`);
        }

        return result;
    }

    private addRequest(request : Request) : void
    {
        if (request.method === 'GET') {
            this.lastChangeset = null;
            this.operations.push(request);
            return;
        }

        if (!this.lastChangeset) {
            this.lastChangeset = [];
            this.operations.push(this.lastChangeset);
        }

        this.lastChangeset.push(request);
    }
}

export default BatchRequest;
