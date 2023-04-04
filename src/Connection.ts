import type {URLSearchParams} from 'url';
import type {BodyInit, Response} from 'undici';
import {fetch, Headers, Request} from 'undici';
import BatchRequest from './BatchRequest.js';
import Database from './Database.js';

export type Authentication = {
    getAuthorizationHeader : () => Promise<string>;
};

export type FetchParams = {
    search ?: URLSearchParams;
    method ?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    body ?: BodyInit;
    contentType ?: string;
};

export class FetchError extends Error {
    public constructor(
        message : string,
        public readonly errorCode : string,
        public readonly statusCode : number,
    ) {
        super(message);
    }
}

export type DatabaseListEntry = {
    name : string;
    kind : 'EntityContainer';
    url : string;
};

export type ServiceDocument<T> = {
    /* eslint-disable @typescript-eslint/naming-convention */
    '@odata.context' : string;
    /* eslint-enable @typescript-eslint/naming-convention */
    value : T;
};

export type Blob = {
    type : string;
    buffer : Buffer;
};

type BatchOperation = {
    path : string;
    params : FetchParams | Promise<FetchParams>;
    resolve : (response : Response) => void;
    reject : (error : Error) => void;
};

type Batch = {
    databaseName : string;
    operations : BatchOperation[];
};

class Connection {
    private batch : Batch | null = null;

    public constructor(
        private readonly hostname : string,
        private readonly authentication : Authentication,
        private readonly laxParsing = false,
    ) {
    }

    public async listDatabases() : Promise<DatabaseListEntry[]> {
        if (this.batch) {
            throw new Error('Databases cannot be listed from a batched connection');
        }

        const response = await this.fetchJson<ServiceDocument<DatabaseListEntry[]>>('');
        return response.value;
    }

    public database(name : string) : Database {
        if (this.batch) {
            throw new Error('Database objects cannot be created from a batched connection');
        }

        return new Database(this, name);
    }

    /**
     * @internal
     */
    public batchConnection(databaseName : string) : Connection {
        const connection = new Connection(this.hostname, this.authentication);
        connection.batch = {databaseName, operations: []};
        return connection;
    }

    /**
     * @internal
     */
    public async executeBatch() : Promise<void> {
        if (!this.batch) {
            throw new Error('A batch has not been started');
        }

        if (this.batch.operations.length === 0) {
            return;
        }

        const batchRequest = new BatchRequest(
            `https://${this.hostname}/fmi/odata/v4/${this.batch.databaseName}`,
            await this.authentication.getAuthorizationHeader(),
            await Promise.all(this.batch.operations.map(
                async operation => this.createRequest(operation.path, operation.params)
            )),
        );

        const response = await fetch(await batchRequest.toRequest());

        if (!response.ok) {
            throw new Error('Batch request failed');
        }

        const body = await response.text();
        const responses = BatchRequest.parseMultipartResponse(body, response.headers);

        for (let i = 0; i < this.batch.operations.length; ++i) {
            if (!responses[i]) {
                this.batch.operations[i].reject(new Error('No matching response in batch response'));
                continue;
            }

            this.batch.operations[i].resolve(responses[i]);
        }
    }

    /**
     * @internal
     */
    public async fetchNone(path : string, params : FetchParams | Promise<FetchParams> = {}) : Promise<void> {
        await this.fetch(path, params);
    }

    /**
     * @internal
     */
    public async fetchJson<T>(path : string, params : FetchParams | Promise<FetchParams> = {}) : Promise<T> {
        const response = await this.fetch(path, params);

        if (response.status === 204) {
            throw new Error('Response included no content');
        }

        return await this.parseResponseJson<T>(response);
    }

    /**
     * @internal
     */
    public async fetchBlob(path : string, params : FetchParams | Promise<FetchParams> = {}) : Promise<Blob> {
        const response = await this.fetch(path, params);
        const contentType = response.headers.get('Content-Type');
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        return {buffer, type: contentType ?? 'application/octet-stream'};
    }

    private async fetch(path : string, params : FetchParams | Promise<FetchParams>) : Promise<Response> {
        let response : Response;

        if (this.batch) {
            const batch = this.batch;
            response = await new Promise((resolve, reject) => {
                batch.operations.push({path, params, resolve, reject});
            });
        } else {
            const request = await this.createRequest(path, params);
            response = await fetch(request);
        }

        if (!response.ok) {
            let errorCode = 'unknown';
            let errorMessage = 'An unknown error occurred';

            try {
                const data = await this.parseResponseJson<{
                    error : {
                        code : string;
                        message : string;
                    };
                }>(response);
                errorCode = data.error.code;
                errorMessage = data.error.message;
            } catch {
                // Ignore error.
            }

            throw new FetchError(errorMessage, errorCode, response.status);
        }

        return response;
    }

    private async createRequest(path : string, params : FetchParams | Promise<FetchParams>) : Promise<Request> {
        params = await params;
        let url = `https://${this.hostname}/fmi/odata/v4${path}`;

        if (params.search) {
            url += `?${Connection.stringifySearch(params.search)}`;
        }

        const headers = new Headers({
            Authorization: await this.authentication.getAuthorizationHeader(),
            Accept: 'application/json',
        });

        if (params.contentType) {
            headers.set('Content-Type', params.contentType);
        } else if (params.method === 'POST' || params.method === 'PATCH') {
            headers.set('Content-Type', 'application/json');
        }

        if (typeof params.body === 'string' || Buffer.isBuffer(params.body)) {
            headers.set('Content-Length', params.body.length.toString());
        }

        return new Request(url, {
            keepalive: true,
            method: params.method,
            body: params.body,
            headers,
        });
    }

    private async parseResponseJson<T = unknown>(response : Response) : Promise<T> {
        if (!this.laxParsing) {
            return await response.json() as T;
        }

        const json = await response.text();
        const cleanedJson = json.replace(/"(?:(?=(\\?))\1.)*?"/gs, substring => {
            return substring.replace(/(?<!\\)((?:\\\\)*)\n/g, '$1\\n');
        });

        return await JSON.parse(cleanedJson) as T;
    }

    private static stringifySearch(search : URLSearchParams) : string {
        const specialTokens = {'%24': '$', '+': '%20', '%2F': '/', '%3D': '=', '%2C': ','};
        return search.toString().replace(
            /(%24|\+|%2F|%3D|%2C)/g,
            match => specialTokens[match as keyof typeof specialTokens]
        );
    }
}

export default Connection;
