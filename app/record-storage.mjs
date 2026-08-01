const pad = (value) => String(value).padStart(2, "0");

const isCounts = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const entries = Object.entries(value);
  return entries.length > 0 && entries.every(([id, count]) => /^([1-9]|1[0-2])$/.test(id) && typeof count === "number");
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
