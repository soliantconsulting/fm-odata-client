import {URLSearchParams} from 'url';
import {FetchError} from './Connection.js';
import type {Blob, FetchParams, ServiceDocument} from './Connection.js';
import type Database from './Database.js';

export type FieldValue = string | number | Buffer | null;
export type RepetitionFieldValue = string[] | number[] | Buffer[] | null[];
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
    orderBy ?: string | OrderBy | Array<string | OrderBy>;
    top ?: number;
    skip ?: number;
    count ?: boolean;
    select ?: string[];
    relatedTable ?: string | string[] | {
        primaryKey : PrimaryKey;
        table : string | string[];
    };
};

export type FetchOneParams = Omit<QueryParams, 'top' | 'count'>;

export type CrossJoinParams = Omit<QueryParams, 'relatedTable' | 'select'> & {
    select ?: Record<string, string[]>;
};

export type Row = {
    /* eslint-disable @typescript-eslint/naming-convention */
    '@odata.id' : string;
    '@odata.editLink' : string;
    /* eslint-enable @typescript-eslint/naming-convention */
} & Record<string, string | number | null>;

export type QueryResultWithCount = {
    count : number;
    rows : Row[];
};

export type CrossJoinRow = Record<string, string | number | null>;

export type CrossJoinResultWithCount = {
    count : number;
    rows : CrossJoinRow[];
};

export type PrimaryKey = string | number | Array<string | number>;

export const allowedFileTypes = ['image/gif', 'image/png', 'image/jpeg', 'image/tiff', 'application/pdf'];

class Table<Batched extends boolean = false> {
    public constructor(
        private readonly database : Database<Batched>,
        private readonly name : string,
        private readonly batched : Batched = false as Batched,
    ) {
    }

    // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
    public create(data : RowData) : Batched extends false ? Promise<Row> : void;
    // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
    public create(data : RowData) : Promise<Row> | void {
        const path = '';
        const params = (async () : Promise<FetchParams> => ({
            method: 'POST',
            body: JSON.stringify(await Table.compileRowData(data)),
        }))();

        if (this.batched) {
            void this.fetchNone(path, params);
            return;
        }

        return this.fetchJson(path, params);
    }

    // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
    public update(id : PrimaryKey, data : RowData) : Batched extends false ? Promise<Row> : void;
    // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
    public update(id : PrimaryKey, data : RowData) : Promise<Row> | void {
        const path = `(${Table.compilePrimaryKey(id)})`;
        const params = (async () : Promise<FetchParams> => ({
            method: 'PATCH',
            body: JSON.stringify(await Table.compileRowData(data)),
        }))();

        if (this.batched) {
            void this.fetchNone(path, params);
            return;
        }

        return this.fetchJson(path, params);
    }

    // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
    public updateMany(filter : string, data : RowData) : Batched extends false ? Promise<Row[]> : void;
    // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
    public updateMany(filter : string, data : RowData) : Promise<Row[]> | void {
        const path = '';
        const params = (async () : Promise<FetchParams> => ({
            method: 'PATCH',
            search: new URLSearchParams({$filter: filter}),
            body: JSON.stringify(await Table.compileRowData(data)),
        }))();

        if (this.batched) {
            void this.fetchNone(path, params);
            return;
        }

        return this.fetchJson(path, params);
    }

    // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
    public delete(id : PrimaryKey) : Batched extends false ? Promise<void> : void;
    public delete(id : PrimaryKey) : Promise<void> | void {
        return this.fetchNone(`(${Table.compilePrimaryKey(id)})`, {method: 'DELETE'});
    }

    // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
    public deleteMany(filter : string) : Batched extends false ? Promise<void> : void;
    public deleteMany(filter : string) : Promise<void> | void {
        return this.fetchNone('', {
            method: 'DELETE',
            search: new URLSearchParams({$filter: filter}),
        });
    }

    public uploadBinary(id : PrimaryKey, fieldName : string, data : Buffer) : Batched extends false
        ? Promise<void>
        // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
        : void;
    public uploadBinary(id : PrimaryKey, fieldName : string, data : Buffer) : Promise<void> | void {
        return this.fetchNone(
            `(${Table.compilePrimaryKey(id)})/${fieldName}`,
            (async () : Promise<FetchParams> => ({
                method: 'PATCH',
                body: data,
                contentType: await Table.getMimeType(data),
            }))()
        );
    }

    public async count(filter ?: string) : Promise<number> {
        return this.fetchJson<number>('/$count', {
            search: !filter
                ? undefined
                : new URLSearchParams({
                    $filter: filter,
                }),
        });
    }

    public async fetchById(id : PrimaryKey) : Promise<Row | null> {
        try {
            return await this.fetchJson(`(${Table.compilePrimaryKey(id)})`);
        } catch (e) {
            if (e instanceof FetchError && e.statusCode === 404 && e.errorCode === '-1023') {
                return null;
            }

            throw e;
        }
    }

    public async fetchFieldValue(id : PrimaryKey, fieldName : string) : Promise<FieldValue | RepetitionFieldValue> {
        const path = `(${Table.compilePrimaryKey(id)})/${fieldName}`;
        const response = await this.fetchJson<ServiceDocument<FieldValue | RepetitionFieldValue>>(path);

        return response.value;
    }

    public async fetchBinaryFieldValue(id : PrimaryKey, fieldName : string, repetition ?: number) : Promise<Blob> {
        let path : string;

        if (repetition === undefined) {
            path = `(${Table.compilePrimaryKey(id)})/${fieldName}/$value`;
        } else {
            path = `(${Table.compilePrimaryKey(id)})/${fieldName}[${repetition}]/$value`;
        }

        return await this.fetchBlob(path);
    }

    public async fetchField(id : PrimaryKey, fieldName : string) : Promise<Blob> {
        return this.fetchBlob(`(${Table.compilePrimaryKey(id)})/${fieldName}/$value`);
    }

    public async fetchOne(params ?: FetchOneParams) : Promise<Row | null> {
        const result = await this.query({...params, top: 1});

        if (result.length === 0) {
            return null;
        }

        return result[0];
    }

    public async query(params ?: QueryParams & {count : true}) : Promise<QueryResultWithCount>;
    public async query(params ?: QueryParams & {count ?: false}) : Promise<Row[]>;
    public async query(params ?: QueryParams) : Promise<Row[] | QueryResultWithCount> {
        const searchParams : URLSearchParams = params ? Table.compileQuerySearch(params) : new URLSearchParams();
        const path = params?.relatedTable ? Table.compileRelatedTablePath(params.relatedTable) : '';

        const response = await this.fetchJson<ServiceDocument<Row[]> & {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            '@odata.count' : number;
        }>(
            path,
            {search: searchParams}
        );

        if (params?.count) {
            return {count: response['@odata.count'], rows: response.value};
        }

        return response.value;
    }

    public async crossJoin(
        tables : string | string[],
        params ?: CrossJoinParams & {count : true}
    ) : Promise<CrossJoinResultWithCount>;
    public async crossJoin(
        tables : string | string[],
        params ?: CrossJoinParams & {count ?: false}
    ) : Promise<CrossJoinRow[]>;
    public async crossJoin(
        tables : string | string[],
        params ?: CrossJoinParams
    ) : Promise<CrossJoinRow[] | CrossJoinResultWithCount> {
        const searchParams : URLSearchParams = params
            ? Table.compileQuerySearch({...params, select: undefined})
            : new URLSearchParams();
        const tableNames = [this.name, ...Array.isArray(tables) ? tables : [tables]];

        if (params?.select) {
            searchParams.set(
                '$expand',
                Object.entries(params.select)
                    .map(([table, fields]) => `${table}($select=${fields.join(',')})`)
                    .join(',')
            );
        }

        const response = await this.database.fetchJson<ServiceDocument<CrossJoinRow[]> & {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            '@odata.count' : number;
        }>(
            `/$crossjoin(${tableNames.join(',')})`,
            {search: searchParams}
        );

        if (params?.count) {
            return {count: response['@odata.count'], rows: response.value};
        }

        return response.value;
    }

    private async fetchNone(path : string, params : FetchParams | Promise<FetchParams>) : Promise<void> {
        return this.database.fetchNone(`/${this.name}${path}`, params);
    }

    private async fetchJson<T>(path : string, params : FetchParams | Promise<FetchParams> = {}) : Promise<T> {
        return this.database.fetchJson<T>(`/${this.name}${path}`, params);
    }

    private async fetchBlob(path : string, params : FetchParams | Promise<FetchParams> = {}) : Promise<Blob> {
        return this.database.fetchBlob(`/${this.name}${path}`, params);
    }

    private static async compileRowData(data : RowData) : Promise<Record<string, string | number | null>> {
        const result : Record<string, string | number | null> = {};

        for (let [key, value] of Object.entries(data)) {
            if (value !== null && typeof value === 'object' && !(value instanceof Buffer)) {
                key = `${key}[${value.repetition}]`;
                value = value.value;
            }

            if (value instanceof Buffer) {
                await Table.getMimeType(value);
                value = value.toString('base64');
            }

            result[key] = value;
        }

        return result;
    }

    private static async getMimeType(data : Buffer) : Promise<string> {
        // Asynchronous import for CommonJS support
        // @todo move to top level import when going ESM only
        const {fileTypeFromBuffer} = await import('file-type');
        const fileType = await fileTypeFromBuffer(data);

        if (!fileType || !allowedFileTypes.includes(fileType.mime)) {
            throw new Error('Invalid data, must be one of the following types: ' + allowedFileTypes.join(', '));
        }

        return fileType.mime;
    }

    private static compileQuerySearch(params : QueryParams) : URLSearchParams {
        const searchParams = new URLSearchParams();

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
            searchParams.set('$select', params.select.join(','));
        }

        return searchParams;
    }

    private static compileOrderBy(orderBy : string | OrderBy | Array<string | OrderBy>) : string {
        if (typeof orderBy === 'string') {
            return orderBy;
        }

        if (Array.isArray(orderBy)) {
            return orderBy.map(Table.compileOrderBy).join(',');
        }

        if (!orderBy.direction) {
            return orderBy.field;
        }

        return `${orderBy.field} ${orderBy.direction}`;
    }

    private static compilePrimaryKey(id : PrimaryKey) : string {
        if (Array.isArray(id)) {
            return id.map(Table.compilePrimaryKey).join(',');
        }

        if (typeof id === 'string') {
            return `'${id}'`;
        }

        return id.toString();
    }

    private static compileRelatedTablePath(relatedTable : Exclude<QueryParams['relatedTable'], undefined>) : string {
        if (Array.isArray(relatedTable)) {
            return `/${relatedTable.map(encodeURIComponent).join('/')}`;
        }

        if (typeof relatedTable === 'string') {
            return `/${encodeURIComponent(relatedTable)}`;
        }

        return `(${Table.compilePrimaryKey(
            relatedTable.primaryKey
        )})${Table.compileRelatedTablePath(relatedTable.table)}`;
    }
}

export default Table;
