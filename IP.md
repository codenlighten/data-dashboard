# IP records

| Date | Covers | Type | Record hash | Signer | Tag |
|---|---|---|---|---|---|
| 2026-11-26 | Commit `4115ec6`: a React and D3 earthquake dashboard, source, tests and documentation. No authorship claimed in third-party libraries, tool scaffolding, map data, the USGS sample data and the generated lockfile. | software, hash-only | [`d703b48a81cb36a85eaaf5ced34017404e181cf5545d3b77ab118b8377cc90c4`](https://iptrust.org/v/d703b48a81cb36a85eaaf5ced34017404e181cf5545d3b77ab118b8377cc90c4) | Gregory J. Ward | `ip-2026-11-26` |
| 2026-11-26 | Commit `0388f2d`: a React and D3 earthquake dashboard, source, tests and documentation; revision with input validation and chart and table fixes. No authorship claimed in third-party libraries, tool scaffolding, map data, the USGS sample data and the generated lockfile. | software, hash-only | [`620b0a52de81224ce25aa643c48e454ddbc3b081ccdcfe61761fa75b6184c970`](https://iptrust.org/v/620b0a52de81224ce25aa643c48e454ddbc3b081ccdcfe61761fa75b6184c970) | Gregory J. Ward | `ip-2026-11-26-2` |

A record is evidence that the committed content existed by the time of its anchor and that the signer made
the statement; it does not create or register any right. Anchoring completes some hours after submission.
Files under `third_party/`, where present, are not part of the record.

## Verifying

The commands below show the first record. For a later one, use its record hash and tag from the table.

Verification needs the evidence package for the record, which the author holds and which is not committed
here. With it in `.iptrust/`:

```
git worktree add /tmp/at-tag-data-dashboard ip-2026-11-26
cp -r .iptrust /tmp/at-tag-data-dashboard/
(cd /tmp/at-tag-data-dashboard && iptrust2 verify d703b48a81cb36a85eaaf5ced34017404e181cf5545d3b77ab118b8377cc90c4 --fetch-headers)
git worktree remove --force /tmp/at-tag-data-dashboard
```

Expect `verdict: valid` and `content: matched` once both chains have anchored.
