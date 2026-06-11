import type {
  CapabilityResponse,
  CreateLectureResponse,
  GenerateResponse,
  ImageUploadResponse,
  LectureSummary,
  LectureTimeline,
  OutputMode,
  VideoUploadResponse,
} from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = new Headers(options?.headers);
  const isFormData = typeof FormData !== "undefined" && options?.body instanceof FormData;
  if (!isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(readErrorMessage(errorText, response.status));
  }

  return response.json() as Promise<T>;
}

export function getHealth(): Promise<{ status: string }> {
  return request<{ status: string }>("/health");
}

export function getCapabilities(): Promise<CapabilityResponse> {
  return request<CapabilityResponse>("/api/capabilities");
}

export function loadSampleLecture(): Promise<LectureTimeline> {
  return request<LectureTimeline>("/api/lectures/sample");
}

export function listLectures(): Promise<LectureSummary[]> {
  return request<LectureSummary[]>("/api/lectures");
}

export function createLectureFromTranscript(
  title: string,
  transcript: string,
): Promise<CreateLectureResponse> {
  return request<CreateLectureResponse>("/api/lectures", {
    method: "POST",
    body: JSON.stringify({
      title,
      source_type: "transcript",
      transcript,
    }),
  });
}

export function getLecture(lectureId: string): Promise<LectureTimeline> {
  return request<LectureTimeline>(`/api/lectures/${encodeURIComponent(lectureId)}`);
}

export function generateOutput(
  lectureId: string,
  mode: OutputMode,
): Promise<GenerateResponse> {
  return request<GenerateResponse>(`/api/lectures/${encodeURIComponent(lectureId)}/generate`, {
    method: "POST",
    body: JSON.stringify({ mode }),
  });
}

export function uploadVideoLecture(
  title: string,
  videoFile: File,
  transcript: string,
  transcriptFile?: File | null,
): Promise<VideoUploadResponse> {
  const formData = new FormData();
  formData.append("title", title);
  formData.append("video", videoFile);
  formData.append("transcript", transcript);
  if (transcriptFile) {
    formData.append("transcript_file", transcriptFile);
  }

  return request<VideoUploadResponse>("/api/videos/upload", {
    method: "POST",
    body: formData,
  });
}

export function uploadImageLecture(
  title: string,
  imageFile: File,
  notes: string,
): Promise<ImageUploadResponse> {
  const formData = new FormData();
  formData.append("title", title);
  formData.append("image", imageFile);
  formData.append("notes", notes);

  return request<ImageUploadResponse>("/api/images/upload", {
    method: "POST",
    body: formData,
  });
}

export function assetUrl(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  return `${API_BASE_URL}${path}`;
}

function readErrorMessage(errorText: string, status: number): string {
  if (!errorText) {
    return `Request failed with ${status}`;
  }
  try {
    const parsed = JSON.parse(errorText) as { detail?: unknown };
    if (typeof parsed.detail === "string") {
      return parsed.detail;
    }
    if (Array.isArray(parsed.detail)) {
      return parsed.detail
        .map((item) => {
          if (item && typeof item === "object" && "msg" in item) {
            return String((item as { msg: unknown }).msg);
          }
          return String(item);
        })
        .join(" ");
    }
  } catch {
    return errorText;
  }
  return errorText;
}
