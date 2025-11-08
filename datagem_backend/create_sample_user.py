"""
Script to create a sample user account using the API endpoint.
Run this with: python create_sample_user.py
"""
import requests
import json

def create_sample_user():
    """Create a sample user account via the signup API."""
    url = "http://127.0.0.1:8000/auth/signup"
    
    user_data = {
        "email": "aakshitmalik@gmail.com",
        "password": "123456",
        "full_name": "Akshit Malik"
    }
    
    try:
        response = requests.post(url, json=user_data)
        
        if response.status_code == 200:
            user = response.json()
            print("✅ Sample user created successfully!")
            print(f"   Email: {user_data['email']}")
            print(f"   Password: {user_data['password']}")
            print(f"   Full Name: {user_data['full_name']}")
            return user
        elif response.status_code == 400:
            error_detail = response.json().get('detail', 'Unknown error')
            if 'already registered' in error_detail.lower():
                print(f"✅ User with email {user_data['email']} already exists!")
                print(f"   Email: {user_data['email']}")
                print(f"   Password: {user_data['password']}")
                print(f"   Full Name: {user_data['full_name']}")
                return None
            else:
                print(f"❌ Error: {error_detail}")
                return None
        else:
            print(f"❌ Error: Status code {response.status_code}")
            print(f"   Response: {response.text}")
            return None
            
    except requests.exceptions.ConnectionError:
        print("❌ Error: Cannot connect to backend. Make sure it's running on http://127.0.0.1:8000")
        return None
    except Exception as e:
        print(f"❌ Error: {e}")
        return None

if __name__ == "__main__":
    create_sample_user()
