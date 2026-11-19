import { describe, expect, it } from "vitest";
import { buildSectionTree, type Section } from "./section-tree";

const titles = (s: Section) => s.children.map((c) => c.title);

describe("basic structure", () => {
  it("nests children under parents", () => {
    const t = buildSectionTree("# A\n## B\n### C\n## D\n");
    expect(titles(t)).toEqual(["A"]);
    expect(titles(t.children[0])).toEqual(["B", "D"]);
    expect(titles(t.children[0].children[0])).toEqual(["C"]);
  });

  it("owns content up to the first child heading", () => {
    const t = buildSectionTree("# A\nintro\n## B\nbody\n");
    expect(t.children[0].own_content).toBe("intro");
    expect(t.children[0].children[0].own_content).toBe("body");
  });

  it("keeps preamble on the root", () => {
    const t = buildSectionTree("hello\n\n# A\n");
    expect(t.own_content).toBe("hello\n");
  });
});

describe("line ranges", () => {
  it("covers children in the parent's range", () => {
    const t = buildSectionTree("# A\n## B\ntext\n# C\n");
    const [a, c] = t.children;
    expect(a.source_line_start).toBe(1);
    expect(a.source_line_end).toBe(3);
    expect(a.children[0].source_line_end).toBe(3);
    expect(c.source_line_start).toBe(4);
  });
});

describe("edge cases", () => {
  it("skipped levels: H1 then H3 nests directly, keeps true level", () => {
    const t = buildSectionTree("# A\n### C\n## B\n");
    const a = t.children[0];
    expect(titles(a)).toEqual(["C", "B"]);
    expect(a.children[0].level).toBe(3);
  });

  it("multiple H1s are siblings", () => {
    const t = buildSectionTree("# A\n# B\n");
    expect(titles(t)).toEqual(["A", "B"]);
  });

  it("ignores # lines inside fenced code", () => {
    const t = buildSectionTree("# A\n```\n# not a heading\n```\n");
    expect(titles(t)).toEqual(["A"]);
    expect(t.children[0].children).toHaveLength(0);
  });

  it("makes duplicate titles unique, in document order", () => {
    const t = buildSectionTree("# Notes\n# Notes\n# Notes\n");
    expect(t.children.map((c) => c.id)).toEqual([
      "notes",
      "notes-2",
      "notes-3",
    ]);
  });

  it("frontmatter offsets line numbers correctly", () => {
    const t = buildSectionTree("---\ntitle: x\n---\n# A\n");
    expect(t.children[0].source_line_start).toBe(4);
  });

  it("does not treat frontmatter as a heading or a setext underline", () => {
    const t = buildSectionTree("---\ntitle: x\n---\n# A\n");
    expect(titles(t)).toEqual(["A"]);
  });

  it("does not count the final newline as a line", () => {
    const t = buildSectionTree("# A\nbody\n");
    expect(t.children[0].source_line_end).toBe(2);
  });

  it("keeps a real trailing blank line as content", () => {
    const t = buildSectionTree("# A\nbody\n\n");
    expect(t.children[0].own_content).toBe("body\n");
  });
});

describe("ids", () => {
  it("are stable when unrelated text changes", () => {
    const a = buildSectionTree("# One\n## Two\nfoo\n");
    const b = buildSectionTree("# One\n## Two\nbar bar bar\n");
    expect(a.children[0].children[0].id).toBe(b.children[0].children[0].id);
  });

  it("slugs inline formatting by its text", () => {
    const t = buildSectionTree("# Hello *big* world\n");
    expect(t.children[0].title).toBe("Hello big world");
    expect(t.children[0].id).toBe("hello-big-world");
  });
});

describe("degenerate input", () => {
  it("handles an empty document", () => {
    const t = buildSectionTree("");
    expect(t.children).toEqual([]);
  });

  it("handles no headings", () => {
    const t = buildSectionTree("just text\n");
    expect(t.children).toEqual([]);
    expect(t.own_content).toBe("just text");
  });
});
