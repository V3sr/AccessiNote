// Tests for src/lib/messages.ts. Inputs are the real backend strings listed in the copy pass log.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { hasDash, loadTs, readSource } from "./load-ts.mjs";

const {
  countOf,
  formatAttribution,
  formatCaptionSource,
  formatUserStage,
  friendlyError,
  friendlySettingsError,
  friendlyWarnings,
  partLabel,
} = loadTs("lib/messages.ts");

const GENERIC_ERROR =
  "AccessiNote could not finish that. Try again. If it keeps happening, use a shorter file or add a transcript.";
const NO_SERVER = "AccessiNote cannot reach its server on this computer. Start the server, then try again.";
const SETTINGS_FALLBACK =
  "Your settings were not saved. Check that the AccessiNote server is running, then try again.";

const ERROR_CASES = [
  [
    "Unsupported file type: .docx.",
    "AccessiNote cannot read this file type. Use a recording (MP4, MOV, WebM), a transcript (TXT, SRT, VTT) or a slide image (PNG, JPG, WebP).",
  ],
  [
    "Video file is too large. Maximum is 500 MB.",
    "This file is too big. The limit is 500 MB. Try a shorter recording or a smaller file.",
  ],
  [
    "Caption/transcript file is too large. Maximum is 2 MB.",
    "This file is too big. The limit is 2 MB. Try a shorter recording or a smaller file.",
  ],
  ["File is too large.", "This file is too big. Try a shorter recording or a smaller file."],
  ["Video file is empty.", "This file is empty. Choose the file again."],
  [
    "Caption/transcript file must be TXT, SRT, or VTT.",
    "Captions must be a TXT, SRT or VTT file. Choose a different captions file.",
  ],
  [
    "Lecture not found.",
    "AccessiNote cannot find this lecture any more. Pick another one in Recent lectures, or add it again.",
  ],
  [
    "Processing job not found.",
    "AccessiNote lost track of this upload, maybe because the server restarted. Add the file again.",
  ],
  [
    "Processing stalled for more than 900 seconds at loading caption model. Try again with uploaded captions or increase ACCESSINOTE_TRANSCRIPTION_TIMEOUT_SECONDS.",
    "This upload stopped making progress. Try a shorter recording, or add a captions file with it.",
  ],
  ["Failed to fetch", NO_SERVER],
  ["NetworkError when attempting to fetch resource.", NO_SERVER],
  ["Load failed", NO_SERVER],
  ["Request failed with 500", GENERIC_ERROR],
  ["processing failed", GENERIC_ERROR],
  ["", GENERIC_ERROR],
];

const SETTINGS_CASES = [
  [
    "Runtime provider settings are disabled in this environment. Configure Azure providers with backend environment secrets.",
    "Key entry is turned off on this server. Ask the person who runs AccessiNote to set the keys on the server.",
  ],
  ["Failed to fetch", NO_SERVER],
  ["Request failed with 500", SETTINGS_FALLBACK],
];

const WARNINGS_IN = [
  "AI-generated content may contain errors. Review before academic or accessibility use.",
  "Generated with Azure OpenAI using AccessiNote timeline evidence.",
  "Azure OpenAI generation failed; local deterministic fallback was used. Detail: Connection error.",
  "Azure OpenAI generation failed; local deterministic fallback was used.",
  "GENERATION_PROVIDER=azure_openai is selected but not configured; local deterministic fallback was used.",
];
const AZURE_FAILED =
  "Azure OpenAI did not respond, so these notes were made on this computer. Check your Azure keys in Settings to try again.";
const WARNINGS_OUT = [
  "Written with Azure OpenAI from your lecture timeline.",
  AZURE_FAILED,
  AZURE_FAILED,
  "Made on this computer. To use Azure OpenAI, finish setup in Settings.",
];
const UNKNOWN_WARNING = "Slide 3 had no readable text.";

const STAGE_CASES = [
  ["queued", "Waiting to start"],
  ["starting", "Getting your file ready"],
  ["upload received", "Getting your file ready"],
  ["parsing transcript", "Reading your transcript"],
  ["extracting audio", "Making captions from the audio"],
  ["transcribing with Azure Speech", "Making captions from the audio"],
  ["loading caption model", "Making captions from the audio"],
  ["segmenting captions", "Making captions from the audio"],
  ["finding visual changes", "Finding the slides in the video"],
  ["extracting frames", "Finding the slides in the video"],
  ["running OCR", "Reading slide text"],
  ["aligning evidence", "Matching captions and slides to timestamps"],
  ["assembling timeline", "Matching captions and slides to timestamps"],
  ["ready for review", "Ready to check"],
  ["something new", "Working on your lecture"],
];

const PART_CASES = [
  ["c1", "Part 1"],
  ["c12", "Part 12"],
  ["chunk_7", "Part"],
  ["", "Part"],
];

const ATTRIBUTION_CASES = [
  ["Local image upload: test-slide.png", "image", "Slide: test-slide.png"],
  ["Local video upload: week3.mp4", "video", "Recording: week3.mp4"],
  ["Pasted transcript provided locally by the user.", "transcript", "Pasted transcript"],
  ["Lecture notes from Week 2", "transcript", "Lecture notes from Week 2"],
  ["", "transcript", "Transcript"],
  ["", "video", "Recording"],
  ["", "image", "Slide"],
];

const CAPTION_SOURCE_CASES = [
  ["none", "No captions"],
  ["", "No captions"],
  ["faster-whisper", "Captions made on this computer"],
  ["faster-whisper timeout", "Captions took too long"],
  ["azure_speech", "Captions made by Azure Speech"],
  ["uploaded captions", "Your captions file"],
  ["uploaded transcript", "Your transcript"],
  ["image notes", "Your notes"],
  ["something else", "something else"],
];

const COUNT_CASES = [
  [0, "0 parts"],
  [1, "1 part"],
  [2, "2 parts"],
];

describe("friendlyError", () => {
  for (const [input, expected] of ERROR_CASES) {
    test(`maps ${JSON.stringify(input)}`, () => {
      assert.equal(friendlyError(input), expected);
    });
  }

  test("keeps the size limit from the backend line", () => {
    assert.match(friendlyError("Video file is too large. Maximum is 500 MB."), /The limit is 500 MB\./);
  });

  test("matches regardless of letter case", () => {
    assert.equal(friendlyError("FAILED TO FETCH"), NO_SERVER);
  });
});

describe("friendlySettingsError", () => {
  for (const [input, expected] of SETTINGS_CASES) {
    test(`maps ${JSON.stringify(input)}`, (t) => {
      t.mock.method(console, "error", () => {});
      assert.equal(friendlySettingsError(input), expected);
    });
  }

  test("logs the raw text once when it falls back", (t) => {
    const logged = t.mock.method(console, "error", () => {});
    friendlySettingsError("Request failed with 500");
    assert.equal(logged.mock.callCount(), 1);
    assert.deepEqual(logged.mock.calls[0].arguments, ["AccessiNote settings error:", "Request failed with 500"]);
  });
});

describe("friendlyWarnings", () => {
  test("maps the generator warnings from the copy pass log", () => {
    assert.deepEqual(friendlyWarnings(WARNINGS_IN), WARNINGS_OUT);
  });

  test("drops the AI-generated safety line in any letter case", () => {
    assert.deepEqual(friendlyWarnings([WARNINGS_IN[0]]), []);
    assert.deepEqual(friendlyWarnings([WARNINGS_IN[0].toLowerCase()]), []);
  });

  test("leaves unknown warnings as they are", () => {
    assert.deepEqual(friendlyWarnings([UNKNOWN_WARNING, WARNINGS_IN[1]]), [UNKNOWN_WARNING, WARNINGS_OUT[0]]);
  });

  test("returns an empty list for no warnings", () => {
    assert.deepEqual(friendlyWarnings([]), []);
  });
});

describe("formatUserStage", () => {
  test("covers all 15 stage names from the log", () => {
    assert.equal(STAGE_CASES.length, 15);
  });

  for (const [input, expected] of STAGE_CASES) {
    test(`maps ${JSON.stringify(input)}`, () => {
      assert.equal(formatUserStage(input), expected);
    });
  }
});

describe("partLabel", () => {
  for (const [input, expected] of PART_CASES) {
    test(`maps ${JSON.stringify(input)}`, () => {
      assert.equal(partLabel(input), expected);
    });
  }
});

describe("formatAttribution", () => {
  for (const [attribution, sourceType, expected] of ATTRIBUTION_CASES) {
    test(`maps ${JSON.stringify(attribution)} (${sourceType})`, () => {
      assert.equal(formatAttribution(attribution, sourceType), expected);
    });
  }
});

describe("formatCaptionSource", () => {
  for (const [input, expected] of CAPTION_SOURCE_CASES) {
    test(`maps ${JSON.stringify(input)}`, () => {
      assert.equal(formatCaptionSource(input), expected);
    });
  }
});

describe("countOf", () => {
  for (const [count, expected] of COUNT_CASES) {
    test(`counts ${count}`, () => {
      assert.equal(countOf(count, "part", "parts"), expected);
    });
  }
});

describe("no em dash or en dash", () => {
  test("in any output string", (t) => {
    t.mock.method(console, "error", () => {});
    const outputs = [
      ...ERROR_CASES.map(([input]) => friendlyError(input)),
      ...SETTINGS_CASES.map(([input]) => friendlySettingsError(input)),
      ...friendlyWarnings([...WARNINGS_IN, UNKNOWN_WARNING]),
      ...STAGE_CASES.map(([input]) => formatUserStage(input)),
      ...PART_CASES.map(([input]) => partLabel(input)),
      ...ATTRIBUTION_CASES.map(([attribution, sourceType]) => formatAttribution(attribution, sourceType)),
      ...CAPTION_SOURCE_CASES.map(([input]) => formatCaptionSource(input)),
      ...COUNT_CASES.map(([count]) => countOf(count, "part", "parts")),
    ];
    const withDash = outputs.filter(hasDash);
    assert.deepEqual(withDash, []);
  });

  test("anywhere in messages.ts", () => {
    assert.equal(hasDash(readSource("lib/messages.ts")), false);
  });
});
