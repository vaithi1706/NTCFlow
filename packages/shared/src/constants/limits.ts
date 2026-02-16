export const LIMITS = {
  FREE_TIER: {
    MAX_PROJECTS: 3,
    MAX_MEMBERS: 5,
  },
  PRO_TIER: {
    MAX_PROJECTS: Infinity,
    MAX_MEMBERS: 50,
  },
  FILE_UPLOAD: {
    MAX_SIZE_BYTES: 26214400, // 25MB
    ALLOWED_TYPES: [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "application/pdf",
      "text/plain",
      "text/csv",
      "application/zip",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ],
  },
  TASK: {
    TITLE_MAX_LENGTH: 500,
    DESCRIPTION_MAX_LENGTH: 50000,
  },
  PASSWORD: {
    MIN_LENGTH: 8,
    MAX_LENGTH: 128,
  },
  PAGINATION: {
    DEFAULT_PAGE_SIZE: 50,
    MAX_PAGE_SIZE: 100,
  },
} as const;
