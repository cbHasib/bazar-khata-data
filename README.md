# Bazar Khata default dataset

This repository is the **generation source and seed** for the catalogue. The
app no longer fetches it from GitHub Raw: the `community-api` backend seeds
Postgres from these files on first boot and serves published releases
byte-identically at `<api>/v1/dataset`, which is what the app's
`APP_CONFIG.remoteDataBaseUrl` (derived from `EXPO_PUBLIC_API_BASE_URL`) points
at. Item images are served from S3/CloudFront, not this repo.

## Public files

- `version.json` — small manifest checked by the app first.
- `categories.json` — bilingual category catalogue.
- `items.json` — bilingual generic grocery/household catalogue (image URLs point at the CloudFront CDN).
- `schemas/*.schema.json` — JSON Schema contracts.

These files are served to the app at:

```text
<api>/v1/dataset/version.json
<api>/v1/dataset/categories.json
<api>/v1/dataset/items.json
```

The backend can still fall back to GitHub Raw for the *initial* seed
(`DATASET_REMOTE_BASE`) when no local checkout is present, but live serving and
image hosting have moved off GitHub.

## Release contract

1. Fetch `version.json`.
2. Compare `datasetVersion` with the locally applied version.
3. If newer, download each declared data file.
4. Verify byte length and SHA-256 before parsing or staging.
5. Validate `schemaVersion` and records.
6. Apply the dataset through the app’s three-way merge; never replace the local database wholesale.
7. Persist the successfully applied manifest and base-field snapshot.

`breaking: true` means a client migration or newer app version is required. `minimumAppVersion` is the lowest compatible app version.

## Data policy

- UUIDs are permanent. Never recycle an ID or derive identity from a display name at runtime.
- English/Bangla names can be corrected without changing identity.
- Generic items intentionally omit brands, barcodes, proprietary images, and volatile prices.
- User-created items and user-edited fields are local data and must not be overwritten by a remote release.
- Removed defaults should be retired through sync metadata/tombstones, not silently recreated.

## Regeneration

The human-reviewed candidate catalogue lives in `research/DATA_RESEARCH.md`. The generator reads its catalogue sections, creates deterministic UUIDv5 records, and refreshes the app's offline copies in `src/assets/data/`.

```bash
node data/tools/generate.mjs
node data/tools/validate.mjs
```

Regeneration is deterministic for a fixed research catalogue and generator. Review the JSON diff, update the semantic `DATASET_VERSION` when data changes, run validation, then publish.

## Attribution

The catalogue is an original curation of generic factual names informed by the sources documented in `research/DATA_RESEARCH.md`, notably the Food Composition Table for Bangladesh (University of Dhaka/FAO), Bangladesh government market and fisheries classifications, HIES coverage, and current generic retail taxonomy. It does not republish nutrition tables, retailer product copy, retailer images, or live prices.
