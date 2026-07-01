import http.server
import socketserver
import json
import os
import urllib.parse
import threading
import database
import pipeline

PORT = 8000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

# Global state for tracking search progress
search_progress = {
    "status": "idle",       # "idle", "scanning", "completed", "error"
    "percentage": 0,
    "message": ""
}

class LeadTrackerRequestHandler(http.server.BaseHTTPRequestHandler):
    
    def log_message(self, format, *args):
        # Suppress default logging to keep terminal output clean
        pass

    def send_json(self, data, status=200):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))

    def do_OPTIONS(self):
        # Handle CORS preflight requests
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path
        
        # API: Get search status
        if path == "/api/search/status":
            self.send_json(search_progress)
            return

        # API: Get leads
        elif path == "/api/leads":
            query_params = urllib.parse.parse_qs(parsed_url.query)
            # Flatten query parameters (parse_qs returns lists)
            filters = {k: v[0] for k, v in query_params.items()}
            try:
                leads = database.get_all_leads(filters)
                self.send_json(leads)
            except Exception as e:
                self.send_json({"error": str(e)}, 500)
            return
            
        # API: Get single lead
        elif path.startswith("/api/leads/"):
            lead_id = path.split("/")[-1]
            try:
                lead = database.get_lead(lead_id)
                if lead:
                    self.send_json(lead)
                else:
                    self.send_json({"error": "Lead not found"}, 404)
            except Exception as e:
                self.send_json({"error": str(e)}, 500)
            return

        # Serve static files
        else:
            self.serve_static_file(path)

    def do_POST(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path

        if path == "/api/search":
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length).decode('utf-8')
            
            try:
                data = json.loads(post_data)
            except json.JSONDecodeError:
                self.send_json({"error": "Invalid JSON"}, 400)
                return

            country = data.get("country")
            state = data.get("state")
            city = data.get("city")
            area = data.get("area")
            category = data.get("category")
            api_key = data.get("api_key") or os.environ.get("GOOGLE_PLACES_API_KEY")

            if country or state or city or area:
                loc_parts = [p.strip() for p in [area, city, state, country] if p and p.strip()]
                location = ", ".join(loc_parts)
            else:
                location = data.get("location")

            if not location or not category:
                self.send_json({"error": "Location/City and Category are required"}, 400)
                return

            if not api_key:
                self.send_json({"error": "Google Places API Key is missing. Please provide it in the input or set GOOGLE_PLACES_API_KEY environment variable."}, 400)
                return

            if search_progress["status"] == "scanning":
                self.send_json({"error": "A scan is already in progress"}, 400)
                return

            # Start pipeline in a background thread
            thread = threading.Thread(
                target=self.run_background_scan,
                args=(location, category, api_key)
            )
            thread.daemon = True
            thread.start()

            self.send_json({"message": "Scan started successfully"})
            return
            
        else:
            self.send_json({"error": "Not Found"}, 404)

    def do_PUT(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path

        if path.startswith("/api/leads/"):
            lead_id = path.split("/")[-1]
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length).decode('utf-8')
            
            try:
                data = json.loads(post_data)
            except json.JSONDecodeError:
                self.send_json({"error": "Invalid JSON"}, 400)
                return

            try:
                # We can update status, notes, contact name, contact email, website_status
                lead = database.get_lead(lead_id)
                if not lead:
                    self.send_json({"error": "Lead not found"}, 404)
                    return
                
                # Merge new values
                updated_lead = dict(lead)
                for key in ["outreach_status", "notes", "contact_name", "contact_email", "website_status", "is_favorite"]:
                    if key in data:
                        val = data[key]
                        if key == "is_favorite":
                            val = 1 if val else 0
                        updated_lead[key] = val
                
                database.save_lead(updated_lead)
                self.send_json({"message": "Lead updated successfully", "lead": updated_lead})
            except Exception as e:
                self.send_json({"error": str(e)}, 500)
            return
        else:
            self.send_json({"error": "Not Found"}, 404)
            return

    def do_DELETE(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path

        if path == "/api/leads" or path == "/api/leads/":
            try:
                database.clear_all_leads()
                self.send_json({"message": "All leads deleted successfully"})
            except Exception as e:
                self.send_json({"error": str(e)}, 500)
            return
        elif path.startswith("/api/leads/"):
            lead_id = path.split("/")[-1]
            try:
                database.delete_lead(lead_id)
                self.send_json({"message": "Lead deleted successfully"})
            except Exception as e:
                self.send_json({"error": str(e)}, 500)
            return
        else:
            self.send_json({"error": "Not Found"}, 404)

    def serve_static_file(self, path):
        # Normalize path
        if path == "/" or path == "":
            path = "/index.html"
            
        file_path = os.path.join(DIRECTORY, path.lstrip("/"))
        
        # Prevent Directory Traversal
        if not os.path.abspath(file_path).startswith(os.path.abspath(DIRECTORY)):
            self.send_response(403)
            self.end_headers()
            self.wfile.write(b"Forbidden")
            return

        if os.path.exists(file_path) and os.path.isfile(file_path):
            # Determine mime type
            mime_type = "text/plain"
            if file_path.endswith(".html"):
                mime_type = "text/html"
            elif file_path.endswith(".css"):
                mime_type = "text/css"
            elif file_path.endswith(".js"):
                mime_type = "application/javascript"
            elif file_path.endswith(".json"):
                mime_type = "application/json"
            elif file_path.endswith(".png"):
                mime_type = "image/png"
            elif file_path.endswith(".jpg") or file_path.endswith(".jpeg"):
                mime_type = "image/jpeg"
            elif file_path.endswith(".ico"):
                mime_type = "image/x-icon"
                
            self.send_response(200)
            self.send_header("Content-Type", mime_type)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            
            with open(file_path, "rb") as f:
                self.wfile.write(f.read())
        else:
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b"Not Found")

    def run_background_scan(self, location, category, api_key):
        global search_progress
        search_progress["status"] = "scanning"
        search_progress["percentage"] = 0
        search_progress["message"] = "Initializing scan..."

        def progress_cb(pct, msg):
            search_progress["percentage"] = pct
            search_progress["message"] = msg
            if pct == 100:
                if "Error" in msg:
                    search_progress["status"] = "error"
                else:
                    search_progress["status"] = "completed"

        try:
            pipeline.run_pipeline(location, category, api_key, progress_callback=progress_cb)
        except Exception as e:
            search_progress["status"] = "error"
            search_progress["percentage"] = 100
            search_progress["message"] = f"Fatal scan error: {str(e)}"

def run_server():
    # Ensure database is initialized
    database.init_db()
    
    # Start HTTP server
    handler = LeadTrackerRequestHandler
    try:
        with socketserver.TCPServer(("", PORT), handler) as httpd:
            print(f"Lead Tracker Server started at http://localhost:{PORT}")
            print("Press Ctrl+C to stop.")
            try:
                httpd.serve_forever()
            except KeyboardInterrupt:
                print("\nShutting down server.")
    except OSError as e:
        print(f"\n[ERROR] Could not start server on port {PORT}: {e}")
        print(f"This usually means another process is already running on port {PORT}.")
        print("Please stop that process, or free the port, and try running 'python server.py' again.\n")

if __name__ == "__main__":
    run_server()
