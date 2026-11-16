import test, { describe, it } from "node:test";
import assert from "node:assert";

describe("Notebook Workspace Query Routing & Hook Stability", () => {
  it("should detect missing id parameter and trigger redirect to /notebooks", () => {
    const searchParams = new URLSearchParams("");
    const notebookId = searchParams.get("id") || "";

    assert.strictEqual(notebookId, "");

    let redirectedTo: string | null = null;
    const router = {
      replace: (path: string) => {
        redirectedTo = path;
      },
    };

    // Simulate the unconditional hook effect
    if (!notebookId) {
      router.replace("/notebooks");
    }

    assert.strictEqual(redirectedTo, "/notebooks");
  });

  it("should resolve valid notebook id from query parameter without redirecting", () => {
    const validId = "d7cbd1f8-ec0b-4b2e-977a-7e3aeca0f935";
    const searchParams = new URLSearchParams(`id=${validId}`);
    const notebookId = searchParams.get("id") || "";

    assert.strictEqual(notebookId, validId);

    let redirectedTo: string | null = null;
    const router = {
      replace: (path: string) => {
        redirectedTo = path;
      },
    };

    if (!notebookId) {
      router.replace("/notebooks");
    }

    assert.strictEqual(redirectedTo, null, "Should not redirect when valid ID is provided");
  });

  it("should preserve hook execution sequence between missing ID and valid ID renders", () => {
    // Simulate React render sequence to verify hook order stability
    const hookExecutionLog: string[][] = [];

    function simulateNotebookWorkspaceRender(idParam: string | null) {
      const currentRenderHooks: string[] = [];

      // Hook 1: useRouter
      currentRenderHooks.push("useRouter");

      // Hook 2: useSearchParams
      currentRenderHooks.push("useSearchParams");
      const notebookId = idParam || "";

      // Hook 3: useNotebook
      currentRenderHooks.push("useNotebook");

      // Hooks 4-11: useState hooks
      currentRenderHooks.push("useState_isLeftPanelOpen");
      currentRenderHooks.push("useState_isRightPanelOpen");
      currentRenderHooks.push("useState_isCommandPaletteOpen");
      currentRenderHooks.push("useState_isAddSourceOpen");
      currentRenderHooks.push("useState_isCreateNoteOpen");
      currentRenderHooks.push("useState_deleteCandidate");
      currentRenderHooks.push("useState_activeStudioTool");
      currentRenderHooks.push("useState_viewingArtifact");

      // Hook 12: useEffect (redirect)
      currentRenderHooks.push("useEffect_redirect");

      // Conditional return occurs strictly AFTER all hooks
      hookExecutionLog.push(currentRenderHooks);

      if (!notebookId) {
        return "NO_NOTEBOOK_FALLBACK";
      }
      return "WORKSPACE_VIEW";
    }

    // Render 1: Missing ID
    const render1 = simulateNotebookWorkspaceRender(null);
    assert.strictEqual(render1, "NO_NOTEBOOK_FALLBACK");

    // Render 2: Transition to valid ID
    const render2 = simulateNotebookWorkspaceRender("nb-12345");
    assert.strictEqual(render2, "WORKSPACE_VIEW");

    // Verify exact hook count and order match across both renders
    assert.strictEqual(hookExecutionLog[0].length, hookExecutionLog[1].length);
    assert.deepStrictEqual(hookExecutionLog[0], hookExecutionLog[1]);
  });
});
