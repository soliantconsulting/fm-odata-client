import { URLSearchParams } from "node:url";
import { expect, use } from "chai";
import chaiAsPromised from "chai-as-promised";
import fetchMock from "fetch-mock";
import "mocha";
import { buffer } from "node:stream/consumers";
import type { Authentication } from "../src/index.js";
import { Connection } from "../src/index.js";

use(chaiAsPromised);

class FakeAuth implements Authentication {
    public async getAuthorizationHeader(): Promise<string> {
        return Promise.resolve("foobar");
    }
}

describe("Connection", () => {
    const auth = new FakeAuth();
    const connection = new Connection("localhost", auth);

    beforeEach(() => {
        fetchMock.mockGlobal();
    });

    afterEach(async () => {
        fetchMock.removeRoutes();
        fetchMock.unmockGlobal();
    });

    describe("listDatabases", () => {
        it("should return a list of databases", async () => {
            fetchMock.route("https://localhost/fmi/odata/v4", {
                status: 200,
                body: JSON.stringify({
                    "@odata.context": "https://localhost/fmi/odata/v4/$metadata",
                    value: [
                        {
                            name: "Foo",
                            kind: "EntityContainer",
                            url: "https://localhost/fmi/odata/v4/Foo",
                        },
                    ],
                }),
            });

            const databases = await connection.listDatabases();
            expect(databases).to.be.eql([
                { name: "Foo", kind: "EntityContainer", url: "https://localhost/fmi/odata/v4/Foo" },
            ]);
        });

        it("should throw an error in batched context", async () => {
            const batchedConnection = connection.batchConnection("foo");
            await expect(batchedConnection.listDatabases()).to.eventually.be.rejectedWith(
                "Databases cannot be listed from a batched connection",
            );
        });
    });

    describe("database", () => {
        it("should return a database instance of the given name", () => {
            const database = connection.database("foo");
            // @ts-expect-error accessing private field for testing
            expect(database.connection).to.be.equal(connection);
            // @ts-expect-error accessing private field for testing
            expect(database.name).to.be.equal("foo");
        });

        it("should throw an error in batched context", () => {
            const batchedConnection = connection.batchConnection("foo");
            expect(batchedConnection.database.bind(batchedConnection, "foo")).to.throw(
                "Database objects cannot be created from a batched connection",
            );
        });
    });

    describe("batchConnection", () => {
        it("should return a batched connection", () => {
            const batchedConnection = connection.batchConnection("foo");
            // @ts-expect-error accessing private field for testing
            expect(batchedConnection.hostname).to.equal("localhost");
            // @ts-expect-error accessing private field for testing
            expect(batchedConnection.authentication).to.equal(auth);
            // @ts-expect-error accessing private field for testing
            expect(batchedConnection.batch).to.eql({
                databaseName: "foo",
                operations: [],
            });
        });
    });

    describe("executeBatch", () => {
        it("should throw an error outside batched context", async () => {
            await expect(connection.executeBatch()).to.eventually.be.rejectedWith(
                "A batch has not been started",
            );
        });

        it("should not run without operations", async () => {
            const batchedConnection = connection.batchConnection("foo");
            await batchedConnection.executeBatch();
        });

        it("should throw error on non successful response", async () => {
            fetchMock.post("https://localhost/fmi/odata/v4/foo/$batch", 400);

            const batchedConnection = connection.batchConnection("foo");
            void batchedConnection.fetchNone("/foo");

            await expect(batchedConnection.executeBatch()).to.eventually.be.rejectedWith(
                "Batch request failed",
            );
        });

        it("should reject with insufficient responses", async () => {
            fetchMock.post("https://localhost/fmi/odata/v4/foo/$batch", {
                status: 200,
                body: [
                    "--foo",
                    "Content-Type: application/http",
                    "",
                    "HTTP/1.1 200 OK",
                    "Content-Type: text/plain",
                    "",
                    "foo",
                    "--foo--",
                ].join("\r\n"),
                headers: {
                    "Content-Type": "multipart/mixed; boundary=foo",
                },
            });

            const batchedConnection = connection.batchConnection("foo");
            void batchedConnection.fetchNone("/foo");
            const secondResponse = batchedConnection.fetchNone("/foo");
            await batchedConnection.executeBatch();

            await expect(secondResponse).to.eventually.be.rejectedWith(
                "No matching response in batch response",
            );
        });

        it("should resolve pending operations", async () => {
            fetchMock.post("https://localhost/fmi/odata/v4/foo/$batch", {
                status: 200,
                body: [
                    "--foo",
                    "Content-Type: application/http",
                    "",
                    "HTTP/1.1 200 OK",
                    "Content-Type: application/json",
                    "",
                    '{"foo": "bar"}',
                    "--foo--",
                ].join("\r\n"),
                headers: {
                    "Content-Type": "multipart/mixed; boundary=foo",
                },
            });

            const batchedConnection = connection.batchConnection("foo");
            const response = batchedConnection.fetchJson("/foo");
            await batchedConnection.executeBatch();

            await expect(response).to.eventually.become({ foo: "bar" });
        });
    });

    describe("fetchNone", () => {
        it("should compile complete path", async () => {
            fetchMock.get("https://localhost/fmi/odata/v4/foo", 204);

            return connection.fetchNone("/foo");
        });

        it("should add search to request", async () => {
            fetchMock.get("https://localhost/fmi/odata/v4?foo=bar", 204);

            return connection.fetchNone("", { search: new URLSearchParams({ foo: "bar" }) });
        });

        it("should replace special characters in search params", async () => {
            fetchMock.get("https://localhost/fmi/odata/v4?$foo=a%20b%20c&$bar=d%20e%20f", 204);

            return connection.fetchNone("", {
                search: new URLSearchParams({
                    $foo: "a b c",
                    $bar: "d e f",
                }),
            });
        });

        it("should default to GET", async () => {
            fetchMock.get("https://localhost/fmi/odata/v4", 204);

            return connection.fetchNone("");
        });

        it("should use supplied method", async () => {
            fetchMock.post("https://localhost/fmi/odata/v4", 204);

            return connection.fetchNone("", { method: "POST" });
        });

        it("should have no content type with GET and DELETE", async () => {
            fetchMock.route((callLog) => {
                if (callLog.url !== "https://localhost/fmi/odata/v4" || !callLog.request) {
                    return false;
                }

                if (!["GET", "DELETE"].includes(callLog.request.method)) {
                    return false;
                }

                return callLog.request?.headers.get("Content-Type") === null;
            }, 204);

            return Promise.all([
                connection.fetchNone("", { method: "GET" }),
                connection.fetchNone("", { method: "DELETE" }),
            ]);
        });

        it("should default to application/json with POST and PATCH", async () => {
            fetchMock.route((callLog) => {
                if (callLog.url !== "https://localhost/fmi/odata/v4" || !callLog.request) {
                    return false;
                }

                if (!["POST", "PATCH"].includes(callLog.request.method)) {
                    return false;
                }

                return callLog.request?.headers.get("Content-Type") === "application/json";
            }, 204);

            return Promise.all([
                connection.fetchNone("", { method: "POST" }),
                connection.fetchNone("", { method: "PATCH" }),
            ]);
        });

        it("should send custom content type", async () => {
            fetchMock.post((callLog) => {
                if (callLog.url !== "https://localhost/fmi/odata/v4" || !callLog.request) {
                    return false;
                }

                return callLog.request?.headers.get("Content-Type") === "image/jpeg";
            }, 204);

            return connection.fetchNone("", { method: "POST", contentType: "image/jpeg" });
        });

        it("should send application/json accept header", async () => {
            fetchMock.get((callLog) => {
                if (callLog.url !== "https://localhost/fmi/odata/v4" || !callLog.request) {
                    return false;
                }

                return callLog.request?.headers.get("Accept") === "application/json";
            }, 204);

            return connection.fetchNone("");
        });

        it("should include body in request", async () => {
            let body: ReadableStream | null = null;

            fetchMock.post((callLog) => {
                if (callLog.url !== "https://localhost/fmi/odata/v4" || !callLog.request) {
                    return false;
                }

                body = callLog.request?.body;
                return true;
            }, 204);

            await connection.fetchNone("", { method: "POST", body: "test" });

            expect(body).to.not.be.null;
            const result = await buffer(body as unknown as ReadableStream);
            expect(result.equals(Buffer.from("test"))).to.be.true;
        });

        it("should include binary body in request", async () => {
            let body: ReadableStream | null = null;

            fetchMock.post((callLog) => {
                if (callLog.url !== "https://localhost/fmi/odata/v4" || !callLog.request) {
                    return false;
                }

                body = callLog.request?.body;
                return true;
            }, 204);

            await connection.fetchNone("", { method: "POST", body: Buffer.from("\x01\x02") });

            expect(body).to.not.be.null;
            const result = await buffer(body as unknown as ReadableStream);
            expect(result.equals(Buffer.from("\x01\x02"))).to.be.true;
        });

        it("should throw generic error on invalid response", async () => {
            fetchMock.get("https://localhost/fmi/odata/v4", 400);

            await expect(connection.fetchNone("")).to.eventually.be.rejectedWith(
                "An unknown error occurred",
            );
        });

        it("should throw response error", async () => {
            fetchMock.get("https://localhost/fmi/odata/v4", {
                status: 400,
                body: JSON.stringify({
                    error: {
                        message: "foo",
                        code: "-1",
                    },
                }),
            });

            await expect(connection.fetchNone("")).to.eventually.be.rejectedWith("foo");
        });

        it("should send authorization header from supplied Authentication", async () => {
            fetchMock.get((callLog) => {
                if (callLog.url !== "https://localhost/fmi/odata/v4") {
                    return false;
                }

                return callLog.request?.headers.get("Authorization") === "foobar";
            }, 204);

            return connection.fetchNone("");
        });

        it("should queue operation in batched context", () => {
            const batchedConnection = connection.batchConnection("foo");
            void batchedConnection.fetchNone("/foo");

            // @ts-expect-error accessing private field for testing
            expect(batchedConnection.batch?.operations).to.be.lengthOf(1);
        });
    });

    describe("fetchBlob", () => {
        it("should return a blob with known content type", async () => {
            fetchMock.get("https://localhost/fmi/odata/v4", {
                status: 200,
                body: "foobar",
                headers: {
                    "Content-Type": "image/jpeg",
                },
            });

            const response = await connection.fetchBlob("");
            expect(response.buffer.toString()).to.be.equal("foobar");
            expect(response.type).to.be.equal("image/jpeg");
        });

        it("should forward fetch params", async () => {
            fetchMock.post("https://localhost/fmi/odata/v4", 204);

            return await connection.fetchBlob("", { method: "POST" });
        });
    });

    describe("fetchJson", () => {
        it("should return an object", async () => {
            fetchMock.get("https://localhost/fmi/odata/v4", {
                status: 200,
                body: JSON.stringify({ foo: "bar" }),
            });

            const response = await connection.fetchJson("");
            expect(response).to.be.eql({ foo: "bar" });
        });

        it("should forward fetch params", async () => {
            fetchMock.post("https://localhost/fmi/odata/v4", {
                status: 200,
                body: "{}",
            });

            await connection.fetchJson("", { method: "POST" });
        });

        it("should throw error on 204 response", async () => {
            fetchMock.get("https://localhost/fmi/odata/v4", 204);

            await expect(connection.fetchJson("")).to.eventually.rejectedWith(
                "Response included no content",
            );
        });
    });

    describe("laxParsing", () => {
        it("should error with non encoded newlines without lax parsing in JSON response", async () => {
            fetchMock.get("https://localhost/fmi/odata/v4", {
                status: 200,
                body: '{"foo": "bar\nbaz"}',
            });

            const response = connection.fetchJson("");
            await expect(response).to.eventually.be.rejectedWith("Bad control character");
        });

        it("should error with non encoded newlines without lax parsing in error response", async () => {
            fetchMock.get("https://localhost/fmi/odata/v4", {
                status: 400,
                body: '{"error": {"code": "101", "message": "bar\nbaz"}}',
            });

            const response = connection.fetchJson("");
            await expect(response).to.eventually.be.rejectedWith("An unknown error occurred");
        });

        const laxConnection = new Connection("localhost", auth, { laxParsing: true });

        it("should succeed with non encoded newlines with lax parsing in JSON response", async () => {
            fetchMock.get("https://localhost/fmi/odata/v4", {
                status: 200,
                body: '{"foo": "bar\nbaz"}',
            });

            const response = await laxConnection.fetchJson("");
            expect(response).to.be.eql({ foo: "bar\nbaz" });
        });

        it("should not encode newlines outside of strings", async () => {
            fetchMock.get("https://localhost/fmi/odata/v4", {
                status: 200,
                body: '{"foo":\n"bar"}',
            });

            const response = await laxConnection.fetchJson("");
            expect(response).to.be.eql({ foo: "bar" });
        });

        it("should not double encoded newlines inside of strings", async () => {
            fetchMock.get("https://localhost/fmi/odata/v4", {
                status: 200,
                body: '{"foo": "bar\\nbaz"}',
            });

            const response = await laxConnection.fetchJson("");
            expect(response).to.be.eql({ foo: "bar\nbaz" });
        });

        it("should encode newlines prefixed by double backslash", async () => {
            fetchMock.get("https://localhost/fmi/odata/v4", {
                status: 200,
                body: '{"foo": "bar\\\\\nbaz"}',
            });

            const response = await laxConnection.fetchJson("");
            expect(response).to.be.eql({ foo: "bar\\\nbaz" });
        });

        it("should succeed with non encoded newlines in error response", async () => {
            fetchMock.get("https://localhost/fmi/odata/v4", {
                status: 400,
                body: '{"error": {"code": "101", "message": "bar\nbaz"}}',
            });

            const response = laxConnection.fetchJson("");
            await expect(response).to.eventually.be.rejectedWith("bar\nbaz");
        });
    });
});
