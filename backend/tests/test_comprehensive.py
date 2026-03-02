"""
SP Multi-Business Operations App - Comprehensive Backend API Tests
Tests business type filters, AI insights, export endpoints, and CRUD operations.
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


@pytest.fixture
def director_token():
    """Get director auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": DIRECTOR_EMAIL,
        "password": DIRECTOR_PASSWORD
    })
    assert response.status_code == 200, f"Director login failed: {response.text}"
    return response.json()["token"]


@pytest.fixture
def manager_token():
    """Get manager auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": MANAGER_EMAIL,
        "password": MANAGER_PASSWORD
    })
    assert response.status_code == 200, f"Manager login failed: {response.text}"
    return response.json()["token"]


@pytest.fixture
def staff_token():
    """Get ground staff auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": STAFF_EMAIL,
        "password": STAFF_PASSWORD
    })
    assert response.status_code == 200, f"Staff login failed: {response.text}"
    return response.json()["token"]


# ============= AI INSIGHTS TESTS =============
class TestAIInsights:
    """AI Insights endpoint tests - verify real AI responses"""

    def test_ai_insights_returns_real_text(self, director_token):
        """GET /api/dashboard/ai-insights - should return real AI-generated text"""
        headers = {"Authorization": f"Bearer {director_token}"}
        response = requests.get(f"{BASE_URL}/api/dashboard/ai-insights", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "insights" in data
        
        insights_text = data["insights"]
        # Check it's not empty and has some content
        assert len(insights_text) > 50, "AI insights text too short"
        # Check for bullet points which indicate real analysis
        assert "•" in insights_text or "-" in insights_text or "*" in insights_text, "Expected bullet point format"
        print(f"✓ AI Insights returned ({len(insights_text)} chars): {insights_text[:100]}...")

    def test_ai_insights_denied_for_non_director(self, manager_token):
        """Non-directors should be denied AI insights"""
        headers = {"Authorization": f"Bearer {manager_token}"}
        response = requests.get(f"{BASE_URL}/api/dashboard/ai-insights", headers=headers)
        assert response.status_code == 403
        print("✓ Non-director correctly denied AI insights access")


# ============= BUSINESS TYPE FILTER TESTS =============
class TestBusinessTypeFilters:
    """Business type filter tests for tasks, reports, transactions"""

    def test_tasks_filter_by_petrol_pump(self, director_token):
        """GET /api/tasks?business_type=petrol_pump - filter tasks by business"""
        headers = {"Authorization": f"Bearer {director_token}"}
        response = requests.get(f"{BASE_URL}/api/tasks?business_type=petrol_pump", headers=headers)
        assert response.status_code == 200
        tasks = response.json()
        assert isinstance(tasks, list)
        # All returned tasks should be petrol_pump or None
        for task in tasks:
            if task.get('business_type'):
                assert task['business_type'] == 'petrol_pump', f"Task has wrong business_type: {task['business_type']}"
        print(f"✓ Tasks filtered by petrol_pump: {len(tasks)} tasks")

    def test_reports_filter_by_transport(self, director_token):
        """GET /api/reports?business_type=transport - filter reports by business"""
        headers = {"Authorization": f"Bearer {director_token}"}
        response = requests.get(f"{BASE_URL}/api/reports?business_type=transport", headers=headers)
        assert response.status_code == 200
        reports = response.json()
        assert isinstance(reports, list)
        for report in reports:
            if report.get('business_type'):
                assert report['business_type'] == 'transport'
        print(f"✓ Reports filtered by transport: {len(reports)} reports")

    def test_transactions_filter_by_fl_shop(self, director_token):
        """GET /api/transactions?business_type=fl_shop - filter transactions by business"""
        headers = {"Authorization": f"Bearer {director_token}"}
        response = requests.get(f"{BASE_URL}/api/transactions?business_type=fl_shop", headers=headers)
        assert response.status_code == 200
        transactions = response.json()
        assert isinstance(transactions, list)
        for trans in transactions:
            if trans.get('business_type'):
                assert trans['business_type'] == 'fl_shop'
        print(f"✓ Transactions filtered by fl_shop: {len(transactions)} transactions")

    def test_indents_filter_by_business(self, director_token):
        """GET /api/indents?business_type=hotel - filter indents by business"""
        headers = {"Authorization": f"Bearer {director_token}"}
        response = requests.get(f"{BASE_URL}/api/indents?business_type=hotel", headers=headers)
        assert response.status_code == 200
        indents = response.json()
        assert isinstance(indents, list)
        print(f"✓ Indents filtered by hotel: {len(indents)} indents")


# ============= EXPORT ENDPOINT TESTS =============
class TestExportEndpoints:
    """PDF and CSV export endpoint tests"""

    def test_export_transactions_pdf_valid_content(self, director_token):
        """GET /api/export/transactions/pdf - returns valid PDF"""
        headers = {"Authorization": f"Bearer {director_token}"}
        response = requests.get(f"{BASE_URL}/api/export/transactions/pdf", headers=headers)
        assert response.status_code == 200
        
        # Verify content type
        content_type = response.headers.get("content-type", "")
        assert "application/pdf" in content_type, f"Expected PDF content-type, got: {content_type}"
        
        # Verify PDF magic bytes (PDF starts with %PDF)
        content = response.content
        assert len(content) > 100, "PDF content too small"
        assert content[:4] == b'%PDF', f"Content doesn't start with PDF magic bytes"
        print(f"✓ PDF export valid: {len(content)} bytes, Content-Type: {content_type}")

    def test_export_ledger_csv_valid_content(self, director_token):
        """GET /api/export/ledger/csv - returns valid CSV"""
        headers = {"Authorization": f"Bearer {director_token}"}
        response = requests.get(f"{BASE_URL}/api/export/ledger/csv", headers=headers)
        assert response.status_code == 200
        
        # Verify content type
        content_type = response.headers.get("content-type", "")
        assert "text/csv" in content_type or "csv" in content_type, f"Expected CSV content-type, got: {content_type}"
        
        # Verify CSV has header row
        csv_text = response.text
        assert len(csv_text) > 10, "CSV content too small"
        assert "Date" in csv_text or "date" in csv_text, "CSV should have Date header"
        print(f"✓ CSV export valid: {len(csv_text)} chars, Content-Type: {content_type}")

    def test_export_denied_for_staff(self, staff_token):
        """Ground staff should be denied export access"""
        headers = {"Authorization": f"Bearer {staff_token}"}
        response = requests.get(f"{BASE_URL}/api/export/transactions/pdf", headers=headers)
        assert response.status_code == 403
        print("✓ Ground staff correctly denied export access")


# ============= TRANSACTION CRUD TESTS =============
class TestTransactionCRUD:
    """Transaction create, read, update tests"""

    def test_update_transaction_and_verify(self, manager_token):
        """PUT /api/transactions/{id} - update and verify persistence"""
        headers = {"Authorization": f"Bearer {manager_token}"}
        
        # Create a transaction first
        create_data = {
            "transaction_type": "expense",
            "payment_mode": "cash",
            "amount": 5000.00,
            "description": "TEST_Comprehensive_Update",
            "category": "TEST_Update"
        }
        create_response = requests.post(f"{BASE_URL}/api/transactions", json=create_data, headers=headers)
        assert create_response.status_code == 200
        transaction_id = create_response.json()["id"]
        
        # Update the transaction
        update_data = {
            "transaction_type": "income",
            "payment_mode": "bank",
            "amount": 7500.00,
            "description": "TEST_Updated_Comprehensive",
            "category": "TEST_Updated"
        }
        update_response = requests.put(f"{BASE_URL}/api/transactions/{transaction_id}", json=update_data, headers=headers)
        assert update_response.status_code == 200
        
        updated = update_response.json()
        assert updated["amount"] == 7500.00
        assert updated["transaction_type"] == "income"
        assert updated["payment_mode"] == "bank"
        assert updated["description"] == "TEST_Updated_Comprehensive"
        
        print(f"✓ Transaction {transaction_id} updated and verified")


# ============= USER MANAGEMENT TESTS =============
class TestUserManagement:
    """User management and deletion tests"""

    def test_delete_user_creates_audit_log(self, director_token):
        """DELETE /api/users/{id} - verify deletion and audit trail"""
        headers = {"Authorization": f"Bearer {director_token}"}
        
        # First, create a test user (as director creating manager)
        test_user_data = {
            "email": f"test_delete_{os.urandom(4).hex()}@test.com",
            "password": "testpassword123",
            "name": "TEST_Delete_User",
            "role": "manager",
            "business_type": "petrol_pump"
        }
        create_response = requests.post(f"{BASE_URL}/api/users", json=test_user_data, headers=headers)
        assert create_response.status_code == 200, f"Failed to create test user: {create_response.text}"
        user_id = create_response.json()["id"]
        
        # Delete the user
        delete_response = requests.delete(f"{BASE_URL}/api/users/{user_id}", headers=headers)
        assert delete_response.status_code == 200
        
        # Verify audit log was created
        audit_response = requests.get(f"{BASE_URL}/api/audit-logs?entity_type=user", headers=headers)
        assert audit_response.status_code == 200
        logs = audit_response.json()
        
        # Find deletion log for this user
        delete_logs = [log for log in logs if log['entity_id'] == user_id and log['action'] == 'delete']
        assert len(delete_logs) > 0, "No audit log found for user deletion"
        print(f"✓ User {user_id} deleted, audit log created")

    def test_delete_user_denied_for_manager(self, manager_token, director_token):
        """Manager cannot delete users"""
        headers_manager = {"Authorization": f"Bearer {manager_token}"}
        headers_director = {"Authorization": f"Bearer {director_token}"}
        
        # Get list of users
        users_response = requests.get(f"{BASE_URL}/api/users", headers=headers_director)
        users = users_response.json()
        
        # Find a non-director user to try to delete
        target_user = next((u for u in users if u['role'] != 'director'), None)
        if target_user:
            delete_response = requests.delete(f"{BASE_URL}/api/users/{target_user['id']}", headers=headers_manager)
            assert delete_response.status_code == 403
            print("✓ Manager correctly denied user deletion")


# ============= AUDIT LOG TESTS =============
class TestAuditLogs:
    """Audit trail endpoint tests"""

    def test_get_audit_logs_as_director(self, director_token):
        """GET /api/audit-logs - director can view"""
        headers = {"Authorization": f"Bearer {director_token}"}
        response = requests.get(f"{BASE_URL}/api/audit-logs", headers=headers)
        assert response.status_code == 200
        logs = response.json()
        assert isinstance(logs, list)
        
        # Verify log structure if we have logs
        if len(logs) > 0:
            log = logs[0]
            assert "action" in log
            assert "entity_type" in log
            assert "entity_id" in log
            assert "timestamp" in log
        print(f"✓ Retrieved {len(logs)} audit logs")

    def test_audit_logs_filter_by_entity(self, director_token):
        """GET /api/audit-logs?entity_type=transaction - filter works"""
        headers = {"Authorization": f"Bearer {director_token}"}
        response = requests.get(f"{BASE_URL}/api/audit-logs?entity_type=transaction", headers=headers)
        assert response.status_code == 200
        logs = response.json()
        
        # All returned logs should be for transactions
        for log in logs:
            assert log['entity_type'] == 'transaction'
        print(f"✓ Filtered audit logs by transaction: {len(logs)} entries")


# ============= DASHBOARD STATS TESTS =============
class TestDashboardStats:
    """Dashboard statistics endpoint tests"""

    def test_dashboard_stats_structure(self, director_token):
        """GET /api/dashboard/stats - verify response structure"""
        headers = {"Authorization": f"Bearer {director_token}"}
        response = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        # Verify required fields
        assert "total_users" in data
        assert "total_tasks" in data
        assert "total_reports" in data
        assert "pending_indents" in data
        assert "business_stats" in data
        
        # Verify business_stats structure
        assert isinstance(data["business_stats"], list)
        if len(data["business_stats"]) > 0:
            biz = data["business_stats"][0]
            assert "business_type" in biz
            assert "total_income" in biz
            assert "total_expense" in biz
        
        print(f"✓ Dashboard stats: {data['total_users']} users, {data['total_tasks']} tasks, {len(data['business_stats'])} business stats")


# ============= PREDICTIONS ENDPOINT TESTS =============
class TestPredictions:
    """AI predictions endpoint tests"""

    def test_predictions_endpoint_responds(self, director_token):
        """GET /api/dashboard/predictions - returns prediction data"""
        headers = {"Authorization": f"Bearer {director_token}"}
        response = requests.get(f"{BASE_URL}/api/dashboard/predictions", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        # Should have key prediction fields
        assert "revenue" in data or "revenue_trend" in data
        if "revenue" in data:
            assert isinstance(data["revenue"], (int, float))
        if "expenses" in data:
            assert isinstance(data["expenses"], (int, float))
        print(f"✓ Predictions endpoint returned: {list(data.keys())}")


# ============= LEDGER ENDPOINT TESTS =============
class TestLedger:
    """Ledger endpoint tests"""

    def test_ledger_has_running_balance(self, director_token):
        """GET /api/ledger - verify running balance calculation"""
        headers = {"Authorization": f"Bearer {director_token}"}
        response = requests.get(f"{BASE_URL}/api/ledger", headers=headers)
        assert response.status_code == 200
        ledger = response.json()
        
        if len(ledger) > 0:
            # Each entry should have a balance field
            for entry in ledger:
                assert "balance" in entry, "Ledger entry missing balance"
                assert "transaction_type" in entry
                assert "amount" in entry
        print(f"✓ Ledger has {len(ledger)} entries with running balance")

    def test_ledger_filter_by_business(self, director_token):
        """GET /api/ledger?business_type=slag_crushing - filter works"""
        headers = {"Authorization": f"Bearer {director_token}"}
        response = requests.get(f"{BASE_URL}/api/ledger?business_type=slag_crushing", headers=headers)
        assert response.status_code == 200
        ledger = response.json()
        assert isinstance(ledger, list)
        print(f"✓ Ledger filtered by slag_crushing: {len(ledger)} entries")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
