import type Database from './Database';

type GenericField = {
    name : string;
    nullable ?: boolean;
    primary ?: boolean;
    unique ?: boolean;
    global ?: boolean;
    repetitions ?: number;
};

type StringField = GenericField & {
    type : 'string';
    maxLength ?: number;
    default ?: 'USER' | 'USERNAME' | 'CURRENT_USER';
};

type NumericField = GenericField & {
    type : 'numeric';
};

type DateField = GenericField & {
    type : 'date';
    default ?: 'CURRENT_DATE' | 'CURDATE';
};

type TimeField = GenericField & {
    type : 'time';
    default ?: 'CURRENT_TIME' | 'CURTIME';
};

type TimestampField = GenericField & {
    type : 'timestamp';
    default ?: 'CURRENT_TIMESTAMP' | 'CURTIMESTAMP';
};

type ContainerField = GenericField & {
    type : 'container';
    externalSecurePath ?: string;
};

export type Field = StringField
| NumericField
| DateField
| TimeField
| TimestampField
| ContainerField;

type FileMakerField = Omit<Field, 'type' | 'repetitions' | 'maxLength'> & {type : string};

type TableDefinition = {
    tableName : string;
    fields : FileMakerField[];
};

class SchemaManager {
    public constructor(private readonly database : Database) {
    }

    public async createTable(tableName : string, fields : Field[]) : Promise<TableDefinition> {
        return this.database.fetchJson<TableDefinition>('/FileMaker_Tables', {
            method: 'POST',
            body: JSON.stringify({
                tableName,
                fields: fields.map(SchemaManager.compileFieldDefinition),
            }),
        });
    }

    public async addFields(tableName : string, fields : Field[]) : Promise<TableDefinition> {
        return this.database.fetchJson<TableDefinition>(`/FileMaker_Tables/${tableName}`, {
            method: 'PATCH',
            body: JSON.stringify({fields: fields.map(SchemaManager.compileFieldDefinition)}),
        });
    }

    public async deleteTable(tableName : string) : Promise<void> {
        return this.database.fetchNone(`/FileMaker_Tables/${tableName}`, {method: 'DELETE'});
    }

    public async deleteField(tableName : string, fieldName : string) : Promise<void> {
        return this.database.fetchNone(`/FileMaker_Tables/${tableName}/${fieldName}`, {method: 'DELETE'});
    }

    public async createIndex(tableName : string, fieldName : string) : Promise<{indexName : string}> {
        return this.database.fetchJson<{indexName : string}>(`/FileMaker_Indexes/${tableName}`, {
            method: 'POST',
            body: JSON.stringify({indexName: fieldName}),
        });
    }

    public async deleteIndex(tableName : string, fieldName : string) : Promise<void> {
        return this.database.fetchNone(`/FileMaker_Indexes/${tableName}/${fieldName}`, {method: 'DELETE'});
    }

    private static compileFieldDefinition(field : Field) : FileMakerField {
        const fieldCopy = {...field};
        let type : string = fieldCopy.type;

        if (fieldCopy.type === 'string') {
            type = 'varchar';

            if (fieldCopy.maxLength !== undefined) {
                type += `(${fieldCopy.maxLength})`;
                fieldCopy.maxLength = undefined;
            }
        }

        if (field.repetitions !== undefined) {
            type += `[${field.repetitions}]`;
            fieldCopy.repetitions = undefined;
        }

        return {...fieldCopy, type};
    }
}

export default SchemaManager;
