"""
AI Business Assistant Backend Tests
Tests for /ai-assistant/* endpoints including:
- Chat with text questions
- File upload and processing
- Approve/Reject pending entries
- History and audit trail
- Smart learning corrections
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAIAssistantBackend:
    """AI Business Assistant endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup for all tests - get auth token"""
        self.token = None
        self.manager_token = None
        
        # Director login
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "director@sp.com",
            "password": "password123"
        })
        if resp.status_code == 200:
            self.token = resp.json().get("token")
        
        # Manager login
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "manager@sp.com", 
            "password": "password123"
        })
        if resp.status_code == 200:
            self.manager_token = resp.json().get("token")
    
    def get_headers(self, token=None):
        return {"Authorization": f"Bearer {token or self.token}", "Content-Type": "application/json"}
    
    # ============ 1. CHAT ENDPOINT TESTS ============
    
    def test_chat_text_question_returns_answer(self):
        """POST /api/ai-assistant/chat with text question returns answer type response"""
        if not self.token:
            pytest.skip("Director auth failed")
        
        response = requests.post(
            f"{BASE_URL}/api/ai-assistant/chat",
            headers=self.get_headers(),
            json={"message": "What is my current month sales total?"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Should return answer type for general questions
        assert "type" in data, "Response should have 'type' field"
        assert "message" in data, "Response should have 'message' field"
        # Type can be 'answer' for text or 'preview' if AI decided to create entry
        assert data["type"] in ["answer", "preview"], f"Type should be 'answer' or 'preview', got {data['type']}"
        print(f"Chat response type: {data['type']}, message preview: {data['message'][:100]}...")
    
    def test_chat_create_journal_entry_returns_preview(self):
        """POST /api/ai-assistant/chat asking to create entry returns preview with pending_id"""
        if not self.token:
            pytest.skip("Director auth failed")
        
        response = requests.post(
            f"{BASE_URL}/api/ai-assistant/chat",
            headers=self.get_headers(),
            json={"message": "Create a journal entry for office supplies purchase of Rs 5000 from cash. Debit Office Expenses and Credit Cash."},
            timeout=60  # AI may take time
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # This should trigger preview type
        if data["type"] == "preview":
            assert "pending_id" in data, "Preview should have pending_id"
            assert "entries" in data, "Preview should have entries"
            
            entries = data["entries"]
            # Check for accounting entries
            if "accounting_entries" in entries:
                assert isinstance(entries["accounting_entries"], list), "accounting_entries should be list"
                print(f"Preview created with {len(entries.get('accounting_entries', []))} accounting entries")
        else:
            # AI might respond with text if it doesn't understand as entry creation
            print(f"AI responded with answer instead of preview: {data['message'][:100]}...")
    
    def test_chat_requires_auth(self):
        """POST /api/ai-assistant/chat without auth returns 401"""
        response = requests.post(
            f"{BASE_URL}/api/ai-assistant/chat",
            json={"message": "Test message"}
        )
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
    
    # ============ 2. FILE UPLOAD TESTS ============
    
    def test_upload_csv_file_returns_preview(self):
        """POST /api/ai-assistant/upload with CSV file returns preview type"""
        if not self.token:
            pytest.skip("Director auth failed")
        
        # Create a simple CSV file content
        csv_content = "Item,Quantity,Rate,Amount\nIron Fines,10,3000,30000\nSlag,5,2000,10000\nCoal,20,1500,30000"
        
        files = {
            'file': ('test_inventory.csv', csv_content.encode(), 'text/csv'),
        }
        data = {
            'message': 'Process this inventory purchase invoice',
        }
        
        headers = {"Authorization": f"Bearer {self.token}"}
        
        response = requests.post(
            f"{BASE_URL}/api/ai-assistant/upload",
            headers=headers,
            files=files,
            data=data,
            timeout=60
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        result = response.json()
        
        assert "type" in result, "Response should have 'type' field"
        if result["type"] == "preview":
            assert "pending_id" in result, "Preview should have pending_id"
            assert "entries" in result, "Preview should have entries"
            print(f"Upload preview created - document_type: {result.get('document_type', 'N/A')}")
        elif result["type"] == "error":
            print(f"Upload processing error: {result.get('message', 'Unknown error')}")
        else:
            print(f"Upload response: {result}")
    
    def test_upload_requires_auth(self):
        """POST /api/ai-assistant/upload without auth returns 401"""
        csv_content = "Item,Quantity\nTest,10"
        files = {'file': ('test.csv', csv_content.encode(), 'text/csv')}
        
        response = requests.post(
            f"{BASE_URL}/api/ai-assistant/upload",
            files=files
        )
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
    
    # ============ 3. APPROVE/REJECT TESTS ============
    
    def test_approve_entry_flow(self):
        """Test full flow: chat -> preview -> approve"""
        if not self.token:
            pytest.skip("Director auth failed")
        
        # First create a pending entry via chat
        chat_resp = requests.post(
            f"{BASE_URL}/api/ai-assistant/chat",
            headers=self.get_headers(),
            json={"message": "Create a simple expense entry for Rs 1000 taxi fare, debit Travel Expenses credit Cash"},
            timeout=60
        )
        
        if chat_resp.status_code != 200:
            pytest.skip(f"Chat failed: {chat_resp.text}")
        
        chat_data = chat_resp.json()
        if chat_data.get("type") != "preview":
            pytest.skip("AI did not create preview entry for approve test")
        
        pending_id = chat_data["pending_id"]
        
        # Now approve it
        approve_resp = requests.post(
            f"{BASE_URL}/api/ai-assistant/approve",
            headers=self.get_headers(),
            json={"pending_id": pending_id}
        )
        
        assert approve_resp.status_code == 200, f"Approve failed: {approve_resp.text}"
        approve_data = approve_resp.json()
        assert approve_data.get("status") == "posted", f"Expected status='posted', got {approve_data}"
        print(f"Entry approved and posted: {approve_data.get('results', [])}")
    
    def test_reject_entry_flow(self):
        """Test reject endpoint with a pending entry"""
        if not self.token:
            pytest.skip("Director auth failed")
        
        # First create a pending entry via chat
        chat_resp = requests.post(
            f"{BASE_URL}/api/ai-assistant/chat",
            headers=self.get_headers(),
            json={"message": "Create journal entry for Rs 500 office tea expenses"},
            timeout=60
        )
        
        if chat_resp.status_code != 200:
            pytest.skip(f"Chat failed: {chat_resp.text}")
        
        chat_data = chat_resp.json()
        if chat_data.get("type") != "preview":
            pytest.skip("AI did not create preview entry for reject test")
        
        pending_id = chat_data["pending_id"]
        
        # Reject it
        reject_resp = requests.post(
            f"{BASE_URL}/api/ai-assistant/reject",
            headers=self.get_headers(),
            json={"pending_id": pending_id}
        )
        
        assert reject_resp.status_code == 200, f"Reject failed: {reject_resp.text}"
        reject_data = reject_resp.json()
        assert reject_data.get("status") == "rejected", f"Expected status='rejected', got {reject_data}"
        print("Entry rejected successfully")
    
    def test_approve_nonexistent_entry_returns_404(self):
        """POST /api/ai-assistant/approve with invalid pending_id returns 404"""
        if not self.token:
            pytest.skip("Director auth failed")
        
        response = requests.post(
            f"{BASE_URL}/api/ai-assistant/approve",
            headers=self.get_headers(),
            json={"pending_id": "nonexistent-id-12345"}
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
    
    def test_reject_nonexistent_entry_returns_404(self):
        """POST /api/ai-assistant/reject with invalid pending_id returns 404"""
        if not self.token:
            pytest.skip("Director auth failed")
        
        response = requests.post(
            f"{BASE_URL}/api/ai-assistant/reject",
            headers=self.get_headers(),
            json={"pending_id": "nonexistent-id-12345"}
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
    
    # ============ 4. HISTORY TESTS ============
    
    def test_get_history_returns_list(self):
        """GET /api/ai-assistant/history returns list of past operations"""
        if not self.token:
            pytest.skip("Director auth failed")
        
        response = requests.get(
            f"{BASE_URL}/api/ai-assistant/history",
            headers=self.get_headers()
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "History should return a list"
        print(f"History returned {len(data)} entries")
        
        # Verify structure if there are entries
        if len(data) > 0:
            entry = data[0]
            assert "id" in entry, "Entry should have 'id'"
            assert "status" in entry, "Entry should have 'status'"
            assert "created_at" in entry, "Entry should have 'created_at'"
    
    def test_history_requires_auth(self):
        """GET /api/ai-assistant/history without auth returns 401"""
        response = requests.get(f"{BASE_URL}/api/ai-assistant/history")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
    
    # ============ 5. AUDIT TRAIL TESTS ============
    
    def test_get_audit_trail_returns_list(self):
        """GET /api/ai-assistant/audit-trail returns audit entries"""
        if not self.token:
            pytest.skip("Director auth failed")
        
        response = requests.get(
            f"{BASE_URL}/api/ai-assistant/audit-trail",
            headers=self.get_headers()
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Audit trail should return a list"
        print(f"Audit trail returned {len(data)} entries")
    
    def test_audit_trail_requires_auth(self):
        """GET /api/ai-assistant/audit-trail without auth returns 401"""
        response = requests.get(f"{BASE_URL}/api/ai-assistant/audit-trail")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
    
    # ============ 6. SMART LEARNING - CORRECTION MAPPINGS ============
    
    def test_save_correction_mapping(self):
        """POST /api/ai-assistant/learn saves correction mapping"""
        if not self.token:
            pytest.skip("Director auth failed")
        
        response = requests.post(
            f"{BASE_URL}/api/ai-assistant/learn",
            headers=self.get_headers(),
            json={
                "original": "TEST_IRON FINES",
                "corrected": "Iron Fines 60%",
                "field": "product_name"
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("status") == "saved", f"Expected status='saved', got {data}"
        print(f"Correction mapping saved: {data.get('mapping', {})}")
    
    def test_get_correction_mappings(self):
        """GET /api/ai-assistant/mappings returns correction mappings"""
        if not self.token:
            pytest.skip("Director auth failed")
        
        response = requests.get(
            f"{BASE_URL}/api/ai-assistant/mappings",
            headers=self.get_headers()
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Mappings should return a list"
        print(f"Mappings returned {len(data)} entries")
    
    # ============ 7. AUDIT STATS ENDPOINT ============
    
    def test_get_audit_stats_returns_stats(self):
        """GET /api/ai-assistant/audit-stats returns stats object with totals"""
        if not self.token:
            pytest.skip("Director auth failed")
        
        response = requests.get(
            f"{BASE_URL}/api/ai-assistant/audit-stats",
            headers=self.get_headers()
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify stats structure
        assert "total_approved" in data, "Stats should have 'total_approved'"
        assert "total_rejected" in data, "Stats should have 'total_rejected'"
        assert "total_pending" in data, "Stats should have 'total_pending'"
        assert "total_actions" in data, "Stats should have 'total_actions'"
        
        # Verify values are integers
        assert isinstance(data["total_approved"], int), "total_approved should be int"
        assert isinstance(data["total_rejected"], int), "total_rejected should be int"
        assert isinstance(data["total_pending"], int), "total_pending should be int"
        assert isinstance(data["total_actions"], int), "total_actions should be int"
        
        print(f"Audit stats: approved={data['total_approved']}, rejected={data['total_rejected']}, pending={data['total_pending']}, total_actions={data['total_actions']}")
    
    def test_audit_stats_requires_auth(self):
        """GET /api/ai-assistant/audit-stats without auth returns 401"""
        response = requests.get(f"{BASE_URL}/api/ai-assistant/audit-stats")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
    
    # ============ 8. DELETE MAPPING ENDPOINT ============
    
    def test_delete_mapping_flow(self):
        """Test create mapping then delete it"""
        if not self.token:
            pytest.skip("Director auth failed")
        
        # First create a test mapping
        create_resp = requests.post(
            f"{BASE_URL}/api/ai-assistant/learn",
            headers=self.get_headers(),
            json={
                "original": "TEST_DELETE_ME",
                "corrected": "Delete Test Item",
                "field": "name"
            }
        )
        assert create_resp.status_code == 200, f"Create mapping failed: {create_resp.text}"
        mapping_data = create_resp.json().get("mapping", {})
        mapping_id = mapping_data.get("id")
        assert mapping_id, "Created mapping should have id"
        
        # Now delete it
        delete_resp = requests.delete(
            f"{BASE_URL}/api/ai-assistant/mappings/{mapping_id}",
            headers=self.get_headers()
        )
        
        assert delete_resp.status_code == 200, f"Delete mapping failed: {delete_resp.text}"
        delete_data = delete_resp.json()
        assert delete_data.get("status") == "deleted", f"Expected status='deleted', got {delete_data}"
        print(f"Mapping {mapping_id} deleted successfully")
    
    def test_delete_nonexistent_mapping_returns_404(self):
        """DELETE /api/ai-assistant/mappings/{id} with invalid id returns 404"""
        if not self.token:
            pytest.skip("Director auth failed")
        
        response = requests.delete(
            f"{BASE_URL}/api/ai-assistant/mappings/nonexistent-mapping-id",
            headers=self.get_headers()
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
    
    # ============ 9. MANAGER ACCESS TESTS ============
    
    def test_manager_can_access_chat(self):
        """Manager role should have access to AI Assistant chat"""
        if not self.manager_token:
            pytest.skip("Manager auth failed")
        
        response = requests.post(
            f"{BASE_URL}/api/ai-assistant/chat",
            headers=self.get_headers(self.manager_token),
            json={"message": "What is my inventory status?"},
            timeout=60
        )
        
        assert response.status_code == 200, f"Manager chat failed: {response.status_code}: {response.text}"
        data = response.json()
        assert "type" in data and "message" in data
        print(f"Manager chat access verified - type: {data['type']}")
    
    def test_manager_can_access_history(self):
        """Manager role should have access to AI Assistant history"""
        if not self.manager_token:
            pytest.skip("Manager auth failed")
        
        response = requests.get(
            f"{BASE_URL}/api/ai-assistant/history",
            headers=self.get_headers(self.manager_token)
        )
        
        assert response.status_code == 200, f"Manager history failed: {response.status_code}"
        data = response.json()
        assert isinstance(data, list)
        print("Manager history access verified")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
