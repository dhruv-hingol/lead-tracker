import os
import re
import json
import time
import hashlib
import ssl
import urllib.request
import urllib.parse
import urllib.error
from html.parser import HTMLParser
import database

# Regex for email matching
EMAIL_REGEX = re.compile(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}')

# Simple SSL Context that ignores certificate verification errors (useful for crawling small businesses with misconfigured SSL)
ssl_context = ssl.create_default_context()
ssl_context.check_hostname = False
ssl_context.verify_mode = ssl.CERT_NONE

class WebPageParser(HTMLParser):
    def __init__(self, base_url):
        super().__init__()
        self.base_url = base_url
        self.has_viewport = False
        self.emails = set()
        self.copyright_year = None
        self.internal_links = set()
        self.contact_names = set()
        self.text_accumulator = []
        
    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)
        if tag == 'meta':
            if attrs_dict.get('name') == 'viewport':
                self.has_viewport = True
        elif tag == 'a':
            href = attrs_dict.get('href', '').strip()
            if href.startswith('mailto:'):
                email = href.replace('mailto:', '').split('?')[0].strip()
                if email and EMAIL_REGEX.match(email):
                    self.emails.add(email)
            elif href and not href.startswith('#') and not href.startswith('javascript:'):
                # Look for contact/about page links
                href_lower = href.lower()
                if any(k in href_lower for k in ['contact', 'about', 'info', 'team', 'staff', 'owner', 'touch', 'reach', 'connect', 'support', 'write', 'help']):
                    # Resolve relative URL
                    full_url = urllib.parse.urljoin(self.base_url, href)
                    # Ensure it's on the same domain
                    base_domain = urllib.parse.urlparse(self.base_url).netloc
                    link_domain = urllib.parse.urlparse(full_url).netloc
                    if base_domain.replace('www.', '') == link_domain.replace('www.', ''):
                        self.internal_links.add(full_url)
                        
    def handle_data(self, data):
        self.text_accumulator.append(data)
        
        # Check for copyright in text
        if not self.copyright_year:
            match = re.search(r'(?:©|copyright|copyright\s+©)\s*(\d{4})', data, re.IGNORECASE)
            if match:
                self.copyright_year = int(match.group(1))
                
        # Check for contact names using simple pattern matching
        # e.g., "Owner: John Smith", "Founder: Jane Doe", "Manager: Bob"
        name_match = re.search(r'\b(?:owner|founder|manager|proprietor|director|ceo)\b\s*:\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})', data, re.IGNORECASE)
        if name_match:
            self.contact_names.add(name_match.group(1).strip())

    def get_text(self):
        return " ".join(self.text_accumulator)

def fetch_url(url, timeout=12):
    """Fetches a URL using urllib with browser-grade headers and returns (html_content, final_url, status_code)."""
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "max-age=0",
        "Upgrade-Insecure-Requests": "1"
    }
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=ssl_context) as response:
            html = response.read().decode('utf-8', errors='ignore')
            return html, response.geturl(), response.status
    except urllib.error.HTTPError as e:
        # Some servers return HTML content along with error codes
        try:
            html = e.read().decode('utf-8', errors='ignore')
        except Exception:
            html = ""
        return html, url, e.code
    except Exception as e:
        return "", url, 0

def crawl_and_audit_website(url):
    """
    Crawls the homepage and up to 2 contact/about pages.
    Audits page speed (via local metrics), viewport, HTTPS, and extracts contact info.
    """
    result = {
        "website_status": "Good",
        "has_https": 1 if url.startswith("https") else 0,
        "has_viewport": 0,
        "copyright_year": None,
        "contact_email": "",
        "email_confidence": "Not Found",
        "contact_name": "",
        "audit_notes": []
    }
    
    start_time = time.time()
    html, final_url, status = fetch_url(url)
    load_time = round(time.time() - start_time, 2)
    result["load_time"] = load_time
    
    if status == 0 or status == 404:
        result["website_status"] = "Dead Link"
        result["audit_notes"].append(f"Website failed to connect (status code {status}).")
        return result
    elif status >= 400:
        result["website_status"] = "Needs Improvement"
        result["audit_notes"].append(f"Website accessible but returned restricted status code {status} (bot block/maintenance).")
        if not html:
            return result
        
    # Parse homepage
    parser = WebPageParser(final_url)
    try:
        parser.feed(html)
    except Exception:
        pass
        
    result["has_viewport"] = 1 if parser.has_viewport else 0
    result["copyright_year"] = parser.copyright_year
    
    # Scrape emails from homepage HTML text
    emails = parser.emails
    text_emails = EMAIL_REGEX.findall(parser.get_text())
    for email in text_emails:
        # Filter out common false positives like images
        if not any(email.lower().endswith(ext) for ext in ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp']):
            emails.add(email)
            
    # Search entire raw HTML of homepage (highly aggressive)
    raw_emails = EMAIL_REGEX.findall(html)
    for email in raw_emails:
        if not any(email.lower().endswith(ext) for ext in ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp']):
            emails.add(email)
            
    # Contact names
    contact_names = list(parser.contact_names)
    
    # Crawl up to 2 internal contact/about pages if we don't have an email yet
    links_to_crawl = list(parser.internal_links)[:2]
    for link in links_to_crawl:
        if len(emails) >= 2:
            break
        sub_html, _, sub_status = fetch_url(link)
        if sub_status == 200:
            sub_parser = WebPageParser(link)
            try:
                sub_parser.feed(sub_html)
            except Exception:
                pass
            for email in sub_parser.emails:
                emails.add(email)
            sub_text_emails = EMAIL_REGEX.findall(sub_parser.get_text())
            for email in sub_text_emails:
                if not any(email.lower().endswith(ext) for ext in ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp']):
                    emails.add(email)
            # Search entire raw HTML of contact subpage
            sub_raw_emails = EMAIL_REGEX.findall(sub_html)
            for email in sub_raw_emails:
                if not any(email.lower().endswith(ext) for ext in ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp']):
                    emails.add(email)
            if sub_parser.contact_names:
                contact_names.extend(list(sub_parser.contact_names))

    # Clean up emails and contact names
    emails = sorted(list(emails))
    contact_names = list(set(contact_names))
    
    if emails:
        result["contact_email"] = emails[0]
        result["email_confidence"] = "Confirmed"
    else:
        # Generate a pattern guess
        parsed_url = urllib.parse.urlparse(url)
        domain = parsed_url.netloc.replace("www.", "")
        if domain:
            result["contact_email"] = f"info@{domain}"
            result["email_confidence"] = "Guessed"
            
    if contact_names:
        result["contact_name"] = contact_names[0]
    else:
        result["contact_name"] = "Not Found"
        
    # Heuristics for "Needs Improvement"
    reasons = []
    if result["has_https"] == 0:
        reasons.append("No HTTPS")
    if result["has_viewport"] == 0:
        reasons.append("Not mobile-friendly (no viewport meta tag)")
    if load_time > 4.0:
        reasons.append(f"Slow loading time ({load_time}s)")
        
    current_year = time.localtime().tm_year
    if parser.copyright_year and parser.copyright_year < (current_year - 1):
        reasons.append(f"Outdated copyright year ({parser.copyright_year})")
        
    if reasons:
        result["website_status"] = "Needs Improvement"
        result["audit_notes"] = ", ".join(reasons)
    else:
        result["website_status"] = "Good"
        result["audit_notes"] = "Website looks healthy and modern."
        
    return result

def check_pagespeed(url, api_key=None):
    """Calls Google PageSpeed Insights API to get mobile scores."""
    if not api_key:
        return None, None
        
    encoded_url = urllib.parse.quote(url)
    api_url = f"https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url={encoded_url}&strategy=mobile&key={api_key}"
    
    try:
        req = urllib.request.Request(api_url)
        with urllib.request.urlopen(req, timeout=15) as response:
            data = json.loads(response.read().decode('utf-8'))
            lighthouse = data.get("lighthouseResult", {})
            categories = lighthouse.get("categories", {})
            performance = categories.get("performance", {})
            score = performance.get("score")
            
            # Convert 0.0-1.0 score to 0-100
            score_val = int(score * 100) if score is not None else None
            
            # Extract mobile friendliness / SEO or other metric if needed
            # For simplicity, we just return performance score as the main indicator
            return score_val, score_val
    except Exception as e:
        print(f"PageSpeed API Error for {url}: {e}")
        return None, None

def run_pipeline(location, category, api_key, progress_callback=None, country=None):
    """
    Runs the full lead-generation pipeline.
    Queries Places API, audits websites, crawls for contact info, and saves to DB.
    """
    query = f"{category} in {location}"
    if progress_callback:
        progress_callback(0, f"Initializing search for '{query}'...")
        
    # 1. Places Text Search
    search_url = "https://maps.googleapis.com/maps/api/place/textsearch/json"
    params = {
        "query": query,
        "key": api_key
    }
    
    businesses = []
    try:
        url_params = urllib.parse.urlencode(params)
        req = urllib.request.Request(f"{search_url}?{url_params}")
        with urllib.request.urlopen(req, timeout=15) as response:
            data = json.loads(response.read().decode('utf-8'))
            
        if data.get("status") not in ("OK", "ZERO_RESULTS"):
            error_msg = data.get("error_message", "Unknown error")
            if progress_callback:
                progress_callback(100, f"Places API Error: {data.get('status')} - {error_msg}")
            return []
            
        businesses = data.get("results", [])
    except Exception as e:
        if progress_callback:
            progress_callback(100, f"Error searching places: {e}")
        return []
        
    total_found = len(businesses)
    if total_found == 0:
        if progress_callback:
            progress_callback(100, "No businesses found matching query.")
        return []
        
    if progress_callback:
        progress_callback(10, f"Found {total_found} businesses. Starting details & audits...")
        
    saved_count = 0
    for idx, biz in enumerate(businesses):
        place_id = biz.get("place_id")
        name = biz.get("name")
        
        if progress_callback:
            progress_callback(
                int(10 + (idx / total_found) * 85), 
                f"Processing [{idx+1}/{total_found}]: {name}"
            )
            
        # Fetch Details (phone, website, etc.)
        details_url = "https://maps.googleapis.com/maps/api/place/details/json"
        d_params = {
            "place_id": place_id,
            "fields": "name,formatted_address,formatted_phone_number,international_phone_number,website,url,rating,user_ratings_total",
            "key": api_key
        }
        
        phone = ""
        website = ""
        maps_url = ""
        address = biz.get("formatted_address", "")
        rating = biz.get("rating")
        user_ratings_total = biz.get("user_ratings_total")
        
        try:
            d_url_params = urllib.parse.urlencode(d_params)
            d_req = urllib.request.Request(f"{details_url}?{d_url_params}")
            with urllib.request.urlopen(d_req, timeout=15) as response:
                d_data = json.loads(response.read().decode('utf-8'))
                
            if d_data.get("status") == "OK":
                result = d_data.get("result", {})
                phone = result.get("international_phone_number") or result.get("formatted_phone_number") or ""
                website = result.get("website") or ""
                maps_url = result.get("url") or ""
                address = result.get("formatted_address") or address
                rating = result.get("rating") or rating
                user_ratings_total = result.get("user_ratings_total") or user_ratings_total
        except Exception as e:
            print(f"Error fetching details for {name}: {e}")
            
        # Generate a unique ID
        # MD5 hash of place_id or name+phone
        uid_source = place_id if place_id else f"{name}_{phone}"
        lead_id = hashlib.md5(uid_source.encode('utf-8')).hexdigest()
        
        # Determine country based on passed country parameter, location, or phone
        lead_country = country
        if not lead_country:
            if "india" in location.lower() or (phone and phone.startswith("+91")):
                lead_country = "India"
            elif "united kingdom" in location.lower() or "uk" in location.lower() or (phone and phone.startswith("+44")):
                lead_country = "United Kingdom"
            elif "canada" in location.lower() or (phone and phone.startswith("+1") and not ("united states" in location.lower() or "usa" in location.lower())):
                lead_country = "Canada"
            elif "australia" in location.lower() or (phone and phone.startswith("+61")):
                lead_country = "Australia"
            else:
                lead_country = "USA"


        
        lead_data = {
            "id": lead_id,
            "business_name": name,
            "category": category,
            "country": lead_country,
            "city_region": location,
            "full_address": address,
            "phone": phone,
            "website_url": website,
            "website_status": "No Website",
            "pagespeed_score": None,
            "mobile_score": None,
            "load_time": None,
            "has_https": 0,
            "has_viewport": 0,
            "copyright_year": None,
            "audit_notes": "No website listed.",
            "contact_name": "Not Found",
            "contact_email": "Not Found",
            "email_confidence": "Not Found",
            "outreach_status": "New",
            "notes": ""
        }
        
        # If website is present, run crawl & audit
        if website:
            audit = crawl_and_audit_website(website)
            lead_data.update(audit)
            
            # PageSpeed (only if website is alive and we have an API key)
            if lead_data["website_status"] != "Dead Link":
                ps_score, mb_score = check_pagespeed(website, api_key)
                if ps_score is not None:
                    lead_data["pagespeed_score"] = ps_score
                    lead_data["mobile_score"] = mb_score
                    
                    # Update audit notes with PageSpeed
                    notes_list = []
                    if lead_data["audit_notes"] and lead_data["audit_notes"] != "Website looks healthy and modern.":
                        notes_list.append(lead_data["audit_notes"])
                    if ps_score < 50:
                        notes_list.append(f"Poor PageSpeed score ({ps_score}/100)")
                        if lead_data["website_status"] == "Good":
                            lead_data["website_status"] = "Needs Improvement"
                    
                    if notes_list:
                        lead_data["audit_notes"] = ", ".join(notes_list)
                    else:
                        lead_data["audit_notes"] = f"Website is healthy (PageSpeed: {ps_score}/100)"
                        
        # Ensure audit_notes is a string before saving
        if isinstance(lead_data.get("audit_notes"), list):
            lead_data["audit_notes"] = ", ".join(lead_data["audit_notes"])
            
        # Save to SQLite database
        database.save_lead(lead_data)
        saved_count += 1
        
        # Rate limit friendly
        time.sleep(0.5)
        
    if progress_callback:
        progress_callback(100, f"Scan completed! Discovered and processed {saved_count} leads.")
        
    return database.get_all_leads({"category": category, "city_region": location})
