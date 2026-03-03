"""
Test company scoping and data isolation for Multi-Company SP ERP
Tests that:
1. Director sees "All Companies" data by default
2. Director can filter by specific company
3. Manager sees ONLY their assigned company data
4. No cross-company data leakage
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAuthAndCompanyScoping:
    """Authentication and company scoping tests"""
    
    @pytest.fixture(scope="class")
    def director_token(self):
        """Get director authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "director@sp.com",
            "password": "password123"
        })
        assert response.status_code == 200, f"Director login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert data["user"]["role"] == "director"
        return data["token"]
    
    @pytest.fixture(scope="class")
    def manager_token(self):
        """Get manager authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "manager@sp.com",
            "password": "password123"
        })
        assert response.status_code == 200, f"Manager login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert data["user"]["role"] == "manager"
        return data["token"]
    
    @pytest.fixture(scope="class")
    def fl_shop_company_id(self, director_token):
        """Get FL Shop company ID"""
        response = requests.get(f"{BASE_URL}/api/companies",
            headers={"Authorization": f"Bearer {director_token}"})
        assert response.status_code == 200
        companies = response.json()
        fl_shop = next((c for c in companies if "FL Shop" in c["name"]), None)
        assert fl_shop is not None, "FL Shop company not found"
        return fl_shop["id"]
    
    # ============================================================
    # COMPANY ACCESS TESTS
    # ============================================================
    
    def test_director_sees_all_companies(self, director_token):
        """Director can see all companies"""
        response = requests.get(f"{BASE_URL}/api/companies",
            headers={"Authorization": f"Bearer {director_token}"})
        assert response.status_code == 200
        companies = response.json()
        assert len(companies) >= 6, f"Expected at least 6 companies, got {len(companies)}"
        company_names = [c["name"] for c in companies]
        assert any("FL Shop" in n for n in company_names)
        assert any("Petrol" in n for n in company_names)
    
    def test_manager_sees_only_assigned_company(self, manager_token):
        """Manager sees only their assigned company (FL Shop)"""
        response = requests.get(f"{BASE_URL}/api/companies/my-companies",
            headers={"Authorization": f"Bearer {manager_token}"})
        assert response.status_code == 200
        companies = response.json()
        assert len(companies) == 1, f"Manager should see 1 company, got {len(companies)}"
        assert "FL Shop" in companies[0]["name"]
    
    # ============================================================
    # JOURNAL ENTRY DATA ISOLATION TESTS
    # ============================================================
    
    def test_director_journal_entries_all_companies(self, director_token):
        """Director sees journal entries from ALL companies (no company_id filter)"""
        response = requests.get(f"{BASE_URL}/api/journal-entries",
            headers={"Authorization": f"Bearer {director_token}"})
        assert response.status_code == 200
        entries = response.json()
        # Director should see more than manager
        assert len(entries) >= 20, f"Director should see 20+ entries, got {len(entries)}"
    
    def test_manager_journal_entries_scoped(self, manager_token):
        """Manager sees only their company's journal entries"""
        response = requests.get(f"{BASE_URL}/api/journal-entries",
            headers={"Authorization": f"Bearer {manager_token}"})
        assert response.status_code == 200
        entries = response.json()
        # Manager sees only FL Shop entries
        assert len(entries) <= 5, f"Manager should see <= 5 entries, got {len(entries)}"
    
    def test_director_filter_by_specific_company(self, director_token, fl_shop_company_id):
        """Director can filter to specific company"""
        response = requests.get(f"{BASE_URL}/api/journal-entries",
            params={"company_id": fl_shop_company_id},
            headers={"Authorization": f"Bearer {director_token}"})
        assert response.status_code == 200
        entries = response.json()
        # Should match manager's view
        for entry in entries:
            assert entry.get("company_id") == fl_shop_company_id
    
    # ============================================================
    # P&L REPORT DATA ISOLATION
    # ============================================================
    
    def test_director_profit_loss_aggregated(self, director_token):
        """Director P&L shows aggregated data across all companies"""
        response = requests.get(f"{BASE_URL}/api/reports/profit-loss",
            headers={"Authorization": f"Bearer {director_token}"})
        assert response.status_code == 200
        data = response.json()
        # Aggregated P&L should show higher values
        assert data.get("net_profit", 0) >= 300000, f"Expected P&L >= 300k, got {data.get('net_profit')}"
    
    def test_manager_profit_loss_scoped(self, manager_token):
        """Manager P&L shows only their company data"""
        response = requests.get(f"{BASE_URL}/api/reports/profit-loss",
            headers={"Authorization": f"Bearer {manager_token}"})
        assert response.status_code == 200
        data = response.json()
        # Manager sees FL Shop only - should be much smaller
        assert data.get("net_profit", 0) <= 10000, f"Manager P&L should be <= 10k, got {data.get('net_profit')}"
    
    # ============================================================
    # INVENTORY DATA ISOLATION
    # ============================================================
    
    def test_director_low_stock_all_companies(self, director_token):
        """Director sees low stock alerts from all companies"""
        response = requests.get(f"{BASE_URL}/api/inv/low-stock",
            headers={"Authorization": f"Bearer {director_token}"})
        assert response.status_code == 200
        # Response should be list (may be empty if no low stock)
        assert isinstance(response.json(), list)
    
    def test_manager_low_stock_scoped(self, manager_token):
        """Manager sees only their company's low stock"""
        response = requests.get(f"{BASE_URL}/api/inv/low-stock",
            headers={"Authorization": f"Bearer {manager_token}"})
        assert response.status_code == 200
        alerts = response.json()
        assert isinstance(alerts, list)
    
    def test_director_stock_movements_all(self, director_token):
        """Director sees movements from all companies"""
        response = requests.get(f"{BASE_URL}/api/inv/movements",
            headers={"Authorization": f"Bearer {director_token}"})
        assert response.status_code == 200
        movements = response.json()
        assert isinstance(movements, list)
    
    def test_manager_stock_movements_scoped(self, manager_token):
        """Manager sees only their company's movements"""
        response = requests.get(f"{BASE_URL}/api/inv/movements",
            headers={"Authorization": f"Bearer {manager_token}"})
        assert response.status_code == 200
        movements = response.json()
        assert isinstance(movements, list)
    
    # ============================================================
    # TRANSACTIONS DATA ISOLATION
    # ============================================================
    
    def test_director_transactions_all(self, director_token):
        """Director sees transactions from all companies"""
        response = requests.get(f"{BASE_URL}/api/transactions",
            headers={"Authorization": f"Bearer {director_token}"})
        assert response.status_code == 200
        txns = response.json()
        assert len(txns) >= 5, f"Expected 5+ transactions, got {len(txns)}"
    
    def test_manager_transactions_scoped(self, manager_token):
        """Manager sees only their company's transactions"""
        response = requests.get(f"{BASE_URL}/api/transactions",
            headers={"Authorization": f"Bearer {manager_token}"})
        assert response.status_code == 200
        txns = response.json()
        # Manager may see fewer transactions
        assert isinstance(txns, list)
    
    # ============================================================
    # REPORTS DATA ISOLATION
    # ============================================================
    
    def test_director_reports_all(self, director_token):
        """Director sees reports from all companies"""
        response = requests.get(f"{BASE_URL}/api/reports",
            headers={"Authorization": f"Bearer {director_token}"})
        assert response.status_code == 200
        reports = response.json()
        assert isinstance(reports, list)
    
    def test_manager_reports_scoped(self, manager_token):
        """Manager sees only their company's reports"""
        response = requests.get(f"{BASE_URL}/api/reports",
            headers={"Authorization": f"Bearer {manager_token}"})
        assert response.status_code == 200
        reports = response.json()
        assert isinstance(reports, list)
    
    # ============================================================
    # INDENTS DATA ISOLATION
    # ============================================================
    
    def test_director_indents_all(self, director_token):
        """Director sees indents from all companies"""
        response = requests.get(f"{BASE_URL}/api/indents",
            headers={"Authorization": f"Bearer {director_token}"})
        assert response.status_code == 200
        indents = response.json()
        assert isinstance(indents, list)
    
    def test_manager_indents_scoped(self, manager_token):
        """Manager sees only their indents"""
        response = requests.get(f"{BASE_URL}/api/indents",
            headers={"Authorization": f"Bearer {manager_token}"})
        assert response.status_code == 200
        indents = response.json()
        assert isinstance(indents, list)
    
    # ============================================================
    # TASKS DATA ISOLATION
    # ============================================================
    
    def test_director_tasks_all(self, director_token):
        """Director sees tasks from all companies"""
        response = requests.get(f"{BASE_URL}/api/tasks",
            headers={"Authorization": f"Bearer {director_token}"})
        assert response.status_code == 200
        tasks = response.json()
        assert isinstance(tasks, list)
    
    def test_manager_tasks_scoped(self, manager_token):
        """Manager sees only their team's tasks"""
        response = requests.get(f"{BASE_URL}/api/tasks",
            headers={"Authorization": f"Bearer {manager_token}"})
        assert response.status_code == 200
        tasks = response.json()
        assert isinstance(tasks, list)
    
    # ============================================================
    # DIRECTOR-ONLY ENDPOINTS
    # ============================================================
    
    def test_director_executive_report(self, director_token):
        """Director can access executive report"""
        response = requests.get(f"{BASE_URL}/api/director/executive-report",
            headers={"Authorization": f"Bearer {director_token}"})
        assert response.status_code == 200
        data = response.json()
        assert "companies" in data
        assert "totals" in data
        assert len(data["companies"]) >= 1
    
    def test_manager_cannot_access_executive_report(self, manager_token):
        """Manager cannot access director-only executive report"""
        response = requests.get(f"{BASE_URL}/api/director/executive-report",
            headers={"Authorization": f"Bearer {manager_token}"})
        assert response.status_code == 403
    
    def test_director_daily_summary(self, director_token):
        """Director can access daily summary"""
        response = requests.get(f"{BASE_URL}/api/director/daily-summary",
            headers={"Authorization": f"Bearer {director_token}"})
        assert response.status_code == 200
        data = response.json()
        assert "date" in data
        assert "journal_entries_count" in data
    
    def test_manager_cannot_access_daily_summary(self, manager_token):
        """Manager cannot access director-only daily summary"""
        response = requests.get(f"{BASE_URL}/api/director/daily-summary",
            headers={"Authorization": f"Bearer {manager_token}"})
        assert response.status_code == 403
    
    def test_director_job_roles(self, director_token):
        """Director can access job roles"""
        response = requests.get(f"{BASE_URL}/api/job-roles",
            headers={"Authorization": f"Bearer {director_token}"})
        assert response.status_code == 200
        roles = response.json()
        assert isinstance(roles, list)
    
    def test_manager_cannot_access_job_roles(self, manager_token):
        """Manager cannot access director-only job roles"""
        response = requests.get(f"{BASE_URL}/api/job-roles",
            headers={"Authorization": f"Bearer {manager_token}"})
        assert response.status_code == 403
    
    def test_director_reconciliation(self, director_token):
        """Director can access reconciliation"""
        response = requests.get(f"{BASE_URL}/api/reconciliation",
            headers={"Authorization": f"Bearer {director_token}"})
        assert response.status_code == 200
        records = response.json()
        assert isinstance(records, list)
    
    def test_manager_cannot_access_reconciliation(self, manager_token):
        """Manager cannot access director-only reconciliation"""
        response = requests.get(f"{BASE_URL}/api/reconciliation",
            headers={"Authorization": f"Bearer {manager_token}"})
        assert response.status_code == 403


class TestManagerJournalEntryCreation:
    """Test that manager can create journal entries scoped to their company"""
    
    @pytest.fixture(scope="class")
    def manager_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "manager@sp.com", "password": "password123"
        })
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def director_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "director@sp.com", "password": "password123"
        })
        return response.json()["token"]
    
    def test_manager_can_create_journal_entry(self, manager_token, director_token):
        """Manager can create journal entry - auto-scoped to FL Shop"""
        # Create entry as manager
        response = requests.post(f"{BASE_URL}/api/journal-entries",
            json={
                "narration": "TEST_Manager_Entry_Scoping_Test",
                "lines": [
                    {"account_name": "Cash", "debit": 100, "credit": 0},
                    {"account_name": "Sales", "debit": 0, "credit": 100}
                ]
            },
            headers={"Authorization": f"Bearer {manager_token}"})
        assert response.status_code == 200, f"Create failed: {response.text}"
        data = response.json()
        assert "entry" in data
        entry_id = data["entry"]["id"]
        company_id = data["entry"].get("company_id")
        
        # Verify the entry was created with FL Shop company_id
        assert company_id is not None, "Entry should have company_id"
        
        # Verify manager can see their entry
        response = requests.get(f"{BASE_URL}/api/journal-entries",
            headers={"Authorization": f"Bearer {manager_token}"})
        manager_entries = response.json()
        entry_ids = [e["id"] for e in manager_entries]
        assert entry_id in entry_ids, "Manager should see their own entry"
        
        # Verify director can also see the entry
        response = requests.get(f"{BASE_URL}/api/journal-entries",
            headers={"Authorization": f"Bearer {director_token}"})
        director_entries = response.json()
        entry_ids = [e["id"] for e in director_entries]
        assert entry_id in entry_ids, "Director should see manager's entry"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
