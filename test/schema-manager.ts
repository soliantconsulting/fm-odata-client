import { expect, use } from "chai";
import chaiAsPromised from "chai-as-promised";
import "mocha";
import type { SinonStubbedInstance } from "sinon";
import sinon from "sinon";
import { Database, SchemaManager } from "../src/index.js";

use(chaiAsPromised);

/* eslint-disable @typescript-eslint/unbound-method */

describe("SchemaManager", () => {
    let databaseStub: SinonStubbedInstance<Database>;
    let schemaManager: SchemaManager;

    beforeEach(() => {
        databaseStub = sinon.createStubInstance(Database);
        schemaManager = new SchemaManager(databaseStub as unknown as Database);
    });

    describe("createTable", () => {
        it("should send create table request", async () => {
            databaseStub.fetchJson.returns(
                Promise.resolve({
                    tableName: "foo",
                    fields: [{ name: "bar", type: "string" }],
                }),
            );
            const response = await schemaManager.createTable("foo", [
                { name: "bar", type: "string" },
            ]);
            expect(response).to.be.eql({
                tableName: "foo",
                fields: [{ name: "bar", type: "string" }],
            });
            sinon.assert.calledWith(databaseStub.fetchJson, "/FileMaker_Tables", {
                method: "POST",
                body: JSON.stringify({
                    tableName: "foo",
                    fields: [{ name: "bar", type: "varchar" }],
                }),
            });
        });

        it("should add repetitions to field type", async () => {
            await schemaManager.createTable("foo", [
                { name: "bar", type: "numeric", repetitions: 2 },
            ]);
            sinon.assert.calledWith(databaseStub.fetchJson, "/FileMaker_Tables", {
                method: "POST",
                body: JSON.stringify({
                    tableName: "foo",
                    fields: [{ name: "bar", type: "numeric[2]" }],
                }),
            });
        });

        it("should add max length to string field", async () => {
            await schemaManager.createTable("foo", [
                { name: "bar", type: "string", maxLength: 10 },
            ]);
            sinon.assert.calledWith(databaseStub.fetchJson, "/FileMaker_Tables", {
                method: "POST",
                body: JSON.stringify({
                    tableName: "foo",
                    fields: [{ name: "bar", type: "varchar(10)" }],
                }),
            });
        });

        it("should combine max length and repetitions", async () => {
            await schemaManager.createTable("foo", [
                { name: "bar", type: "string", maxLength: 10, repetitions: 2 },
            ]);
            sinon.assert.calledWith(databaseStub.fetchJson, "/FileMaker_Tables", {
                method: "POST",
                body: JSON.stringify({
                    tableName: "foo",
                    fields: [{ name: "bar", type: "varchar(10)[2]" }],
                }),
            });
        });
    });

    describe("addFields", () => {
        it("should send add fields request", async () => {
            databaseStub.fetchJson.returns(
                Promise.resolve({
                    tableName: "foo",
                    fields: [{ name: "bar", type: "string" }],
                }),
            );
            const response = await schemaManager.addFields("foo", [
                { name: "bar", type: "string" },
            ]);
            expect(response).to.be.eql({
                tableName: "foo",
                fields: [{ name: "bar", type: "string" }],
            });
            sinon.assert.calledWith(databaseStub.fetchJson, "/FileMaker_Tables/foo", {
                method: "PATCH",
                body: JSON.stringify({ fields: [{ name: "bar", type: "varchar" }] }),
            });
        });
    });

    describe("deleteField", () => {
        it("should send delete field request", async () => {
            await schemaManager.deleteField("foo", "bar");
            sinon.assert.calledWith(databaseStub.fetchNone, "/FileMaker_Tables/foo/bar", {
                method: "DELETE",
            });
        });
    });

    describe("deleteTable", () => {
        it("should send delete table request", async () => {
            await schemaManager.deleteTable("foo");
            sinon.assert.calledWith(databaseStub.fetchNone, "/FileMaker_Tables/foo", {
                method: "DELETE",
            });
        });
    });

    describe("createIndex", () => {
        it("should send create index request", async () => {
            databaseStub.fetchJson.returns(Promise.resolve({ indexName: "bar" }));
            const response = await schemaManager.createIndex("foo", "bar");
            expect(response).to.be.eql({ indexName: "bar" });
            sinon.assert.calledWith(databaseStub.fetchJson, "/FileMaker_Indexes/foo", {
                method: "POST",
                body: JSON.stringify({ indexName: "bar" }),
            });
        });
    });

    describe("deleteIndex", () => {
        it("should send delete index request", async () => {
            await schemaManager.deleteIndex("foo", "bar");
            sinon.assert.calledWith(databaseStub.fetchNone, "/FileMaker_Indexes/foo/bar", {
                method: "DELETE",
            });
        });
    });
});
