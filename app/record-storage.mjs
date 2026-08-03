const pad = (value) => String(value).padStart(2, "0");

const isCounts = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const entries = Object.entries(value);
  return entries.length > 0 && entries.every(([id, count]) => /^([1-9]|1[0-2])(?::(passenger|busSmall|busLarge|truckSmall|truckLarge|trailer))?$/.test(id) && typeof count === "number");
};

const slotKey = (value) => {
  const rawSlot = value.includes("|") ? value.split("|").at(-1) : value;
  const number = Number(rawSlot);
  return Number.isInteger(number) && number >= 0 && number < 96 ? pad(number) : null;
};

export const migrateRecords = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const entries = Object.entries(value);
  if (entries.every(([key, counts]) => slotKey(key) !== null && isCounts(counts))) {
    return Object.fromEntries(entries.map(([key, counts]) => [slotKey(key), counts]));
  }

  const datedEntries = entries
    .filter(([, day]) => day && typeof day === "object" && !Array.isArray(day))
    .sort(([left], [right]) => left.localeCompare(right));
  if (!datedEntries.length) return {};
  const [, latestDay] = datedEntries.at(-1);
  const result = {};
  const previousEntry = datedEntries.at(-2);

  if (previousEntry && isCounts(previousEntry[1]["95"]) && isCounts(latestDay["00"])) {
    const previousDay = previousEntry[1];
    let firstOvernightSlot = 95;
    while (firstOvernightSlot > 0 && isCounts(previousDay[pad(firstOvernightSlot - 1)])) firstOvernightSlot -= 1;
    for (let index = firstOvernightSlot; index < 96; index += 1) {
      const counts = previousDay[pad(index)];
      if (isCounts(counts)) result[pad(index)] = counts;
    }
  }

  Object.entries(latestDay).forEach(([key, counts]) => {
    const normalizedSlot = slotKey(key);
    if (normalizedSlot && isCounts(counts)) result[normalizedSlot] = counts;
  });
  return result;
};

export const migrateDrafts = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result = {};
  Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).forEach(([key, counts]) => {
    const normalizedSlot = slotKey(key);
    if (normalizedSlot && isCounts(counts)) result[normalizedSlot] = counts;
  });
  return result;
};

const normalizeSlot = (value, fallback = "00") => {
  const normalized = slotKey(String(value ?? ""));
  return normalized ?? fallback;
};

const emptySet = (mode, index = 1) => ({
  id: `${mode}-${index}`,
  name: `기록 ${index}`,
  records: {},
  drafts: {},
  slot: "00",
});

export const createEmptyLibrary = () => ({
  library: { full: [emptySet("full")], photo: [emptySet("photo")], box: [emptySet("box")], gyuho: [emptySet("gyuho")] },
  activeRecordIds: { full: "full-1", photo: "photo-1", box: "box-1", gyuho: "gyuho-1" },
});

const normalizeSet = (value, mode, index) => {
  const fallback = emptySet(mode, index + 1);
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;
  return {
    id: typeof value.id === "string" && value.id ? value.id : fallback.id,
    name: typeof value.name === "string" && value.name.trim() ? value.name.trim() : fallback.name,
    records: migrateRecords(value.records),
    drafts: migrateDrafts(value.drafts),
    slot: normalizeSlot(value.slot),
  };
};

export const migrateToLibrary = (value) => {
  const defaults = createEmptyLibrary();
  if (!value || typeof value !== "object" || Array.isArray(value)) return defaults;

  if (value.library && typeof value.library === "object") {
    for (const mode of ["full", "photo", "box", "gyuho"]) {
      const sourceSets = Array.isArray(value.library[mode]) ? value.library[mode] : [];
      const sets = sourceSets.map((set, index) => normalizeSet(set, mode, index));
      defaults.library[mode] = sets.length ? sets : [emptySet(mode)];
      const requestedId = value.activeRecordIds?.[mode];
      defaults.activeRecordIds[mode] = defaults.library[mode].some((set) => set.id === requestedId)
        ? requestedId
        : defaults.library[mode][0].id;
    }
    return defaults;
  }

  const mode = value.mode === "photo" ? "photo" : value.mode === "box" ? "box" : value.mode === "gyuho" ? "gyuho" : "full";
  defaults.library[mode][0] = {
    ...defaults.library[mode][0],
    records: migrateRecords(value.records),
    drafts: migrateDrafts(value.drafts),
    slot: normalizeSlot(value.slot),
  };
  return defaults;
};
