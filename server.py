#!/usr/bin/env python3
"""
Simple HTTP Server for LifeSavers United
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
                script_url = 'https://script.google.com/macros/s/AKfycbzZuVZqReNkoNvR7tXYGRu_qi5GAKsaQRjTwmsb841Pwd5bWPzONwBLBCX95M1Kdp3I/exec'
                
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
        elif self.path == '/api/submit-donor-registration':
            # Handle donor registration submission
            print("Processing donor registration submission...")  # Debug log
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                # Parse the form data
                form_data = post_data.decode('utf-8')
                print(f"Received form data: {form_data[:200]}...")  # Debug log
                parsed_data = urllib.parse.parse_qs(form_data)
                
                # Extract the JSON data
                if 'data' in parsed_data:
                    data = json.loads(parsed_data['data'][0])
                    print(f"Parsed data: {data}")  # Debug log
                else:
                    raise ValueError("No data found in form submission")
                
                # Prepare data for Google Apps Script (donor registration)
                script_url = 'https://script.google.com/macros/s/AKfycbzZuVZqReNkoNvR7tXYGRu_qi5GAKsaQRjTwmsb841Pwd5bWPzONwBLBCX95M1Kdp3I/exec'
                
                # Create form data for Google Apps Script
                # Use the correct action for donor registration
                donor_data = {
                    'action': 'submit_donor_registration',
                    'data': json.dumps({
                        'fullName': data.get('fullName'),
                        'dateOfBirth': data.get('dateOfBirth'),
                        'gender': data.get('gender'),
                        'contactNumber': data.get('contactNumber'),
                        'email': data.get('email'),
                        'weight': data.get('weight'),
                        'bloodGroup': data.get('bloodGroup'),
                        'city': data.get('city'),
                        'area': data.get('area'),
                        'emergencyAvailable': data.get('emergencyAvailable'),
                        'preferredContact': data.get('preferredContact'),
                        'lastDonation': data.get('lastDonation', ''),
                        'medicalHistory': data.get('medicalHistory', ''),
                        'registrationDate': data.get('registrationDate'),
                        'source': 'donor_registration'
                    })
                }
                
                script_form_data = urllib.parse.urlencode(donor_data).encode('utf-8')
                
                print(f"Submitting to Google Apps Script: {script_url}")  # Debug log
                print(f"Donor data being sent: {donor_data}")  # Debug log
                
                # Make request to Google Apps Script
                req = urllib.request.Request(script_url, data=script_form_data)
                req.add_header('Content-Type', 'application/x-www-form-urlencoded')
                
                with urllib.request.urlopen(req) as response:
                    result = response.read().decode('utf-8')
                    print(f"Google Apps Script response: {result}")  # Debug log
                    
                # Return the result
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(result.encode('utf-8'))
                
            except Exception as e:
                print(f"Error in donor registration: {str(e)}")  # Debug log
                # Return error response
                error_response = json.dumps({
                    'success': False,
                    'message': 'Failed to submit donor registration',
                    'error': str(e)
                })
                
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(error_response.encode('utf-8'))
            return  # Important: return here to prevent fallback to super()
        elif self.path == '/api/submit-donor-details':
            # Handle donor details submission from emergency request system
            print("Processing donor details submission from emergency system...")  # Debug log
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                # Parse the JSON data
                data = json.loads(post_data.decode('utf-8'))
                print(f"Received donor details: {data}")  # Debug log
                
                # Prepare data for Google Apps Script (donor details from emergency system)
                script_url = 'https://script.google.com/macros/s/AKfycbzZuVZqReNkoNvR7tXYGRu_qi5GAKsaQRjTwmsb841Pwd5bWPzONwBLBCX95M1Kdp3I/exec'
                
                # Create form data for Google Apps Script
                # Try action that might route to Form Responses 2
                donor_data = {
                    'action': 'form_responses_2',
                    'data': json.dumps({
                        'fullName': data.get('fullName'),
                        'dateOfBirth': data.get('dateOfBirth'),
                        'gender': data.get('gender'),
                        'contactNumber': data.get('contactNumber'),
                        'email': data.get('email'),
                        'weight': data.get('weight'),
                        'bloodGroup': data.get('bloodGroup'),
                        'city': data.get('city'),
                        'area': data.get('area'),
                        'emergencyAvailable': data.get('emergencyAvailable', 'Yes'),
                        'preferredContact': data.get('preferredContact'),
                        'lastDonation': data.get('lastDonation', ''),
                        'medicalHistory': data.get('medicalHistory', ''),
                        'registrationDate': data.get('registrationDate'),
                        'source': 'emergency_request_system',
                        'relatedRequestId': data.get('requestId', ''),
                        'relatedPatientName': data.get('patientName', '')
                    })
                }
                
                script_form_data = urllib.parse.urlencode(donor_data).encode('utf-8')
                
                print(f"Submitting donor details to Google Apps Script: {script_url}")  # Debug log
                
                # Make request to Google Apps Script
                req = urllib.request.Request(script_url, data=script_form_data)
                req.add_header('Content-Type', 'application/x-www-form-urlencoded')
                
                with urllib.request.urlopen(req) as response:
                    result = response.read().decode('utf-8')
                    print(f"Google Apps Script response: {result}")  # Debug log
                    
                # Return the result
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(result.encode('utf-8'))
                
            except Exception as e:
                print(f"Error in donor details submission: {str(e)}")  # Debug log
                # Return error response
                error_response = json.dumps({
                    'success': False,
                    'message': 'Failed to submit donor details',
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
                script_url = 'https://script.google.com/macros/s/AKfycbzZuVZqReNkoNvR7tXYGRu_qi5GAKsaQRjTwmsb841Pwd5bWPzONwBLBCX95M1Kdp3I/exec'
                
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
