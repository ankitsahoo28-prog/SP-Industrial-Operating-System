#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime

class SPIndustrialTester:
    def __init__(self, base_url="https://odoo-advance-pay.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.tokens = {}  # Store tokens for each role
        self.users = {
            'director': {'email': 'director@sp.com', 'password': 'password123', 'token': None, 'user_data': None},
            'manager': {'email': 'manager@sp.com', 'password': 'password123', 'token': None, 'user_data': None},
            'ground_staff': {'email': 'staff@sp.com', 'password': 'password123', 'token': None, 'user_data': None}
        }
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, response_status=None, error=None):
        """Log test results"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED (Status: {response_status})")
        else:
            print(f"❌ {name} - FAILED (Status: {response_status}, Error: {error})")
        
        self.test_results.append({
            'test_name': name,
            'success': success,
            'status_code': response_status,
            'error': error
        })

    def make_request(self, method, endpoint, data=None, token=None):
        """Make HTTP request with error handling"""
        url = f"{self.base_url}{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if token:
            headers['Authorization'] = f'Bearer {token}'

        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'PATCH':
                response = requests.patch(url, json=data, headers=headers)

            return response
        except Exception as e:
            return None

    def test_login_all_roles(self):
        """Test login for all three roles"""
        print("\n🔐 Testing Authentication...")
        
        for role, creds in self.users.items():
            response = self.make_request('POST', '/auth/login', {
                'email': creds['email'],
                'password': creds['password']
            })
            
            if response and response.status_code == 200:
                data = response.json()
                creds['token'] = data.get('token')
                creds['user_data'] = data.get('user')
                self.log_test(f"Login - {role.title()}", True, response.status_code)
            else:
                self.log_test(f"Login - {role.title()}", False, 
                            response.status_code if response else 0, 
                            "Connection failed or invalid credentials")
                return False
        
        return True

    def test_dashboard_stats(self):
        """Test director dashboard stats"""
        print("\n📊 Testing Dashboard Stats...")
        
        director_token = self.users['director']['token']
        response = self.make_request('GET', '/dashboard/stats', token=director_token)
        
        success = response and response.status_code == 200
        self.log_test("Dashboard Stats (Director)", success, response.status_code)
        
        if success:
            stats = response.json()
            print(f"   Stats: Users={stats.get('total_users', 0)}, Tasks={stats.get('total_tasks', 0)}, Reports={stats.get('total_reports', 0)}")
        
        return success

    def test_user_management(self):
        """Test user management functionality"""
        print("\n👥 Testing User Management...")
        
        # Test director can get all users
        director_token = self.users['director']['token']
        response = self.make_request('GET', '/users', token=director_token)
        success = response and response.status_code == 200
        self.log_test("Get Users (Director)", success, response.status_code)
        
        # Test manager can get their team
        manager_token = self.users['manager']['token']
        response = self.make_request('GET', '/users', token=manager_token)
        success = response and response.status_code == 200
        self.log_test("Get Users (Manager)", success, response.status_code)
        
        # Test ground staff cannot access users
        staff_token = self.users['ground_staff']['token']
        response = self.make_request('GET', '/users', token=staff_token)
        success = response and response.status_code == 403
        self.log_test("Get Users Blocked (Ground Staff)", success, response.status_code)
        
        return True

    def test_task_management(self):
        """Test task creation and management"""
        print("\n📋 Testing Task Management...")
        
        # Create task as director
        director_token = self.users['director']['token']
        staff_id = self.users['ground_staff']['user_data']['id']
        
        task_data = {
            'title': 'Test Task from API Test',
            'description': 'This is a test task created during API testing',
            'assigned_to': staff_id,
            'deadline': '2024-12-31T23:59:59'
        }
        
        response = self.make_request('POST', '/tasks', task_data, token=director_token)
        success = response and response.status_code == 200
        self.log_test("Create Task (Director)", success, response.status_code)
        
        if success:
            task_id = response.json()['id']
            
            # Test task update by ground staff
            staff_token = self.users['ground_staff']['token']
            response = self.make_request('PATCH', f'/tasks/{task_id}', 
                                      {'status': 'in_progress'}, token=staff_token)
            success = response and response.status_code == 200
            self.log_test("Update Task Status (Ground Staff)", success, response.status_code)
        
        # Test get tasks for all roles
        for role, creds in self.users.items():
            response = self.make_request('GET', '/tasks', token=creds['token'])
            success = response and response.status_code == 200
            self.log_test(f"Get Tasks ({role.title()})", success, response.status_code)
        
        return True

    def test_location_tracking(self):
        """Test location recording functionality"""
        print("\n📍 Testing Location Tracking...")
        
        # Record location as ground staff
        staff_token = self.users['ground_staff']['token']
        location_data = {
            'latitude': 28.6139,
            'longitude': 77.2090,
            'accuracy': 10.0
        }
        
        response = self.make_request('POST', '/locations', location_data, token=staff_token)
        success = response and response.status_code == 200
        self.log_test("Record Location (Ground Staff)", success, response.status_code)
        
        # Get location history as director
        director_token = self.users['director']['token']
        staff_id = self.users['ground_staff']['user_data']['id']
        response = self.make_request('GET', f'/locations/{staff_id}', token=director_token)
        success = response and response.status_code == 200
        self.log_test("Get Location History (Director)", success, response.status_code)
        
        return True

    def test_reports_system(self):
        """Test reports functionality"""
        print("\n📄 Testing Reports System...")
        
        # Create report as manager
        manager_token = self.users['manager']['token']
        report_data = {
            'type': 'diesel',
            'data': {
                'equipment_id': 'EQ001',
                'running_hours': 8,
                'diesel_consumed': 25.5
            }
        }
        
        response = self.make_request('POST', '/reports', report_data, token=manager_token)
        success = response and response.status_code == 200
        self.log_test("Create Report (Manager)", success, response.status_code)
        
        # Get reports for all roles
        for role, creds in self.users.items():
            response = self.make_request('GET', '/reports', token=creds['token'])
            success = response and response.status_code == 200
            self.log_test(f"Get Reports ({role.title()})", success, response.status_code)
        
        return True

    def test_indents_system(self):
        """Test indents functionality"""
        print("\n📦 Testing Indents System...")
        
        # Create indent as manager
        manager_token = self.users['manager']['token']
        indent_data = {
            'items': [
                {'item': 'Steel Rods', 'quantity': 100, 'unit': 'tons'},
                {'item': 'Cement', 'quantity': 50, 'unit': 'bags'}
            ],
            'notes': 'Urgent requirement for project'
        }
        
        response = self.make_request('POST', '/indents', indent_data, token=manager_token)
        success = response and response.status_code == 200
        self.log_test("Create Indent (Manager)", success, response.status_code)
        
        if success:
            indent_id = response.json()['id']
            
            # Authorize indent as director
            director_token = self.users['director']['token']
            auth_data = {
                'status': 'approved',
                'notes': 'Approved for immediate procurement'
            }
            
            response = self.make_request('PATCH', f'/indents/{indent_id}/authorize', 
                                      auth_data, token=director_token)
            success = response and response.status_code == 200
            self.log_test("Authorize Indent (Director)", success, response.status_code)
        
        # Test ground staff cannot create indents
        staff_token = self.users['ground_staff']['token']
        response = self.make_request('POST', '/indents', indent_data, token=staff_token)
        success = response and response.status_code == 403
        self.log_test("Block Indent Creation (Ground Staff)", success, response.status_code)
        
        return True

    def test_role_based_access(self):
        """Test role-based access control"""
        print("\n🔒 Testing Role-Based Access Control...")
        
        # Test manager cannot authorize indents
        manager_token = self.users['manager']['token']
        response = self.make_request('PATCH', '/indents/dummy-id/authorize', 
                                   {'status': 'approved'}, token=manager_token)
        success = response and response.status_code == 403
        self.log_test("Block Indent Authorization (Manager)", success, response.status_code)
        
        # Test ground staff cannot access dashboard stats
        staff_token = self.users['ground_staff']['token']
        response = self.make_request('GET', '/dashboard/stats', token=staff_token)
        success = response and response.status_code == 403
        self.log_test("Block Dashboard Access (Ground Staff)", success, response.status_code)
        
        return True

    def run_all_tests(self):
        """Run comprehensive API tests"""
        print("🚀 Starting SP Industrial Operating System API Tests")
        print(f"Backend URL: {self.base_url}")
        print("=" * 60)
        
        # Authentication is critical - if it fails, we can't test anything else
        if not self.test_login_all_roles():
            print("\n❌ Authentication failed - stopping tests")
            return False
        
        # Run all other tests
        test_methods = [
            self.test_dashboard_stats,
            self.test_user_management,
            self.test_task_management,
            self.test_location_tracking,
            self.test_reports_system,
            self.test_indents_system,
            self.test_role_based_access
        ]
        
        for test_method in test_methods:
            try:
                test_method()
            except Exception as e:
                print(f"❌ {test_method.__name__} failed with exception: {e}")
        
        # Print summary
        print("\n" + "=" * 60)
        print(f"📊 Test Summary: {self.tests_passed}/{self.tests_run} tests passed")
        print(f"Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        
        return self.tests_passed == self.tests_run

def main():
    tester = SPIndustrialTester()
    success = tester.run_all_tests()
    
    # Save detailed results for reference
    with open('/app/api_test_results.json', 'w') as f:
        json.dump({
            'timestamp': datetime.now().isoformat(),
            'total_tests': tester.tests_run,
            'passed_tests': tester.tests_passed,
            'success_rate': (tester.tests_passed/tester.tests_run*100) if tester.tests_run > 0 else 0,
            'detailed_results': tester.test_results
        }, f, indent=2)
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())