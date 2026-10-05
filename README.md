# news-dashboards

Part of the muxd22-alt monorepo consolidation (50 repos -> 5).

Every member lives in `repos/<name>/` and stays self-contained.
Identical CI configs across the old repos were replaced by the single,
shared workflow set in `.github/workflows/`:

- **CI** — structure, oversized-file, secret and syntax checks on every push/PR
- **Daily Digest** — scheduled 06:00 UTC, publishes a per-member activity table
  to the `Daily Digest` issue and the job summary

## Members

| folder | language | files | size | merged (absorbed repos) |
|---|---|---:|---:|---|
| `MUXDLab-Homepage` | Python | 31 | 1.8 MB | — |
| `PAI` | TypeScript | 76 | 0.4 MB | — |
| `ai_research_dashboard` | TypeScript | 42 | 4.4 MB | — |
| `global-news-dashboard` | HTML | 7 | 0.0 MB | — |
| `hud_live` | TypeScript | 155 | 11.1 MB | `HudhudLive-Production` |
| `hudhud-platform` | Python | 17 | 0.1 MB | — |
| `iran-news-dashboard` | Python | 15 | 0.5 MB | — |

See `SOURCE_MAP.md` for the old-repo -> new-path mapping, including files
kept under `repos/<x>/_variants/` (conflicting versions from absorbed repos).
