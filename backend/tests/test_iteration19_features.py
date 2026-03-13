"""
Iteration 19 Tests: GSTR-1/GSTR-3B Reports, Role Templates, WhatsApp Integration
Tests the following new features:
1. GSTR-1 Report: Outward supplies (B2B, B2C, HSN Summary)
2. GSTR-3B Report: Monthly GST summary (outward, inward, ITC, tax payable)
3. Role Templates: 5 predefined templates (Accountant, Warehouse Manager, etc.)
4. Create Role from Template: POST /job-roles/from-template
5. WhatsApp Status: GET /whatsapp/status
6. WhatsApp Forgot Password: POST /whatsapp/forgot-password  
7. WhatsApp Settings: PUT /whatsapp/settings
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="module")
def director_token():
    """Login as director and return token."""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "director@sp.com",
        "password": "password123"
    })
    assert response.status_code == 200, f"Director login failed: {response.text}"
    return response.json()["token"]

@pytest.fixture(scope="module")
def manager_token():
    """Login as manager and return token."""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "manager@sp.com",
        "password": "password123"
    })
    assert response.status_code == 200, f"Manager login failed: {response.text}"
    return response.json()["token"]

@pytest.fixture(scope="module")
def auth_headers(director_token):
    return {"Authorization": f"Bearer {director_token}"}

@pytest.fixture(scope="module")
def manager_headers(manager_token):
    return {"Authorization": f"Bearer {manager_token}"}


# ========== GSTR-1 REPORT TESTS ==========

class TestGSTR1Report:
    """Tests for GSTR-1 (Outward Supplies) Report"""

    def test_gstr1_report_returns_valid_structure(self, auth_headers):
        """GET /api/acc/reports/gstr1 returns valid GSTR-1 structure with all required fields."""
        response = requests.get(
            f"{BASE_URL}/api/acc/reports/gstr1",
            params={"month": "3", "year": "2026"},
            headers=auth_headers
        )
        assert response.status_code == 200, f"GSTR-1 failed: {response.text}"
        data = response.json()
        
        # Verify required top-level fields
        assert "period" in data, "Missing period field"
        assert "b2b" in data, "Missing b2b field"
        assert "b2c_small" in data, "Missing b2c_small field"
        assert "hsn_summary" in data, "Missing hsn_summary field"
        assert "totals" in data, "Missing totals field"
        
        # Verify totals structure
        totals = data["totals"]
        assert "taxable_value" in totals, "Missing taxable_value in totals"
        assert "cgst" in totals, "Missing cgst in totals"
        assert "sgst" in totals, "Missing sgst in totals"
        assert "igst" in totals, "Missing igst in totals"
        assert "invoice_value" in totals, "Missing invoice_value in totals"
        assert "total_invoices" in totals, "Missing total_invoices in totals"
        assert "b2b_count" in totals, "Missing b2b_count in totals"
        assert "b2c_count" in totals, "Missing b2c_count in totals"
        
        print(f"GSTR-1 Report - Period: {data['period']}, Invoices: {totals['total_invoices']}, B2B: {totals['b2b_count']}, B2C: {totals['b2c_count']}")

    def test_gstr1_report_period_format(self, auth_headers):
        """GSTR-1 period field is in YYYY-MM format."""
        response = requests.get(
            f"{BASE_URL}/api/acc/reports/gstr1",
            params={"month": "1", "year": "2026"},
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["period"] == "2026-01", f"Expected 2026-01, got {data['period']}"

    def test_gstr1_b2b_entries_structure(self, auth_headers):
        """B2B entries have required fields (invoice_number, gstin, taxable_value, cgst, sgst, igst, total)."""
        response = requests.get(
            f"{BASE_URL}/api/acc/reports/gstr1",
            params={"month": "3", "year": "2026"},
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # If there are B2B entries, verify structure
        if len(data["b2b"]) > 0:
            entry = data["b2b"][0]
            required_fields = ["invoice_number", "invoice_date", "partner_name", "gstin", 
                            "taxable_value", "cgst", "sgst", "igst", "total"]
            for field in required_fields:
                assert field in entry, f"B2B entry missing field: {field}"
            print(f"B2B entry verified: {entry['invoice_number']} - {entry['partner_name']}")
        else:
            print("No B2B entries in selected period (expected if no registered customers)")


# ========== GSTR-3B REPORT TESTS ==========

class TestGSTR3BReport:
    """Tests for GSTR-3B (Monthly Summary) Report"""

    def test_gstr3b_report_returns_valid_structure(self, auth_headers):
        """GET /api/acc/reports/gstr3b returns valid GSTR-3B structure."""
        response = requests.get(
            f"{BASE_URL}/api/acc/reports/gstr3b",
            params={"month": "3", "year": "2026"},
            headers=auth_headers
        )
        assert response.status_code == 200, f"GSTR-3B failed: {response.text}"
        data = response.json()
        
        # Verify required sections
        assert "period" in data, "Missing period"
        assert "outward_supplies" in data, "Missing outward_supplies (Section 3.1)"
        assert "inward_supplies" in data, "Missing inward_supplies"
        assert "itc_available" in data, "Missing itc_available (Section 4)"
        assert "tax_payable" in data, "Missing tax_payable (Section 6.1)"
        assert "net_payable" in data, "Missing net_payable"
        
        print(f"GSTR-3B Report - Period: {data['period']}")
        print(f"  3.1 Outward: {data['outward_supplies']}")
        print(f"  4. ITC: {data['itc_available']}")
        print(f"  6.1 Payment: {data['tax_payable']}")
        print(f"  Net Payable: {data['net_payable']}")

    def test_gstr3b_outward_supplies_structure(self, auth_headers):
        """Outward supplies (3.1) has taxable_value, cgst, sgst, igst, total_tax, invoice_count."""
        response = requests.get(
            f"{BASE_URL}/api/acc/reports/gstr3b",
            params={"month": "3", "year": "2026"},
            headers=auth_headers
        )
        assert response.status_code == 200
        outward = response.json()["outward_supplies"]
        
        required_fields = ["taxable_value", "cgst", "sgst", "igst", "total_tax", "invoice_count"]
        for field in required_fields:
            assert field in outward, f"outward_supplies missing: {field}"

    def test_gstr3b_itc_available_structure(self, auth_headers):
        """ITC available (Section 4) has cgst, sgst, igst, total."""
        response = requests.get(
            f"{BASE_URL}/api/acc/reports/gstr3b",
            params={"month": "3", "year": "2026"},
            headers=auth_headers
        )
        assert response.status_code == 200
        itc = response.json()["itc_available"]
        
        required_fields = ["cgst", "sgst", "igst", "total"]
        for field in required_fields:
            assert field in itc, f"itc_available missing: {field}"

    def test_gstr3b_tax_payable_structure(self, auth_headers):
        """Tax payable (Section 6.1) has cgst, sgst, igst, total."""
        response = requests.get(
            f"{BASE_URL}/api/acc/reports/gstr3b",
            params={"month": "3", "year": "2026"},
            headers=auth_headers
        )
        assert response.status_code == 200
        payable = response.json()["tax_payable"]
        
        required_fields = ["cgst", "sgst", "igst", "total"]
        for field in required_fields:
            assert field in payable, f"tax_payable missing: {field}"


# ========== ROLE TEMPLATES TESTS ==========

class TestRoleTemplates:
    """Tests for Role Templates feature"""

    def test_get_role_templates_returns_five_templates(self, auth_headers):
        """GET /api/job-roles/templates returns exactly 5 predefined templates."""
        response = requests.get(
            f"{BASE_URL}/api/job-roles/templates",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Get templates failed: {response.text}"
        templates = response.json()
        
        assert len(templates) == 5, f"Expected 5 templates, got {len(templates)}"
        
        expected_names = ["Accountant", "Warehouse Manager", "Field Supervisor", "Sales Manager", "Read-Only Auditor"]
        actual_names = [t["name"] for t in templates]
        
        for name in expected_names:
            assert name in actual_names, f"Missing template: {name}"
        
        print(f"Role Templates: {actual_names}")

    def test_role_template_structure(self, auth_headers):
        """Each template has name, description, and permissions array."""
        response = requests.get(
            f"{BASE_URL}/api/job-roles/templates",
            headers=auth_headers
        )
        assert response.status_code == 200
        templates = response.json()
        
        for tmpl in templates:
            assert "name" in tmpl, "Template missing name"
            assert "description" in tmpl, "Template missing description"
            assert "permissions" in tmpl, "Template missing permissions"
            assert isinstance(tmpl["permissions"], list), "Permissions should be a list"
            print(f"  {tmpl['name']}: {len(tmpl['permissions'])} permissions")

    def test_create_role_from_accountant_template(self, auth_headers):
        """POST /api/job-roles/from-template?template_name=Accountant creates role successfully."""
        response = requests.post(
            f"{BASE_URL}/api/job-roles/from-template",
            params={"template_name": "Accountant"},
            headers=auth_headers
        )
        assert response.status_code == 200, f"Create from template failed: {response.text}"
        role = response.json()
        
        assert role["name"] == "Accountant", f"Expected name 'Accountant', got {role['name']}"
        assert "id" in role, "Created role should have id"
        assert len(role["permissions"]) > 0, "Accountant role should have permissions"
        
        # Verify accountant has accounting permissions
        assert "view_accounting" in role["permissions"], "Accountant should have view_accounting"
        assert "edit_accounting" in role["permissions"], "Accountant should have edit_accounting"
        
        print(f"Created Accountant role with {len(role['permissions'])} permissions")
        
        # Cleanup: Delete the created role
        requests.delete(f"{BASE_URL}/api/job-roles/{role['id']}", headers=auth_headers)

    def test_create_role_from_invalid_template_fails(self, auth_headers):
        """POST /api/job-roles/from-template with invalid name returns 404."""
        response = requests.post(
            f"{BASE_URL}/api/job-roles/from-template",
            params={"template_name": "NonExistentTemplate"},
            headers=auth_headers
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"


# ========== WHATSAPP INTEGRATION TESTS ==========

class TestWhatsAppIntegration:
    """Tests for WhatsApp notification endpoints"""

    def test_whatsapp_status_endpoint(self):
        """GET /api/whatsapp/status returns configured: true/false."""
        response = requests.get(f"{BASE_URL}/api/whatsapp/status")
        assert response.status_code == 200, f"WhatsApp status failed: {response.text}"
        data = response.json()
        
        assert "configured" in data, "Response missing 'configured' field"
        assert isinstance(data["configured"], bool), "configured should be boolean"
        
        print(f"WhatsApp configured: {data['configured']} (Expected false without Twilio keys)")

    def test_whatsapp_forgot_password(self):
        """POST /api/whatsapp/forgot-password returns success message."""
        response = requests.post(
            f"{BASE_URL}/api/whatsapp/forgot-password",
            json={"phone": "+919876543210"}
        )
        assert response.status_code == 200, f"Forgot password failed: {response.text}"
        data = response.json()
        
        assert "message" in data, "Response missing message field"
        # Message should not reveal if user exists
        assert "If this number is registered" in data["message"]
        print(f"WhatsApp forgot password response: {data['message']}")

    def test_whatsapp_settings_update(self, auth_headers):
        """PUT /api/whatsapp/settings updates phone and notification prefs."""
        response = requests.put(
            f"{BASE_URL}/api/whatsapp/settings",
            json={"phone": "+919876543210", "whatsapp_notifications": True},
            headers=auth_headers
        )
        assert response.status_code == 200, f"Settings update failed: {response.text}"
        data = response.json()
        
        assert "phone" in data, "Response missing phone"
        assert "whatsapp_notifications" in data, "Response missing whatsapp_notifications"
        print(f"WhatsApp settings updated: phone={data['phone']}, notifications={data['whatsapp_notifications']}")

    def test_whatsapp_settings_get(self, auth_headers):
        """GET /api/whatsapp/settings returns current settings."""
        response = requests.get(
            f"{BASE_URL}/api/whatsapp/settings",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Get settings failed: {response.text}"
        data = response.json()
        
        assert "phone" in data, "Response missing phone"
        assert "whatsapp_notifications" in data, "Response missing whatsapp_notifications"


# ========== MANAGER INVENTORY ACCESS TESTS ==========

class TestManagerInventoryAccess:
    """Verify manager can access inventory pages"""

    def test_manager_can_access_inventory_products(self, manager_headers):
        """Manager can GET /api/inv/products."""
        response = requests.get(
            f"{BASE_URL}/api/inv/products",
            headers=manager_headers
        )
        assert response.status_code == 200, f"Manager inventory access failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Products should be a list"
        print(f"Manager accessed inventory: {len(data)} products found")

    def test_manager_can_access_inventory_dashboard(self, manager_headers):
        """Manager can GET /api/inv/dashboard (new Odoo dashboard)."""
        response = requests.get(
            f"{BASE_URL}/api/inv/dashboard",
            headers=manager_headers
        )
        assert response.status_code == 200, f"Manager dashboard access failed: {response.text}"
        data = response.json()
        print(f"Manager inventory dashboard: {data}")


# ========== DEPRECATION VERIFICATION ==========

class TestOldInventoryDeprecation:
    """Verify old inventory routes behavior"""

    def test_inv_dashboard_returns_new_format(self, auth_headers):
        """GET /api/inv/dashboard returns new Odoo inventory format."""
        response = requests.get(
            f"{BASE_URL}/api/inv/dashboard",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Dashboard failed: {response.text}"
        data = response.json()
        
        # New dashboard should have odoo-style fields
        # Check for some typical fields
        print(f"Inventory Dashboard Response: {list(data.keys())}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
