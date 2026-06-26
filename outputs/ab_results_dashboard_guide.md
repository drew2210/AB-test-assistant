# Algolia A/B Results Dashboard Guide

Use this guide as hidden context for any screenshot parser that needs to read an Algolia A/B test results dashboard.

## Goal
Extract only visible, high-confidence information from the screenshot and turn it into a structured summary for an assistant to interpret.

## Important Constraint
If the screenshot is zoomed out, blurry, cropped poorly, or missing the key metric tables, the parser should say that there is not enough visible detail rather than guessing.

## Expected Dashboard Layout

### Header Area
Usually contains:
- test name
- duration or date range
- status such as completed or stopped early

### Variant Summary Area
Usually shows side-by-side cards or boxes for:
- Control
- Variant

These often include:
- index name
- tracked searches
- quick performance summary

### Metric Breakdown Tabs
The dashboard commonly includes 3 major tabs:

1. `Conversion Funnel`
- CTR
- Add to Cart Rate
- Purchase Rate
- Conversion Rate

2. `Revenue Impact`
- Revenue per Search
- total revenue comparison

3. `Search Quality`
- No Result Count
- Click Position

### Metric Table Pattern
Within a metric table, try to identify:
- metric name
- control value
- variant value
- difference vs control
- confidence label
- confidence interval or shaded range

### Additional Insights Area
May include:
- confidence-over-time chart
- revenue-over-time chart
- dropdown to switch viewed metric

### Follow-up Actions
May include:
- declare winner
- view analytics

## Interpretation Rules For Parsing

### Tracked Searches
Tracked searches are especially important.
- More tracked searches = more reliable interpretation
- Low tracked-search volume should reduce confidence in the parser summary

### Confidence
Look for labels like:
- Unconfident
- Trending Confident
- Confident
- Inconclusive

If the confidence interval crosses zero, the result is not yet reliable.

### Search Quality Signals
- lower no-result count is better
- lower click position is better

### Revenue Signals
- revenue per search is supportive business context
- it does not necessarily replace the primary metric

## Parser Behavior Rules

### Extract When Clearly Visible
Extract only fields that are clearly readable.

### Do Not Guess
If a field is not clearly visible, return `null` or mark it as `not_visible`.

### Prefer Structured Facts Over Narration
The parser should return fields, values, and evidence, not a long essay.

### Flag Weak Screenshots
If the screenshot is too zoomed out or too incomplete, the parser should say:
- not enough visible detail
- which parts are missing
- what kind of screenshot would work better

## Best Screenshot Advice
The parser should work best when:
- the screenshot is tightly cropped to the results dashboard
- metric labels are legible
- control and variant cards are visible
- at least one metric table is visible
- confidence labels or bars are visible

## Recommended Missing-Detail Message
If the screenshot is not usable, return a message like:

`The screenshot was parsed, but there was not enough visible detail to produce a confident summary. Please upload a tighter crop showing the control/variant cards and at least one metric table with confidence information.`
