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
let currentMainView = 'all'; // 'all', 'priority', 'history'

// DOM Elements
const csvUploadInput = document.getElementById('csv-upload-input');
const tableBody = document.getElementById('leads-table-body');
const searchInput = document.getElementById('search-input');
const filterWebsiteBtns = document.querySelectorAll('#filter-website .filter-btn');
const filterOutreachBtns = document.querySelectorAll('#filter-outreach .filter-btn');

// Pagination Elements
const btnPrevPage = document.getElementById('btn-prev-page');
const btnNextPage = document.getElementById('btn-next-page');
const pageIndicator = document.getElementById('page-indicator');
const paginationInfoText = document.getElementById('pagination-info-text');

let currentPage = 1;
const itemsPerPage = 10;

// Scanner Elements
const scanCountrySelect = document.getElementById('scan-country');
const scanStateSelect = document.getElementById('scan-state');
const scanCitySelect = document.getElementById('scan-city');
const scanAreaInput = document.getElementById('scan-area');
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

let countryData = [];

async function loadCountryData() {
  try {
    countryData = await safeFetchJson('/countries_states.json') || [];
    
    // Populate Country dropdown
    scanCountrySelect.innerHTML = '';
    
    // Sort countries by name alphabetically
    countryData.sort((a, b) => a.countryName.localeCompare(b.countryName));
    
    countryData.forEach(country => {
      const opt = document.createElement('option');
      opt.value = country.countryShortCode;
      opt.textContent = country.countryName;
      scanCountrySelect.appendChild(opt);
    });
    
    // Select India (IN) as default if present
    const defaultIndex = countryData.findIndex(c => c.countryShortCode === 'IN');
    if (defaultIndex !== -1) {
      scanCountrySelect.selectedIndex = defaultIndex;
    } else {
      // Default to US if India not found
      const usIndex = countryData.findIndex(c => c.countryShortCode === 'US');
      if (usIndex !== -1) scanCountrySelect.selectedIndex = usIndex;
    }
    
    populateStates();
  } catch (error) {
    console.error('Failed to load country/state data:', error);
  }
}

function populateStates() {
  const selectedCountryCode = scanCountrySelect.value;
  const country = countryData.find(c => c.countryShortCode === selectedCountryCode);
  scanStateSelect.innerHTML = '';
  
  if (country && country.regions) {
    // Sort regions alphabetically
    const sortedRegions = [...country.regions].sort((a, b) => a.name.localeCompare(b.name));
    
    sortedRegions.forEach(region => {
      const opt = document.createElement('option');
      opt.value = region.name;
      opt.textContent = region.name;
      scanStateSelect.appendChild(opt);
    });
  }
  
  if (scanStateSelect.children.length === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'No subdivisions';
    scanStateSelect.appendChild(opt);
  }

  // Populate cities for the selected state
  populateCities();
}

async function populateCities() {
  const countryName = scanCountrySelect.options[scanCountrySelect.selectedIndex].text;
  const stateName = scanStateSelect.value;
  
  scanCitySelect.innerHTML = '<option value="">Loading cities...</option>';
  
  if (!countryName || !stateName || stateName === 'No subdivisions' || stateName === '') {
    scanCitySelect.innerHTML = '<option value="">No cities available</option>';
    return;
  }
  
  try {
    const response = await fetch('https://countriesnow.space/api/v0.1/countries/state/cities', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        country: countryName,
        state: stateName
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch cities');
    }
    
    const resData = await response.json();
    const cities = resData.data || [];
    
    scanCitySelect.innerHTML = '';
    
    if (cities.length === 0) {
      scanCitySelect.innerHTML = '<option value="">No cities found</option>';
      return;
    }
    
    // Sort cities alphabetically
    cities.sort((a, b) => a.localeCompare(b));
    
    cities.forEach(city => {
      const opt = document.createElement('option');
      opt.value = city;
      opt.textContent = city;
      scanCitySelect.appendChild(opt);
    });
  } catch (error) {
    console.error('Error populating cities:', error);
    scanCitySelect.innerHTML = '<option value="">Error loading cities</option>';
  }
}

// --- INITIALIZATION ---
window.addEventListener('DOMContentLoaded', () => {
  loadSavedApiKey();
  fetchLeads();
  checkScanStatus();
  loadCountryData();
  scanCountrySelect.addEventListener('change', populateStates);
  scanStateSelect.addEventListener('change', populateCities);
});

function loadSavedApiKey() {
  const savedKey = localStorage.getItem('google_places_api_key');
  if (savedKey) {
    scanApiKeyInput.value = savedKey;
  }
}

const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_BASE = window.location.protocol === 'file:' 
  ? 'http://localhost:8000' 
  : ((isLocalhost && window.location.port !== '8000') ? 'http://localhost:8000' : '');

// Helper for safe fetch and JSON parsing
async function safeFetchJson(url, options = {}) {
  const targetUrl = (url.startsWith('http') || !url.startsWith('/api/')) ? url : `${API_BASE}${url}`;
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
  const country = scanCountrySelect.options[scanCountrySelect.selectedIndex].text;
  const state = scanStateSelect.value;
  const city = scanCitySelect.value.trim();
  const area = scanAreaInput.value.trim();
  const category = scanCategoryInput.value.trim();
  const apiKey = scanApiKeyInput.value.trim();

  if (!city || !category) {
    showToast('Please select both City and Category.');
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
      body: JSON.stringify({ country, state, city, area, category, api_key: apiKey })
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
        <td colspan="8" style="text-align: center; padding: 4rem; color: var(--text-muted);">
          No leads match the current filters.
        </td>
      </tr>
    `;
    if (pageIndicator) pageIndicator.textContent = 'Page 1 of 1';
    if (paginationInfoText) paginationInfoText.textContent = 'Showing 0 to 0 of 0 leads';
    if (btnPrevPage) btnPrevPage.disabled = true;
    if (btnNextPage) btnNextPage.disabled = true;
    return;
  }

  // Calculate pages
  const totalPages = Math.ceil(filteredLeads.length / itemsPerPage) || 1;
  if (currentPage > totalPages) {
    currentPage = totalPages;
  }
  
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, filteredLeads.length);
  const pageLeads = filteredLeads.slice(startIndex, endIndex);

  // Update pagination indicators
  if (pageIndicator) pageIndicator.textContent = `Page ${currentPage} of ${totalPages}`;
  if (paginationInfoText) paginationInfoText.textContent = `Showing ${startIndex + 1} to ${endIndex} of ${filteredLeads.length} leads`;
  
  if (btnPrevPage) btnPrevPage.disabled = currentPage === 1;
  if (btnNextPage) btnNextPage.disabled = currentPage === totalPages;

  pageLeads.forEach((lead) => {
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

    const websiteLink = lead.website_url 
      ? `<a href="${lead.website_url}" target="_blank" class="table-link" style="color: var(--primary); text-decoration: none;" title="${lead.website_url}"><i class="fa-solid fa-arrow-up-right-from-square"></i> Visit</a>` 
      : '<span style="color: var(--text-muted)">None</span>';

    const phoneValue = lead.phone || '';
    const phoneHTML = phoneValue
      ? `<div style="display: flex; align-items: center; gap: 0.35rem; white-space: nowrap;">
           <span>${phoneValue}</span>
           <button class="copy-cell-btn" data-copy="${phoneValue}" title="Copy Phone Number">
             <i class="fa-regular fa-copy"></i>
           </button>
         </div>`
      : '<span style="color: var(--text-muted)">None</span>';

    const emailValue = (lead.contact_email && lead.contact_email !== 'Not Found') ? lead.contact_email : '';
    const emailHTML = emailValue
      ? `<div style="display: flex; align-items: center; gap: 0.35rem; white-space: nowrap;">
           <span class="table-email" style="font-size: 0.8rem;" title="${emailValue}">${emailValue}</span>
           <button class="copy-cell-btn" data-copy="${emailValue}" title="Copy Email Address">
             <i class="fa-regular fa-copy"></i>
           </button>
         </div>`
      : '<span style="color: var(--text-muted)">None</span>';

    const companyName = lead.business_name || 'Unknown';
    const initials = companyName.charAt(0).toUpperCase();
    const circleColors = ['#2F6FED', '#06b6d4', '#10b981', '#f59e0b', '#7c3aed', '#f43f5e'];
    const colorIndex = initials.charCodeAt(0) % circleColors.length;
    const circleBg = circleColors[colorIndex];

    const isFav = lead.is_favorite === 1 || lead.is_favorite === true;
    const favIconClass = isFav ? 'fa-solid fa-star' : 'fa-regular fa-star';
    const favColor = isFav ? '#f59e0b' : 'var(--text-muted)';

    tr.innerHTML = `
      <td>
        <div class="company-cell">
          <div class="company-logo-circle" style="background-color: ${circleBg};">${initials}</div>
          <div>
            <div class="company-name">${companyName}</div>
            <div class="company-desc">${lead.category || 'N/A'}</div>
          </div>
        </div>
      </td>
      <td>
        <div style="font-size: 0.85rem; font-weight: 500;">${lead.city_region || 'N/A'}</div>
      </td>
      <td>${phoneHTML}</td>
      <td>${emailHTML}</td>
      <td>${websiteLink}</td>
      <td>${statusBadge}</td>
      <td>${outreachBadge}</td>
      <td style="text-align: center; vertical-align: middle; white-space: nowrap;">
        <button class="fav-row-btn" style="background: none; border: none; color: ${favColor}; cursor: pointer; padding: 0.25rem 0.5rem; font-size: 1rem; margin-right: 0.25rem; transition: transform var(--transition-fast);" title="${isFav ? 'Remove from Priority' : 'Mark as Priority'}">
          <i class="${favIconClass}"></i>
        </button>
        <button class="delete-row-btn" style="background: none; border: none; color: var(--error); cursor: pointer; padding: 0.25rem 0.5rem; font-size: 1rem; opacity: 0.7; transition: opacity 0.2s;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.7">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </td>
    `;

    // Add event listener to company name click instead of the whole row
    const companyNameEl = tr.querySelector('.company-name');
    if (companyNameEl) {
      companyNameEl.addEventListener('click', (e) => {
        e.stopPropagation();
        selectLead(lead, tr);
      });
    }
    
    // Add event listeners to copy buttons
    const copyBtns = tr.querySelectorAll('.copy-cell-btn');
    copyBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent row selection
        const textToCopy = btn.getAttribute('data-copy');
        if (textToCopy) {
          navigator.clipboard.writeText(textToCopy).then(() => {
            showToast('Copied to clipboard!');
            // Visual feedback: change icon to checkmark temporarily
            const icon = btn.querySelector('i');
            icon.className = 'fa-solid fa-check';
            icon.style.color = 'var(--success)';
            setTimeout(() => {
              icon.className = 'fa-regular fa-copy';
              icon.style.color = '';
            }, 1500);
          }).catch(err => {
            console.error('Failed to copy: ', err);
            showToast('Failed to copy.');
          });
        }
      });
    });
    
    // Add event listener to delete button
    const deleteBtn = tr.querySelector('.delete-row-btn');
    deleteBtn.addEventListener('click', async (e) => {
      e.stopPropagation(); // Prevent row selection
      if (confirm(`Are you sure you want to delete "${lead.business_name}"?`)) {
        try {
          await safeFetchJson(`/api/leads/${lead.id}`, { method: 'DELETE' });
          showToast('Lead deleted successfully.');
          
          if (selectedLead && selectedLead.id === lead.id) {
            selectedLead = null;
            detailsPanel.style.display = 'none';
            detailsEmptyState.style.display = 'flex';
            detailsContent.style.display = 'none';
          }
          
          fetchLeads();
        } catch (error) {
          console.error(error);
          showToast('Error deleting lead.');
        }
      }
    });

    // Add event listener to favorite button
    const favBtn = tr.querySelector('.fav-row-btn');
    if (favBtn) {
      favBtn.addEventListener('click', async (e) => {
        e.stopPropagation(); // Prevent row selection
        const newFavStatus = !(lead.is_favorite === 1 || lead.is_favorite === true);
        
        try {
          await safeFetchJson(`/api/leads/${lead.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_favorite: newFavStatus })
          });
          
          lead.is_favorite = newFavStatus ? 1 : 0;
          showToast(newFavStatus ? 'Added to Priority list.' : 'Removed from Priority list.');
          
          // Update details modal favorite star if this is the selected lead
          if (selectedLead && selectedLead.id === lead.id) {
            selectedLead.is_favorite = lead.is_favorite;
            updateModalFavStar();
          }
          
          filterAndSearch();
        } catch (error) {
          console.error(error);
          showToast('Error updating priority.');
        }
      });
    }

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

    // 4. Main Tab View (Priority/Favorite Filter)
    if (currentMainView === 'priority') {
      if (lead.is_favorite !== 1 && lead.is_favorite !== true) return false;
    }

    return true;
  });

  currentPage = 1; // Reset to page 1 on new filter
  renderTable();
}

// Search input
searchInput.addEventListener('input', (e) => {
  activeFilters.search = e.target.value;
  filterAndSearch();
});

// Pagination button listeners
if (btnPrevPage) {
  btnPrevPage.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      renderTable();
    }
  });
}

if (btnNextPage) {
  btnNextPage.addEventListener('click', () => {
    const totalPages = Math.ceil(filteredLeads.length / itemsPerPage);
    if (currentPage < totalPages) {
      currentPage++;
      renderTable();
    }
  });
}

// Main View Tabs (Leads, Priority, History)
const mainViewTabs = document.querySelectorAll('#main-view-tabs .header-tab');
mainViewTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    mainViewTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentMainView = tab.getAttribute('data-view');
    
    // Hide/show panels based on active view
    const statsContainer = document.querySelector('.stats-container');
    const scannerCard = document.querySelector('.scanner-card');
    
    if (currentMainView === 'priority') {
      if (statsContainer) statsContainer.style.display = 'none';
      if (scannerCard) scannerCard.style.display = 'none';
    } else {
      if (statsContainer) statsContainer.style.display = 'grid';
      if (scannerCard) scannerCard.style.display = 'flex';
    }
    
    filterAndSearch();
  });
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
    btn.style.borderBottom = '2px solid var(--primary)';
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

  // Show details panel modal overlay
  detailsPanel.style.display = 'flex';
  detailsContent.style.display = 'block';
  detailsEmptyState.style.display = 'none';

  // Update Favorite Star Indicator in modal
  updateModalFavStar();

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
    
    // Clear selection and hide modal
    selectedLead = null;
    detailsPanel.style.display = 'none';
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

// Clear Database Button
const clearDatabaseBtn = document.getElementById('clear-database-btn');
if (clearDatabaseBtn) {
  clearDatabaseBtn.addEventListener('click', async () => {
    if (confirm('WARNING: Are you sure you want to delete ALL leads from the database? This action cannot be undone.')) {
      try {
        await safeFetchJson('/api/leads', { method: 'DELETE' });
        showToast('Database cleared successfully.');
        selectedLead = null;
        detailsPanel.style.display = 'none';
        detailsEmptyState.style.display = 'flex';
        detailsContent.style.display = 'none';
        fetchLeads();
      } catch (error) {
        console.error(error);
        showToast('Error clearing database.');
      }
    }
  });
}

// --- MODAL CLOSE BUTTON & CLICK OUTSIDE ---
const btnCloseModal = document.getElementById('btn-close-modal');
if (btnCloseModal) {
  btnCloseModal.addEventListener('click', () => {
    selectedLead = null;
    detailsPanel.style.display = 'none';
    document.querySelectorAll('#leads-table-body tr').forEach(r => r.classList.remove('selected'));
  });
}

if (detailsPanel) {
  detailsPanel.addEventListener('click', (e) => {
    if (e.target === detailsPanel) {
      selectedLead = null;
      detailsPanel.style.display = 'none';
      document.querySelectorAll('#leads-table-body tr').forEach(r => r.classList.remove('selected'));
    }
  });
}

// --- DETAILS MODAL FAVORITE STAR TOGGLE ---
const btnFavLead = document.getElementById('btn-fav-lead');
if (btnFavLead) {
  btnFavLead.addEventListener('click', async () => {
    if (!selectedLead) return;
    const newFavStatus = !(selectedLead.is_favorite === 1 || selectedLead.is_favorite === true);
    
    try {
      await safeFetchJson(`/api/leads/${selectedLead.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_favorite: newFavStatus })
      });
      
      selectedLead.is_favorite = newFavStatus ? 1 : 0;
      showToast(newFavStatus ? 'Added to Priority list.' : 'Removed from Priority list.');
      
      // Update local array data as well
      const leadObj = leads.find(l => l.id === selectedLead.id);
      if (leadObj) {
        leadObj.is_favorite = selectedLead.is_favorite;
      }
      
      updateModalFavStar();
      filterAndSearch();
    } catch (error) {
      console.error(error);
      showToast('Error updating priority.');
    }
  });
}

function updateModalFavStar() {
  const btnFavLead = document.getElementById('btn-fav-lead');
  if (!btnFavLead || !selectedLead) return;
  const isFav = selectedLead.is_favorite === 1 || selectedLead.is_favorite === true;
  const icon = btnFavLead.querySelector('i');
  if (icon) {
    icon.className = isFav ? 'fa-solid fa-star' : 'fa-regular fa-star';
  }
  btnFavLead.style.color = isFav ? '#f59e0b' : 'var(--text-muted)';
  btnFavLead.title = isFav ? 'Remove from Priority' : 'Mark as Priority';
}

// --- DARK/LIGHT THEME TOGGLE ---
const btnThemeToggle = document.getElementById('theme-toggle-btn');
const rootElement = document.documentElement;

// Check for saved preference
const savedTheme = localStorage.getItem('theme') || 'dark';
if (savedTheme === 'light') {
  rootElement.classList.add('light-theme');
  updateThemeToggleUI(true);
} else {
  updateThemeToggleUI(false);
}

if (btnThemeToggle) {
  btnThemeToggle.addEventListener('click', () => {
    const isLight = rootElement.classList.toggle('light-theme');
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
    updateThemeToggleUI(isLight);
  });
}

function updateThemeToggleUI(isLight) {
  if (!btnThemeToggle) return;
  const icon = btnThemeToggle.querySelector('i');
  const span = btnThemeToggle.querySelector('span');
  if (isLight) {
    icon.className = 'fa-solid fa-sun';
    span.textContent = 'Light Mode';
  } else {
    icon.className = 'fa-solid fa-moon';
    span.textContent = 'Dark Mode';
  }
}
