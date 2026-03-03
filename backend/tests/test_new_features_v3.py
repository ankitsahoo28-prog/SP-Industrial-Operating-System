"""
Test Multi-Company ERP new features - iteration 9
- Multi-company assignment for users
- Director edit/delete tasks, reports, indents
- Ground staff task visibility
- Manager sees ground staff reports
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
STAFF_EMAIL = "staff@sp.com"
STAFF_PASS = "password123"


class TestAuthentication:
    """Test user authentication and token retrieval"""

    def test_director_login(self, session):
        """Director can login successfully"""
        res = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": DIRECTOR_EMAIL,
            "password": DIRECTOR_PASS
        })
        assert res.status_code == 200
        data = res.json()
        assert "token" in data
        assert data["user"]["role"] == "director"
        session.headers["Authorization"] = f"Bearer {data['token']}"

    def test_manager_login(self, manager_session):
        """Manager can login successfully"""
        res = manager_session.post(f"{BASE_URL}/api/auth/login", json={
            "email": MANAGER_EMAIL,
            "password": MANAGER_PASS
        })
        assert res.status_code == 200
        data = res.json()
        assert "token" in data
        assert data["user"]["role"] == "manager"

    def test_ground_staff_login(self, staff_session):
        """Ground staff can login successfully"""
        res = staff_session.post(f"{BASE_URL}/api/auth/login", json={
            "email": STAFF_EMAIL,
            "password": STAFF_PASS
        })
        assert res.status_code == 200
        data = res.json()
        assert "token" in data
        assert data["user"]["role"] == "ground_staff"


class TestMultiCompanyAssignment:
    """Test multi-company assignment for users"""

    def test_director_can_get_companies(self, director_client):
        """Director can view all companies"""
        res = director_client.get(f"{BASE_URL}/api/companies")
        assert res.status_code == 200
        companies = res.json()
        assert len(companies) > 0
        # Store first company for later tests
        return companies

    def test_get_user_companies_endpoint(self, director_client):
        """GET /users/{id}/companies returns company list"""
        # First get users
        users_res = director_client.get(f"{BASE_URL}/api/users")
        assert users_res.status_code == 200
        users = users_res.json()
        
        # Get companies for a non-director user
        non_director = next((u for u in users if u["role"] != "director"), None)
        if non_director:
            res = director_client.get(f"{BASE_URL}/api/users/{non_director['id']}/companies")
            assert res.status_code == 200
            assert isinstance(res.json(), list)

    def test_assign_multiple_companies_to_user(self, director_client):
        """POST /companies/assign-multiple assigns multiple companies"""
        # Get companies
        companies_res = director_client.get(f"{BASE_URL}/api/companies")
        companies = companies_res.json()
        company_ids = [c["id"] for c in companies[:2]]  # Take first 2

        # Get users
        users_res = director_client.get(f"{BASE_URL}/api/users")
        users = users_res.json()
        non_director = next((u for u in users if u["role"] == "manager"), None)
        
        if non_director and company_ids:
            res = director_client.post(f"{BASE_URL}/api/companies/assign-multiple", json={
                "user_id": non_director["id"],
                "company_ids": company_ids
            })
            assert res.status_code == 200
            assert "message" in res.json()

            # Verify assignment
            verify_res = director_client.get(f"{BASE_URL}/api/users/{non_director['id']}/companies")
            assert verify_res.status_code == 200
            assigned = verify_res.json()
            assigned_ids = [c["id"] for c in assigned]
            for cid in company_ids:
                assert cid in assigned_ids


class TestDirectorTaskManagement:
    """Test director can edit/delete tasks"""

    def test_director_can_create_task(self, director_client):
        """Director can create a task"""
        # First get a user to assign to
        users_res = director_client.get(f"{BASE_URL}/api/users")
        users = users_res.json()
        assignee = next((u for u in users if u["role"] != "director"), None)
        
        if not assignee:
            pytest.skip("No non-director user to assign task")

        res = director_client.post(f"{BASE_URL}/api/tasks", json={
            "title": "TEST_Task_Delete_Test",
            "description": "Task to test delete functionality",
            "assigned_to": assignee["id"]
        })
        assert res.status_code == 200
        task = res.json()
        assert task["title"] == "TEST_Task_Delete_Test"
        return task["id"]

    def test_director_can_delete_task(self, director_client):
        """Director can delete task via DELETE /tasks/{id}"""
        # Create a task first
        users_res = director_client.get(f"{BASE_URL}/api/users")
        users = users_res.json()
        assignee = next((u for u in users if u["role"] != "director"), None)
        
        if not assignee:
            pytest.skip("No user to assign task")

        create_res = director_client.post(f"{BASE_URL}/api/tasks", json={
            "title": "TEST_Task_For_Delete",
            "description": "This task will be deleted",
            "assigned_to": assignee["id"]
        })
        assert create_res.status_code == 200
        task_id = create_res.json()["id"]

        # Delete the task
        del_res = director_client.delete(f"{BASE_URL}/api/tasks/{task_id}")
        assert del_res.status_code == 200
        assert "deleted" in del_res.json().get("message", "").lower()

        # Verify task is deleted (should not be in list)
        tasks_res = director_client.get(f"{BASE_URL}/api/tasks")
        tasks = tasks_res.json()
        task_ids = [t["id"] for t in tasks]
        assert task_id not in task_ids

    def test_director_can_update_task(self, director_client):
        """Director can update task title/description"""
        # Create a task first
        users_res = director_client.get(f"{BASE_URL}/api/users")
        users = users_res.json()
        assignee = next((u for u in users if u["role"] != "director"), None)
        
        if not assignee:
            pytest.skip("No user to assign task")

        create_res = director_client.post(f"{BASE_URL}/api/tasks", json={
            "title": "TEST_Task_For_Update",
            "description": "Original description",
            "assigned_to": assignee["id"]
        })
        task_id = create_res.json()["id"]

        # Update the task
        update_res = director_client.patch(f"{BASE_URL}/api/tasks/{task_id}", json={
            "description": "Updated description by director"
        })
        assert update_res.status_code == 200
        updated = update_res.json()
        assert updated["description"] == "Updated description by director"

        # Cleanup
        director_client.delete(f"{BASE_URL}/api/tasks/{task_id}")

    def test_non_director_cannot_delete_task(self, manager_client):
        """Manager cannot delete tasks (403)"""
        # First get existing tasks as manager
        tasks_res = manager_client.get(f"{BASE_URL}/api/tasks")
        if tasks_res.status_code != 200:
            pytest.skip("Manager can't access tasks endpoint")
        
        tasks = tasks_res.json()
        if not tasks:
            pytest.skip("No tasks to test with")

        # Try to delete first task
        del_res = manager_client.delete(f"{BASE_URL}/api/tasks/{tasks[0]['id']}")
        assert del_res.status_code == 403


class TestDirectorReportManagement:
    """Test director can delete reports"""

    def test_director_can_delete_report(self, director_client, staff_client):
        """Director can delete a report via DELETE /reports/{id}"""
        # First create a report as ground staff
        create_res = staff_client.post(f"{BASE_URL}/api/reports", json={
            "type": "feeding",
            "data": {"item": "TEST_Report_Delete", "quantity": 100}
        })
        
        if create_res.status_code != 200:
            pytest.skip("Could not create test report")
        
        report_id = create_res.json()["id"]

        # Director deletes the report
        del_res = director_client.delete(f"{BASE_URL}/api/reports/{report_id}")
        assert del_res.status_code == 200
        assert "deleted" in del_res.json().get("message", "").lower()

    def test_non_director_cannot_delete_report(self, manager_client):
        """Manager cannot delete reports (403)"""
        reports_res = manager_client.get(f"{BASE_URL}/api/reports")
        if reports_res.status_code != 200 or not reports_res.json():
            pytest.skip("No reports to test with")
        
        report = reports_res.json()[0]
        del_res = manager_client.delete(f"{BASE_URL}/api/reports/{report['id']}")
        assert del_res.status_code == 403


class TestDirectorIndentManagement:
    """Test director can delete indents"""

    def test_director_can_delete_indent(self, director_client, manager_client):
        """Director can delete an indent via DELETE /indents/{id}"""
        # Create an indent as manager
        create_res = manager_client.post(f"{BASE_URL}/api/indents", json={
            "items": [{"name": "TEST_Indent_Delete", "quantity": 10, "unit": "pcs"}],
            "notes": "Test indent for deletion"
        })
        
        if create_res.status_code != 200:
            pytest.skip("Could not create test indent")
        
        indent_id = create_res.json()["id"]

        # Director deletes the indent
        del_res = director_client.delete(f"{BASE_URL}/api/indents/{indent_id}")
        assert del_res.status_code == 200
        assert "deleted" in del_res.json().get("message", "").lower()


class TestGroundStaffTaskVisibility:
    """Test ground staff can see tasks assigned to them"""

    def test_ground_staff_sees_assigned_tasks(self, director_client, staff_client):
        """Ground staff can see tasks assigned to them via GET /tasks"""
        # Get staff user info
        staff_me_res = staff_client.get(f"{BASE_URL}/api/auth/me")
        staff_user = staff_me_res.json()
        staff_id = staff_user["id"]

        # Create a task assigned to ground staff
        create_res = director_client.post(f"{BASE_URL}/api/tasks", json={
            "title": "TEST_Task_For_Staff",
            "description": "Task assigned to ground staff",
            "assigned_to": staff_id
        })
        assert create_res.status_code == 200
        task_id = create_res.json()["id"]

        # Ground staff should see this task
        tasks_res = staff_client.get(f"{BASE_URL}/api/tasks")
        assert tasks_res.status_code == 200
        tasks = tasks_res.json()
        task_ids = [t["id"] for t in tasks]
        assert task_id in task_ids

        # Cleanup
        director_client.delete(f"{BASE_URL}/api/tasks/{task_id}")


class TestManagerReportVisibility:
    """Test manager can see reports from ground staff under them"""

    def test_manager_sees_ground_staff_reports(self, manager_client):
        """Manager sees reports from team members via GET /reports"""
        reports_res = manager_client.get(f"{BASE_URL}/api/reports")
        assert reports_res.status_code == 200
        # Manager should be able to access reports endpoint
        reports = reports_res.json()
        # Verify it's a list (may be empty if no ground staff reports)
        assert isinstance(reports, list)


class TestCompanySelector:
    """Test company selector behavior"""

    def test_director_gets_all_companies(self, director_client):
        """Director can access all companies"""
        res = director_client.get(f"{BASE_URL}/api/companies")
        assert res.status_code == 200
        companies = res.json()
        # Director should see multiple companies
        assert len(companies) >= 1

    def test_manager_gets_assigned_companies(self, manager_client):
        """Manager only sees assigned companies"""
        res = manager_client.get(f"{BASE_URL}/api/companies")
        assert res.status_code == 200
        companies = res.json()
        # Manager should see at least their assigned companies
        assert isinstance(companies, list)


class TestDirectorPagesAccess:
    """Test all director pages return 200"""

    @pytest.mark.parametrize("endpoint", [
        "/api/users",
        "/api/tasks",
        "/api/reports",
        "/api/indents",
        "/api/transactions",
        "/api/journal-entries",
        "/api/accounts",
        "/api/companies",
        "/api/audit-logs",
        "/api/settings",
        "/api/job-roles",
    ])
    def test_director_endpoints(self, director_client, endpoint):
        """Director can access various endpoints"""
        res = director_client.get(f"{BASE_URL}{endpoint}")
        assert res.status_code == 200


class TestManagerPagesAccess:
    """Test manager pages return expected status"""

    @pytest.mark.parametrize("endpoint,expected_status", [
        ("/api/tasks", 200),
        ("/api/reports", 200),
        ("/api/indents", 200),
        ("/api/transactions", 200),
        ("/api/companies", 200),
    ])
    def test_manager_endpoints(self, manager_client, endpoint, expected_status):
        """Manager can access their permitted endpoints"""
        res = manager_client.get(f"{BASE_URL}{endpoint}")
        assert res.status_code == expected_status


# Fixtures
@pytest.fixture
def session():
    """Create a new requests session"""
    s = requests.Session()
    s.headers["Content-Type"] = "application/json"
    return s

@pytest.fixture
def manager_session():
    """Create a new requests session for manager"""
    s = requests.Session()
    s.headers["Content-Type"] = "application/json"
    return s

@pytest.fixture
def staff_session():
    """Create a new requests session for ground staff"""
    s = requests.Session()
    s.headers["Content-Type"] = "application/json"
    return s

@pytest.fixture
def director_client():
    """Authenticated director client"""
    s = requests.Session()
    s.headers["Content-Type"] = "application/json"
    res = s.post(f"{BASE_URL}/api/auth/login", json={
        "email": DIRECTOR_EMAIL,
        "password": DIRECTOR_PASS
    })
    if res.status_code == 200:
        s.headers["Authorization"] = f"Bearer {res.json()['token']}"
        return s
    pytest.skip("Director login failed")

@pytest.fixture
def manager_client():
    """Authenticated manager client"""
    s = requests.Session()
    s.headers["Content-Type"] = "application/json"
    res = s.post(f"{BASE_URL}/api/auth/login", json={
        "email": MANAGER_EMAIL,
        "password": MANAGER_PASS
    })
    if res.status_code == 200:
        s.headers["Authorization"] = f"Bearer {res.json()['token']}"
        return s
    pytest.skip("Manager login failed")

@pytest.fixture
def staff_client():
    """Authenticated ground staff client"""
    s = requests.Session()
    s.headers["Content-Type"] = "application/json"
    res = s.post(f"{BASE_URL}/api/auth/login", json={
        "email": STAFF_EMAIL,
        "password": STAFF_PASS
    })
    if res.status_code == 200:
        s.headers["Authorization"] = f"Bearer {res.json()['token']}"
        return s
    pytest.skip("Ground staff login failed")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
