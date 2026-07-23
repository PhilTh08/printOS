export const MAX_PRINT_FILE_SIZE =
  100 * 1024 * 1024;
export const MAX_DIRECTORY_SCAN_FILES =
  50_000;
export const MAX_SCAN_IMPORT_FILES = 250;
export const MAX_SCAN_IMPORT_SIZE =
  1024 * 1024 * 1024;
export const MAX_RELATIVE_PATH_LENGTH =
  1000;

export type PrintFormatGroup = {
  id:
    | "models"
    | "print_jobs"
    | "cad"
    | "references"
    | "archives";
  label: string;
  description: string;
  formats: Array<{
    extension: string;
    label: string;
    defaultEnabled: boolean;
  }>;
};

export const PRINT_FORMAT_GROUPS: PrintFormatGroup[] = [
  {
    id: "models",
    label: "3D-Modelle",
    description:
      "Mesh- und Austauschformate für Slicer und CAD.",
    formats: [
      {
        extension: "stl",
        label: "STL",
        defaultEnabled: true,
      },
      {
        extension: "3mf",
        label: "3MF",
        defaultEnabled: true,
      },
      {
        extension: "obj",
        label: "OBJ",
        defaultEnabled: true,
      },
      {
        extension: "ply",
        label: "PLY",
        defaultEnabled: false,
      },
      {
        extension: "amf",
        label: "AMF",
        defaultEnabled: false,
      },
    ],
  },
  {
    id: "print_jobs",
    label: "Druckdateien",
    description:
      "Geslicte Dateien für FDM- und Resin-Drucker.",
    formats: [
      {
        extension: "gcode",
        label: "G-Code",
        defaultEnabled: true,
      },
      {
        extension: "bgcode",
        label: "BG-Code",
        defaultEnabled: false,
      },
      {
        extension: "chitubox",
        label: "Chitubox",
        defaultEnabled: false,
      },
      {
        extension: "ctb",
        label: "CTB",
        defaultEnabled: false,
      },
      {
        extension: "goo",
        label: "GOO",
        defaultEnabled: false,
      },
    ],
  },
  {
    id: "cad",
    label: "CAD-Quellen",
    description:
      "Original- und Austauschdateien für spätere Änderungen.",
    formats: [
      {
        extension: "step",
        label: "STEP",
        defaultEnabled: false,
      },
      {
        extension: "stp",
        label: "STP",
        defaultEnabled: false,
      },
      {
        extension: "f3d",
        label: "Fusion 360",
        defaultEnabled: false,
      },
      {
        extension: "fcstd",
        label: "FreeCAD",
        defaultEnabled: false,
      },
      {
        extension: "scad",
        label: "OpenSCAD",
        defaultEnabled: false,
      },
      {
        extension: "iges",
        label: "IGES",
        defaultEnabled: false,
      },
      {
        extension: "igs",
        label: "IGS",
        defaultEnabled: false,
      },
      {
        extension: "dxf",
        label: "DXF",
        defaultEnabled: false,
      },
    ],
  },
  {
    id: "references",
    label: "Referenzen",
    description:
      "Bilder, Zeichnungen, PDF und Begleittexte.",
    formats: [
      {
        extension: "jpg",
        label: "JPG",
        defaultEnabled: false,
      },
      {
        extension: "jpeg",
        label: "JPEG",
        defaultEnabled: false,
      },
      {
        extension: "png",
        label: "PNG",
        defaultEnabled: false,
      },
      {
        extension: "webp",
        label: "WebP",
        defaultEnabled: false,
      },
      {
        extension: "gif",
        label: "GIF",
        defaultEnabled: false,
      },
      {
        extension: "svg",
        label: "SVG",
        defaultEnabled: false,
      },
      {
        extension: "bmp",
        label: "BMP",
        defaultEnabled: false,
      },
      {
        extension: "pdf",
        label: "PDF",
        defaultEnabled: false,
      },
      {
        extension: "txt",
        label: "Text",
        defaultEnabled: false,
      },
      {
        extension: "md",
        label: "Markdown",
        defaultEnabled: false,
      },
    ],
  },
  {
    id: "archives",
    label: "Archive",
    description:
      "Zusammengefasste Projekt- und Austauschpakete.",
    formats: [
      {
        extension: "zip",
        label: "ZIP",
        defaultEnabled: false,
      },
    ],
  },
];

const ALL_FORMATS = PRINT_FORMAT_GROUPS.flatMap(
  (group) => group.formats,
);

export const ALL_PRINT_EXTENSIONS =
  new Set(
    ALL_FORMATS.map(
      (format) => format.extension,
    ),
  );

export const DEFAULT_SCAN_EXTENSIONS =
  ALL_FORMATS.filter(
    (format) => format.defaultEnabled,
  ).map((format) => format.extension);

export const PRINT_LIBRARY_ACCEPT =
  ALL_FORMATS.map(
    (format) => `.${format.extension}`,
  ).join(",");

export const PREVIEW_IMAGE_EXTENSIONS =
  new Set([
    "png",
    "jpg",
    "jpeg",
    "webp",
    "gif",
  ]);

const FORMAT_LABELS = new Map(
  ALL_FORMATS.map((format) => [
    format.extension,
    format.label,
  ]),
);

const FORMAT_GROUPS_BY_EXTENSION =
  new Map(
    PRINT_FORMAT_GROUPS.flatMap(
      (group) =>
        group.formats.map((format) => [
          format.extension,
          group,
        ] as const),
    ),
  );

export type DirectorySelectableFile =
  File & {
    webkitRelativePath?: string;
  };

export type ScannedPrintFileStatus =
  | "ready"
  | "too_large"
  | "path_too_long";

export type ScannedPrintFile = {
  id: string;
  file: DirectorySelectableFile;
  name: string;
  extension: string;
  relativePath: string;
  rootName: string;
  size: number;
  lastModified: number;
  status: ScannedPrintFileStatus;
};

export type IgnoredPrintFile = {
  id: string;
  name: string;
  extension: string;
  relativePath: string;
  size: number;
  reason: "unsupported";
};

export type DirectoryScanResult = {
  rootName: string;
  totalEntries: number;
  unsupportedEntries: number;
  ignoredFiles: IgnoredPrintFile[];
  tooLargeEntries: number;
  pathTooLongEntries: number;
  recognizedSize: number;
  files: ScannedPrintFile[];
};

export function extensionOf(
  fileName: string,
): string {
  const parts = fileName
    .toLocaleLowerCase("de")
    .split(".");

  return parts.length > 1
    ? parts.at(-1) ?? ""
    : "";
}

export function safeFileName(
  fileName: string,
): string {
  const normalized = fileName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");

  return normalized.slice(0, 180) || "datei";
}

export function formatLabelForExtension(
  extension: string,
): string {
  return (
    FORMAT_LABELS.get(
      extension.toLocaleLowerCase("de"),
    ) ?? extension.toUpperCase()
  );
}

export function formatGroupForExtension(
  extension: string,
): PrintFormatGroup | null {
  return (
    FORMAT_GROUPS_BY_EXTENSION.get(
      extension.toLocaleLowerCase("de"),
    ) ?? null
  );
}

export function fileKindForExtension(
  extension: string,
): string {
  const group =
    formatGroupForExtension(extension);

  if (!group) {
    return "Datei";
  }

  if (group.id === "models") {
    return "3D-Modell";
  }

  if (group.id === "print_jobs") {
    return "Druckdatei";
  }

  if (group.id === "cad") {
    return "CAD-Datei";
  }

  if (group.id === "references") {
    return "Referenz";
  }

  return "Archiv";
}

function normalizedPath(
  file: DirectorySelectableFile,
): {
  rootName: string;
  relativePath: string;
} {
  const rawPath =
    file.webkitRelativePath?.trim() ||
    file.name;
  const segments = rawPath
    .replace(/\\/g, "/")
    .split("/")
    .map((segment) => segment.trim())
    .filter(
      (segment) =>
        Boolean(segment) &&
        segment !== "." &&
        segment !== "..",
    );

  if (segments.length <= 1) {
    return {
      rootName: "Lokaler Ordner",
      relativePath: file.name,
    };
  }

  return {
    rootName: segments[0],
    relativePath:
      segments.slice(1).join("/") ||
      file.name,
  };
}

export function scanDirectoryFiles(
  inputFiles: DirectorySelectableFile[],
): DirectoryScanResult {
  if (
    inputFiles.length >
    MAX_DIRECTORY_SCAN_FILES
  ) {
    throw new Error(
      `Der Ordner enthält mehr als ${MAX_DIRECTORY_SCAN_FILES.toLocaleString("de-DE")} Dateien. Bitte einen kleineren Ordner auswählen.`,
    );
  }

  const files: ScannedPrintFile[] = [];
  const ignoredFiles: IgnoredPrintFile[] = [];
  let unsupportedEntries = 0;
  let tooLargeEntries = 0;
  let pathTooLongEntries = 0;
  let recognizedSize = 0;
  let detectedRootName = "Lokaler Ordner";

  inputFiles.forEach((file, index) => {
    const extension = extensionOf(
      file.name,
    );
    const path = normalizedPath(file);

    if (
      detectedRootName === "Lokaler Ordner" &&
      path.rootName !== "Lokaler Ordner"
    ) {
      detectedRootName = path.rootName;
    }

    if (
      !ALL_PRINT_EXTENSIONS.has(extension)
    ) {
      unsupportedEntries += 1;
      ignoredFiles.push({
        id: `ignored:${index}:${path.relativePath.toLocaleLowerCase("de")}:${file.size}:${file.lastModified}`,
        name: file.name,
        extension,
        relativePath: path.relativePath,
        size: file.size,
        reason: "unsupported",
      });
      return;
    }

    recognizedSize += file.size;
    let status: ScannedPrintFileStatus =
      "ready";

    if (file.size > MAX_PRINT_FILE_SIZE) {
      status = "too_large";
      tooLargeEntries += 1;
    } else if (
      path.relativePath.length >
      MAX_RELATIVE_PATH_LENGTH
    ) {
      status = "path_too_long";
      pathTooLongEntries += 1;
    }

    files.push({
      id: `${index}:${path.relativePath.toLocaleLowerCase("de")}:${file.size}:${file.lastModified}`,
      file,
      name: file.name,
      extension,
      relativePath: path.relativePath,
      rootName: path.rootName,
      size: file.size,
      lastModified: file.lastModified,
      status,
    });
  });

  files.sort((first, second) =>
    first.relativePath.localeCompare(
      second.relativePath,
      "de",
      {
        numeric: true,
        sensitivity: "base",
      },
    ),
  );

  ignoredFiles.sort((first, second) =>
    first.relativePath.localeCompare(
      second.relativePath,
      "de",
      {
        numeric: true,
        sensitivity: "base",
      },
    ),
  );

  return {
    rootName: detectedRootName,
    totalEntries: inputFiles.length,
    unsupportedEntries,
    ignoredFiles,
    tooLargeEntries,
    pathTooLongEntries,
    recognizedSize,
    files,
  };
}
