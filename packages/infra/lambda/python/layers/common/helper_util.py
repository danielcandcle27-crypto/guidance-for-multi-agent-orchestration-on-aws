# helper.py
import requests

def fetch_google_homepage():
    """Fetches the Google homepage and returns the status code."""
    response = requests.get("https://www.google.com")
    return response.status_code

def add_numbers(a, b):
    """Simple function to add two numbers."""
    return a + b
