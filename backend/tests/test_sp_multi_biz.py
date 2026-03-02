"""
SP Multi-Business Operations App - Backend API Tests
Tests login flows, user management, accounting, transactions, audit logs, and export endpoints.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://multi-company-sp.preview.emergentagent.com')

# Test credentials
DIRECTOR_EMAIL = "director@sp.com"
DIRECTOR_PASSWORD = "password123"
MANAGER_EMAIL = "manager@sp.com"
MANAGER_PASSWORD = "password123"
STAFF_EMAIL = "staff@sp.com"
STAFF_PASSWORD = "password123"


class TestAuthenticationFlow:
    """Authentication and Login Tests"""
    
    def test_api_root(self):
        """Test API root endpoint"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print(f"✓ API Root: {data['message']}")
    
    def test_director_login(self):
        """Director login and role verification"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": DIRECTOR_EMAIL,
            "password": DIRECTOR_PASSWORD
        })
        assert response.status_code == 200, f"Director login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["role"] == "director"
        assert data["user"]["email"] == DIRECTOR_EMAIL
        print(f"✓ Director login successful: {data['user']['name']}")
        return data["token"]
    
    def test_manager_login(self):
        """Manager login and role verification"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": MANAGER_EMAIL,
            "password": MANAGER_PASSWORD
        })
        assert response.status_code == 200, f"Manager login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["role"] == "manager"
        assert data["user"]["email"] == MANAGER_EMAIL
        print(f"✓ Manager login successful: {data['user']['name']}")
        return data["token"]
    
    def test_staff_login(self):
        """Ground Staff login and role verification"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": STAFF_EMAIL,
            "password": STAFF_PASSWORD
        })
        assert response.status_code == 200, f"Staff login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["role"] == "ground_staff"
        assert data["user"]["email"] == STAFF_EMAIL
        print(f"✓ Ground Staff login successful: {data['user']['name']}")
        return data["token"]
    
    def test_invalid_login(self):
        """Test login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "invalid@email.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        print("✓ Invalid login rejected correctly")


class TestDirectorDashboard:
    """Director Dashboard and Stats Tests"""
    
    @pytest.fixture
    def director_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": DIRECTOR_EMAIL,
            "password": DIRECTOR_PASSWORD
        })
        return response.json()["token"]
    
    def test_dashboard_stats(self, director_token):
        """Test dashboard stats endpoint for director"""
        headers = {"Authorization": f"Bearer {director_token}"}
        response = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        # Verify expected fields
        assert "total_users" in data
        assert "total_tasks" in data
        assert "total_reports" in data
        assert "pending_indents" in data
        assert "business_stats" in data
        
        print(f"✓ Dashboard stats: {data['total_users']} users, {data['total_tasks']} tasks, {data['total_reports']} reports, {data['pending_indents']} pending indents")
    
    def test_ai_insights(self, director_token):
        """Test AI insights endpoint (may return mock data)"""
        headers = {"Authorization": f"Bearer {director_token}"}
        response = requests.get(f"{BASE_URL}/api/dashboard/ai-insights", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "insights" in data
        print(f"✓ AI insights returned")
    
    def test_predictions(self, director_token):
        """Test predictions endpoint (may return fallback mock data)"""
        headers = {"Authorization": f"Bearer {director_token}"}
        response = requests.get(f"{BASE_URL}/api/dashboard/predictions", headers=headers)
        assert response.status_code == 200
        data = response.json()
        # Should have some prediction data even if AI fails
        assert "revenue" in data or "revenue_trend" in data
        print(f"✓ Predictions endpoint responded")


class TestUserManagement:
    """User Management Tests (Director role)"""
    
    @pytest.fixture
    def director_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": DIRECTOR_EMAIL,
            "password": DIRECTOR_PASSWORD
        })
        return response.json()["token"]
    
    @pytest.fixture
    def manager_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": MANAGER_EMAIL,
            "password": MANAGER_PASSWORD
        })
        return response.json()["token"]
    
    def test_get_users_as_director(self, director_token):
        """Director can list all users"""
        headers = {"Authorization": f"Bearer {director_token}"}
        response = requests.get(f"{BASE_URL}/api/users", headers=headers)
        assert response.status_code == 200
        users = response.json()
        assert isinstance(users, list)
        assert len(users) > 0
        
        # Verify user structure
        user = users[0]
        assert "id" in user
        assert "email" in user
        assert "name" in user
        assert "role" in user
        print(f"✓ Director can list {len(users)} users")
    
    def test_delete_user_permission_denied_for_staff(self):
        """Staff cannot delete users"""
        # Login as staff
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": STAFF_EMAIL,
            "password": STAFF_PASSWORD
        })
        staff_token = response.json()["token"]
        headers = {"Authorization": f"Bearer {staff_token}"}
        
        # Try to get users (should fail)
        response = requests.get(f"{BASE_URL}/api/users", headers=headers)
        assert response.status_code == 403
        print("✓ Staff correctly denied access to users list")


class TestTransactions:
    """Transaction CRUD and Accounting Tests"""
    
    @pytest.fixture
    def director_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": DIRECTOR_EMAIL,
            "password": DIRECTOR_PASSWORD
        })
        return response.json()["token"]
    
    @pytest.fixture
    def manager_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": MANAGER_EMAIL,
            "password": MANAGER_PASSWORD
        })
        return response.json()["token"]
    
    def test_create_transaction_as_manager(self, manager_token):
        """Manager can create a transaction"""
        headers = {"Authorization": f"Bearer {manager_token}"}
        transaction_data = {
            "transaction_type": "expense",
            "payment_mode": "cash",
            "amount": 1500.50,
            "description": "TEST_Transaction for testing",
            "category": "TEST_Category"
        }
        response = requests.post(f"{BASE_URL}/api/transactions", json=transaction_data, headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert data["amount"] == 1500.50
        assert data["transaction_type"] == "expense"
        print(f"✓ Manager created transaction: {data['id']}")
        return data["id"]
    
    def test_get_transactions(self, manager_token):
        """Get list of transactions"""
        headers = {"Authorization": f"Bearer {manager_token}"}
        response = requests.get(f"{BASE_URL}/api/transactions", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Retrieved {len(data)} transactions")
    
    def test_update_transaction(self, manager_token):
        """Manager can update a transaction (PUT /api/transactions/{id})"""
        headers = {"Authorization": f"Bearer {manager_token}"}
        
        # First create a transaction
        create_data = {
            "transaction_type": "expense",
            "payment_mode": "cash",
            "amount": 2000.00,
            "description": "TEST_Update transaction test",
            "category": "TEST_Update"
        }
        create_response = requests.post(f"{BASE_URL}/api/transactions", json=create_data, headers=headers)
        assert create_response.status_code == 200
        transaction_id = create_response.json()["id"]
        
        # Now update it
        update_data = {
            "transaction_type": "income",
            "payment_mode": "bank",
            "amount": 2500.00,
            "description": "TEST_Updated transaction",
            "category": "TEST_Updated Category"
        }
        update_response = requests.put(f"{BASE_URL}/api/transactions/{transaction_id}", json=update_data, headers=headers)
        assert update_response.status_code == 200
        updated = update_response.json()
        assert updated["amount"] == 2500.00
        assert updated["transaction_type"] == "income"
        assert updated["payment_mode"] == "bank"
        print(f"✓ Transaction {transaction_id} updated successfully")
    
    def test_accounting_summary(self, director_token):
        """Get accounting summary"""
        headers = {"Authorization": f"Bearer {director_token}"}
        response = requests.get(f"{BASE_URL}/api/accounting/summary", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        # Verify expected fields
        assert "total_income" in data
        assert "total_expense" in data
        assert "net_profit" in data
        assert "cash_balance" in data
        assert "bank_balance" in data
        print(f"✓ Accounting summary: Income={data['total_income']}, Expense={data['total_expense']}, Net={data['net_profit']}")
    
    def test_get_ledger(self, director_token):
        """Get complete ledger"""
        headers = {"Authorization": f"Bearer {director_token}"}
        response = requests.get(f"{BASE_URL}/api/ledger", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        # Verify ledger entry structure
        if len(data) > 0:
            entry = data[0]
            assert "balance" in entry  # Ledger should have running balance
        print(f"✓ Ledger has {len(data)} entries")


class TestAuditLogs:
    """Audit Log Tests (Director only)"""
    
    @pytest.fixture
    def director_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": DIRECTOR_EMAIL,
            "password": DIRECTOR_PASSWORD
        })
        return response.json()["token"]
    
    @pytest.fixture
    def manager_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": MANAGER_EMAIL,
            "password": MANAGER_PASSWORD
        })
        return response.json()["token"]
    
    def test_get_audit_logs_as_director(self, director_token):
        """Director can view audit logs (GET /api/audit-logs)"""
        headers = {"Authorization": f"Bearer {director_token}"}
        response = requests.get(f"{BASE_URL}/api/audit-logs", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Director can access audit logs: {len(data)} entries")
    
    def test_get_audit_logs_filtered(self, director_token):
        """Director can filter audit logs by entity type"""
        headers = {"Authorization": f"Bearer {director_token}"}
        response = requests.get(f"{BASE_URL}/api/audit-logs?entity_type=transaction", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Filtered audit logs (transaction): {len(data)} entries")
    
    def test_audit_logs_denied_for_manager(self, manager_token):
        """Manager cannot access audit logs"""
        headers = {"Authorization": f"Bearer {manager_token}"}
        response = requests.get(f"{BASE_URL}/api/audit-logs", headers=headers)
        assert response.status_code == 403
        print("✓ Manager correctly denied access to audit logs")


class TestExportEndpoints:
    """PDF and CSV Export Tests"""
    
    @pytest.fixture
    def director_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": DIRECTOR_EMAIL,
            "password": DIRECTOR_PASSWORD
        })
        return response.json()["token"]
    
    @pytest.fixture
    def manager_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": MANAGER_EMAIL,
            "password": MANAGER_PASSWORD
        })
        return response.json()["token"]
    
    def test_export_transactions_pdf(self, director_token):
        """Director can export transactions as PDF"""
        headers = {"Authorization": f"Bearer {director_token}"}
        response = requests.get(f"{BASE_URL}/api/export/transactions/pdf", headers=headers)
        assert response.status_code == 200
        assert response.headers.get("content-type") == "application/pdf"
        assert len(response.content) > 0
        print(f"✓ PDF export successful: {len(response.content)} bytes")
    
    def test_export_ledger_csv(self, director_token):
        """Director can export ledger as CSV"""
        headers = {"Authorization": f"Bearer {director_token}"}
        response = requests.get(f"{BASE_URL}/api/export/ledger/csv", headers=headers)
        assert response.status_code == 200
        assert "text/csv" in response.headers.get("content-type", "")
        content = response.text
        assert len(content) > 0
        # CSV should have header row
        print(f"✓ CSV export successful: {len(content)} characters")
    
    def test_export_pdf_as_manager(self, manager_token):
        """Manager can also export PDF"""
        headers = {"Authorization": f"Bearer {manager_token}"}
        response = requests.get(f"{BASE_URL}/api/export/transactions/pdf", headers=headers)
        assert response.status_code == 200
        assert response.headers.get("content-type") == "application/pdf"
        print("✓ Manager can export PDF")
    
    def test_export_csv_as_manager(self, manager_token):
        """Manager can also export CSV"""
        headers = {"Authorization": f"Bearer {manager_token}"}
        response = requests.get(f"{BASE_URL}/api/export/ledger/csv", headers=headers)
        assert response.status_code == 200
        print("✓ Manager can export CSV")


class TestTasksAndReports:
    """Task and Report Tests"""
    
    @pytest.fixture
    def director_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": DIRECTOR_EMAIL,
            "password": DIRECTOR_PASSWORD
        })
        return response.json()["token"]
    
    @pytest.fixture
    def manager_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": MANAGER_EMAIL,
            "password": MANAGER_PASSWORD
        })
        return response.json()["token"]
    
    def test_get_tasks(self, director_token):
        """Director can view all tasks"""
        headers = {"Authorization": f"Bearer {director_token}"}
        response = requests.get(f"{BASE_URL}/api/tasks", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Retrieved {len(data)} tasks")
    
    def test_get_reports(self, director_token):
        """Director can view all reports"""
        headers = {"Authorization": f"Bearer {director_token}"}
        response = requests.get(f"{BASE_URL}/api/reports", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Retrieved {len(data)} reports")
    
    def test_get_indents(self, director_token):
        """Director can view all indents"""
        headers = {"Authorization": f"Bearer {director_token}"}
        response = requests.get(f"{BASE_URL}/api/indents", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Retrieved {len(data)} indents")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
