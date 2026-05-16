import requests
url = "http://localhost:8000/api/v1/auth/login"
data = {
    "username": "admin",
    "password": "admin"
}
try:
    response = requests.post(url, data=data)
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.json()}")
except Exception as e:
    print(f"Error: {e}")
