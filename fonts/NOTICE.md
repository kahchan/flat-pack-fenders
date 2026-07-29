# Bundled fonts

Both families are licensed under the SIL Open Font License 1.1 and are redistributed here
unmodified, as `latin` and `latin-ext` variable subsets produced by Google Fonts.

| Family | Axes | Upstream |
|---|---|---|
| Hanken Grotesk | `wght` 100–900 | https://github.com/hanken-design/HankenGrotesk |
| JetBrains Mono | `wght` 400–700 | https://github.com/JetBrains/JetBrainsMono |

The full OFL 1.1 text for each is in its upstream repository, and at
https://openfontlicense.org. The OFL permits bundling and redistribution with an application;
it does not permit selling the fonts on their own, and requires this notice be retained.

Note: the app's `--font-mono` stack is used for the diameter sign `⌀` (U+2300) in the
cross-section label, which falls outside both subsets. It renders from a system fallback.
That is intentional — pulling in a wider subset for one glyph is not worth ~40 KB.
