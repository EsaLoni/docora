import test, { describe, it } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveApiBaseUrl, ApiClient, apiClient } from "../src/lib/api-client.ts";

const __testdir = path.dirname(fileURLToPath(import.meta.url));

describe("Docora Phase 19.1 API Architecture & Client Tests", () => {
  describe("resolveApiBaseUrl", () => {
    const originalEnv = { ...process.env };

    it("should normalize a production URL ending with /api/v1", () => {
      process.env.NEXT_PUBLIC_API_URL = "https://api.docora.ai/api/v1";
      const resolved = resolveApiBaseUrl();
      assert.strictEqual(resolved, "https://api.docora.ai");
    });

    it("should normalize a production URL ending with /api/v1/", () => {
      process.env.NEXT_PUBLIC_API_URL = "https://api.docora.ai/api/v1/";
      const resolved = resolveApiBaseUrl();
      assert.strictEqual(resolved, "https://api.docora.ai");
    });

    it("should normalize a URL with a trailing slash", () => {
      process.env.NEXT_PUBLIC_API_URL = "https://custom-docora.onrender.com/";
      const resolved = resolveApiBaseUrl();
      assert.strictEqual(resolved, "https://custom-docora.onrender.com");
    });

    it("should normalize a clean URL without trailing slash", () => {
      process.env.NEXT_PUBLIC_API_URL = "https://custom-docora.onrender.com";
      const resolved = resolveApiBaseUrl();
      assert.strictEqual(resolved, "https://custom-docora.onrender.com");
    });

    it("should fall back to empty string in production when NEXT_PUBLIC_API_URL is missing", () => {
      delete process.env.NEXT_PUBLIC_API_URL;
      (process.env as any).NODE_ENV = "production";
      const resolved = resolveApiBaseUrl();
      // Must not leak localhost in production
      assert.strictEqual(resolved, "");
      assert.doesNotMatch(resolved, /localhost/);
    });

    it("should fall back to http://localhost:8000 in development when NEXT_PUBLIC_API_URL is missing", () => {
      delete process.env.NEXT_PUBLIC_API_URL;
      (process.env as any).NODE_ENV = "development";
      const resolved = resolveApiBaseUrl();
      assert.strictEqual(resolved, "http://localhost:8000");
      process.env = { ...originalEnv };
    });
  });

  describe("ApiClient URL Construction & Headers", () => {
    it("buildUrl should create clean endpoints without double slashes", () => {
      const client = new ApiClient();
      const base = client.getBaseUrl();
      const url1 = client.buildUrl("/api/v1/documents");
      const url2 = client.buildUrl("api/v1/documents");
      assert.strictEqual(url1, `${base}/api/v1/documents`);
      assert.strictEqual(url2, `${base}/api/v1/documents`);
    });

    it("should manage authentication token properly", () => {
      const client = new ApiClient();
      assert.strictEqual(client.getAuthToken(), null);

      client.setAuthToken("test-jwt-token-xyz");
      assert.strictEqual(client.getAuthToken(), "test-jwt-token-xyz");

      client.setAuthToken(null);
      assert.strictEqual(client.getAuthToken(), null);
    });
  });

  describe("Regression Guard: No Hardcoded Localhost in Frontend Components", () => {
    const targetFiles = [
      "src/app/chat/page.tsx",
      "src/app/documents/page.tsx",
      "src/app/intelligence/page.tsx",
      "src/app/page.tsx",
      "src/app/tasks/page.tsx",
      "src/components/layout/Header.tsx",
      "src/context/UploadContext.tsx",
      "src/components/notebook/ArtifactViewerModal.tsx",
      "src/app/settings/page.tsx",
    ];

    for (const relPath of targetFiles) {
      it(`verifies ${relPath} contains no hardcoded backend URLs`, () => {
        const fullPath = path.resolve(__testdir, "..", relPath);
        assert.ok(fs.existsSync(fullPath), `File must exist: ${relPath}`);
        const content = fs.readFileSync(fullPath, "utf-8");

        // Assert no fetch to localhost:8000 or 127.0.0.1:8000
        const match8000 = content.match(/https?:\/\/(localhost|127\.0\.0\.1):8000[^\s"'`]*/g);
        assert.strictEqual(
          match8000,
          null,
          `Found forbidden hardcoded localhost URL in ${relPath}: ${JSON.stringify(match8000)}`
        );
      });
    }
  });

  describe("ApiClient Mocked Network Operations", () => {
    const originalFetch = global.fetch;

    it("handles request success and parses JSON", async () => {
      global.fetch = async (url: any, init: any) => {
        return new Response(JSON.stringify({ status: "ok", data: 123 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      };

      const client = new ApiClient();
      const res = await client.request<{ status: string; data: number }>("/api/v1/test");
      assert.strictEqual(res.status, "ok");
      assert.strictEqual(res.data, 123);
    });

    it("handles 204 No Content response gracefully", async () => {
      global.fetch = async (url: any, init: any) => {
        return new Response(null, { status: 204 });
      };

      const client = new ApiClient();
      const res = await client.delete<{ success?: boolean }>("/api/v1/documents/123");
      assert.deepStrictEqual(res, {});
    });

    it("throws normalized ApiError on server error", async () => {
      global.fetch = async (url: any, init: any) => {
        return new Response(JSON.stringify({ detail: "Unauthorized workspace access" }), {
          status: 403,
          headers: { "Content-Type": "application/json", "x-request-id": "req-999" },
        });
      };

      const client = new ApiClient();
      await assert.rejects(
        async () => {
          await client.get("/api/v1/documents");
        },
        (err: any) => {
          assert.strictEqual(err.status, 403);
          assert.strictEqual(err.detail, "Unauthorized workspace access");
          assert.strictEqual(err.requestId, "req-999");
          return true;
        }
      );
    });

    it("handles multipart file upload correctly without forced json header", async () => {
      let capturedHeaders: any = null;
      let capturedBody: any = null;

      global.fetch = async (url: any, init: any) => {
        capturedHeaders = init.headers;
        capturedBody = init.body;
        return new Response(JSON.stringify({ id: "doc-new", title: "test_doc" }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        });
      };

      const client = new ApiClient();
      client.setAuthToken("mock-token-abc");

      // Mock a File
      const mockFile = new File(["dummy content"], "test_report.pdf", { type: "application/pdf" });
      const result = await client.uploadDocument(mockFile, "folder-123");

      assert.strictEqual(result.id, "doc-new");
      assert.strictEqual(capturedHeaders["Authorization"], "Bearer mock-token-abc");
      assert.strictEqual(capturedHeaders["Content-Type"], undefined); // Browser sets multipart boundary
      assert.ok(capturedBody instanceof FormData);
    });

    it("handles SSE streaming response and parses tokens and citations", async () => {
      const ssePayload = [
        'data: {"token": "Docora "}\n\n',
        'data: {"token": "is ready."}\n\n',
        'data: {"citations": [{"document_id": "doc-1", "chunk_id": "c1", "page_number": 1, "quote": "test"}]}\n\n',
      ].join("");

      global.fetch = async (url: any, init: any) => {
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(ssePayload));
            controller.close();
          },
        });
        return new Response(stream, {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        });
      };

      const client = new ApiClient();
      let streamedText = "";
      let receivedCitations: any[] = [];

      await client.streamChat(
        "notebook-1",
        { message: "Explain document", conversation_id: "conv-100" },
        (token) => {
          streamedText += token;
        },
        (citations) => {
          receivedCitations = citations;
        }
      );

      assert.strictEqual(streamedText, "Docora is ready.");
      assert.strictEqual(receivedCitations.length, 1);
      assert.strictEqual(receivedCitations[0].document_id, "doc-1");
    });

    // Cleanup
    global.fetch = originalFetch;
  });
});
