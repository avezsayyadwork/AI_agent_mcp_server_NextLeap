# Project Context: Mobile Store Feedback Weekly Pulse

This document captures the context and specifications for the Mobile Store Feedback Weekly Pulse project, as defined in [problemstatement.txt](file:///d:/anita/product-AI-training/Milestone -- AI agent and MCP/docs/problemstatement.txt).

---

## 🎯 Project Goal
The primary objective is to transform raw public mobile-store feedback (from the App Store and Google Play Store) into a concise, actionable, and weekly scannable summary (a "weekly pulse") for the team. 
This summary highlights:
1. What users care about (themes)
2. What users actually said (quotes)
3. What to do next (actions)

The delivery is integrated seamlessly into familiar surfaces—**Google Docs** for reading and sharing, and a draft in **Gmail** for sending—using the **Model Context Protocol (MCP)** to avoid direct credentials and manual REST/OAuth API integration.

---

## 🔄 End-to-End Flow
1. **Data Pull**: Import recent App Store and Play Store reviews (last 8–12 weeks).
2. **Analysis & Clustering**: Group reviews into a maximum of 5 themes and distill a scannable, one-page weekly note (≤250 words).
3. **Google Docs Integration**: Create or update the pulse document in Google Docs.
4. **Gmail Integration**: Create a draft email in Gmail containing or linking to the weekly note.

---

## 📋 Deliverables

### 1. Weekly One-Page Pulse
A scannable report (maximum 250 words) that includes:
- **Top 3 Themes**: A subset of the identified feedback themes.
- **3 User Quotes**: Verbatim snippets from reviews (must be anonymous/stripped of PII, no invented wording).
- **3 Action Ideas**: Concrete, next-step recommendations grounded in the identified themes.

### 2. Gmail Draft Email
- A draft email sent to yourself (or a designated alias) that includes the weekly note itself or a clear, direct pointer/link to the Google Doc.

---

## 👥 Audience & Value Prop

| Role | Why This Helps |
| :--- | :--- |
| **Product / Growth** | Prioritize fixes, enhancements, and features based on real user signals. |
| **Support** | Align customer messaging and FAQs with what users are actually experiencing and saying. |
| **Leadership** | Provide a high-level health check of the product without drowning in raw reviews. |

---

## ⚙️ Technical Requirements & Scope

### Data Import
- **Timeframe**: Retrieve reviews from roughly the last **8–12 weeks**.
- **Fields**: Gather standard review metadata such as `rating`, `title`, `text`, `date`, etc.

### Theme Clustering
- **Limit**: Group reviews into **at most 5 themes** (e.g., onboarding, KYC, payments, statements, withdrawals).
- **Presentation**: Choose the top 3 themes for inclusion in the final weekly pulse.

### Integration Approach (MCP-first)
- **Constraint**: **Do not** build custom Google API clients or implement custom OAuth/REST wrapper code from scratch.
- **Execution**: Leverage **Model Context Protocol (MCP)** servers/connectors for Google Docs and Gmail to handle document creation/modification and draft email creation.

---

## 🚫 Key Constraints & Rules

* **Public Reviews Only**: Only use public review exports. Scraping behind store logins or using ToS-violating automation is strictly prohibited.
* **Maximum 5 Themes**: Keep the clustering model clean and concise with a maximum of 5 themes.
* **Length Limit**: The written weekly pulse must be scannable and **≤250 words** where applicable.
* **Strict Privacy / No PII**: Do not include any Personally Identifiable Information (PII). Ensure no usernames, email addresses, device IDs, or other identifiable reviewer data are present in quotes or any project artifacts.
