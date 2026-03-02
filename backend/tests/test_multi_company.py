"""
Test Multi-Company Management System for SP GROUP ERP
Features tested:
- Company CRUD with auto Chart of Accounts
- User assignment to companies
- Role-based access control (Director sees all, Manager sees assigned)
- Soft delete + restore
- Activate/deactivate companies
- Director executive reporting dashboard
- Data isolation (company_id) for all modules
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
DIRECTOR_CREDS = {"email": "director@sp.com", "password": "password123"}
MANAGER_CREDS = {"email": "manager@sp.com", "password": "password123"}
STAFF_CREDS = {"email": "staff@sp.com", "password": "password123"}


# ===================== FIXTURES =====================

@pytest.fixture(scope="module")
def director_token():
    """Get director authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json=DIRECTOR_CREDS)
    assert response.status_code == 200, f"Director login failed: {response.text}"
    return response.json()["token"]


@pytest.fixture(scope="module")
def manager_token():
    """Get manager authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json=MANAGER_CREDS)
    assert response.status_code == 200, f"Manager login failed: {response.text}"
    return response.json()["token"]


@pytest.fixture(scope="module")
def staff_token():
    """Get staff authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json=STAFF_CREDS)
    assert response.status_code == 200, f"Staff login failed: {response.text}"
    return response.json()["token"]


@pytest.fixture(scope="module")
def director_headers(director_token):
    return {"Authorization": f"Bearer {director_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def manager_headers(manager_token):
    return {"Authorization": f"Bearer {manager_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def staff_headers(staff_token):
    return {"Authorization": f"Bearer {staff_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def manager_user_id(manager_token):
    """Get manager user ID"""
    headers = {"Authorization": f"Bearer {manager_token}"}
    response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
    assert response.status_code == 200
    return response.json()["id"]


# ===================== COMPANY CRUD TESTS =====================

class TestCompanyCRUD:
    """Test Company CRUD operations"""
    
    def test_director_get_all_companies(self, director_headers):
        """Director should see all companies"""
        response = requests.get(f"{BASE_URL}/api/companies", headers=director_headers)
        assert response.status_code == 200
        companies = response.json()
        assert isinstance(companies, list)
        assert len(companies) >= 6  # 6 default companies + possibly more
        # Verify company structure
        for c in companies:
            assert "id" in c
            assert "name" in c
            assert "business_type" in c
            assert "status" in c
    
    def test_create_company_with_auto_coa(self, director_headers):
        """Creating company should auto-seed Chart of Accounts"""
        unique_name = f"TEST_Company_{uuid.uuid4().hex[:8]}"
        payload = {
            "name": unique_name,
            "business_type": "hotel",
            "fy_start": "April",
            "gst_number": "22AAAAA0000A1Z5",
            "currency": "INR"
        }
        response = requests.post(f"{BASE_URL}/api/companies", headers=director_headers, json=payload)
        assert response.status_code == 200
        company = response.json()
        assert company["name"] == unique_name
        assert company["business_type"] == "hotel"
        assert company["status"] == "active"
        assert "id" in company
        
        # Verify Chart of Accounts was seeded for this company
        company_id = company["id"]
        accounts_response = requests.get(
            f"{BASE_URL}/api/accounts?company_id={company_id}",
            headers=director_headers
        )
        assert accounts_response.status_code == 200
        accounts = accounts_response.json()
        assert len(accounts) > 0  # Should have default accounts
        # Check key accounts exist
        account_names = [a["name"] for a in accounts]
        assert "Cash" in account_names
        assert "Bank" in account_names
        assert "Sales" in account_names
        
        return company_id
    
    def test_manager_cannot_create_company(self, manager_headers):
        """Manager should not be able to create companies"""
        payload = {"name": "Manager Company", "business_type": "hotel"}
        response = requests.post(f"{BASE_URL}/api/companies", headers=manager_headers, json=payload)
        assert response.status_code == 403
    
    def test_update_company(self, director_headers):
        """Director can update company details"""
        # First create a company
        unique_name = f"TEST_Update_{uuid.uuid4().hex[:8]}"
        create_resp = requests.post(
            f"{BASE_URL}/api/companies",
            headers=director_headers,
            json={"name": unique_name, "business_type": "transport"}
        )
        assert create_resp.status_code == 200
        company_id = create_resp.json()["id"]
        
        # Update the company
        update_payload = {"name": f"{unique_name}_Updated", "gst_number": "33BBBBB0000B2Z6"}
        update_resp = requests.put(
            f"{BASE_URL}/api/companies/{company_id}",
            headers=director_headers,
            json=update_payload
        )
        assert update_resp.status_code == 200
        updated = update_resp.json()
        assert updated["name"] == f"{unique_name}_Updated"
        assert updated["gst_number"] == "33BBBBB0000B2Z6"


# ===================== SOFT DELETE & RESTORE TESTS =====================

class TestSoftDeleteRestore:
    """Test soft delete and restore company"""
    
    def test_soft_delete_company(self, director_headers):
        """Soft delete should mark status as 'deleted'"""
        # Create a company to delete
        unique_name = f"TEST_Delete_{uuid.uuid4().hex[:8]}"
        create_resp = requests.post(
            f"{BASE_URL}/api/companies",
            headers=director_headers,
            json={"name": unique_name, "business_type": "fl_shop"}
        )
        assert create_resp.status_code == 200
        company_id = create_resp.json()["id"]
        
        # Soft delete
        delete_resp = requests.delete(
            f"{BASE_URL}/api/companies/{company_id}",
            headers=director_headers
        )
        assert delete_resp.status_code == 200
        
        # Verify it's not in regular list
        list_resp = requests.get(f"{BASE_URL}/api/companies", headers=director_headers)
        company_ids = [c["id"] for c in list_resp.json()]
        assert company_id not in company_ids
        
        # Verify it appears when including deleted
        list_deleted_resp = requests.get(
            f"{BASE_URL}/api/companies?include_deleted=true",
            headers=director_headers
        )
        all_companies = list_deleted_resp.json()
        deleted_company = next((c for c in all_companies if c["id"] == company_id), None)
        assert deleted_company is not None
        assert deleted_company["status"] == "deleted"
        
        return company_id
    
    def test_restore_company(self, director_headers):
        """Restore should change status back to active"""
        # Create and delete a company
        unique_name = f"TEST_Restore_{uuid.uuid4().hex[:8]}"
        create_resp = requests.post(
            f"{BASE_URL}/api/companies",
            headers=director_headers,
            json={"name": unique_name, "business_type": "stone_crusher"}
        )
        company_id = create_resp.json()["id"]
        
        # Delete it
        requests.delete(f"{BASE_URL}/api/companies/{company_id}", headers=director_headers)
        
        # Restore it
        restore_resp = requests.post(
            f"{BASE_URL}/api/companies/{company_id}/restore",
            headers=director_headers
        )
        assert restore_resp.status_code == 200
        
        # Verify it's back in regular list
        list_resp = requests.get(f"{BASE_URL}/api/companies", headers=director_headers)
        restored = next((c for c in list_resp.json() if c["id"] == company_id), None)
        assert restored is not None
        assert restored["status"] == "active"


# ===================== ACTIVATE/DEACTIVATE TESTS =====================

class TestActivateDeactivate:
    """Test company activate/deactivate"""
    
    def test_deactivate_company(self, director_headers):
        """Deactivate company should set status to inactive"""
        # Create company
        unique_name = f"TEST_Deact_{uuid.uuid4().hex[:8]}"
        create_resp = requests.post(
            f"{BASE_URL}/api/companies",
            headers=director_headers,
            json={"name": unique_name, "business_type": "petrol_pump"}
        )
        company_id = create_resp.json()["id"]
        
        # Deactivate
        deact_resp = requests.post(
            f"{BASE_URL}/api/companies/{company_id}/deactivate",
            headers=director_headers
        )
        assert deact_resp.status_code == 200
        
        # Verify status
        list_resp = requests.get(f"{BASE_URL}/api/companies", headers=director_headers)
        company = next((c for c in list_resp.json() if c["id"] == company_id), None)
        assert company["status"] == "inactive"
        
        return company_id
    
    def test_activate_company(self, director_headers):
        """Activate company should set status to active"""
        # Create and deactivate
        unique_name = f"TEST_Act_{uuid.uuid4().hex[:8]}"
        create_resp = requests.post(
            f"{BASE_URL}/api/companies",
            headers=director_headers,
            json={"name": unique_name, "business_type": "slag_crushing"}
        )
        company_id = create_resp.json()["id"]
        requests.post(f"{BASE_URL}/api/companies/{company_id}/deactivate", headers=director_headers)
        
        # Activate
        act_resp = requests.post(
            f"{BASE_URL}/api/companies/{company_id}/activate",
            headers=director_headers
        )
        assert act_resp.status_code == 200
        
        # Verify
        list_resp = requests.get(f"{BASE_URL}/api/companies", headers=director_headers)
        company = next((c for c in list_resp.json() if c["id"] == company_id), None)
        assert company["status"] == "active"


# ===================== USER ASSIGNMENT TESTS =====================

class TestUserAssignment:
    """Test user assignment to companies"""
    
    def test_assign_user_to_company(self, director_headers, manager_user_id):
        """Director can assign users to companies"""
        # Create a company
        unique_name = f"TEST_Assign_{uuid.uuid4().hex[:8]}"
        create_resp = requests.post(
            f"{BASE_URL}/api/companies",
            headers=director_headers,
            json={"name": unique_name, "business_type": "transport"}
        )
        company_id = create_resp.json()["id"]
        
        # Assign manager to company
        assign_resp = requests.post(
            f"{BASE_URL}/api/companies/assign-user",
            headers=director_headers,
            json={"user_id": manager_user_id, "company_id": company_id}
        )
        assert assign_resp.status_code == 200
        
        # Verify assignment
        users_resp = requests.get(
            f"{BASE_URL}/api/companies/{company_id}/users",
            headers=director_headers
        )
        assert users_resp.status_code == 200
        users = users_resp.json()
        user_ids = [u["id"] for u in users]
        assert manager_user_id in user_ids
        
        return company_id
    
    def test_remove_user_from_company(self, director_headers, manager_user_id):
        """Director can remove users from companies"""
        # Create and assign
        unique_name = f"TEST_Remove_{uuid.uuid4().hex[:8]}"
        create_resp = requests.post(
            f"{BASE_URL}/api/companies",
            headers=director_headers,
            json={"name": unique_name, "business_type": "hotel"}
        )
        company_id = create_resp.json()["id"]
        
        # Assign first
        requests.post(
            f"{BASE_URL}/api/companies/assign-user",
            headers=director_headers,
            json={"user_id": manager_user_id, "company_id": company_id}
        )
        
        # Remove
        remove_resp = requests.post(
            f"{BASE_URL}/api/companies/remove-user",
            headers=director_headers,
            json={"user_id": manager_user_id, "company_id": company_id}
        )
        assert remove_resp.status_code == 200
        
        # Verify removal
        users_resp = requests.get(
            f"{BASE_URL}/api/companies/{company_id}/users",
            headers=director_headers
        )
        users = users_resp.json()
        user_ids = [u["id"] for u in users]
        assert manager_user_id not in user_ids
    
    def test_manager_cannot_assign_users(self, manager_headers, manager_user_id):
        """Manager cannot assign users to companies"""
        # Get any company from manager's list
        companies_resp = requests.get(f"{BASE_URL}/api/companies/my-companies", headers=manager_headers)
        companies = companies_resp.json()
        if companies:
            company_id = companies[0]["id"]
            assign_resp = requests.post(
                f"{BASE_URL}/api/companies/assign-user",
                headers=manager_headers,
                json={"user_id": manager_user_id, "company_id": company_id}
            )
            assert assign_resp.status_code == 403


# ===================== ROLE-BASED ACCESS TESTS =====================

class TestRoleBasedAccess:
    """Test role-based access control for companies"""
    
    def test_director_sees_all_companies(self, director_headers):
        """Director sees all companies"""
        response = requests.get(f"{BASE_URL}/api/companies", headers=director_headers)
        assert response.status_code == 200
        companies = response.json()
        # Director should see all 6 default companies + any test companies
        assert len(companies) >= 6
    
    def test_manager_sees_only_assigned_companies(self, manager_headers):
        """Manager only sees assigned companies via my-companies"""
        response = requests.get(f"{BASE_URL}/api/companies/my-companies", headers=manager_headers)
        assert response.status_code == 200
        companies = response.json()
        # Manager should see only assigned companies (at least 1 - SP FL Shop from context)
        assert len(companies) >= 1
        # All returned companies should have active status
        for c in companies:
            assert c["status"] == "active"
    
    def test_staff_cannot_access_company_crud(self, staff_headers):
        """Staff cannot create companies"""
        response = requests.post(
            f"{BASE_URL}/api/companies",
            headers=staff_headers,
            json={"name": "Staff Company", "business_type": "hotel"}
        )
        assert response.status_code == 403


# ===================== EXECUTIVE REPORT TESTS =====================

class TestExecutiveReport:
    """Test Director executive reporting dashboard"""
    
    def test_executive_report_monthly(self, director_headers):
        """Executive report with monthly period"""
        response = requests.get(
            f"{BASE_URL}/api/director/executive-report?period=monthly",
            headers=director_headers
        )
        assert response.status_code == 200
        report = response.json()
        assert "companies" in report
        assert "totals" in report
        assert "period" in report
        assert report["period"] == "monthly"
        assert "company_count" in report
        # Verify company structure
        for c in report["companies"]:
            assert "company_id" in c
            assert "company_name" in c
            assert "revenue" in c
            assert "expenses" in c
            assert "profit" in c
            assert "cash_position" in c
            assert "inventory_value" in c
    
    def test_executive_report_quarterly(self, director_headers):
        """Executive report with quarterly period"""
        response = requests.get(
            f"{BASE_URL}/api/director/executive-report?period=quarterly",
            headers=director_headers
        )
        assert response.status_code == 200
        report = response.json()
        assert report["period"] == "quarterly"
    
    def test_executive_report_yearly(self, director_headers):
        """Executive report with yearly period"""
        response = requests.get(
            f"{BASE_URL}/api/director/executive-report?period=yearly",
            headers=director_headers
        )
        assert response.status_code == 200
        report = response.json()
        assert report["period"] == "yearly"
    
    def test_executive_report_single_company(self, director_headers):
        """Executive report for single company"""
        # Get a company ID
        companies_resp = requests.get(f"{BASE_URL}/api/companies", headers=director_headers)
        companies = companies_resp.json()
        company_id = companies[0]["id"]
        
        response = requests.get(
            f"{BASE_URL}/api/director/executive-report?company_id={company_id}",
            headers=director_headers
        )
        assert response.status_code == 200
        report = response.json()
        assert report["company_count"] == 1
        assert len(report["companies"]) == 1
        assert report["companies"][0]["company_id"] == company_id
    
    def test_manager_cannot_access_executive_report(self, manager_headers):
        """Manager cannot access executive report"""
        response = requests.get(
            f"{BASE_URL}/api/director/executive-report",
            headers=manager_headers
        )
        assert response.status_code == 403


# ===================== DATA ISOLATION TESTS =====================

class TestDataIsolation:
    """Test company_id data isolation for modules"""
    
    def test_journal_entries_company_scoped(self, director_headers):
        """Journal entries should be scoped by company_id"""
        # Get a company
        companies_resp = requests.get(f"{BASE_URL}/api/companies", headers=director_headers)
        company_id = companies_resp.json()[0]["id"]
        
        response = requests.get(
            f"{BASE_URL}/api/journal-entries?company_id={company_id}",
            headers=director_headers
        )
        assert response.status_code == 200
        # Entries should be empty or all have the same company_id
        entries = response.json()
        for entry in entries:
            if "company_id" in entry:
                assert entry["company_id"] == company_id
    
    def test_trial_balance_company_scoped(self, director_headers):
        """Trial balance should be scoped by company_id"""
        companies_resp = requests.get(f"{BASE_URL}/api/companies", headers=director_headers)
        company_id = companies_resp.json()[0]["id"]
        
        response = requests.get(
            f"{BASE_URL}/api/reports/trial-balance?company_id={company_id}",
            headers=director_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "rows" in data
        assert "total_debit" in data
        assert "total_credit" in data
    
    def test_accounts_company_scoped(self, director_headers):
        """Chart of accounts should be scoped by company_id"""
        companies_resp = requests.get(f"{BASE_URL}/api/companies", headers=director_headers)
        company_id = companies_resp.json()[0]["id"]
        
        response = requests.get(
            f"{BASE_URL}/api/accounts?company_id={company_id}",
            headers=director_headers
        )
        assert response.status_code == 200
        accounts = response.json()
        # All accounts should belong to this company
        for acc in accounts:
            assert acc.get("company_id") == company_id
    
    def test_task_creation_with_company_id(self, director_headers):
        """Tasks can be created with company_id scope"""
        # Get users
        users_resp = requests.get(f"{BASE_URL}/api/users", headers=director_headers)
        users = users_resp.json()
        if not users:
            pytest.skip("No users available")
        user_id = users[0]["id"]
        
        # Get a company
        companies_resp = requests.get(f"{BASE_URL}/api/companies", headers=director_headers)
        company_id = companies_resp.json()[0]["id"]
        
        # Create task with company_id
        task_payload = {
            "title": f"TEST_Task_{uuid.uuid4().hex[:8]}",
            "description": "Test task for company",
            "assigned_to": user_id
        }
        response = requests.post(
            f"{BASE_URL}/api/tasks?company_id={company_id}",
            headers=director_headers,
            json=task_payload
        )
        assert response.status_code == 200
        task = response.json()
        assert task["title"].startswith("TEST_Task_")


# ===================== COMPANY USERS TESTS =====================

class TestCompanyUsers:
    """Test getting users assigned to a company"""
    
    def test_get_company_users(self, director_headers):
        """Get users assigned to a company"""
        # Get first company
        companies_resp = requests.get(f"{BASE_URL}/api/companies", headers=director_headers)
        company_id = companies_resp.json()[0]["id"]
        
        response = requests.get(
            f"{BASE_URL}/api/companies/{company_id}/users",
            headers=director_headers
        )
        assert response.status_code == 200
        users = response.json()
        assert isinstance(users, list)
        # Verify user structure
        for u in users:
            assert "id" in u
            assert "email" in u
            assert "name" in u
            assert "role" in u


# ===================== CLEANUP =====================

@pytest.fixture(scope="module", autouse=True)
def cleanup(director_headers):
    """Cleanup test data after all tests"""
    yield
    # Delete TEST_ prefixed companies
    companies_resp = requests.get(
        f"{BASE_URL}/api/companies?include_deleted=true",
        headers=director_headers
    )
    if companies_resp.status_code == 200:
        for company in companies_resp.json():
            if company["name"].startswith("TEST_"):
                requests.delete(
                    f"{BASE_URL}/api/companies/{company['id']}",
                    headers=director_headers
                )
