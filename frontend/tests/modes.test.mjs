// Tests for src/lib/modes.ts: one name per output format.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import ts from "typescript";
import { hasDash, loadTs, readSource } from "./load-ts.mjs";

const { MODE_OPTIONS, modeLabel } = loadTs("lib/modes.ts");

const EXPECTED_LABELS = {
  structured_notes: "Structured notes",
  adhd_study_pack: "ADHD study pack",
  screen_reader_notes: "Screen reader notes",
  exam_prep_pack: "Exam prep pack",
  plain_language: "Plain-language explanation",
  notetaker_quality_report: "Notetaker quality report",
  captions_vtt: "Captions (WebVTT)",
  timeline_json: "Full record (JSON)",
  transcript_txt: "Plain transcript",
};

// Read the OutputMode union straight from types.ts, so a new mode there must also get a name here.
function outputModesFromTypes() {
  const file = ts.createSourceFile("types.ts", readSource("lib/types.ts"), ts.ScriptTarget.Latest, true);
  const alias = file.statements.find(
    (node) => ts.isTypeAliasDeclaration(node) && node.name.text === "OutputMode",
  );
  assert.ok(alias, "OutputMode type not found in types.ts");
  assert.ok(ts.isUnionTypeNode(alias.type), "OutputMode is not a union");
  return alias.type.types.map((member) => {
    assert.ok(ts.isLiteralTypeNode(member) && ts.isStringLiteral(member.literal), "OutputMode member is not a string");
    return member.literal.text;
  });
}

const OUTPUT_MODES = outputModesFromTypes();

describe("MODE_OPTIONS", () => {
  test("has nine modes", () => {
    assert.equal(MODE_OPTIONS.length, 9);
  });

  test("matches the OutputMode type in types.ts", () => {
    assert.deepEqual(
      MODE_OPTIONS.map((option) => option.mode).sort(),
      [...OUTPUT_MODES].sort(),
    );
  });

  test("has unique modes", () => {
    const modes = MODE_OPTIONS.map((option) => option.mode);
    assert.equal(new Set(modes).size, modes.length);
  });

  test("has unique labels", () => {
    const labels = MODE_OPTIONS.map((option) => option.label);
    assert.equal(new Set(labels).size, labels.length);
  });

  test("gives every mode a label and a description", () => {
    for (const option of MODE_OPTIONS) {
      assert.ok(option.label.trim().length > 0, `${option.mode} has no label`);
      assert.ok(option.description.trim().length > 0, `${option.mode} has no description`);
    }
  });

  test("has no em dash or en dash in labels or descriptions", () => {
    const withDash = MODE_OPTIONS.flatMap((option) => [option.label, option.description]).filter(hasDash);
    assert.deepEqual(withDash, []);
  });

  test("has no em dash or en dash anywhere in modes.ts", () => {
    assert.equal(hasDash(readSource("lib/modes.ts")), false);
  });
});

describe("modeLabel", () => {
  test("knows all nine OutputMode values", () => {
    assert.equal(OUTPUT_MODES.length, 9);
  });

  for (const mode of OUTPUT_MODES) {
    test(`names ${mode}`, () => {
      assert.equal(modeLabel(mode), EXPECTED_LABELS[mode]);
    });
  }

  test("falls back to Notes for an unknown mode", () => {
    assert.equal(modeLabel("not_a_mode"), "Notes");
  });

  test("never returns a dash", () => {
    const withDash = [...OUTPUT_MODES, "not_a_mode"].map(modeLabel).filter(hasDash);
    assert.deepEqual(withDash, []);
  });
});
