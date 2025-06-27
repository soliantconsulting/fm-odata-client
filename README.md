# FileMaker OData client

[![npm version](https://badge.fury.io/js/fm-odata-client.svg)](https://badge.fury.io/js/fm-odata-client)
[![Release](https://github.com/soliantconsulting/fm-odata-client/actions/workflows/release.yml/badge.svg)](https://github.com/soliantconsulting/fm-odata-client/actions/workflows/release.yml)
[![Coverage Status](https://coveralls.io/repos/github/soliantconsulting/fm-odata-client/badge.svg?branch=main)](https://coveralls.io/github/soliantconsulting/fm-odata-client?branch=main)

FileMaker OData client is a Typescript [OData](https://www.odata.org/) client specifically aimed at the
[FileMaker OData API](https://help.claris.com/en/odata-guide/). It supports both FileMaker Server and FileMaker Cloud. 

## Installation

- Install the npm package:

    `npm install fm-odata-client`
  
- If you use FileMaker Cloud, you also need to install the following package:

    `npm install amazon-cognito-identity-js`

## Quick Start

To get started, you need to create a connection instance. Depending on the FileMaker host type, you have two different
options:

- FileMaker Server
    ```typescript
    import {BasicAuth, Connection} from 'fm-odata-client';
  
    const connection = new Connection('example.com', new BasicAuth('username', 'password'));
    ````
  
- FileMaker Cloud
    ```typescript
    import {Connection} from 'fm-odata-client';
    import ClarisId from 'fm-odata-client/claris-id';
  
    const connection = new Connection('example.com', new ClarisId('username', 'password'));
    ````  

- Using OttoFMS Data API Key
   ```typescript
    import {OttoAPIKey, Connection} from 'fm-odata-client';
  
    const connection = new Connection('example.com', new OttoAPIKey('dk_1234567890'));
    ````

This will give you a connection instance which allows you to issue queries against the OData API.

### Note about FileMaker related OData issues

At the time of writing, the FileMaker OData API suffers an issue where it incorrectly includes unescaped newline
characters in JSON responses. If you are using a version affected by this issue, you can pass an options object as the 
third parameter of the `Connection` constructor with `laxParsing` set to `true` to enable lax parsing which will work
around this issue.

### Listing all databases

You can retrieve a list of all databases available on the server:

```typescript
const databases = await connection.listDatabases();
console.log('All databases on the host: ', databases);
```

### Working with a database

In order to do actual work on a database, you need to create a database instance:

```typescript
const database = connection.database('example');
```

#### Listing all tables of a database

You can retrieve a simple list of all tables in a database, which will include their name and OData URL: 

```typescript
const tables = await database.listTables();
console.log('All tables in the database: ', tables);
```

#### Retrieving table metadata

To get not only table names, but also field declarations and relationships, you must retrieve all metadata:

```typescript
const metadata = await database.getMetadata();
console.log('Database metadata: ', metadata);
```

### Working with table data

To actually query and modify table data, you need to create a table instance:

```typescript
const userTable = database.table('users');
```

#### Creating records

You can create new records through the `create()` method. The method takes an object mapping field names to their
value. The value can either be a string, a number (for numeric fields), or a buffer (for container fields):

```typescript
const newUser = await userTable.create({
    id: 1,
    username: 'loki',
});

console.log('New user: ', newUser);
```

Additionally, when addressing a specific repetition of a field, the value can be an object with a `repetition` and
`value` property:

```typescript
const newUser = await userTable.create({
    name: {repetition: 2, value: 'odin'},
});

console.log('New user: ', newUser);
```

#### Updating records

In the same manner you can update existing records:

```typescript
const updatedUser = await userTable.update(1, {username: 'thor'});

console.log('Updated user: ', updatedUser);
```

> **__NOTE:__** A primary key is usually a string or a number. If a table has multiple primary keys, you must pass an
> object mapping all primary keys to their value.

If you need to update a bunch of records with the same values, you can also issue an update based on
[filters](#filters):

```typescript
await userTable.updateMany("startswith(username, 'a')", {name: 'a person'});
```

#### Deleting records

You can also delete records either by their primary key or with [filters](#filters):

```typescript
// Via primary key:
await userTable.delete(1);

// Via filter:
await userTable.deleteMany("username eq 'loki'");
```

#### Uploading binary data

Instead of passing binary data in a "create" or "update" requests, you can also upload binary data separately:

```typescript
await userTable.uploadBinary('users', 'photo', dataBuffer);
``` 

It is important to note that the OData API limits the types of data you can upload. At the time of writing, these are
PEG, GIF, PNG, TIFF and PDF.

#### Counting records in a table

You can retrieve a count of all records in a table or just a filtered subset:

```typescript
const totalRecords = await userTable.count();
const filteredRecords = await userTable.count("startswith(username, 'a')");

console.log('Total records: ', totalRecords);
console.log('Filtered records: ', totalRecords);
```

#### Retrieving a single record

To retrieve an individual record from a table, you can fetch it by its primary key. The result will contain all fields
except container fields. To retrieve those, see the following section.

```typescript
const user = await userTable.find(1);
console.log('User: ', user);
```

#### Retrieving individual fields

Since container fields are never returned in queries, you have to retrieve them individually when needed:

```typescript
const photo = await userTable.fetchField(1, 'photo');

console.log('Mime-type: ', photo.type);
console.log('Buffer: ', photo.buffer);
``` 

#### Retrieving multiple records

You can retrieve multiple records while specifying [filters](#filters) and other query parameters:

```typescript
const users = await userTable.query({
    filter: "startswith(username, 'a')",
    top: 5,
});

console.log('Top 5 users: ', users);
```

You can also request a total count of all records matching your filter while retrieving a limited record set:

```typescript
const {count, rows: users} = await userTable.query({
    filter: "startswith(username, 'a')",
    top: 5,
});

console.log('Number of users: ', count);
console.log('Top 5 users: ', users);
```

##### Limiting the result set

Record sets can be paginated with the `top` and `skip` properties. The `skip` property defines the offset, while the
`top` property defines the limit.

##### Changing the order of the result set

To change the order of the result set, you can pass in an `orderBy` property, which can be one of the following:

- a string which is the name of the field to order by (optionally add `asc` or `desc`)
- an object with a `field` and optionally `direction` property
- an array of one of the other values

##### Selecting a subset of fields

When retrieving large number of records, it might make sense to only retrieve the fields you are actually interested
in. You can specify those fields with the `select` property:

```typescript
const sparseUsers = await userTable.query({
    select: ['username'],
});

console.log('Sparse users: ', users);
```

##### Retrieving the first record of a result set

If you expect your query to only return a single record, you can also use the `fetchOne()` method, which takes the same
parameters except `count` and `top`:

```typescript
const user = await userTable.fetchOne({filter: "username eq 'loki'"});
console.log('User: ', user);
```

##### Retrieving related records

When your tables have relationships to other tables, you can directly retrieve related records:

```typescript
const articles = await userTable.query({
    relatedTable: {primaryKey: 1, table: 'articles'},
});

console.log('Articles by user with ID 1: ', articles);
```

The `relatedTable` property can either be an object, as shown above, to retrieve all related record of a single record,
or it can just be a string. In the latter case, you'll retrieve all related records to all records, unless limited by
a filter.

To retrieve data from deeper relations, you can pass an array of table names instead of a single table:

```typescript
const allRelatedComments = await userTable.query({
    relatedTable: ['articles', 'comments'],
});

console.log('Comments: ', allRelatedComments);
```

> **__NOTE:__** The table names are actually relationship names defined in FileMaker, not the actual table names.

When specifying filters for the relations, you can address them in the filter by prepending the field name with the
table name followed by a slash (`/`).

##### Cross-joining tables

Sometimes you want to collect field data from multiple tables. This can be achieved with a cross-join. A cross-join
combines the results of all records from one table with those of another table (or multiple other tables). When
making a cross-join, you have to manually match the identities with a filter.

The tables to join can either be a string or an array of strings if you need to cross-join multiple tables.

It is also to note that, by default, the OData API only returns navigation links to each record. To actually get values
back from each table, you need to expand them with the `select` property. When selecting two fields with the same name
from different tables, those will be prepended with the table name in the result set:

```typescript
const result = await userTable.crossJoin(['articles', 'comments'], {
    filter: 'articles/userId eq user/id and comments/articleId eq article/id',
    select: {
        users: ['username'],
        comments: ['content'],
    },
});

console.log('Cross-join result: ', result);
```

The `crossJoin()` method supports all other properties from the `query()` method except `relatedTable`. 

#### Filters

Filters in OData are simple string expressions. If you just want to write them yourself, you can find more information
about the syntax in the [OData docs](http://docs.oasis-open.org/odata/odata/v4.0/errata03/os/complete/part1-protocol/odata-v4.0-errata03-os-part1-protocol-complete.html#_The_$filter_System).

Alternatively, you can use a filter builder like [odata-filter-builder](https://www.npmjs.com/package/odata-filter-builder)
to programmatically create queries. 

Please note the following FileMaker specifics:

- The following built-in functions are not supported:
    - `indexof()`
    - `isof()`
    - `geo.distance()`
    - `geo.length()`
    - `geo.intersects()`
- Date, time, and timestamp formats conform to ISO 8601. Time zone offsets are relative to the time zone of the server.
- Enclose field names that include special characters, such as spaces or underscores, in double-quotation marks.

### Run FileMaker scripts

The OData API allows executing FileMaker scripts (without table context). The script parameter can be omitted, but if
provided must be a number, string, or a JSON serializable object. The return value will always be a string and must
be interpreted manually:

```typescript
const scriptResult = await database.runScript('createUser', 'example-user');

if (scriptResult.code !== 0) {
    throw new Error('Script returned with an error');
}

console.log('Script result: ', scriptResult.resultParameter);
```

### Modifying the database schema

You can create and modify tables through the built-in schema manager:

```typescript
const schemaManager = database.schemaManager();
``` 

You can then create tables with the `createTable()` method:

```typescript
await schemaManager.createTable('users', [
    {name: 'id', type: 'numeric', primary: true},
    {name: 'username', type: 'string'},
]);
```

Each field must at least specify a name and a type. The type can be one of the following values:

- `string`
- `numeric`
- `date`
- `time`
- `timestamp`
- `container`

All types support the following generic properties:

- `nullable` - Whether the field accepts null values 
- `primary` - Whether the field is a primary key
- `unique` - Whether the field must be unique
- `global` - Whether the field is global or local
- `repetitions` - If defined, specifies the number of allowed repetitions

Some field types allow for additional properties:

- `string`:
    - `maxLength` - Maximum length of values
    - `default` - Can be set to `CURRENT_USER` to default to the current user's name
- `date`:
    - `default` - Can be set to `CURRENT_DATE` to default to the current date
- `time`:
    - `default` - Can be set to `CURRENT_TIME` to default to the current time
- `timestamp`:
    - `default` - Can be set to `CURRENT_TIMESTAMP` to default to the current timestamp
- `container`:
    - `externalSecurePath` - Secure path to externally access the contents

Similarly, you can add fields to an existing table:

```typescript
await schemaManager.addFields('users', [
    {name: 'realname', type: 'string'},
]);
```

Indexes for fields can also be added after the fact:

```typescript
await schemaManager.createIndex('users', 'username');
```

Deleting tables, fields or indexes is just as easy:

```typescript
// Delete an index
await schemaManager.deleteIndex('users', 'username');

// Delete a field
await schemaManager.deleteField('users', 'realname');

// Delete an entire table
await schemaManager.deleteTable('users');
```

> **__NOTE:__** At the time of writing, FileMaker OData API does not allow modifying relationships. 

### Batching requests

The FileMaker OData API allows batching CRUD requests on tables. This will queue up all requests in a single HTTP
request and be executed in an atomic operation. This means that when one of the requests fail, the entire batch will
be rolled back.

Batched requests do have limitations compared to standard requests:

- They cannot execute schema modifications or retrieve metadata.
- Create and update calls return no response.

In order to create a batch request, it has to be initialized through the database instance. It is important to note
that even though the CRUD methods still return promises, these must not be awaited, as they won't be fulfilled until
after the batch has executed.

Following is a simple example of inserting multiple rows into a table. All operations will be executed in their call
order:

```typescript
await database.batch(database => {
    const userTable = database.table('user');
    userTable.create({/* … */});
    userTable.create({/* … */});
});
```

It should be noted that the table instance within the batch must be created from the passed in batched database, and
not from the outer database instance.

You might want to include query requests in your batch operation. In order to access the results outside of the batch
operation, you need to return their promises in an array:

```typescript
const [userOne, userTwo] = await database.batch(database => {
    const userTable = database.table('user');
    return [
        userTable.fetchById(1),
        userTable.fetchById(2),
    ];
});
```
