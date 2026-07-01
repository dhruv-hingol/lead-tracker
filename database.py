import sqlite3
import os
import json

DB_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "leads.db")

def get_db_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Create leads table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS leads (
            id TEXT PRIMARY KEY,
            business_name TEXT NOT NULL,
            category TEXT NOT NULL,
            country TEXT,
            city_region TEXT,
            full_address TEXT,
            phone TEXT,
            website_url TEXT,
            website_status TEXT,
            pagespeed_score INTEGER,
            mobile_score INTEGER,
            load_time REAL,
            has_https INTEGER,
            has_viewport INTEGER,
            copyright_year INTEGER,
            audit_notes TEXT,
            contact_name TEXT,
            contact_email TEXT,
            email_confidence TEXT,
            outreach_status TEXT DEFAULT 'New',
            notes TEXT,
            date_found TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    conn.commit()
    conn.close()

def save_lead(lead_data):
    """
    Saves a lead. If a lead with the same ID or same phone already exists,
    it updates the existing record with new details while preserving 
    outreach_status and notes.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    lead_id = lead_data.get("id")
    phone = lead_data.get("phone")
    
    # Check if lead already exists by ID or Phone (if phone is present)
    existing = None
    if lead_id:
        cursor.execute("SELECT id, outreach_status, notes FROM leads WHERE id = ?", (lead_id,))
        existing = cursor.fetchone()
    
    if not existing and phone:
        cursor.execute("SELECT id, outreach_status, notes FROM leads WHERE phone = ? AND phone != ''", (phone,))
        existing = cursor.fetchone()
        
    if existing:
        # Update existing lead
        # Preserve outreach_status and notes if they are already set
        uid = existing["id"]
        
        update_fields = []
        params = []
        for key in [
            "business_name", "category", "country", "city_region", "full_address", 
            "phone", "website_url", "website_status", "pagespeed_score", "mobile_score", 
            "load_time", "has_https", "has_viewport", "copyright_year", "audit_notes", 
            "contact_name", "contact_email", "email_confidence"
        ]:
            if key in lead_data:
                update_fields.append(f"{key} = ?")
                params.append(lead_data[key])
                
        if "notes" in lead_data and lead_data["notes"]:
            update_fields.append("notes = ?")
            params.append(lead_data["notes"])
            
        if "outreach_status" in lead_data:
            update_fields.append("outreach_status = ?")
            params.append(lead_data["outreach_status"])
            
        params.append(uid)
        
        if update_fields:
            sql = f"UPDATE leads SET {', '.join(update_fields)} WHERE id = ?"
            cursor.execute(sql, tuple(params))
            ret_id = uid
    else:
        # Insert new lead
        columns = []
        placeholders = []
        values = []
        
        for key, val in lead_data.items():
            columns.append(key)
            placeholders.append("?")
            values.append(val)
            
        sql = f"INSERT INTO leads ({', '.join(columns)}) VALUES ({', '.join(placeholders)})"
        cursor.execute(sql, tuple(values))
        ret_id = lead_id
        
    conn.commit()
    conn.close()
    return ret_id

def get_all_leads(filters=None):
    """
    Retrieves leads with optional filtering.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    sql = "SELECT * FROM leads WHERE 1=1"
    params = []
    
    if filters:
        if "category" in filters and filters["category"]:
            sql += " AND category = ?"
            params.append(filters["category"])
        if "city_region" in filters and filters["city_region"]:
            sql += " AND city_region LIKE ?"
            params.append(f"%{filters['city_region']}%")
        if "outreach_status" in filters and filters["outreach_status"]:
            sql += " AND outreach_status = ?"
            params.append(filters["outreach_status"])
        if "website_status" in filters and filters["website_status"]:
            # Custom filter logic
            status = filters["website_status"]
            if status == "no_website":
                sql += " AND (website_status = 'No Website' OR website_status IS NULL)"
            elif status == "needs_improvement":
                sql += " AND website_status = 'Needs Improvement'"
            elif status == "dead_link":
                sql += " AND website_status = 'Dead Link'"
            elif status == "good":
                sql += " AND website_status = 'Good'"
        if "search" in filters and filters["search"]:
            q = f"%{filters['search']}%"
            sql += " AND (business_name LIKE ? OR full_address LIKE ? OR phone LIKE ? OR category LIKE ?)"
            params.extend([q, q, q, q])
            
    sql += " ORDER BY date_found DESC"
    
    cursor.execute(sql, tuple(params))
    rows = cursor.fetchall()
    
    result = [dict(row) for row in rows]
    conn.close()
    return result

def get_lead(lead_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM leads WHERE id = ?", (lead_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def update_lead_status(lead_id, outreach_status, notes=None):
    conn = get_db_connection()
    cursor = conn.cursor()
    if notes is not None:
        cursor.execute(
            "UPDATE leads SET outreach_status = ?, notes = ? WHERE id = ?",
            (outreach_status, notes, lead_id)
        )
    else:
        cursor.execute(
            "UPDATE leads SET outreach_status = ? WHERE id = ?",
            (outreach_status, lead_id)
        )
    conn.commit()
    conn.close()

def delete_lead(lead_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM leads WHERE id = ?", (lead_id,))
    conn.commit()
    conn.close()

def clear_all_leads():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM leads")
    conn.commit()
    conn.close()
