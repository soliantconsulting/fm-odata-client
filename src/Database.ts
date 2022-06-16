import type {Blob, FetchParams, ServiceDocument} from './Connection';
import type Connection from './Connection';
import SchemaManager from './SchemaManager';
import Table from './Table';

export type TableListEntry = {
    name : string;
    kind : 'EntitySet';
    url : string;
};

export type GenericFieldMetadata = {
    $Nullable ?: boolean;
    /* eslint-disable @typescript-eslint/naming-convention */
    '@Index' ?: boolean;
    '@Calculation' ?: boolean;
    '@Summary' ?: boolean;
    '@Global' ?: boolean;
    '@Org.OData.Core.V1.Permissions' ?: 'Org.OData.Core.V1.Permission@Read';
    /* eslint-enable @typescript-eslint/naming-convention */
};

export type StringFieldMetadata = GenericFieldMetadata & {
    $Type : 'Edm.String';
    $DefaultValue ?: 'USER' | 'USERNAME' | 'CURRENT_USER';
    $MaxLength ?: number;
};

export type DecimalFieldMetadata = GenericFieldMetadata & {
    $Type : 'Edm.Decimal';
    /* eslint-disable @typescript-eslint/naming-convention */
    '@AutoGenerated' ?: boolean;
    /* eslint-enable @typescript-eslint/naming-convention */
};

export type DateFieldMetadata = GenericFieldMetadata & {
    $Type : 'Edm.Date';
    $DefaultValue ?: 'CURDATE' | 'CURRENT_DATE';
};

export type TimeOfDayFieldMetadata = GenericFieldMetadata & {
    $Type : 'Edm.TimeOfDay';
    $DefaultValue ?: 'CURTIME' | 'CURRENT_TIME';
};

export type DateTimeOffsetFieldMetadata = GenericFieldMetadata & {
    $Type : 'Edm.Date';
    $DefaultValue ?: 'CURTIMESTAMP' | 'CURRENT_TIMESTAMP';
    /* eslint-disable @typescript-eslint/naming-convention */
    '@VersionId' ?: boolean;
    /* eslint-enable @typescript-eslint/naming-convention */
};

export type StreamFieldMetadata = {
    $Type : 'Edm.Stream';
    $Nullable ?: boolean;
    /* eslint-disable @typescript-eslint/naming-convention */
    '@EnclosedPath' : string;
    '@ExternalOpenPath' : string;
    '@ExternalSecurePath' ?: string;
    /* eslint-enable @typescript-eslint/naming-convention */
};

export type FieldMetadata = StringFieldMetadata
| DecimalFieldMetadata
| DateFieldMetadata
| TimeOfDayFieldMetadata
| DateTimeOffsetFieldMetadata
| StreamFieldMetadata;

export type EntityType = {
    $Kind : 'EntityType';
    $Key : string[];
} & Record<string, FieldMetadata>;

export type EntitySet = {
    $Kind : 'EntitySet';
    $Type : string;
};

export type Metadata = Record<string, EntityType | EntitySet>;

export type ScriptParam = string | number | Record<string, unknown>;
export type ScriptResult = {
    code : number;
    resultParameter : string;
};

// eslint-disable-next-line @typescript-eslint/no-invalid-void-type
type BatchExecutor<T> = (database : Database<true>) => (T | void);

class Database<Batched extends boolean = false> {
    public constructor(
        private readonly connection : Connection,
        private readonly name : string,
        private readonly batched : Batched = false as Batched,
    ) {
    }

    public async batch<T>(executor : BatchExecutor<T[]>) : Promise<T[]> {
        const batchConnection = this.connection.batchConnection(this.name);
        const database = new Database(batchConnection, this.name, true);
        const promises = executor(database);
        await batchConnection.executeBatch();

        if (!promises) {
            return [];
        }

        return Promise.all(promises);
    }

    public table(tableName : string) : Table<Batched> {
        return new Table(this, tableName, this.batched);
    }

    public schemaManager() : SchemaManager {
        if (this.batched) {
            throw new Error('Schema alterations are not allowed in a batch operation');
        }

        return new SchemaManager(this as Database);
    }

    public async listTables() : Promise<TableListEntry[]> {
        if (this.batched) {
            throw new Error('Tables cannot be listed in a batch operation');
        }

        const response = await this.fetchJson<ServiceDocument<TableListEntry[]>>('');
        return response.value;
    }

    public async getMetadata() : Promise<Metadata> {
        if (this.batched) {
            throw new Error('Metadata cannot be retrieved in a batch operation');
        }

        const response = await this.fetchJson<Record<string, Metadata>>('/$metadata');

        if (!(this.name in response)) {
            throw new Error('Response did not include any table information');
        }

        return response[this.name];
    }

    public async runScript(scriptName : string, scriptParam ?: ScriptParam) : Promise<ScriptResult> {
        if (this.batched) {
            throw new Error('Script execution is not allowed in a batch operation');
        }

        const response = await this.fetchJson<{scriptResult : ScriptResult}>(`/Script.${scriptName}`, {
            method: 'POST',
            body: JSON.stringify({
                scriptParameterValue: scriptParam,
            }),
        });

        return response.scriptResult;
    }

    /**
     * @internal
     */
    public async fetchNone(path : string, params : FetchParams | Promise<FetchParams> = {}) : Promise<void> {
        return this.connection.fetchNone(`/${this.name}${path}`, params);
    }

    /**
     * @internal
     */
    public async fetchJson<T>(path : string, params : FetchParams | Promise<FetchParams> = {}) : Promise<T> {
        return this.connection.fetchJson<T>(`/${this.name}${path}`, params);
    }

    /**
     * @internal
     */
    public async fetchBlob(path : string, params : FetchParams | Promise<FetchParams> = {}) : Promise<Blob> {
        return this.connection.fetchBlob(`/${this.name}${path}`, params);
    }
}

export default Database;
