# Lead Tracker — Local Business Lead Finder & Outreach CRM

Lead Tracker is a powerful local lead-generation and CRM system designed for freelance web developers and agencies. It discovers local businesses in the USA and India, audits their websites for performance and design flaws, scrapes contact details, and provides a sleek dashboard to manage outreach.

---

## 📂 Project Structure

```
xyz/
├── server.py        # Lightweight HTTP server (REST API & static file hosting)
├── pipeline.py      # Lead discovery, website auditing, and email/contact crawler
├── database.py      # SQLite database manager (CRUD operations & deduplication)
├── index.html       # Dark glassmorphic dashboard interface
├── styles.css       # Premium CSS styling (glassmorphic cards, score gauges, tabs)
├── app.js           # Frontend client logic (API requests, polling, CRM, templates)
├── leads.db         # Persistent SQLite database (auto-created on startup)
└── README.md        # Documentation
```

---

## 🚀 Getting Started (No Dependencies Required!)

Lead Tracker is built entirely using **Python's standard library**. You do not need to install `pip` packages like Flask or BeautifulSoup. It runs out-of-the-box on any system with Python 3.

### 1. Start the Local Server
Run the server script from the project directory:
```bash
python3 server.py
```

This will:
* Initialize the SQLite database (`leads.db`).
* Start the web server at [http://localhost:8000](http://localhost:8000).

### 2. Open the Dashboard
Open your browser and navigate to:
👉 **[http://localhost:8000](http://localhost:8000)**

---

## 💡 Key Features & How to Use Them

### 1. Find New Leads (Interactive Scanner)
At the top of the dashboard, you can trigger new scans directly:
1. **City / Region**: Enter the target area (e.g., `Ahmedabad, Gujarat` or `Austin, TX`).
2. **Business Category**: Enter the niche (e.g., `dentists`, `restaurants`, `gyms`, `salons`, `plumbers`).
3. **Google Places API Key**: Paste your Google API Key.
   * *Tip*: The key will be securely saved in your browser's `localStorage` so you don't have to re-enter it next time. You can also set it as an environment variable (`export GOOGLE_PLACES_API_KEY="your_key"`) and leave the UI field blank.
4. Click **Start Scan**. A real-time progress bar will appear, showing the current business being processed and audited.

### 2. Website Quality Audit
For every business discovered, Lead Tracker performs a multi-step audit:
* **HTTPS/SSL Check**: Verifies if the site is served securely.
* **Mobile-Friendliness (Viewport)**: Checks for the presence of the mobile viewport meta tag.
* **Outdated Design Heuristics**: Extracts the copyright year from the footer (flags if it is older than the previous year).
* **Load Time**: Measures how long it takes to fetch the homepage.
* **Google PageSpeed Insights**: If an API key is present, it automatically queries the PageSpeed API to fetch the mobile performance score.
* **Status Classification**:
  * `No Website`: No website URL listed on Google Maps.
  * `Dead Link`: The URL returned an error or failed to load.
  * `Needs Upgrade`: The website is alive but has flaws (slow, not mobile-friendly, no HTTPS, or outdated copyright).
  * `Good`: The website is fast, secure, and modern.

### 3. Contact Enrichment & Email Crawler
For businesses with websites, Lead Tracker crawls the homepage and up to two contact/about pages to extract:
* **Email Addresses**: Finds `mailto:` links and text emails using regex.
* **Contact Names**: Searches for patterns like "Owner: [Name]" or "Founder: [Name]".
* **Confidence Level**: Labels emails as `Confirmed` (physically scraped) or `Guessed` (pattern-based fallback, e.g., `info@domain.com`).

### 4. B2B Outreach & CRM
Click on any business in the table to open the sidebar, which features two tabs:
* **CRM & Contact Tab**:
  * Edit the **Contact Person Name** and **Contact Email** manually if you find better info.
  * **Email Guesser**: If you enter a contact name, it dynamically generates professional email patterns based on the business's domain. Click a pattern to copy it and set it as the lead's email.
  * **Outreach Status**: Move leads through a pipeline: `New` ➔ `Contacted` ➔ `Replied` ➔ `Won` ➔ `Not Interested`. Changes are saved instantly to the database.
  * **Internal Notes**: Add log entries about phone calls, custom requirements, or follow-ups.
  * **Email Composer**: Select a template (No Website, Broken Website, Slow Website). The app compiles a customized email draft with placeholders. Click **Send Email** to open your local mail client with the draft, or **Copy Draft** to copy it.
  * **Call Business**: Click to trigger a call via `tel:` protocol.
* **Website Audit Tab**:
  * View the PageSpeed score gauge (visual ring).
  * See the checklist of standard checks (HTTPS, Viewport, Copyright) with status icons.
  * Read the detailed audit notes summarizing all flaws.

### 5. Import & Export
* **Export CSV**: Downloads your current filtered lead list as a clean CSV, ready for external email tools.
* **Import CSV**: Allows you to import an existing CSV. Lead Tracker parses the CSV and uploads the leads directly into the SQLite database, ensuring they are saved and deduplicated.
