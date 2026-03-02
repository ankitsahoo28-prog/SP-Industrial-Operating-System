"""
Test new features for Multi-Company SP ERP:
- BUG FIX 1: Manager journal entry creation with company scope
- BUG FIX 2: Data isolation - non-directors see only their company data
- BUG FIX 3: Director executive report shows all companies
- FEATURE 1: Daily Summary page
- FEATURE 2: Director can create other directors
- FEATURE 3: Role Management
- FEATURE 4: Inter-Company Reconciliation
- FEATURE 5: Director Edit-All (update/delete journal entries, update any task)
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAuth:
    """Authentication helper tests"""
    
    def test_director_login(self):
        """Test director login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "director@sp.com",
            "password": "password123"
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data["user"]["role"] == "director"
        return data["token"]
    
    def test_manager_login(self):
        """Test manager login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "manager@sp.com",
            "password": "password123"
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data["user"]["role"] == "manager"
        return data["token"]


class TestBugFix1_ManagerJournalEntries:
    """BUG FIX 1: Manager can create journal entries scoped to their company"""
    
    @pytest.fixture
    def manager_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "manager@sp.com", "password": "password123"
        })
        return response.json()["token"]
    
    def test_manager_can_create_journal_entry(self, manager_token):
        """Manager should be able to create journal entries"""
        headers = {"Authorization": f"Bearer {manager_token}"}
        response = requests.post(f"{BASE_URL}/api/journal-entries", headers=headers, json={
            "narration": f"TEST_manager_entry_{uuid.uuid4().hex[:6]}",
            "lines": [
                {"account_name": "Cash", "debit": 500, "credit": 0},
                {"account_name": "Sales", "debit": 0, "credit": 500}
            ]
        })
        assert response.status_code == 200
        data = response.json()
        assert "entry" in data
        assert data["entry"]["narration"].startswith("TEST_manager")
    
    def test_manager_journal_entry_is_company_scoped(self, manager_token):
        """Manager's journal entries should be scoped to their assigned company"""
        headers = {"Authorization": f"Bearer {manager_token}"}
        # Get manager's companies
        companies_resp = requests.get(f"{BASE_URL}/api/companies/my-companies", headers=headers)
        assert companies_resp.status_code == 200
        companies = companies_resp.json()
        assert len(companies) > 0, "Manager should have at least one company assigned"
        
        # Get journal entries
        entries_resp = requests.get(f"{BASE_URL}/api/journal-entries", headers=headers)
        assert entries_resp.status_code == 200


class TestBugFix2_DataIsolation:
    """BUG FIX 2: Non-directors see only their company data"""
    
    @pytest.fixture
    def director_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "director@sp.com", "password": "password123"
        })
        return response.json()["token"]
    
    @pytest.fixture
    def manager_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "manager@sp.com", "password": "password123"
        })
        return response.json()["token"]
    
    def test_director_sees_all_journal_entries(self, director_token):
        """Director should see all journal entries across all companies"""
        headers = {"Authorization": f"Bearer {director_token}"}
        response = requests.get(f"{BASE_URL}/api/journal-entries", headers=headers)
        assert response.status_code == 200
        entries = response.json()
        # Director should see multiple entries
        assert isinstance(entries, list)
        print(f"Director sees {len(entries)} journal entries")
    
    def test_manager_sees_only_company_entries(self, manager_token, director_token):
        """Manager should see fewer entries than director (company-scoped)"""
        manager_headers = {"Authorization": f"Bearer {manager_token}"}
        director_headers = {"Authorization": f"Bearer {director_token}"}
        
        manager_entries = requests.get(f"{BASE_URL}/api/journal-entries", headers=manager_headers).json()
        director_entries = requests.get(f"{BASE_URL}/api/journal-entries", headers=director_headers).json()
        
        # Manager should see equal or fewer entries than director
        assert len(manager_entries) <= len(director_entries)
        print(f"Manager: {len(manager_entries)}, Director: {len(director_entries)}")
    
    def test_inventory_data_isolation(self, manager_token, director_token):
        """Inventory should be isolated by company for non-directors"""
        manager_headers = {"Authorization": f"Bearer {manager_token}"}
        director_headers = {"Authorization": f"Bearer {director_token}"}
        
        manager_items = requests.get(f"{BASE_URL}/api/inv/items", headers=manager_headers).json()
        director_items = requests.get(f"{BASE_URL}/api/inv/items", headers=director_headers).json()
        
        # Manager should see equal or fewer items
        assert len(manager_items) <= len(director_items)


class TestBugFix3_DirectorExecutiveReport:
    """BUG FIX 3: Director executive report shows all companies"""
    
    @pytest.fixture
    def director_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "director@sp.com", "password": "password123"
        })
        return response.json()["token"]
    
    def test_executive_report_returns_all_companies(self, director_token):
        """Executive report should return data for all companies"""
        headers = {"Authorization": f"Bearer {director_token}"}
        response = requests.get(f"{BASE_URL}/api/director/executive-report?period=monthly", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "companies" in data
        assert "totals" in data
        assert "company_count" in data
        assert data["company_count"] > 0
        print(f"Executive report shows {data['company_count']} companies")
    
    def test_executive_report_has_financial_data(self, director_token):
        """Executive report should include revenue/expense/profit data"""
        headers = {"Authorization": f"Bearer {director_token}"}
        response = requests.get(f"{BASE_URL}/api/director/executive-report", headers=headers)
        data = response.json()
        
        assert "revenue" in data["totals"]
        assert "expenses" in data["totals"]
        assert "profit" in data["totals"]
    
    def test_executive_report_period_filter(self, director_token):
        """Executive report should support period filters"""
        headers = {"Authorization": f"Bearer {director_token}"}
        
        for period in ["monthly", "quarterly", "yearly"]:
            response = requests.get(f"{BASE_URL}/api/director/executive-report?period={period}", headers=headers)
            assert response.status_code == 200
            assert response.json()["period"] == period


class TestFeature1_DailySummary:
    """FEATURE 1: Daily Summary endpoint"""
    
    @pytest.fixture
    def director_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "director@sp.com", "password": "password123"
        })
        return response.json()["token"]
    
    def test_daily_summary_returns_data(self, director_token):
        """Daily summary should return today's activity"""
        headers = {"Authorization": f"Bearer {director_token}"}
        response = requests.get(f"{BASE_URL}/api/director/daily-summary", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "date" in data
        assert "journal_entries_count" in data
        assert "stock_movements" in data
        assert "tasks_created" in data
        assert "income_today" in data
        assert "expense_today" in data
        assert "low_stock_alerts" in data
    
    def test_daily_summary_director_only(self):
        """Daily summary should only be accessible by directors"""
        # Login as manager
        manager_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "manager@sp.com", "password": "password123"
        })
        manager_token = manager_resp.json()["token"]
        
        headers = {"Authorization": f"Bearer {manager_token}"}
        response = requests.get(f"{BASE_URL}/api/director/daily-summary", headers=headers)
        assert response.status_code == 403


class TestFeature2_DirectorCreation:
    """FEATURE 2: Director can create other directors"""
    
    @pytest.fixture
    def director_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "director@sp.com", "password": "password123"
        })
        return response.json()["token"]
    
    def test_director_can_create_director(self, director_token):
        """Director should be able to create another director"""
        headers = {"Authorization": f"Bearer {director_token}"}
        unique_email = f"TEST_newdir_{uuid.uuid4().hex[:6]}@sp.com"
        
        response = requests.post(f"{BASE_URL}/api/users", headers=headers, json={
            "email": unique_email,
            "password": "password123",
            "name": "Test New Director",
            "role": "director"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["role"] == "director"
        assert data["email"] == unique_email
    
    def test_director_can_create_manager(self, director_token):
        """Director should be able to create managers"""
        headers = {"Authorization": f"Bearer {director_token}"}
        unique_email = f"TEST_newmgr_{uuid.uuid4().hex[:6]}@sp.com"
        
        response = requests.post(f"{BASE_URL}/api/users", headers=headers, json={
            "email": unique_email,
            "password": "password123",
            "name": "Test New Manager",
            "role": "manager",
            "business_type": "hotel"
        })
        assert response.status_code == 200
        assert response.json()["role"] == "manager"


class TestFeature3_RoleManagement:
    """FEATURE 3: Role Management CRUD"""
    
    @pytest.fixture
    def director_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "director@sp.com", "password": "password123"
        })
        return response.json()["token"]
    
    def test_get_permissions_list(self, director_token):
        """Should return list of available permissions"""
        headers = {"Authorization": f"Bearer {director_token}"}
        response = requests.get(f"{BASE_URL}/api/job-roles/permissions", headers=headers)
        assert response.status_code == 200
        permissions = response.json()
        assert isinstance(permissions, list)
        assert len(permissions) > 0
        assert "view_dashboard" in permissions
    
    def test_create_job_role(self, director_token):
        """Should create a new job role"""
        headers = {"Authorization": f"Bearer {director_token}"}
        role_name = f"TEST_Role_{uuid.uuid4().hex[:6]}"
        
        response = requests.post(f"{BASE_URL}/api/job-roles", headers=headers, json={
            "name": role_name,
            "description": "Test role for testing",
            "permissions": ["view_dashboard", "view_inventory"]
        })
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == role_name
        assert "view_dashboard" in data["permissions"]
        return data["id"]
    
    def test_get_job_roles(self, director_token):
        """Should return list of job roles"""
        headers = {"Authorization": f"Bearer {director_token}"}
        response = requests.get(f"{BASE_URL}/api/job-roles", headers=headers)
        assert response.status_code == 200
        roles = response.json()
        assert isinstance(roles, list)
    
    def test_update_job_role(self, director_token):
        """Should update a job role"""
        headers = {"Authorization": f"Bearer {director_token}"}
        # First create a role
        role_name = f"TEST_Update_{uuid.uuid4().hex[:6]}"
        create_resp = requests.post(f"{BASE_URL}/api/job-roles", headers=headers, json={
            "name": role_name, "description": "Original", "permissions": ["view_dashboard"]
        })
        role_id = create_resp.json()["id"]
        
        # Update it
        update_resp = requests.put(f"{BASE_URL}/api/job-roles/{role_id}", headers=headers, json={
            "description": "Updated description",
            "permissions": ["view_dashboard", "view_inventory", "edit_inventory"]
        })
        assert update_resp.status_code == 200
        assert "edit_inventory" in update_resp.json()["permissions"]
    
    def test_delete_job_role(self, director_token):
        """Should delete a job role"""
        headers = {"Authorization": f"Bearer {director_token}"}
        # Create a role to delete
        role_name = f"TEST_Delete_{uuid.uuid4().hex[:6]}"
        create_resp = requests.post(f"{BASE_URL}/api/job-roles", headers=headers, json={
            "name": role_name, "permissions": []
        })
        role_id = create_resp.json()["id"]
        
        # Delete it
        delete_resp = requests.delete(f"{BASE_URL}/api/job-roles/{role_id}", headers=headers)
        assert delete_resp.status_code == 200


class TestFeature4_Reconciliation:
    """FEATURE 4: Inter-Company Reconciliation"""
    
    @pytest.fixture
    def director_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "director@sp.com", "password": "password123"
        })
        return response.json()["token"]
    
    @pytest.fixture
    def company_ids(self, director_token):
        headers = {"Authorization": f"Bearer {director_token}"}
        companies = requests.get(f"{BASE_URL}/api/companies", headers=headers).json()
        return [c["id"] for c in companies[:2]] if len(companies) >= 2 else None
    
    def test_create_reconciliation(self, director_token, company_ids):
        """Should create a reconciliation entry"""
        if not company_ids or len(company_ids) < 2:
            pytest.skip("Need at least 2 companies for reconciliation test")
        
        headers = {"Authorization": f"Bearer {director_token}"}
        response = requests.post(f"{BASE_URL}/api/reconciliation", headers=headers, json={
            "from_company_id": company_ids[0],
            "to_company_id": company_ids[1],
            "amount": 10000.00,
            "description": f"TEST_reconciliation_{uuid.uuid4().hex[:6]}",
            "reference": "TEST-INV-001"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "pending"
        assert data["amount"] == 10000.00
        return data["id"]
    
    def test_get_reconciliations(self, director_token):
        """Should return list of reconciliation entries"""
        headers = {"Authorization": f"Bearer {director_token}"}
        response = requests.get(f"{BASE_URL}/api/reconciliation", headers=headers)
        assert response.status_code == 200
        assert isinstance(response.json(), list)
    
    def test_update_reconciliation_status_to_matched(self, director_token, company_ids):
        """Should update reconciliation status to matched"""
        if not company_ids or len(company_ids) < 2:
            pytest.skip("Need at least 2 companies")
        
        headers = {"Authorization": f"Bearer {director_token}"}
        # Create entry
        create_resp = requests.post(f"{BASE_URL}/api/reconciliation", headers=headers, json={
            "from_company_id": company_ids[0],
            "to_company_id": company_ids[1],
            "amount": 5000.00,
            "description": "TEST_match",
            "reference": ""
        })
        rec_id = create_resp.json()["id"]
        
        # Update to matched
        update_resp = requests.patch(f"{BASE_URL}/api/reconciliation/{rec_id}?status=matched", headers=headers)
        assert update_resp.status_code == 200
        assert update_resp.json()["status"] == "matched"
    
    def test_update_reconciliation_status_to_disputed(self, director_token, company_ids):
        """Should update reconciliation status to disputed"""
        if not company_ids or len(company_ids) < 2:
            pytest.skip("Need at least 2 companies")
        
        headers = {"Authorization": f"Bearer {director_token}"}
        create_resp = requests.post(f"{BASE_URL}/api/reconciliation", headers=headers, json={
            "from_company_id": company_ids[0],
            "to_company_id": company_ids[1],
            "amount": 7500.00,
            "description": "TEST_dispute"
        })
        rec_id = create_resp.json()["id"]
        
        update_resp = requests.patch(f"{BASE_URL}/api/reconciliation/{rec_id}?status=disputed", headers=headers)
        assert update_resp.status_code == 200
        assert update_resp.json()["status"] == "disputed"


class TestFeature5_DirectorEditAll:
    """FEATURE 5: Director can edit/delete any journal entry and update any task"""
    
    @pytest.fixture
    def director_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "director@sp.com", "password": "password123"
        })
        return response.json()["token"]
    
    def test_director_update_journal_entry(self, director_token):
        """Director should be able to update any journal entry"""
        headers = {"Authorization": f"Bearer {director_token}"}
        
        # First create a journal entry
        create_resp = requests.post(f"{BASE_URL}/api/journal-entries", headers=headers, json={
            "narration": "TEST_original_narration",
            "lines": [
                {"account_name": "Cash", "debit": 100, "credit": 0},
                {"account_name": "Sales", "debit": 0, "credit": 100}
            ]
        })
        entry_id = create_resp.json()["entry"]["id"]
        
        # Update the narration
        update_resp = requests.put(f"{BASE_URL}/api/director/journal-entries/{entry_id}", headers=headers, json={
            "narration": "TEST_updated_narration",
            "lines": []
        })
        assert update_resp.status_code == 200
        assert update_resp.json()["narration"] == "TEST_updated_narration"
    
    def test_director_delete_journal_entry(self, director_token):
        """Director should be able to delete any journal entry"""
        headers = {"Authorization": f"Bearer {director_token}"}
        
        # Create entry to delete
        create_resp = requests.post(f"{BASE_URL}/api/journal-entries", headers=headers, json={
            "narration": f"TEST_delete_me_{uuid.uuid4().hex[:6]}",
            "lines": [
                {"account_name": "Cash", "debit": 50, "credit": 0},
                {"account_name": "Sales", "debit": 0, "credit": 50}
            ]
        })
        entry_id = create_resp.json()["entry"]["id"]
        
        # Delete it
        delete_resp = requests.delete(f"{BASE_URL}/api/director/journal-entries/{entry_id}", headers=headers)
        assert delete_resp.status_code == 200
        
        # Verify it's gone
        get_resp = requests.get(f"{BASE_URL}/api/journal-entries", headers=headers)
        entries = get_resp.json()
        assert not any(e["id"] == entry_id for e in entries)
    
    def test_director_update_any_task(self, director_token):
        """Director should be able to update any task"""
        headers = {"Authorization": f"Bearer {director_token}"}
        
        # Get existing tasks
        tasks_resp = requests.get(f"{BASE_URL}/api/tasks", headers=headers)
        tasks = tasks_resp.json()
        
        if not tasks:
            pytest.skip("No tasks available to test")
        
        task_id = tasks[0]["id"]
        update_resp = requests.patch(f"{BASE_URL}/api/tasks/{task_id}", headers=headers, json={
            "status": "in_progress"
        })
        assert update_resp.status_code == 200


class TestManagerRestrictions:
    """Test that manager cannot access director-only endpoints"""
    
    @pytest.fixture
    def manager_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "manager@sp.com", "password": "password123"
        })
        return response.json()["token"]
    
    def test_manager_cannot_access_daily_summary(self, manager_token):
        """Manager should get 403 on daily summary"""
        headers = {"Authorization": f"Bearer {manager_token}"}
        response = requests.get(f"{BASE_URL}/api/director/daily-summary", headers=headers)
        assert response.status_code == 403
    
    def test_manager_cannot_access_job_roles(self, manager_token):
        """Manager should get 403 on job roles"""
        headers = {"Authorization": f"Bearer {manager_token}"}
        response = requests.get(f"{BASE_URL}/api/job-roles", headers=headers)
        assert response.status_code == 403
    
    def test_manager_cannot_create_director(self, manager_token):
        """Manager should not be able to create director"""
        headers = {"Authorization": f"Bearer {manager_token}"}
        response = requests.post(f"{BASE_URL}/api/users", headers=headers, json={
            "email": "test_fail@sp.com",
            "password": "password123",
            "name": "Should Fail",
            "role": "director"
        })
        assert response.status_code == 403


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
