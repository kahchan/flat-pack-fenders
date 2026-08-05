# Bundled fonts

All families are licensed under the SIL Open Font License 1.1 and are redistributed here
unmodified, as `latin` subsets produced by Google Fonts.

| Family | Axes | Upstream |
|---|---|---|
| Newsreader | `wght` 300–400, roman and italic | https://github.com/google/fonts/tree/main/ofl/newsreader |
| Archivo | `wght` 400–600 | https://github.com/google/fonts/tree/main/ofl/archivo |
| Ojuju | `wght` 300–700 | https://github.com/google/fonts/tree/main/ofl/ojuju |
| Geist Mono | `wght` 400, 500 | https://github.com/google/fonts/tree/main/ofl/geistmono |

The full OFL 1.1 text for each is in its upstream repository, and at
https://openfontlicense.org. The OFL permits bundling and redistribution with an application;
it does not permit selling the fonts on their own, and requires this notice be retained.

Note: the app's `--font-mono` stack is used for the diameter sign `⌀` (U+2300) in the
cross-section label, which falls outside the latin subset. It renders from a system fallback.
That is intentional — pulling in a wider subset for one glyph is not worth the extra weight.
