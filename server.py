#!/usr/bin/env python3
"""
Simple HTTP Server for Life Savers Donors
Run this to serve the website locally and avoid CORS issues
"""

import http.server
import socketserver
import os
import webbrowser
from pathlib import Path

# Configuration
PORT = 8000
DIRECTORY = Path(__file__).parent

import urllib.request
import urllib.parse
import json

class CORSHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Add CORS headers to allow cross-origin requests
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()
    
    def do_OPTIONS(self):
        # Handle preflight requests
        self.send_response(200)
        self.end_headers()
    
    def do_POST(self):
        print(f"POST request to: {self.path}")  # Debug log
        if self.path == '/api/submit-blood-request':
            # Handle blood request submission
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                # Parse the JSON data
                data = json.loads(post_data.decode('utf-8'))
                
                # Prepare data for Google Apps Script
                script_url = 'https://script.google.com/macros/s/AKfycbz7dBZqc2t36QwY8nRw2rPViKpiKWelilUPlre5TrsvhWenaBXW5UKndknbyMb7A5q3zQ/exec'
                
                # Create form data
                form_data = urllib.parse.urlencode({
                    'data': json.dumps(data)
                }).encode('utf-8')
                
                # Make request to Google Apps Script
                req = urllib.request.Request(script_url, data=form_data)
                req.add_header('Content-Type', 'application/x-www-form-urlencoded')
                
                with urllib.request.urlopen(req) as response:
                    result = response.read().decode('utf-8')
                    
                # Return the result
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(result.encode('utf-8'))
                
            except Exception as e:
                # Return error response
                error_response = json.dumps({
                    'success': False,
                    'message': 'Failed to submit request',
                    'error': str(e)
                })
                
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(error_response.encode('utf-8'))
            return  # Important: return here to prevent fallback to super()
        else:
            super().do_POST()
    
    def do_GET(self):
        print(f"GET request to: {self.path}")  # Debug log
        if self.path == '/api/fetch-requests':
            # Handle fetching emergency requests
            try:
                script_url = 'https://script.google.com/macros/s/AKfycbz7dBZqc2t36QwY8nRw2rPViKpiKWelilUPlre5TrsvhWenaBXW5UKndknbyMb7A5q3zQ/exec'
                
                with urllib.request.urlopen(script_url) as response:
                    result = response.read().decode('utf-8')
                    
                # Return the result
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(result.encode('utf-8'))
                
            except Exception as e:
                # Return error response
                error_response = json.dumps({
                    'success': False,
                    'message': 'Failed to fetch requests',
                    'error': str(e)
                })
                
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(error_response.encode('utf-8'))
            return  # Important: return here to prevent fallback to super()
        else:
            super().do_GET()

def main():
    # Change to the project directory
    os.chdir(DIRECTORY)
    
    # Create server
    with socketserver.TCPServer(("", PORT), CORSHTTPRequestHandler) as httpd:
        print(f"🚀 Server started at http://localhost:{PORT}")
        print(f"📁 Serving files from: {DIRECTORY}")
        print(f"🌐 Open your browser and go to: http://localhost:{PORT}")
        print(f"📄 Emergency Blood Request Form: http://localhost:{PORT}/pages/emergency_blood_request.html")
        print(f"📊 Emergency Request System: http://localhost:{PORT}/pages/emergency_request_system.html")
        print("\nPress Ctrl+C to stop the server")
        
        # Try to open the main page in browser
        try:
            webbrowser.open(f'http://localhost:{PORT}')
        except:
            pass
        
        # Start serving
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n🛑 Server stopped")

if __name__ == "__main__":
    main()
