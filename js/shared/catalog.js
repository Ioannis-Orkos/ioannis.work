export function collectCategoryCounts(items, getCategories) {
  const counts = new Map();

  items.forEach((item) => {
    const categories = Array.isArray(getCategories(item)) ? getCategories(item) : [];
    categories.forEach((category) => {
      counts.set(category, (counts.get(category) || 0) + 1);
    });
  });

  return counts;
}

export function filterCatalogItems({
  items,
  query = "",
  selectedCategories = new Set(),
  getCategories,
  getSearchText,
}) {
  const normalizedQuery = String(query || "").trim().toLowerCase();

  const byCategory = selectedCategories.size
    ? items.filter((item) => {
        const categories = Array.isArray(getCategories(item)) ? getCategories(item) : [];
        return categories.length > 0 && categories.some((category) => selectedCategories.has(category));
      })
    : items;

  if (!normalizedQuery) {
    return byCategory;
  }

  return byCategory.filter((item) => {
    const haystack = String(getSearchText(item) || "").toLowerCase();
    return haystack.includes(normalizedQuery);
  });
}
