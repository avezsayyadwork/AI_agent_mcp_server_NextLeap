# Edge Case Handling and Mitigation Strategy

This document details critical edge cases, corner scenarios, and mitigation strategies for the Mobile Store Feedback Weekly Pulse application based on the system constraints outlined in [context.md](file:///d:/anita/product-AI-training/Milestone -- AI agent and MCP/context.md) and [architecture.md](file:///d:/anita/product-AI-training/Milestone -- AI agent and MCP/architecture.md).

---

## 📈 1. Review Ingestion Edge Cases

### 1.1. Zero Reviews Found (Last 8–12 Weeks)
* **Scenario**: The application has no reviews during the window (common for newly launched apps or niche internal tools).
* **Impact**: The LLM parser receives empty input, causing compilation or extraction failure.
* **Mitigation**:
  - **Detection**: The `ReviewImporter` checks if the imported list length is `0`.
  - **Action**: Short-circuit the pipeline. Do not call the LLM. Instead, create a Google Doc and Gmail draft with a placeholder message: *"No reviews were posted in the last 8–12 weeks. No weekly pulse was generated."*

### 1.2. Review Flood (Context Window Overflow)
* **Scenario**: A major outage or marketing campaign causes a spike in reviews (e.g., 5,000+ reviews in a week), exceeding the LLM context window.
* **Impact**: LLM API calls fail with token limits exceeded or high billing costs.
* **Mitigation**:
  - **Detection**: Calculate token length of all ingested reviews before LLM processing.
  - **Action**: Implement **Representative Sampling & Pre-Aggregation**:
    1. Filter out repetitive/non-informative reviews (e.g., single-word reviews).
    2. Sample reviews proportionally to their rating distribution (e.g., if 80% are 1-star, ensure 80% of the sample contains 1-star reviews).
    3. Run a lightweight local map-reduce summary before sending themes to the main LLM.

### 1.3. Multilingual Reviews
* **Scenario**: Reviews are written in Spanish, French, Japanese, etc.
* **Impact**: The LLM struggles to cluster themes accurately or mixes languages in verbatim quotes.
* **Mitigation**:
  - **Detection**: Check language profiles or configure the LLM prompt to anticipate non-English reviews.
  - **Action**: Add an translation step in the pipeline or prompt the LLM to: *"Translate all verbatim quotes into English if the target language is not English, but mark it with `[Translated]` prefix."*

---

## 🧠 2. LLM Analysis & Formatting Edge Cases

### 2.1. Insufficient Themes (< 3 Themes Present)
* **Scenario**: All reviews discuss a single service crash (e.g., 100% of reviews are about "Login Error").
* **Impact**: The prompt requires the top 3 themes, forcing the LLM to invent redundant themes.
* **Mitigation**:
  - **Detection**: LLM parser output contains duplicate or extremely overlapping themes.
  - **Action**: Adjust prompt guidance: *"If there are fewer than 3 distinct themes, list only the available ones (e.g., 1 or 2 themes) and clearly state that a single issue dominated the weekly feedback."*

### 2.2. Formatting & Validation Failures (Invalid JSON)
* **Scenario**: The LLM returns markdown or conversational text instead of strict JSON, or exceeds the ≤250-word constraint.
* **Impact**: Downstream pipeline crashes on JSON parsing, or doc updates violate word count limits.
* **Mitigation**:
  - **Detection**: Implement a local Pydantic or JSON schema validator post-LLM extraction.
  - **Action**: 
    1. Use structured output API modes (e.g., Gemini Structured Outputs / JSON Schema mode).
    2. If validation fails, trigger a automatic retry with a corrected prompt containing the parsing error.
    3. Truncate outputs with a tailing ellipsis if word constraints are exceeded.

### 2.3. Safety Filter Triggering
* **Scenario**: Verbatim user reviews contain extreme profanity, toxicity, or terms that trigger the LLM's built-in safety filters.
* **Impact**: The LLM API returns an empty response or block error.
* **Mitigation**:
  - **Detection**: Check the API response status for filter block flags.
  - **Action**: Pre-filter/censor reviews locally to remove highly profane words or flag controversial inputs before sending them to the LLM.

---

## 🛡️ 3. Privacy & PII Edge Cases

### 3.1. Obfuscated / Sneaky PII
* **Scenario**: A user puts their phone number or account credentials in the review body text in a non-standard format (e.g., *"Call me at nine one seven 555 zero one two three"*).
* **Impact**: Simple regex PII scrubbers miss it, causing a privacy violation in the final Google Doc.
* **Mitigation**:
  - **Detection**: Combine regex scrubbers with a dedicated "PII Audit" LLM instruction or a localized NER parser (e.g., spaCy).
  - **Action**: Anonymize any sequences resembling phone numbers, credit cards, or customer IDs with custom placeholder strings, e.g., `[Redacted Customer Number]`.

---

## 🔌 4. MCP & Integration Edge Cases

### 4.1. MCP Server Offline / Unreachable
* **Scenario**: The Google Docs or Gmail MCP server is not running or crashes during the handshake.
* **Impact**: The orchestrator cannot complete the publishing phase.
* **Mitigation**:
  - **Detection**: Connection handshakes fail or time out.
  - **Action**: Save the weekly pulse locally in a `reports/weekly_pulse_YYYY_MM_DD.json` file. Send a notification or exit with an exit code that indicates publishing failed but data processing succeeded.

### 4.2. API Rate Limiting (Google Docs & Gmail)
* **Scenario**: Repeatedly creating and updating files triggers Google API quota limit blocks.
* **Impact**: Pipeline execution fails with HTTP 429 status.
* **Mitigation**:
  - **Detection**: Capture HTTP 429 exceptions from the MCP responses.
  - **Action**: Implement exponential backoff inside the MCP client wrapper. Cache payloads to avoid redrafting identical emails.

### 4.3. Severe LLM API Rate and Token Limits (`llama-3.3-70b-versatile` constraints)
* **Scenario**: Exceeding the tight `llama-3.3-70b-versatile` limits (30 RPM, 1K TPM, 12K RPD, 100K TPD).
* **Impact**: API requests fail with status 429 (rate limit exceeded), blocking review analysis.
* **Mitigation**:
  - **Detection**: Catch rate limit exceptions (HTTP 429 or library-specific errors) indicating TPM/RPM exhaustion.
  - **Action**:
    1. **Throttled Batching**: Divide input reviews into small chunks of 3–5 items.
    2. **Interval Delay**: Enforce a delay (e.g., sleeping 3–5 seconds between batches or longer if tokens approach 1K in a sliding window) using a custom queue scheduler.
    3. **Representative Sampling**: Downsample reviews proportionally if the input set is large, ensuring total processing tokens stay well under the 100K daily limit.
