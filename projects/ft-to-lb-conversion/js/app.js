(() => {
  const FT_TO_M = 0.3048;
  const KG_TO_LB = 2.2046226218;
  const US_GAL_TO_L = 3.78541;
  const JET_A1_KG_PER_L = 0.8;
  const JET_A1_KG_PER_GAL = US_GAL_TO_L * JET_A1_KG_PER_L;

  const ids = (id) => document.getElementById(id);
  const statusEl = ids("status");
  const precisionEl = ids("precision-select");

  const inputs = [
    "feet-input",
    "meter-input",
    "kg-input",
    "lb-input",
    "fuel-kg-input",
    "fuel-gal-input",
  ].map(ids);

  const toNumber = (input) => Number(input.value);
  const precision = () => Number(precisionEl.value || 2);
  const fmt = (value) => Number(value).toFixed(precision());

  const invalid = (n) => !Number.isFinite(n);

  const setStatus = (msg) => {
    statusEl.textContent = msg || "";
  };

  const convert = (sourceEl, targetEl, calc, okLabel) => {
    const n = toNumber(sourceEl);
    if (invalid(n)) {
      setStatus("Enter a valid numeric value first.");
      return;
    }
    if (n < 0) {
      setStatus("Negative values are not allowed for this aviation calculator.");
      return;
    }
    const result = calc(n);
    targetEl.value = fmt(result);
    setStatus(okLabel);
  };

  ids("ft-to-m").addEventListener("click", () =>
    convert(ids("feet-input"), ids("meter-input"), (n) => n * FT_TO_M, "Converted feet to meters.")
  );
  ids("m-to-ft").addEventListener("click", () =>
    convert(ids("meter-input"), ids("feet-input"), (n) => n / FT_TO_M, "Converted meters to feet.")
  );

  ids("kg-to-lb").addEventListener("click", () =>
    convert(ids("kg-input"), ids("lb-input"), (n) => n * KG_TO_LB, "Converted kilograms to pounds.")
  );
  ids("lb-to-kg").addEventListener("click", () =>
    convert(ids("lb-input"), ids("kg-input"), (n) => n / KG_TO_LB, "Converted pounds to kilograms.")
  );

  ids("fuel-kg-to-gal").addEventListener("click", () =>
    convert(
      ids("fuel-kg-input"),
      ids("fuel-gal-input"),
      (n) => n / JET_A1_KG_PER_GAL,
      "Converted Jet A-1 kilograms to US gallons."
    )
  );
  ids("fuel-gal-to-kg").addEventListener("click", () =>
    convert(
      ids("fuel-gal-input"),
      ids("fuel-kg-input"),
      (n) => n * JET_A1_KG_PER_GAL,
      "Converted Jet A-1 US gallons to kilograms."
    )
  );

  ids("clear-all").addEventListener("click", () => {
    inputs.forEach((input) => {
      input.value = "";
    });
    setStatus("Cleared all fields.");
  });
})();
