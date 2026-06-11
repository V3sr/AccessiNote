export type OutputMode =
  | "structured_notes"
  | "adhd_study_pack"
  | "screen_reader_notes"
  | "exam_prep_pack"
  | "plain_language"
  | "notetaker_quality_report"
  | "captions_vtt";

export interface SourceInfo {
  type: string;
  attribution: string;
  license: string;
  url: string;
}

export interface TimelineChunk {
  chunk_id: string;
  start: string;
  end: string;
  transcript: string;
  ocr: string[];
  ocr_confidence: number;
  visual_description: string;
  concepts: string[];
  source_confidence: number;
  keyframe_path: string;
}

export interface CaptionSegment {
  start: string;
  end: string;
  text: string;
  source: string;
}

export interface LectureTimeline {
  lecture_id: string;
  title: string;
  source: SourceInfo;
  chunks: TimelineChunk[];
  caption_segments: CaptionSegment[];
}

export interface LectureSummary {
  lecture_id: string;
  title: string;
  source_type: string;
  chunk_count: number;
  ocr_chunk_count: number;
  updated_at: string;
}

export interface CreateLectureResponse {
  lecture_id: string;
  status: string;
}

export interface SourceReference {
  chunk_id: string;
  start: string;
  end: string;
  reason: string;
}

export interface GenerateResponse {
  lecture_id: string;
  mode: OutputMode;
  title: string;
  content_markdown: string;
  sources: SourceReference[];
  warnings: string[];
}

export interface CapabilityResponse {
  ffmpeg_available: boolean;
  rapidocr_available: boolean;
  tesseract_available: boolean;
  local_transcription_available: boolean;
  transcription_engine: string;
  video_upload_enabled: boolean;
  image_upload_enabled: boolean;
  ocr_engines: string[];
  notes: string[];
}

export interface VideoUploadResponse {
  lecture_id: string;
  status: string;
  frame_count: number;
  candidate_frame_count: number;
  ocr_frame_count: number;
  ocr_engine: string;
  transcript_segment_count: number;
  transcription_engine: string;
  warnings: string[];
}

export interface ImageUploadResponse {
  lecture_id: string;
  status: string;
  ocr_text_count: number;
  ocr_engine: string;
  warnings: string[];
}
