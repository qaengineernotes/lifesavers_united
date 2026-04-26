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
import urllib.request
import urllib.parse
import json
import re

# Configuration
PORT = 8000
DIRECTORY = Path(__file__).parent

def normalize_phone_number(phone_number):
    """
    Normalize phone number to 10-digit format
    Removes country code (+91 or 91), spaces, and special characters
    """
    if not phone_number:
        return ''
    normalized = str(phone_number).strip()
    normalized = re.sub(r'\D', '', normalized)
    if normalized.startswith('91') and len(normalized) > 10:
        normalized = normalized[2:]
    if len(normalized) > 10:
        normalized = normalized[-10:]
    return normalized

def to_title_case(text):
    """
    Convert a string to Title Case
    """
    if not text:
        return ''
    return ' '.join(word.capitalize() for word in text.strip().split())


class CORSHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()
    
    def do_POST(self):
        print(f"POST request to: {self.path}")
        if self.path == '/api/submit-blood-request':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            try:
                data = json.loads(post_data.decode('utf-8'))
                if 'patientName' in data: data['patientName'] = to_title_case(data['patientName'])
                if 'contactPerson' in data: data['contactPerson'] = to_title_case(data['contactPerson'])
                
                script_url = 'https://script.google.com/macros/s/AKfycbzam6IZ55zyXe70MdOyfdlfIL3uFlIMeEHvvFf91M0yD39VfNeIjYwjYGoxuVeSYnwV/exec'
                form_data = urllib.parse.urlencode({'data': json.dumps(data)}).encode('utf-8')
                req = urllib.request.Request(script_url, data=form_data)
                req.add_header('Content-Type', 'application/x-www-form-urlencoded')
                
                with urllib.request.urlopen(req) as response:
                    result = response.read().decode('utf-8')
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(result.encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'success': False, 'error': str(e)}).encode('utf-8'))
            return

        elif self.path == '/api/submit-donor-registration':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            try:
                parsed_data = urllib.parse.parse_qs(post_data.decode('utf-8'))
                if 'data' not in parsed_data: raise ValueError("No data found")
                data = json.loads(parsed_data['data'][0])
                
                script_url = 'https://script.google.com/macros/s/AKfycbzam6IZ55zyXe70MdOyfdlfIL3uFlIMeEHvvFf91M0yD39VfNeIjYwjYGoxuVeSYnwV/exec'
                donor_data = {
                    'action': 'submit_donor_registration',
                    'data': json.dumps({
                        'fullName': to_title_case(data.get('fullName')),
                        'dateOfBirth': data.get('dateOfBirth'),
                        'gender': data.get('gender'),
                        'contactNumber': normalize_phone_number(data.get('contactNumber')),
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
                req = urllib.request.Request(script_url, data=script_form_data)
                req.add_header('Content-Type', 'application/x-www-form-urlencoded')
                
                with urllib.request.urlopen(req) as response:
                    result = response.read().decode('utf-8')
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(result.encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'success': False, 'error': str(e)}).encode('utf-8'))
            return

        elif self.path == '/api/submit-donor-details':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            try:
                data = json.loads(post_data.decode('utf-8'))
                script_url = 'https://script.google.com/macros/s/AKfycbzam6IZ55zyXe70MdOyfdlfIL3uFlIMeEHvvFf91M0yD39VfNeIjYwjYGoxuVeSYnwV/exec'
                donor_data = {
                    'action': 'form_responses_2',
                    'data': json.dumps({
                        'fullName': to_title_case(data.get('fullName')),
                        'contactNumber': normalize_phone_number(data.get('contactNumber')),
                        'bloodGroup': data.get('bloodGroup'),
                        'source': 'emergency_request_system',
                        'relatedRequestId': data.get('requestId', '')
                    })
                }
                script_form_data = urllib.parse.urlencode(donor_data).encode('utf-8')
                req = urllib.request.Request(script_url, data=script_form_data)
                req.add_header('Content-Type', 'application/x-www-form-urlencoded')
                with urllib.request.urlopen(req) as response:
                    result = response.read().decode('utf-8')
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(result.encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'success': False, 'error': str(e)}).encode('utf-8'))
            return

        elif self.path == '/volunteer-signup':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            try:
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"success": True, "message": "Local Mock: Registration received!"}).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.end_headers()
                self.wfile.write(json.dumps({"success": False, "error": str(e)}).encode('utf-8'))
            return

        elif self.path == '/donor-registration-email':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            try:
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"success": True, "message": "Local Mock: Email triggered!"}).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.end_headers()
                self.wfile.write(json.dumps({"success": False, "error": str(e)}).encode('utf-8'))
            return

        elif self.path == '/broadcast-email':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            try:
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"success": True, "message": "Local Mock: Broadcast initiated!"}).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.end_headers()
                self.wfile.write(json.dumps({"success": False, "error": str(e)}).encode('utf-8'))
            return

        else:
            super().do_POST()
    
    def do_GET(self):
        if self.path == '/api/fetch-requests':
            try:
                script_url = 'https://script.google.com/macros/s/AKfycbzam6IZ55zyXe70MdOyfdlfIL3uFlIMeEHvvFf91M0yD39VfNeIjYwjYGoxuVeSYnwV/exec'
                with urllib.request.urlopen(script_url) as response:
                    result = response.read().decode('utf-8')
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(result.encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'success': False, 'error': str(e)}).encode('utf-8'))
            return
        else:
            if '.' not in os.path.basename(self.path) and not self.path.endswith('/'):
                html_path = self.path + '.html'
                file_path = os.path.join(DIRECTORY, html_path.lstrip('/'))
                if os.path.isfile(file_path):
                    self.path = html_path
            super().do_GET()

def main():
    os.chdir(DIRECTORY)
    socketserver.TCPServer.allow_reuse_address = True
    try:
        with socketserver.TCPServer(("", PORT), CORSHTTPRequestHandler) as httpd:
            print(f"[*] Server started at http://localhost:{PORT}")
            webbrowser.open(f'http://localhost:{PORT}/emergency_request_system')
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[!] Server stopped")
    except Exception as e:
        print(f"[X] Error: {e}")

if __name__ == "__main__":
    main()
