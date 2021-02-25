import * as FileType from 'file-type';
import {URLSearchParams} from 'url';
import {Blob, FetchParams, ServiceDocument} from './Connection';
import Database from './Database';

export type FieldValue = string | number | Buffer;
export type Repetition = {
    repetition : number;
    value : FieldValue;
};
export type RowData = Record<string, FieldValue | Repetition>;

export type OrderBy = {
    field : string;
    direction ?: 'asc' | 'desc';
};

export type QueryParams = {
    filter ?: string;
    orderBy ?: string | OrderBy | OrderBy[];
    top ?: number;
    skip ?: number;
    count ?: boolean;
    select ?: string[];
};

export type Row = {
    '@odata.id' : string;
    '@odata.editLink' : string;
} & Record<string, string | number>;

export type PrimaryKey = string | number | Record<string, string | number>;

export const allowedFileTypes = ['image/gif', 'image/png', 'image/jpeg', 'image/tiff', 'application/pdf'];

class Table<Batched extends boolean = false>
{
    public constructor(
        private database : Database<Batched>,
        private name : string,
        private batched : Batched = false as Batched,
    )
    {
    }

    public async create(data : RowData) : Promise<Batched extends false ? Row : void>;
    public async create(data : RowData) : Promise<Row | void>
    {
        return (this.batched ? this.fetchNone : this.fetchJson).bind(this)('', async () => ({
            method: 'POST',
            body: JSON.stringify(await Table.compileRowData(data)),
        }));
    }

    public async update(id : PrimaryKey, data : RowData) : Promise<Batched extends false ? Row : void>;
    public async update(id : PrimaryKey, data : RowData) : Promise<Row | void>
    {
        return (this.batched ? this.fetchNone : this.fetchJson).bind(this)(
            `(${Table.compilePrimaryKey(id)})`,
            async () => ({
                method: 'PATCH',
                body: JSON.stringify(await Table.compileRowData(data)),
            })
        );
    }

    public async updateMany(filter : string, data : RowData) : Promise<Batched extends false ? Row[] : void>;
    public async updateMany(filter : string, data : RowData) : Promise<Row[] | void>
    {
        return (this.batched ? this.fetchNone : this.fetchJson).bind(this)('', async () => ({
            method: 'PATCH',
            search: new URLSearchParams({$filter: filter}),
            body: JSON.stringify(await Table.compileRowData(data)),
        }));
    }

    public async delete(id : PrimaryKey) : Promise<void>
    {
        return this.fetchNone(`(${Table.compilePrimaryKey(id)})`, {method: 'DELETE'});
    }

    public async deleteMany(filter : string) : Promise<void>
    {
        return this.fetchNone('', {
            method: 'DELETE',
            search: new URLSearchParams({$filter: filter}),
        });
    }

    public async uploadBinary(id : PrimaryKey, fieldName : string, data : Buffer) : Promise<void>
    {
        return this.fetchNone(`(${Table.compilePrimaryKey(id)})/${fieldName}`, async () => {
            const fileType = await FileType.fromBuffer(data);

            if (!fileType || !allowedFileTypes.includes(fileType.mime)) {
                throw new Error('Invalid data, must be one of the following types: ' + allowedFileTypes.join(', '));
            }

            return {
                method: 'PATCH',
                body: data,
                contentType: fileType.mime,
            };
        });
    }

    public async count(filter ?: string) : Promise<number>
    {
        return this.fetchJson<number>('/$count', {
            search: !filter ? undefined : new URLSearchParams({
                $filter: filter,
            }),
        });
    }

    public async fetchById(id : PrimaryKey) : Promise<Row | null>
    {
        try {
            return await this.fetchJson(`(${Table.compilePrimaryKey(id)})`);
        } catch (e) {
            if (e.statusCode === 404 && e.errorCode === '-1023') {
                return null;
            }

            throw e;
        }
    }

    public async fetchField(id : PrimaryKey, fieldName : string) : Promise<Blob>
    {
        return this.fetchBlob(`(${Table.compilePrimaryKey(id)})/${fieldName}/$value`);
    }

    public async fetchOne(params ?: Omit<QueryParams, 'top' | 'count'>) : Promise<Row | null>
    {
        const result = await this.query({...params, top: 1});

        if (result.length === 0) {
            return null;
        }

        return result[0];
    }

    public async query(params ?: QueryParams) : Promise<Row[]>
    {
        let searchParams : URLSearchParams | undefined = undefined;

        if (params) {
            searchParams = new URLSearchParams();

            if (params.filter) {
                searchParams.set('$filter', params.filter);
            }

            if (params.orderBy) {
                searchParams.set('$orderby', Table.compileOrderBy(params.orderBy));
            }

            if (params.top) {
                searchParams.set('$top', params.top.toString());
            }

            if (params.skip) {
                searchParams.set('$skip', params.skip.toString());
            }

            if (params.count) {
                searchParams.set('$count', 'true');
            }

            if (params.select) {
                searchParams.set('$select', params.select.join(', '));
            }
        }

        const response = await this.fetchJson<ServiceDocument<Row[]>>('', {search: searchParams});
        return response.value;
    }

    private async fetchNone(path : string, params : FetchParams | (() => Promise<FetchParams>) = {}) : Promise<void>
    {
        return this.database.fetchNone(`/${this.name}${path}`, params);
    }

    private async fetchJson<T>(path : string, params : FetchParams | (() => Promise<FetchParams>) = {}) : Promise<T>
    {
        return this.database.fetchJson<T>(`/${this.name}${path}`, params);
    }

    private async fetchBlob(path : string, params : FetchParams | (() => Promise<FetchParams>) = {}) : Promise<Blob>
    {
        return this.database.fetchBlob(`/${this.name}${path}`, params);
    }

    private static async compileRowData(data : RowData) : Promise<Record<string, string | number>>
    {
        const result : Record<string, string | number> = {};

        for (let [key, value] of Object.entries(data)) {
            if (typeof value === 'object' && !(value instanceof Buffer)) {
                key = `${key}[${value.repetition}]`;
                value = value.value;
            }

            if (value instanceof Buffer) {
                const fileType = await FileType.fromBuffer(value);

                if (!fileType || !allowedFileTypes.includes(fileType.mime)) {
                    throw new Error('Invalid data, must be one of the following types: ' + allowedFileTypes.join(', '));
                }

                value = value.toString('base64');
            }

            result[key] = value;
        }

        return result;
    }

    private static compileOrderBy(orderBy : string | OrderBy | OrderBy[]) : string
    {
        if (typeof orderBy === 'string') {
            return orderBy;
        }

        if (Array.isArray(orderBy)) {
            return orderBy.map(Table.compileOrderBy).join(', ');
        }

        if (!orderBy.direction) {
            return orderBy.field;
        }

        return `${orderBy.field} ${orderBy.direction}`;
    }

    private static compilePrimaryKey(id : PrimaryKey) : string
    {
        if (typeof id === 'object') {
            return Object.entries(id).map(([key, value]) => {
                return `${key}=${Table.compilePrimaryKey(value)}`;
            }).join(',');
        }

        if (typeof id === 'string') {
            return `'${id}'`;
        }

        return id.toString();
    }
}

export default Table;
