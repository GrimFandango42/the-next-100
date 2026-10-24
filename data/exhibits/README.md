# Reproducible signature exhibits

These are pinned source extracts, separate from the site's forecast probabilities. Retrieved 2026-10-24. Refreshes must be reviewed and committed, not fetched silently at runtime.

## Population

`population.json` extracts UN DESA World Population Prospects 2024, population by selected age groups, both sexes. The source URL, SHA-256, unit and CC BY 3.0 IGO attribution are embedded in the JSON. Three fertility variants, Africa/China/India, annual 2024–2100, ages 0–14, 15–64 and 65+. Workbook values in thousands are divided by 1,000 and rounded to three decimals to produce millions.

Download the JSON's `source` URL to a local workbook. From the repository root, with Python and openpyxl installed:

```
python scripts/extract-population.py /path/to/downloaded.xlsx
```

The sheet's cached dimensions are wrong: reset_dimensions is required before iterating. The first year Africa's 15–64 population exceeds China plus India is 2057 (low), 2058 (medium), 2059 (high). These alternatives are projections, not confidence intervals. Age counts are not employed-worker counts. The shaded 2054–2062 band is the site's forecast window.

## Arctic

`arctic.json` contains NSIDC Sea Ice Index v4.0 September monthly mean extent, 1979–2026, in million km². Download its `source` CSV, then:

```
python scripts/extract-arctic.py /path/to/downloaded.csv
```

The script also downloads four original September monthly maps (1979, 2000, 2012, 2026). `public/evidence/arctic-*.svg` preserves each original PNG byte-for-byte in an SVG image container. There is no generated geography, interpolation of ice boundaries, or prediction of a future boundary. Source URLs are in the script. The map is the monthly spatial product; the numeric chart is monthly mean extent. Daily minimum, monthly extent and ice area are different measures. The 1M km² line is a forecast threshold, not a projected trajectory.

## Updating

Review source revisions, compare extracted values, run the build and evidence tests, and record an editorial history entry for any changed forecast interpretation. Do not alter an older vintage. Variant controls explore source assumptions and never modify the site's probabilities.
