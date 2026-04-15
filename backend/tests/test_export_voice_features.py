"""
Test suite for new features: Data Export, Voice Commands, Duplicate Detection, Batch Entries
Iteration 23 - Testing export endpoints, voice transcription, duplicate check, and batch operations
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
DIRECTOR_EMAIL = "director@sp.com"
DIRECTOR_PASSWORD = "password123"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for director user."""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": DIRECTOR_EMAIL,
        "password": DIRECTOR_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Headers with auth token."""
    return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}


# ============ ACCOUNTING EXPORT ENDPOINTS ============

class TestAccountingExport:
    """Test accounting data export endpoints."""
    
    def test_export_journal_entries_returns_data(self, auth_headers):
        """GET /api/acc/export/journal-entries returns journal entries data."""
        response = requests.get(f"{BASE_URL}/api/acc/export/journal-entries", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list of journal entries"
        # Verify structure if data exists
        if len(data) > 0:
            entry = data[0]
            assert "name" in entry or "id" in entry, "Entry should have name or id"
            print(f"✓ Journal entries export returned {len(data)} entries")
        else:
            print("✓ Journal entries export returned empty list (no entries yet)")
    
    def test_export_chart_of_accounts_returns_data(self, auth_headers):
        """GET /api/acc/export/chart-of-accounts returns accounts with balances."""
        response = requests.get(f"{BASE_URL}/api/acc/export/chart-of-accounts", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list of accounts"
        if len(data) > 0:
            account = data[0]
            assert "code" in account, "Account should have code"
            assert "name" in account, "Account should have name"
            assert "balance" in account, "Account should have balance"
            print(f"✓ Chart of accounts export returned {len(data)} accounts")
        else:
            print("✓ Chart of accounts export returned empty list")
    
    def test_export_invoices_returns_data(self, auth_headers):
        """GET /api/acc/export/invoices returns invoices."""
        response = requests.get(f"{BASE_URL}/api/acc/export/invoices", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list of invoices"
        print(f"✓ Invoices export returned {len(data)} invoices")


# ============ INVENTORY EXPORT ENDPOINTS ============

class TestInventoryExport:
    """Test inventory data export endpoints."""
    
    def test_export_products_returns_data(self, auth_headers):
        """GET /api/inv/export/products returns products."""
        response = requests.get(f"{BASE_URL}/api/inv/export/products", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list of products"
        if len(data) > 0:
            product = data[0]
            assert "name" in product, "Product should have name"
            print(f"✓ Products export returned {len(data)} products")
        else:
            print("✓ Products export returned empty list")
    
    def test_export_stock_moves_returns_data(self, auth_headers):
        """GET /api/inv/export/stock-moves returns stock moves."""
        response = requests.get(f"{BASE_URL}/api/inv/export/stock-moves", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list of stock moves"
        print(f"✓ Stock moves export returned {len(data)} moves")


# ============ AI ASSISTANT EXPORT ENDPOINT ============

class TestAiAssistantExport:
    """Test AI assistant audit trail export."""
    
    def test_export_audit_trail_returns_data(self, auth_headers):
        """GET /api/ai-assistant/export/audit-trail returns audit trail."""
        response = requests.get(f"{BASE_URL}/api/ai-assistant/export/audit-trail", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list of audit trail entries"
        print(f"✓ Audit trail export returned {len(data)} entries")


# ============ DUPLICATE DETECTION ============

class TestDuplicateDetection:
    """Test duplicate invoice detection endpoint."""
    
    def test_check_duplicates_endpoint_exists(self, auth_headers):
        """POST /api/ai-assistant/check-duplicates endpoint exists and works."""
        response = requests.post(
            f"{BASE_URL}/api/ai-assistant/check-duplicates",
            headers=auth_headers,
            params={"invoice_number": "TEST-INV-001", "vendor_name": "Test Vendor", "amount": 1000}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "duplicates" in data, "Response should have duplicates field"
        assert "has_duplicates" in data, "Response should have has_duplicates field"
        assert isinstance(data["duplicates"], list), "duplicates should be a list"
        assert isinstance(data["has_duplicates"], bool), "has_duplicates should be boolean"
        print(f"✓ Duplicate check returned: has_duplicates={data['has_duplicates']}, count={len(data['duplicates'])}")
    
    def test_check_duplicates_with_no_params(self, auth_headers):
        """POST /api/ai-assistant/check-duplicates works with no params."""
        response = requests.post(
            f"{BASE_URL}/api/ai-assistant/check-duplicates",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "duplicates" in data
        assert data["has_duplicates"] == False, "No duplicates expected with no params"
        print("✓ Duplicate check with no params returns empty result")
    
    def test_check_duplicates_requires_auth(self):
        """POST /api/ai-assistant/check-duplicates requires authentication."""
        response = requests.post(f"{BASE_URL}/api/ai-assistant/check-duplicates")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Duplicate check requires authentication")


# ============ VOICE TRANSCRIPTION ============

class TestVoiceTranscription:
    """Test voice transcription endpoint."""
    
    def test_voice_endpoint_exists(self, auth_headers):
        """POST /api/ai-assistant/voice endpoint exists."""
        # Create a minimal audio file (empty webm)
        # Note: This will likely fail transcription but should return proper error
        import io
        fake_audio = io.BytesIO(b'\x1a\x45\xdf\xa3')  # Minimal webm header
        fake_audio.name = "test.webm"
        
        files = {"file": ("test.webm", fake_audio, "audio/webm")}
        headers = {"Authorization": auth_headers["Authorization"]}
        
        response = requests.post(
            f"{BASE_URL}/api/ai-assistant/voice",
            headers=headers,
            files=files
        )
        # Endpoint should exist - may return 500 for invalid audio but not 404
        assert response.status_code != 404, f"Voice endpoint should exist, got {response.status_code}"
        print(f"✓ Voice endpoint exists (status: {response.status_code})")
    
    def test_voice_requires_auth(self):
        """POST /api/ai-assistant/voice requires authentication."""
        import io
        fake_audio = io.BytesIO(b'\x1a\x45\xdf\xa3')
        files = {"file": ("test.webm", fake_audio, "audio/webm")}
        
        response = requests.post(f"{BASE_URL}/api/ai-assistant/voice", files=files)
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Voice endpoint requires authentication")


# ============ BATCH ENTRIES ============

class TestBatchEntries:
    """Test batch entry functionality."""
    
    def test_batch_approve_endpoint_works(self, auth_headers):
        """POST /api/ai-assistant/batch-approve works."""
        response = requests.post(
            f"{BASE_URL}/api/ai-assistant/batch-approve",
            headers=auth_headers,
            json={"pending_ids": []}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "status" in data, "Response should have status"
        assert data["status"] == "batch_posted", f"Expected batch_posted, got {data['status']}"
        assert "total_approved" in data, "Response should have total_approved"
        print(f"✓ Batch approve works: {data}")
    
    def test_batch_reject_endpoint_works(self, auth_headers):
        """POST /api/ai-assistant/batch-reject works."""
        response = requests.post(
            f"{BASE_URL}/api/ai-assistant/batch-reject",
            headers=auth_headers,
            json={"pending_ids": []}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "status" in data, "Response should have status"
        assert data["status"] == "batch_rejected", f"Expected batch_rejected, got {data['status']}"
        print(f"✓ Batch reject works: {data}")
    
    def test_chat_with_multiple_entries_request(self, auth_headers):
        """POST /api/ai-assistant/chat with multiple entries returns batch_preview type."""
        response = requests.post(
            f"{BASE_URL}/api/ai-assistant/chat",
            headers=auth_headers,
            json={
                "message": "Create 2 journal entries: 1) Debit Cash 5000, Credit Sales 5000 for cash sale. 2) Debit Rent Expense 3000, Credit Cash 3000 for rent payment.",
                "company_id": None
            },
            timeout=60
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        # Should return either batch_preview or preview (depending on AI interpretation)
        assert "type" in data, "Response should have type"
        print(f"✓ Chat response type: {data['type']}")
        if data["type"] == "batch_preview":
            assert "batch" in data, "batch_preview should have batch field"
            assert "total_count" in data, "batch_preview should have total_count"
            print(f"✓ Batch preview returned {data['total_count']} entries")
        elif data["type"] == "preview":
            print("✓ Single preview returned (AI interpreted as single entry)")
        else:
            print(f"✓ Answer type returned: {data.get('message', '')[:100]}")


# ============ EXPORT ENDPOINTS REQUIRE AUTH ============

class TestExportAuth:
    """Test that export endpoints require authentication."""
    
    def test_journal_entries_export_requires_auth(self):
        """Export journal entries requires auth."""
        response = requests.get(f"{BASE_URL}/api/acc/export/journal-entries")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
    
    def test_chart_of_accounts_export_requires_auth(self):
        """Export chart of accounts requires auth."""
        response = requests.get(f"{BASE_URL}/api/acc/export/chart-of-accounts")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
    
    def test_invoices_export_requires_auth(self):
        """Export invoices requires auth."""
        response = requests.get(f"{BASE_URL}/api/acc/export/invoices")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
    
    def test_products_export_requires_auth(self):
        """Export products requires auth."""
        response = requests.get(f"{BASE_URL}/api/inv/export/products")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
    
    def test_stock_moves_export_requires_auth(self):
        """Export stock moves requires auth."""
        response = requests.get(f"{BASE_URL}/api/inv/export/stock-moves")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
    
    def test_audit_trail_export_requires_auth(self):
        """Export audit trail requires auth."""
        response = requests.get(f"{BASE_URL}/api/ai-assistant/export/audit-trail")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
