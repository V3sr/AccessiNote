// Plain lines for text the backend writes for developers: errors, job stages, warnings and labels.
// Callers that catch an error log the raw text once, so problems can still be traced.

const pluralRules = new Intl.PluralRules("en");

export function countOf(count: number, one: string, other: string): string {
  return `${count} ${pluralRules.select(count) === "one" ? one : other}`;
}

export function friendlyError(error: string): string {
  const normalized = error.toLowerCase();
  if (normalized.includes("unsupported file type")) {
    return "AccessiNote cannot read this file type. Use a recording (MP4, MOV, WebM), a transcript (TXT, SRT, VTT) or a slide image (PNG, JPG, WebP).";
  }
  if (normalized.includes("too large")) {
    const limit = /maximum is (\d+) mb/.exec(normalized);
    return limit
      ? `This file is too big. The limit is ${limit[1]} MB. Try a shorter recording or a smaller file.`
      : "This file is too big. Try a shorter recording or a smaller file.";
  }
  if (normalized.includes("file is empty")) {
    return "This file is empty. Choose the file again.";
  }
  if (normalized.includes("must be txt, srt, or vtt")) {
    return "Captions must be a TXT, SRT or VTT file. Choose a different captions file.";
  }
  if (normalized.includes("lecture not found")) {
    return "AccessiNote cannot find this lecture any more. Pick another one in Recent lectures, or add it again.";
  }
  if (normalized.includes("processing job not found")) {
    return "AccessiNote lost track of this upload, maybe because the server restarted. Add the file again.";
  }
  if (normalized.includes("processing stalled")) {
    return "This upload stopped making progress. Try a shorter recording, or add a captions file with it.";
  }
  if (normalized.includes("failed to fetch") || normalized.includes("networkerror") || normalized.includes("load failed")) {
    return "AccessiNote cannot reach its server on this computer. Start the server, then try again.";
  }
  return "AccessiNote could not finish that. Try again. If it keeps happening, use a shorter file or add a transcript.";
}

export function friendlySettingsError(error: string): string {
  if (error.toLowerCase().includes("disabled in this environment")) {
    return "Key entry is turned off on this server. Ask the person who runs AccessiNote to set the keys on the server.";
  }
  if (error.toLowerCase().includes("failed to fetch")) {
    return friendlyError(error);
  }
  console.error("AccessiNote settings error:", error);
  return "Your settings were not saved. Check that the AccessiNote server is running, then try again.";
}

const SAFETY_WARNING_START = "ai-generated content may contain errors";

export function friendlyWarnings(warnings: string[]): string[] {
  // The safety line is already shown above every set of notes, so it is not repeated here.
  return warnings
    .filter((warning) => !warning.toLowerCase().startsWith(SAFETY_WARNING_START))
    .map(friendlyWarning);
}

function friendlyWarning(warning: string): string {
  const normalized = warning.toLowerCase();
  if (normalized.startsWith("generated with azure openai")) {
    return "Written with Azure OpenAI from your lecture timeline.";
  }
  if (normalized.startsWith("azure openai generation failed")) {
    return "Azure OpenAI did not respond, so these notes were made on this computer. Check your Azure keys in Settings to try again.";
  }
  if (normalized.includes("azure_openai is selected but not configured")) {
    return "Made on this computer. To use Azure OpenAI, finish setup in Settings.";
  }
  return warning;
}

export function formatUserStage(stage: string): string {
  const normalized = stage.toLowerCase();
  if (normalized.includes("queued")) {
    return "Waiting to start";
  }
  if (normalized.includes("starting") || normalized.includes("upload received")) {
    return "Getting your file ready";
  }
  if (normalized.includes("parsing transcript")) {
    return "Reading your transcript";
  }
  if (normalized.includes("audio") || normalized.includes("transcrib") || normalized.includes("caption")) {
    return "Making captions from the audio";
  }
  if (normalized.includes("visual changes") || normalized.includes("extracting frames")) {
    return "Finding the slides in the video";
  }
  if (normalized.includes("ocr")) {
    return "Reading slide text";
  }
  if (normalized.includes("align") || normalized.includes("assembling")) {
    return "Matching captions and slides to timestamps";
  }
  if (normalized.includes("ready")) {
    return "Ready to check";
  }
  return "Working on your lecture";
}

export function partLabel(chunkId: string): string {
  const match = /^c(\d+)$/.exec(chunkId);
  return match ? `Part ${match[1]}` : "Part";
}

export function formatAttribution(attribution: string, sourceType: string): string {
  const upload = /^Local (video|image) upload: (.+)$/.exec(attribution);
  if (upload) {
    return `${upload[1] === "video" ? "Recording" : "Slide"}: ${upload[2]}`;
  }
  if (attribution.toLowerCase().startsWith("pasted transcript")) {
    return "Pasted transcript";
  }
  if (attribution) {
    return attribution;
  }
  return sourceType === "video" ? "Recording" : sourceType === "image" ? "Slide" : "Transcript";
}

export function formatCaptionSource(value: string): string {
  if (!value || value === "none") {
    return "No captions";
  }
  if (value === "faster-whisper") {
    return "Captions made on this computer";
  }
  if (value === "faster-whisper timeout") {
    return "Captions took too long";
  }
  if (value === "azure_speech") {
    return "Captions made by Azure Speech";
  }
  if (value === "uploaded captions") {
    return "Your captions file";
  }
  if (value === "uploaded transcript") {
    return "Your transcript";
  }
  if (value === "image notes") {
    return "Your notes";
  }
  return value;
}
