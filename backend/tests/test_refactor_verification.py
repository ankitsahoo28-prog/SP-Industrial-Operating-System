"""
Test Suite for Backend Refactoring Verification - Iteration 12
Tests that all API endpoints work correctly after server.py was split into modular routers.

Tests verify:
- Auth endpoints (routes/auth.py)
- Director endpoints (routes/director.py)
- Company endpoints (routes/companies.py)
- Task endpoints (routes/tasks.py)
- Accounting endpoints (routes/accounting.py)
- Inventory endpoints (routes/inventory.py)
- Notification endpoints
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
DIRECTOR_EMAIL = "director@sp.com"
DIRECTOR_PASS = "password123"
MANAGER_EMAIL = "manager@sp.com"
MANAGER_PASS = "password123"


@pytest.fixture(scope="module")
def director_token():
    """Get director authentication token"""
    session = requests.Session()
    res = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": DIRECTOR_EMAIL,
        "password": DIRECTOR_PASS
    })
    if res.status_code == 200:
        return res.json().get("token")
    pytest.skip("Director authentication failed")


@pytest.fixture(scope="module")
def manager_token():
    """Get manager authentication token"""
    session = requests.Session()
    res = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": MANAGER_EMAIL,
        "password": MANAGER_PASS
    })
    if res.status_code == 200:
        return res.json().get("token")
    pytest.skip("Manager authentication failed")


@pytest.fixture(scope="module")
def director_client(director_token):
    """Authenticated session for director"""
    session = requests.Session()
    session.headers["Authorization"] = f"Bearer {director_token}"
    session.headers["Content-Type"] = "application/json"
    return session


@pytest.fixture(scope="module")
def manager_client(manager_token):
    """Authenticated session for manager"""
    session = requests.Session()
    session.headers["Authorization"] = f"Bearer {manager_token}"
    session.headers["Content-Type"] = "application/json"
    return session


class TestRootAndAuth:
    """Test root API and authentication endpoints - from routes/auth.py and director.py"""

    def test_api_root_returns_message(self):
        """GET /api/ returns API message"""
        res = requests.get(f"{BASE_URL}/api/")
        assert res.status_code == 200
        data = res.json()
        assert "message" in data
        assert "SP Industrial" in data["message"]

    def test_director_login_returns_token_and_user(self):
        """POST /api/auth/login with director credentials returns token and user"""
        res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": DIRECTOR_EMAIL,
            "password": DIRECTOR_PASS
        })
        assert res.status_code == 200
        data = res.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["email"] == DIRECTOR_EMAIL
        assert data["user"]["role"] == "director"

    def test_manager_login_returns_token_and_user(self):
        """POST /api/auth/login with manager credentials returns token and user"""
        res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": MANAGER_EMAIL,
            "password": MANAGER_PASS
        })
        assert res.status_code == 200
        data = res.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["role"] == "manager"

    def test_invalid_credentials_returns_401(self):
        """POST /api/auth/login with invalid credentials returns 401"""
        res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "invalid@test.com",
            "password": "wrongpassword"
        })
        assert res.status_code == 401


class TestDirectorDashboard:
    """Test director dashboard endpoints - from routes/director.py"""

    def test_dashboard_stats_returns_totals(self, director_client):
        """GET /api/dashboard/stats returns stats with total_users, total_tasks"""
        res = director_client.get(f"{BASE_URL}/api/dashboard/stats")
        assert res.status_code == 200
        data = res.json()
        assert "total_users" in data
        assert "total_tasks" in data
        assert isinstance(data["total_users"], int)
        assert isinstance(data["total_tasks"], int)

    def test_dashboard_trends_returns_data(self, director_client):
        """GET /api/dashboard/trends returns trend data for director"""
        res = director_client.get(f"{BASE_URL}/api/dashboard/trends")
        assert res.status_code == 200
        data = res.json()
        assert isinstance(data, list)

    def test_daily_summary_returns_data(self, director_client):
        """GET /api/director/daily-summary returns daily summary data"""
        res = director_client.get(f"{BASE_URL}/api/director/daily-summary")
        assert res.status_code == 200
        data = res.json()
        assert "date" in data
        assert "journal_entries_count" in data or "tasks_created" in data


class TestCompanies:
    """Test company endpoints - from routes/companies.py"""

    def test_companies_list(self, director_client):
        """GET /api/companies returns list of companies for director"""
        res = director_client.get(f"{BASE_URL}/api/companies")
        assert res.status_code == 200
        data = res.json()
        assert isinstance(data, list)
        if len(data) > 0:
            assert "id" in data[0]
            assert "name" in data[0]

    def test_users_list(self, director_client):
        """GET /api/users returns list of users for director"""
        res = director_client.get(f"{BASE_URL}/api/users")
        assert res.status_code == 200
        data = res.json()
        assert isinstance(data, list)
        if len(data) > 0:
            assert "id" in data[0]
            assert "email" in data[0]


class TestTasks:
    """Test task endpoints - from routes/tasks.py"""

    def test_tasks_list(self, director_client):
        """GET /api/tasks returns list of tasks"""
        res = director_client.get(f"{BASE_URL}/api/tasks")
        assert res.status_code == 200
        data = res.json()
        assert isinstance(data, list)


class TestNotifications:
    """Test notification endpoints - from routes/director.py"""

    def test_notifications_list(self, director_client):
        """GET /api/notifications returns notifications for logged-in user"""
        res = director_client.get(f"{BASE_URL}/api/notifications")
        assert res.status_code == 200
        data = res.json()
        assert isinstance(data, list)

    def test_unread_count(self, director_client):
        """GET /api/notifications/unread-count returns count"""
        res = director_client.get(f"{BASE_URL}/api/notifications/unread-count")
        assert res.status_code == 200
        data = res.json()
        assert "count" in data
        assert isinstance(data["count"], int)


class TestSettings:
    """Test settings endpoint - from routes/director.py"""

    def test_settings_returns_config(self, director_client):
        """GET /api/settings returns app settings"""
        res = director_client.get(f"{BASE_URL}/api/settings")
        assert res.status_code == 200
        data = res.json()
        # Settings may return default or custom config
        assert isinstance(data, dict)


class TestJobRoles:
    """Test job roles endpoint - from routes/director.py"""

    def test_job_roles_list(self, director_client):
        """GET /api/job-roles returns roles for director"""
        res = director_client.get(f"{BASE_URL}/api/job-roles")
        assert res.status_code == 200
        data = res.json()
        assert isinstance(data, list)


class TestReconciliation:
    """Test reconciliation endpoints - from routes/director.py"""

    def test_reconciliation_list(self, director_client):
        """GET /api/reconciliation returns reconciliation records"""
        res = director_client.get(f"{BASE_URL}/api/reconciliation")
        assert res.status_code == 200
        data = res.json()
        assert isinstance(data, list)


class TestAccounting:
    """Test accounting endpoints - from routes/accounting.py"""

    def test_accounts_list(self, director_client):
        """GET /api/accounts returns chart of accounts"""
        res = director_client.get(f"{BASE_URL}/api/accounts")
        assert res.status_code == 200
        data = res.json()
        assert isinstance(data, list)

    def test_journal_entries_list(self, director_client):
        """GET /api/journal-entries returns journal entries"""
        res = director_client.get(f"{BASE_URL}/api/journal-entries")
        assert res.status_code == 200
        data = res.json()
        assert isinstance(data, list)

    def test_transactions_list(self, director_client):
        """GET /api/transactions returns transactions"""
        res = director_client.get(f"{BASE_URL}/api/transactions")
        assert res.status_code == 200
        data = res.json()
        assert isinstance(data, list)


class TestInventory:
    """Test inventory endpoints - from routes/inventory.py"""

    def test_inventory_list(self, director_client):
        """GET /api/inventory returns inventory items"""
        res = director_client.get(f"{BASE_URL}/api/inventory")
        assert res.status_code == 200
        data = res.json()
        assert isinstance(data, list)

    def test_inv_items_list(self, director_client):
        """GET /api/inv/items returns comprehensive inventory items"""
        res = director_client.get(f"{BASE_URL}/api/inv/items")
        assert res.status_code == 200
        data = res.json()
        assert isinstance(data, list)

    def test_inv_dashboard(self, director_client):
        """GET /api/inv/dashboard returns inventory dashboard"""
        res = director_client.get(f"{BASE_URL}/api/inv/dashboard")
        assert res.status_code == 200
        data = res.json()
        assert isinstance(data, dict)


class TestAuditLogs:
    """Test audit log endpoint - from routes/director.py"""

    def test_audit_logs_list(self, director_client):
        """GET /api/audit-logs returns audit logs for director"""
        res = director_client.get(f"{BASE_URL}/api/audit-logs")
        assert res.status_code == 200
        data = res.json()
        assert isinstance(data, list)


class TestReports:
    """Test reports endpoints - from routes/tasks.py"""

    def test_reports_list(self, director_client):
        """GET /api/reports returns reports list"""
        res = director_client.get(f"{BASE_URL}/api/reports")
        assert res.status_code == 200
        data = res.json()
        assert isinstance(data, list)

    def test_indents_list(self, director_client):
        """GET /api/indents returns indents list"""
        res = director_client.get(f"{BASE_URL}/api/indents")
        assert res.status_code == 200
        data = res.json()
        assert isinstance(data, list)


class TestManagerAccess:
    """Test manager role access to various endpoints"""

    def test_manager_can_access_tasks(self, manager_client):
        """Manager can access tasks endpoint"""
        res = manager_client.get(f"{BASE_URL}/api/tasks")
        assert res.status_code == 200

    def test_manager_can_access_reports(self, manager_client):
        """Manager can access reports endpoint"""
        res = manager_client.get(f"{BASE_URL}/api/reports")
        assert res.status_code == 200

    def test_manager_can_access_inventory(self, manager_client):
        """Manager can access inventory endpoint"""
        res = manager_client.get(f"{BASE_URL}/api/inventory")
        assert res.status_code == 200

    def test_manager_cannot_access_audit_logs(self, manager_client):
        """Manager cannot access audit logs (directors only)"""
        res = manager_client.get(f"{BASE_URL}/api/audit-logs")
        assert res.status_code == 403

    def test_manager_cannot_access_job_roles(self, manager_client):
        """Manager cannot access job roles (directors only)"""
        res = manager_client.get(f"{BASE_URL}/api/job-roles")
        assert res.status_code == 403
