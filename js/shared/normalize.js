function hasValue(value) {
  if (value === undefined || value === null) {
    return false;
  }

  if (typeof value === "string") {
    return value.trim() !== "";
  }

  return true;
}

function pickFirstValue(record, keys) {
  if (!record || !Array.isArray(keys)) {
    return undefined;
  }

  for (const key of keys) {
    if (!Object.hasOwn(record, key)) {
      continue;
    }

    const value = record[key];
    if (hasValue(value)) {
      return value;
    }
  }

  return undefined;
}

export function normalizeStringArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }

  if (typeof value !== "string") {
    return [];
  }

  const text = value.trim();
  if (!text) {
    return [];
  }

  if (text.startsWith("[") && text.endsWith("]")) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        return normalizeStringArray(parsed);
      }
    } catch {
      // Fall back to comma-separated text.
    }
  }

  return text
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function readString(record, keys, fallback = "") {
  const value = pickFirstValue(record, keys);
  return hasValue(value) ? String(value).trim() : fallback;
}

export function readNumber(record, keys, fallback = null) {
  const value = pickFirstValue(record, keys);
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function readBoolean(record, keys, fallback = false) {
  const value = pickFirstValue(record, keys);

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes"].includes(normalized)) {
      return true;
    }
    if (["false", "0", "no"].includes(normalized)) {
      return false;
    }
  }

  return fallback;
}

export function readStringArray(record, keys) {
  return normalizeStringArray(pickFirstValue(record, keys));
}
