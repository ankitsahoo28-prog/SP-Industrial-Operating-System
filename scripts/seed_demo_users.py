import requests
import sys

# API URL
BACKEND_URL = "https://journal-entries-1.preview.emergentagent.com/api"

def create_demo_users():
    """Create demo users for testing"""
    users = [
        {
            "email": "director@sp.com",
            "password": "password123",
            "name": "John Director",
            "role": "director",
            "phone": "+1234567890",
            "business_type": "petrol_pump"
        },
        {
            "email": "manager@sp.com",
            "password": "password123",
            "name": "Sarah Manager",
            "role": "manager",
            "phone": "+1234567891",
            "business_type": "transport"
        },
        {
            "email": "staff@sp.com",
            "password": "password123",
            "name": "Mike Staff",
            "role": "ground_staff",
            "phone": "+1234567892",
            "shift_start": "09:00",
            "shift_end": "18:00"
        }
    ]

    print("Creating demo users...")
    
    for user in users:
        try:
            response = requests.post(
                f"{BACKEND_URL}/auth/register",
                json=user,
                timeout=10
            )
            
            if response.status_code == 200:
                print(f"✓ Created user: {user['email']} ({user['role']})")
            else:
                # User might already exist
                if "already registered" in response.text.lower():
                    print(f"ℹ User already exists: {user['email']}")
                else:
                    print(f"✗ Failed to create {user['email']}: {response.text}")
                    
        except Exception as e:
            print(f"✗ Error creating {user['email']}: {str(e)}")
    
    print("\nDemo users setup complete!")
    print("\nYou can now login with:")
    print("Director: director@sp.com / password123")
    print("Manager: manager@sp.com / password123")
    print("Ground Staff: staff@sp.com / password123")

if __name__ == "__main__":
    create_demo_users()