// State Management
let leads = [];
let filteredLeads = [];
let selectedLead = null;
let activeFilters = {
  website: 'all',
  outreach: 'all',
  search: ''
};
let isScanning = false;
let scanPollInterval = null;

// DOM Elements
const csvUploadInput = document.getElementById('csv-upload-input');
const tableBody = document.getElementById('leads-table-body');
const searchInput = document.getElementById('search-input');
const filterWebsiteBtns = document.querySelectorAll('#filter-website .filter-btn');
const filterOutreachBtns = document.querySelectorAll('#filter-outreach .filter-btn');

// Scanner Elements
const scanLocationInput = document.getElementById('scan-location');
const scanCategoryInput = document.getElementById('scan-category');
const scanApiKeyInput = document.getElementById('scan-api-key');
const btnStartScan = document.getElementById('btn-start-scan');
const scanProgressContainer = document.getElementById('scan-progress-container');
const scanProgressMessage = document.getElementById('scan-progress-message');
const scanProgressBarFill = document.getElementById('scan-progress-bar-fill');
const scanProgressPercent = document.getElementById('scan-progress-percent');

// Stats Elements
const statTotalLeads = document.getElementById('stat-total-leads');
const statProspects = document.getElementById('stat-prospects');
const statNeedsUpgrade = document.getElementById('stat-needs-upgrade');
const statWon = document.getElementById('stat-won');

// Details Panel Elements
const detailsPanel = document.getElementById('details-panel');
const detailsEmptyState = document.getElementById('details-empty-state');
const detailsContent = document.getElementById('details-content');
const detailName = document.getElementById('detail-name');
const detailCategoryBadge = document.getElementById('detail-category-badge');
const detailCountryBadge = document.getElementById('detail-country-badge');
const detailAddress = document.getElementById('detail-address');
const detailPhone = document.getElementById('detail-phone');
const detailMapsUrl = document.getElementById('detail-maps-url');

// CRM Tab Elements
const detailContactName = document.getElementById('detail-contact-name');
const detailContactEmail = document.getElementById('detail-contact-email');
const detailEmailConfidence = document.getElementById('detail-email-confidence');
const emailGuesserBox = document.getElementById('email-guesser-box');
const emailsListContainer = document.getElementById('emails-list-container');
const detailOutreachStatus = document.getElementById('detail-outreach-status');
const detailNotes = document.getElementById('detail-notes');
const btnSaveCrm = document.getElementById('btn-save-crm');
const btnDeleteLead = document.getElementById('btn-delete-lead');

// Audit Tab Elements
const detailWebsiteBadge = document.getElementById('detail-website-badge');
const detailLoadTime = document.getElementById('detail-load-time');
const detailCopyrightYear = document.getElementById('detail-copyright-year');
const detailAuditNotes = document.getElementById('detail-audit-notes');
const scoreRingFill = document.getElementById('score-ring-fill');
const scoreRingText = document.getElementById('score-ring-text');
const chkHttps = document.getElementById('chk-https');
const chkViewport = document.getElementById('chk-viewport');
const chkCopyright = document.getElementById('chk-copyright');

// Tab Navigation
const tabButtons = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

// Outreach Elements
const templateSelect = document.getElementById('template-select');
const templateBody = document.getElementById('template-body');
const btnCopyTemplate = document.getElementById('btn-copy-template');
const btnSendEmail = document.getElementById('btn-send-email');
const btnCallPhone = document.getElementById('btn-call-phone');

// Export Elements
const btnExportCsv = document.getElementById('btn-export-csv');

// Toast Notification Elements
const toast = document.getElementById('toast-notification');
const toastMessage = document.getElementById('toast-message');

// Email Templates
const templates = {
  'no-website': {
    subject: `Web design & online growth for {{BUSINESS_NAME}}`,
    body: `Hi {{OWNER_NAME}},

I hope you're doing well!

I was recently looking for local {{CATEGORY}} in the area, and {{BUSINESS_NAME}} came up with great reviews. However, I noticed that you don't have a website listed on your Google profile.

In today's market, over 80% of customers look up local businesses online before visiting. Having a clean, fast, mobile-friendly website would help you:
• Rank higher on Google search results
• Let customers view your services/menu 24/7
• Drive more direct bookings/inquiries

I run a web development agency and specialize in building high-performing websites for local businesses. I'd love to build a custom, modern website for {{BUSINESS_NAME}} to help you attract more customers.

Are you available for a quick 5-minute call this week to discuss how we can help grow your online presence?

Best regards,

[Your Name]
[Your Phone Number]
[Your Portfolio Link]`
  },
  'broken-website': {
    subject: `Urgent: Website issue for {{BUSINESS_NAME}}`,
    body: `Hi {{OWNER_NAME}},

I hope you're having a great day!

I came across {{BUSINESS_NAME}} on Google while looking for local services. I tried to visit your website ({{WEBSITE}}), but it seems to be down or returning an error.

A broken link can turn away potential customers who might think the business is closed, and it also hurts your Google search rankings. 

I wanted to reach out and offer a hand. I am a local web developer, and I can quickly diagnose and fix the issue with your site, or help you transition to a modern, reliable platform so you don't lose out on any customers.

Would you be open to a quick call to get this sorted out?

Best regards,

[Your Name]
[Your Phone Number]
[Your Portfolio Link]`
  },
  'slow-website': {
    subject: `Improving online bookings for {{BUSINESS_NAME}}`,
    body: `Hi {{OWNER_NAME}},

I hope you're doing well!

I found {{BUSINESS_NAME}} on Google and was looking through your website ({{WEBSITE}}). You have fantastic ratings and reviews, but I noticed a few things on your site that might be causing you to miss out on new customers:
• The site takes a few seconds to load (most visitors leave if a page takes more than 3 seconds)
• It's a bit difficult to navigate on mobile devices
• There is no clear, easy way for customers to book or contact you directly

I build modern, lightning-fast websites that are fully optimized for mobile and designed to convert visitors into paying clients. I'd love to show you a quick mockup of how we can refresh {{BUSINESS_NAME}}'s website to match the premium quality of your physical business.

Do you have 5 minutes for a brief chat this week?

Best regards,

[Your Name]
[Your Phone Number]
[Your Portfolio Link]`
  }
};

// --- INITIALIZATION ---
window.addEventListener('DOMContentLoaded', () => {
  loadSavedApiKey();
  fetchLeads();
  checkScanStatus();
});

function loadSavedApiKey() {
  const savedKey = localStorage.getItem('google_places_api_key');
  if (savedKey) {
    scanApiKeyInput.value = savedKey;
  }
}

const API_BASE = window.location.port === '8000' 
  ? '' 
  : (window.location.protocol === 'file:' 
     ? 'http://localhost:8000' 
     : `${window.location.protocol}//${window.location.hostname || 'localhost'}:8000`);

// Helper for safe fetch and JSON parsing
async function safeFetchJson(url, options = {}) {
  const targetUrl = url.startsWith('http') ? url : `${API_BASE}${url}`;
  const response = await fetch(targetUrl, options);
  const contentType = response.headers.get('content-type') || '';
  
  let data = null;
  if (contentType.includes('application/json')) {
    const text = await response.text();
    if (text.trim()) {
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error('Failed to parse JSON response:', e);
      }
    }
  } else {
    const text = await response.text();
    if (text.trim()) {
      data = { error: text };
    }
  }
  
  if (!response.ok) {
    const errorMsg = (data && data.error) ? data.error : `Request failed with status ${response.status}`;
    throw new Error(errorMsg);
  }
  
  return data;
}

// --- API CALLS ---
async function fetchLeads() {
  try {
    leads = await safeFetchJson('/api/leads') || [];
    filteredLeads = [...leads];
    updateStats();
    renderTable();
  } catch (error) {
    console.error(error);
    showToast(`Error loading leads: ${error.message}`);
  }
}

async function checkScanStatus() {
  try {
    const data = await safeFetchJson('/api/search/status');
    if (!data) return;
    
    if (data.status === 'scanning') {
      isScanning = true;
      btnStartScan.disabled = true;
      btnStartScan.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Scanning...`;
      scanProgressContainer.style.display = 'block';
      updateProgressUI(data.percentage, data.message);
      
      // Start polling
      if (!scanPollInterval) {
        scanPollInterval = setInterval(pollScanStatus, 1500);
      }
    }
  } catch (error) {
    console.error('Error checking scan status:', error);
  }
}

async function pollScanStatus() {
  try {
    const data = await safeFetchJson('/api/search/status');
    if (!data) return;
    
    updateProgressUI(data.percentage, data.message);
    
    if (data.status === 'completed') {
      clearInterval(scanPollInterval);
      scanPollInterval = null;
      isScanning = false;
      
      btnStartScan.disabled = false;
      btnStartScan.innerHTML = `<i class="fa-solid fa-play"></i> Start Scan`;
      showToast('Scan completed successfully!');
      
      // Hide progress bar after a delay
      setTimeout(() => {
        scanProgressContainer.style.display = 'none';
      }, 5000);
      
      fetchLeads();
    } else if (data.status === 'error') {
      clearInterval(scanPollInterval);
      scanPollInterval = null;
      isScanning = false;
      
      btnStartScan.disabled = false;
      btnStartScan.innerHTML = `<i class="fa-solid fa-play"></i> Start Scan`;
      showToast(`Scan Error: ${data.message}`);
    }
  } catch (error) {
    console.error('Error polling status:', error);
  }
}

function updateProgressUI(percent, message) {
  scanProgressBarFill.style.width = `${percent}%`;
  scanProgressPercent.textContent = `${percent}%`;
  scanProgressMessage.textContent = message;
}

// --- SCANNER TRIGGER ---
btnStartScan.addEventListener('click', async () => {
  const location = scanLocationInput.value.trim();
  const category = scanCategoryInput.value.trim();
  const apiKey = scanApiKeyInput.value.trim();

  if (!location || !category) {
    showToast('Please enter both Location and Category.');
    return;
  }

  // Save API key if provided
  if (apiKey) {
    localStorage.setItem('google_places_api_key', apiKey);
  }

  try {
    btnStartScan.disabled = true;
    btnStartScan.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Initializing...`;
    
    const data = await safeFetchJson('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ location, category, api_key: apiKey })
    });
    
    showToast('Background scan started!');
    scanProgressContainer.style.display = 'block';
    updateProgressUI(0, 'Starting scan pipeline...');
    
    isScanning = true;
    scanPollInterval = setInterval(pollScanStatus, 1500);
  } catch (error) {
    btnStartScan.disabled = false;
    btnStartScan.innerHTML = `<i class="fa-solid fa-play"></i> Start Scan`;
    showToast(error.message);
  }
});

// --- STATS UPDATE ---
function updateStats() {
  statTotalLeads.textContent = leads.length;
  
  const prospects = leads.filter(l => {
    const st = (l.website_status || '').toLowerCase();
    return st === 'no website' || st === 'dead link';
  }).length;
  statProspects.textContent = prospects;
  
  const needsUpgrade = leads.filter(l => (l.website_status || '').toLowerCase() === 'needs improvement').length;
  statNeedsUpgrade.textContent = needsUpgrade;

  const won = leads.filter(l => (l.outreach_status || '').toLowerCase() === 'won').length;
  statWon.textContent = won;
}

// --- RENDER LEADS TABLE ---
function renderTable() {
  const container = document.querySelector('.table-container');
  const scrollTop = container ? container.scrollTop : 0;
  const scrollLeft = container ? container.scrollLeft : 0;

  tableBody.innerHTML = '';
  
  if (filteredLeads.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; padding: 4rem; color: var(--text-muted);">
          No leads match the current filters.
        </td>
      </tr>
    `;
    return;
  }

  filteredLeads.forEach((lead) => {
    const tr = document.createElement('tr');
    tr.setAttribute('data-id', lead.id);
    if (selectedLead && selectedLead.id === lead.id) {
      tr.classList.add('selected');
    }

    // Website Status Badge
    const status = lead.website_status || 'No Website';
    let statusClass = 'no-website';
    let iconClass = 'fa-circle-xmark';
    
    if (status === 'Good') {
      statusClass = 'good';
      iconClass = 'fa-circle-check';
    } else if (status === 'Needs Improvement') {
      statusClass = 'needs-improvement';
      iconClass = 'fa-triangle-exclamation';
    } else if (status === 'Dead Link') {
      statusClass = 'dead-link';
      iconClass = 'fa-link-slash';
    }

    const statusBadge = `<span class="badge ${statusClass}"><i class="fa-solid ${iconClass}"></i> ${status}</span>`;

    // Outreach Status Badge
    const outreach = lead.outreach_status || 'New';
    let outreachClass = 'badge';
    if (outreach === 'Won') outreachClass += ' has-website'; // green
    else if (outreach === 'Contacted') outreachClass += ' needs-improvement'; // yellow
    else if (outreach === 'Replied') outreachClass += ' good'; // cyan
    else outreachClass += ' no-website'; // grey/red
    
    const outreachBadge = `<span class="${outreachClass}" style="text-transform: capitalize;">${outreach}</span>`;

    tr.innerHTML = `
      <td style="font-weight: 600;">${lead.business_name || 'Unknown'}</td>
      <td>
        <div style="font-size: 0.85rem; font-weight: 500;">${lead.category || 'N/A'}</div>
        <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.1rem;">${lead.city_region || 'N/A'}</div>
      </td>
      <td>${lead.phone || '<span style="color: var(--text-muted)">None</span>'}</td>
      <td>${statusBadge}</td>
      <td>${outreachBadge}</td>
    `;

    tr.addEventListener('click', () => selectLead(lead, tr));
    tableBody.appendChild(tr);
  });

  if (container) {
    container.scrollTop = scrollTop;
    container.scrollLeft = scrollLeft;
  }
}

// --- FILTER & SEARCH ---
function filterAndSearch() {
  filteredLeads = leads.filter(lead => {
    // 1. Search Query
    if (activeFilters.search) {
      const q = activeFilters.search.toLowerCase();
      const nameMatch = (lead.business_name || '').toLowerCase().includes(q);
      const addressMatch = (lead.full_address || '').toLowerCase().includes(q);
      const categoryMatch = (lead.category || '').toLowerCase().includes(q);
      const phoneMatch = (lead.phone || '').toLowerCase().includes(q);
      if (!nameMatch && !addressMatch && !categoryMatch && !phoneMatch) return false;
    }

    // 2. Website Status Filter
    if (activeFilters.website !== 'all') {
      const status = (lead.website_status || 'No Website').toLowerCase().replace(/\s+/g, '_');
      if (activeFilters.website === 'no_website' && status !== 'no_website') return false;
      if (activeFilters.website === 'dead_link' && status !== 'dead_link') return false;
      if (activeFilters.website === 'needs_improvement' && status !== 'needs_improvement') return false;
      if (activeFilters.website === 'good' && status !== 'good') return false;
    }

    // 3. Outreach Status Filter
    if (activeFilters.outreach !== 'all') {
      const status = lead.outreach_status || 'New';
      if (activeFilters.outreach.toLowerCase() !== status.toLowerCase()) return false;
    }

    return true;
  });

  renderTable();
}

// Search input
searchInput.addEventListener('input', (e) => {
  activeFilters.search = e.target.value;
  filterAndSearch();
});

// Website Filters
filterWebsiteBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    filterWebsiteBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeFilters.website = btn.getAttribute('data-filter');
    filterAndSearch();
  });
});

// Outreach Filters
filterOutreachBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    filterOutreachBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeFilters.outreach = btn.getAttribute('data-filter');
    filterAndSearch();
  });
});

// --- TAB NAVIGATION ---
tabButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    tabButtons.forEach(b => {
      b.classList.remove('active');
      b.style.borderBottom = 'none';
      b.style.color = 'var(--text-secondary)';
    });
    
    btn.classList.add('active');
    btn.style.borderBottom = '2px solid var(--accent-primary)';
    btn.style.color = 'var(--text-primary)';
    
    const targetTab = btn.getAttribute('data-tab');
    tabContents.forEach(content => {
      if (content.id === targetTab) {
        content.style.display = 'block';
      } else {
        content.style.display = 'none';
      }
    });
  });
});

// --- LEAD SELECTION & SIDEBAR POPULATION ---
function selectLead(lead, rowEl) {
  selectedLead = lead;
  
  // Highlight selected row
  document.querySelectorAll('#leads-table-body tr').forEach(r => r.classList.remove('selected'));
  if (rowEl) {
    rowEl.classList.add('selected');
  }

  // Show details panel
  detailsEmptyState.style.display = 'none';
  detailsContent.style.display = 'block';

  // Basic Info
  detailName.textContent = lead.business_name;
  detailCategoryBadge.textContent = lead.category || 'N/A';
  detailCountryBadge.textContent = lead.country || 'USA';
  detailAddress.textContent = lead.full_address || 'No address listed';
  detailPhone.textContent = lead.phone || 'No phone number listed';
  
  if (lead.phone) {
    btnCallPhone.href = `tel:${lead.phone.replace(/[^+\d]/g, '')}`;
    btnCallPhone.style.display = 'inline-flex';
  } else {
    btnCallPhone.removeAttribute('href');
    btnCallPhone.style.display = 'none';
  }

  // Maps URL
  // If maps URL is not saved, generate a search URL
  const mapSearch = lead.google_maps_url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lead.business_name + ' ' + (lead.full_address || ''))}`;
  detailMapsUrl.href = mapSearch;

  // CRM Tab
  detailContactName.value = lead.contact_name && lead.contact_name !== 'Not Found' ? lead.contact_name : '';
  detailContactEmail.value = lead.contact_email && lead.contact_email !== 'Not Found' ? lead.contact_email : '';
  
  // Email Confidence
  const conf = lead.email_confidence || 'Not Found';
  detailEmailConfidence.textContent = conf;
  detailEmailConfidence.className = 'badge';
  if (conf === 'Confirmed') detailEmailConfidence.classList.add('good');
  else if (conf === 'Guessed') detailEmailConfidence.classList.add('needs-improvement');
  else detailEmailConfidence.classList.add('no-website');

  detailOutreachStatus.value = lead.outreach_status || 'New';
  detailNotes.value = lead.notes || '';

  // Website Audit Tab
  const website = lead.website_url || '';
  if (website) {
    // Website Badge
    const status = lead.website_status || 'Good';
    let badgeClass = 'good';
    if (status === 'Needs Improvement') badgeClass = 'needs-improvement';
    else if (status === 'Dead Link') badgeClass = 'dead-link';
    
    detailWebsiteBadge.innerHTML = `
      <span class="badge ${badgeClass}" style="margin-bottom: 0.5rem;"><i class="fa-solid fa-link"></i> ${status}</span>
      <div style="font-size: 0.85rem;"><a href="${website}" target="_blank">${website} <i class="fa-solid fa-arrow-up-right-from-square"></i></a></div>
    `;
    
    // PageSpeed Gauge
    const score = lead.pagespeed_score;
    if (score !== null && score !== undefined) {
      scoreRingText.textContent = score;
      // SVG dashoffset calculation: circumference is 2 * pi * r = 2 * 3.14159 * 15.9155 = 100
      scoreRingFill.style.strokeDasharray = `${score}, 100`;
      
      // Color coding
      if (score >= 90) {
        scoreRingFill.style.stroke = 'var(--success)';
      } else if (score >= 50) {
        scoreRingFill.style.stroke = 'var(--warning)';
      } else {
        scoreRingFill.style.stroke = 'var(--error)';
      }
    } else {
      scoreRingText.textContent = 'N/A';
      scoreRingFill.style.strokeDasharray = '0, 100';
      scoreRingFill.style.stroke = 'var(--border-color)';
    }

    // Load Time
    detailLoadTime.textContent = lead.load_time ? `${lead.load_time}s` : 'N/A';
    
    // Copyright Year
    detailCopyrightYear.textContent = lead.copyright_year || 'N/A';

    // Checklist
    updateChecklistIcon(chkHttps, lead.has_https);
    updateChecklistIcon(chkViewport, lead.has_viewport);
    
    const currentYear = new Date().getFullYear();
    const copyrightOk = lead.copyright_year && lead.copyright_year >= (currentYear - 1);
    updateChecklistIcon(chkCopyright, copyrightOk ? 1 : 0);

    // Audit Notes
    detailAuditNotes.textContent = lead.audit_notes || 'No audit details available.';
    detailAuditNotes.style.borderColor = status === 'Good' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)';
    detailAuditNotes.style.color = status === 'Good' ? '#6ee7b7' : '#fca5a5';
    detailAuditNotes.style.background = status === 'Good' ? 'rgba(16, 185, 129, 0.03)' : 'rgba(239, 68, 68, 0.03)';
  } else {
    detailWebsiteBadge.innerHTML = `<span class="badge no-website"><i class="fa-solid fa-circle-xmark"></i> No Website Listed</span>`;
    scoreRingText.textContent = 'N/A';
    scoreRingFill.style.strokeDasharray = '0, 100';
    scoreRingFill.style.stroke = 'var(--border-color)';
    detailLoadTime.textContent = 'N/A';
    detailCopyrightYear.textContent = 'N/A';
    
    updateChecklistIcon(chkHttps, -1);
    updateChecklistIcon(chkViewport, -1);
    updateChecklistIcon(chkCopyright, -1);
    
    detailAuditNotes.textContent = 'This business has no website to audit. A brand new website is highly recommended.';
    detailAuditNotes.style.borderColor = 'rgba(239, 68, 68, 0.1)';
    detailAuditNotes.style.color = '#fca5a5';
    detailAuditNotes.style.background = 'rgba(239, 68, 68, 0.03)';
  }

  // Pre-select Email template
  if (!website) {
    templateSelect.value = 'no-website';
  } else if (lead.website_status === 'Dead Link') {
    templateSelect.value = 'broken-website';
  } else {
    templateSelect.value = 'slow-website';
  }

  // Setup Email Guesser & Composer
  updateEmailGuesser();
  updateEmailComposer();
}

function updateChecklistIcon(element, val) {
  const icon = element.querySelector('i');
  icon.className = 'fa-solid';
  if (val === 1) {
    icon.classList.add('fa-circle-check', 'success-icon');
  } else if (val === 0) {
    icon.classList.add('fa-circle-xmark', 'error-icon');
  } else {
    icon.classList.add('fa-circle-question');
    icon.style.color = 'var(--text-muted)';
  }
}

// --- EMAIL GUESSER ---
function updateEmailGuesser() {
  if (!selectedLead) return;
  
  const nameInput = detailContactName.value.trim();
  let domain = '';
  
  if (selectedLead.website_url) {
    domain = extractDomain(selectedLead.website_url);
  } else {
    domain = slugify(selectedLead.business_name) + '.com';
  }

  if (!nameInput) {
    emailGuesserBox.style.display = 'none';
    return;
  }

  emailGuesserBox.style.display = 'block';
  emailsListContainer.innerHTML = '';
  
  // Split name into first and last
  const parts = nameInput.split(/\s+/);
  const first = parts[0] || '';
  const last = parts.slice(1).join('') || '';
  
  const guessed = getGuessedEmailPatterns(domain, first, last);
  
  guessed.forEach(email => {
    const div = document.createElement('div');
    div.className = 'email-item';
    div.innerHTML = `
      <span>${email}</span>
      <button title="Use & Copy Email"><i class="fa-regular fa-copy"></i></button>
    `;
    div.querySelector('button').addEventListener('click', (e) => {
      e.stopPropagation();
      detailContactEmail.value = email;
      detailEmailConfidence.textContent = 'Guessed';
      detailEmailConfidence.className = 'badge needs-improvement';
      navigator.clipboard.writeText(email);
      showToast(`Set and copied email: ${email}`);
      updateEmailComposer();
    });
    emailsListContainer.appendChild(div);
  });
}

function extractDomain(url) {
  try {
    let hostname = new URL(url).hostname;
    return hostname.replace(/^www\./, '');
  } catch (e) {
    return url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
  }
}

function slugify(text) {
  return text.toLowerCase().replace(/\s+/g, '').replace(/[^\w\-]+/g, '');
}

function getGuessedEmailPatterns(domain, first, last) {
  const d = domain.toLowerCase();
  let patterns = [`info@${d}`, `contact@${d}`, `hello@${d}`];
  
  if (first) {
    const fn = first.toLowerCase();
    patterns.push(`${fn}@${d}`);
    if (last) {
      const ln = last.toLowerCase();
      patterns.push(`${fn}.${ln}@${d}`);
      patterns.push(`${fn}${ln}@${d}`);
      patterns.push(`${fn[0]}${ln}@${d}`);
    }
  }
  return [...new Set(patterns)];
}

// Link email guesser to name typing
detailContactName.addEventListener('input', updateEmailGuesser);

// --- CRM SAVE & DELETE ---
btnSaveCrm.addEventListener('click', async () => {
  if (!selectedLead) return;
  
  const updatedData = {
    contact_name: detailContactName.value.trim() || 'Not Found',
    contact_email: detailContactEmail.value.trim() || 'Not Found',
    outreach_status: detailOutreachStatus.value,
    notes: detailNotes.value.trim(),
    email_confidence: detailEmailConfidence.textContent
  };

  try {
    const data = await safeFetchJson(`/api/leads/${selectedLead.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedData)
    });
    
    // Update local state
    const index = leads.findIndex(l => l.id === selectedLead.id);
    if (index !== -1 && data && data.lead) {
      leads[index] = data.lead;
      selectedLead = data.lead;
      filterAndSearch();
      updateStats();
    }
    
    showToast('Lead details saved successfully!');
  } catch (error) {
    console.error(error);
    showToast('Error saving lead details.');
  }
});

btnDeleteLead.addEventListener('click', async () => {
  if (!selectedLead) return;
  
  if (!confirm(`Are you sure you want to delete "${selectedLead.business_name}"?`)) {
    return;
  }

  try {
    await safeFetchJson(`/api/leads/${selectedLead.id}`, {
      method: 'DELETE'
    });
    
    showToast('Lead deleted successfully.');
    
    // Clear selection
    selectedLead = null;
    detailsEmptyState.style.display = 'flex';
    detailsContent.style.display = 'none';
    
    fetchLeads();
  } catch (error) {
    console.error(error);
    showToast('Error deleting lead.');
  }
});

// --- OUTREACH EMAIL COMPOSER ---
function updateEmailComposer() {
  if (!selectedLead) return;

  const templateType = templateSelect.value;
  const templateObj = templates[templateType] || templates['no-website'];
  
  const ownerName = detailContactName.value.trim() || 'there';
  const bizName = selectedLead.business_name || 'your business';
  const catName = selectedLead.category || 'business';
  const siteUrl = selectedLead.website_url || '[Website URL]';

  let body = templateObj.body
    .replace(/{{OWNER_NAME}}/g, ownerName)
    .replace(/{{BUSINESS_NAME}}/g, bizName)
    .replace(/{{CATEGORY}}/g, catName)
    .replace(/{{WEBSITE}}/g, siteUrl);

  let subject = templateObj.subject
    .replace(/{{BUSINESS_NAME}}/g, bizName);

  templateBody.innerHTML = `<strong>Subject:</strong> ${subject}\n\n${body}`;

  // Set up Send Email button action
  const emailTo = detailContactEmail.value.trim();
  const emailVal = (emailTo && emailTo !== 'Not Found') ? emailTo : '';
  
  btnSendEmail.onclick = () => {
    const mailtoUrl = `mailto:${emailVal}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoUrl, '_blank');
    
    // Automatically set status to Contacted if it was New
    if (detailOutreachStatus.value === 'New') {
      detailOutreachStatus.value = 'Contacted';
      btnSaveCrm.click();
    }
  };
}

templateSelect.addEventListener('change', updateEmailComposer);
detailContactEmail.addEventListener('input', updateEmailComposer);

btnCopyTemplate.addEventListener('click', () => {
  const text = templateBody.textContent;
  navigator.clipboard.writeText(text);
  showToast('Email draft copied to clipboard!');
});

// --- IMPORT CSV ---
csvUploadInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async function(evt) {
    try {
      const contents = evt.target.result;
      const parsed = parseCSV(contents);
      
      if (parsed.length === 0) {
        showToast('Error: CSV is empty or invalid.');
        return;
      }

      showToast(`Importing ${parsed.length} leads to database...`);
      
      // Upload each parsed lead to the server
      let importedCount = 0;
      for (const item of parsed) {
        // Map CSV fields to database schema
        const lead_data = {
          id: item.id || item.lead_id || hashString(item.business_name + (item.phone || '')),
          business_name: item.business_name || item.name || 'Unknown',
          category: item.category || 'N/A',
          country: item.country || 'USA',
          city_region: item.city_region || item.location || 'N/A',
          full_address: item.full_address || item.address || '',
          phone: item.phone || '',
          website_url: item.website_url || item.website || '',
          website_status: item.website_status || (item.has_website && item.has_website.toLowerCase() === 'yes' ? 'Good' : 'No Website'),
          pagespeed_score: item.pagespeed_score ? parseInt(item.pagespeed_score) : null,
          mobile_score: item.mobile_score ? parseInt(item.mobile_score) : null,
          load_time: item.load_time ? parseFloat(item.load_time) : null,
          has_https: item.has_https ? parseInt(item.has_https) : 0,
          has_viewport: item.has_viewport ? parseInt(item.has_viewport) : 0,
          copyright_year: item.copyright_year ? parseInt(item.copyright_year) : null,
          audit_notes: item.audit_notes || item.notes || '',
          contact_name: item.contact_name || 'Not Found',
          contact_email: item.contact_email || 'Not Found',
          email_confidence: item.email_confidence || 'Not Found',
          outreach_status: item.outreach_status || 'New',
          notes: item.notes || ''
        };

        try {
          await safeFetchJson(`/api/leads/${lead_data.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(lead_data)
          });
          importedCount++;
        } catch (e) {
          console.error(`Failed to import lead: ${lead_data.business_name}`, e);
        }
      }

      showToast(`Successfully imported ${importedCount} of ${parsed.length} leads!`);
      fetchLeads();
    } catch (err) {
      console.error(err);
      showToast('Error parsing or importing CSV.');
    }
  };
  reader.readAsText(file);
});

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  return 'imported_' + Math.abs(hash).toString(16);
}

// Simple CSV Parser
function parseCSV(text) {
  const lines = [];
  let row = [""];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    let c = text[i];
    let next = text[i + 1];
    if (c === '"') {
      if (inQuotes && next === '"') {
        row[row.length - 1] += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      row.push('');
    } else if ((c === '\r' || c === '\n') && !inQuotes) {
      if (c === '\r' && next === '\n') {
        i++;
      }
      lines.push(row);
      row = [''];
    } else {
      row[row.length - 1] += c;
    }
  }
  if (row.length > 1 || row[0] !== '') {
    lines.push(row);
  }

  if (lines.length === 0) return [];

  const headers = lines[0].map(h => h.trim().toLowerCase().replace(/[\s_]+/g, '_'));
  const parsedData = [];

  for (let i = 1; i < lines.length; i++) {
    const rowData = lines[i];
    if (rowData.length < headers.length || (rowData.length === 1 && rowData[0] === '')) continue;
    
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = rowData[index] ? rowData[index].trim() : '';
    });
    parsedData.push(obj);
  }

  return parsedData;
}

// --- EXPORT CSV ---
btnExportCsv.addEventListener('click', () => {
  if (filteredLeads.length === 0) {
    showToast('No leads available to export.');
    return;
  }

  const headers = [
    'Lead ID', 'Business Name', 'Category', 'Country', 'City/Region', 'Address',
    'Phone', 'Website URL', 'Website Status', 'PageSpeed Score', 'Load Time',
    'HTTPS', 'Mobile Viewport', 'Copyright Year', 'Contact Name', 'Contact Email',
    'Email Confidence', 'Outreach Status', 'Notes', 'Date Found'
  ];

  const csvRows = [];
  csvRows.push(headers.join(','));

  filteredLeads.forEach(lead => {
    const values = [
      lead.id,
      escapeCsvValue(lead.business_name),
      escapeCsvValue(lead.category),
      escapeCsvValue(lead.country),
      escapeCsvValue(lead.city_region),
      escapeCsvValue(lead.full_address),
      escapeCsvValue(lead.phone),
      escapeCsvValue(lead.website_url),
      escapeCsvValue(lead.website_status),
      lead.pagespeed_score || '',
      lead.load_time || '',
      lead.has_https || 0,
      lead.has_viewport || 0,
      lead.copyright_year || '',
      escapeCsvValue(lead.contact_name),
      escapeCsvValue(lead.contact_email),
      escapeCsvValue(lead.email_confidence),
      escapeCsvValue(lead.outreach_status),
      escapeCsvValue(lead.notes),
      lead.date_found
    ];
    csvRows.push(values.join(','));
  });

  const csvContent = "data:text/csv;charset=utf-8," + csvRows.join("\n");
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `lead_tracker_leads_${new Date().toISOString().slice(0,10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('Leads exported successfully!');
});

function escapeCsvValue(val) {
  if (val === undefined || val === null) return '';
  let str = val.toString();
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    str = str.replace(/"/g, '""');
    return `"${str}"`;
  }
  return str;
}

// --- UTILITIES ---
function showToast(message) {
  toastMessage.textContent = message;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}
