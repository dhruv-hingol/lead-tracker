import os
import sys
import csv
import time
import argparse
import requests

PLACES_TEXTSEARCH_URL = "https://maps.googleapis.com/maps/api/place/textsearch/json"
PLACES_DETAILS_URL = "https://maps.googleapis.com/maps/api/place/details/json"


def get_api_key():
    key = os.environ.get("GOOGLE_PLACES_API_KEY")
    if not key:
        print("ERROR: Set the GOOGLE_PLACES_API_KEY environment variable first.")
        sys.exit(1)
    return key


def search_places(query, api_key, max_results=60):
    """Paginate through Google Places Text Search results."""
    results = []
    params = {"query": query, "key": api_key}
    while True:
        resp = requests.get(PLACES_TEXTSEARCH_URL, params=params, timeout=15)
        data = resp.json()

        if data.get("status") not in ("OK", "ZERO_RESULTS"):
            print(f"API error: {data.get('status')} - {data.get('error_message', '')}")
            break

        results.extend(data.get("results", []))

        if len(results) >= max_results:
            break

        next_page_token = data.get("next_page_token")
        if not next_page_token:
            break

        # Google requires a short delay before the next_page_token becomes valid
        time.sleep(2)
        params = {"pagetoken": next_page_token, "key": api_key}

    return results[:max_results]


def get_place_details(place_id, api_key):
    """Fetch phone number and website for a specific place."""
    params = {
        "place_id": place_id,
        "fields": "name,formatted_address,formatted_phone_number,international_phone_number,website,url,rating,user_ratings_total",
        "key": api_key,
    }
    resp = requests.get(PLACES_DETAILS_URL, params=params, timeout=15)
    data = resp.json()
    if data.get("status") != "OK":
        return {}
    return data.get("result", {})


def check_website_alive(url, timeout=8):
    """Returns True if the URL actually loads (not dead/broken)."""
    if not url:
        return False
    try:
        resp = requests.get(url, timeout=timeout, allow_redirects=True,
                             headers={"User-Agent": "Mozilla/5.0"})
        return resp.status_code < 400
    except requests.RequestException:
        return False


def main():
    parser = argparse.ArgumentParser(description="Find local businesses without websites.")
    parser.add_argument("--location", required=True, help="e.g. 'Ahmedabad, Gujarat'")
    parser.add_argument("--category", required=True, help="e.g. 'restaurants', 'salons', 'gyms'")
    parser.add_argument("--max-results", type=int, default=60)
    args = parser.parse_args()

    api_key = get_api_key()
    query = f"{args.category} in {args.location}"
    print(f"Searching: {query}")

    places = search_places(query, api_key, args.max_results)
    print(f"Found {len(places)} businesses. Fetching details...")

    rows = []
    for i, place in enumerate(places, 1):
        place_id = place.get("place_id")
        details = get_place_details(place_id, api_key)

        website = details.get("website", "")
        website_alive = check_website_alive(website) if website else False
        has_website = "Yes" if website_alive else "No"

        row = {
            "business_name": details.get("name", place.get("name", "")),
            "category": args.category,
            "address": details.get("formatted_address", place.get("formatted_address", "")),
            "phone": details.get("international_phone_number") or details.get("formatted_phone_number") or "",
            "website": website,
            "has_website": has_website,
            "google_maps_url": details.get("url", ""),
            "rating": details.get("rating", ""),
            "user_ratings_total": details.get("user_ratings_total", ""),
        }
        rows.append(row)
        print(f"  [{i}/{len(places)}] {row['business_name']} - website: {has_website}")

        time.sleep(0.2)  # be gentle on the API

    safe_location = args.location.replace(",", "").replace(" ", "_")
    safe_category = args.category.replace(" ", "_")
    filename = f"leads_{safe_category}_{safe_location}.csv"

    with open(filename, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()) if rows else [])
        writer.writeheader()
        writer.writerows(rows)

    no_site_count = sum(1 for r in rows if r["has_website"] == "No")
    print(f"\nSaved {len(rows)} businesses to {filename}")
    print(f"{no_site_count} of them have NO working website — these are your top prospects.")


if __name__ == "__main__":
    main()


# ---------------------------------------------------------------------------
# OPTIONAL HELPER: rough email guesser for businesses that DO have a website
# (only use this on businesses with an existing site/domain — Google never
# gives you emails directly). Always label guessed emails as "unverified"
# in your outreach.
# ---------------------------------------------------------------------------
def guess_emails(domain, first_name=None, last_name=None):
    """
    Generates likely email patterns for a given domain.
    e.g. guess_emails("example.com", "Raj", "Sharma")
    """
    patterns = ["info@{d}", "contact@{d}", "hello@{d}", "owner@{d}", "admin@{d}"]
    if first_name:
        fn = first_name.lower()
        ln = (last_name or "").lower()
        patterns += [
            "{fn}@{d}", "{fn}.{ln}@{d}", "{fn}{ln}@{d}", "{fn[0]}{ln}@{d}"
        ]
    guesses = []
    for p in patterns:
        try:
            guesses.append(p.format(d=domain, fn=first_name.lower() if first_name else "",
                                     ln=last_name.lower() if last_name else "",
                                     **{"fn[0]": (first_name[0].lower() if first_name else "")}))
        except Exception:
            continue
    return list(dict.fromkeys(guesses))  # dedupe, preserve order
