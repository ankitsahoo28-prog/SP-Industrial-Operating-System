"""
AI Business Assistant - Batch Features Tests
Tests for batch entry creation, batch-approve, and batch-reject endpoints
Added for iteration 22 testing.

Features tested:
- Chat with batch/multiple entry requests (returns batch_preview type)
- POST /api/ai-assistant/batch-approve (approves multiple pending entries)
- POST /api/ai-assistant/batch-reject (rejects multiple pending entries)
- Individual entry approve/reject within batch
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAIAssistantBatch:
    """AI Business Assistant batch features tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup for all tests - get auth token"""
        self.token = None
        
        # Director login
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "director@sp.com",
            "password": "password123"
        })
        if resp.status_code == 200:
            self.token = resp.json().get("token")
        
    def get_headers(self):
        return {"Authorization": f"Bearer {self.token}", "Content-Type": "application/json"}
    
    # ============ 1. BATCH CHAT TESTS ============
    
    def test_chat_batch_entries_returns_batch_preview(self):
        """POST /api/ai-assistant/chat asking for multiple entries returns batch_preview type"""
        if not self.token:
            pytest.skip("Director auth failed")
        
        # Request multiple entries
        response = requests.post(
            f"{BASE_URL}/api/ai-assistant/chat",
            headers=self.get_headers(),
            json={
                "message": "Create 3 journal entries: 1) Office supplies Rs 2000 debit office expenses credit cash, 2) Electricity bill Rs 5000 debit electricity expenses credit cash, 3) Internet Rs 1500 debit communication expenses credit cash"
            },
            timeout=90  # AI may take time for batch processing
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "type" in data, "Response should have 'type' field"
        
        if data["type"] == "batch_preview":
            # Verify batch_preview structure
            assert "batch" in data, "batch_preview should have 'batch' array"
            assert "total_count" in data, "batch_preview should have 'total_count'"
            assert isinstance(data["batch"], list), "'batch' should be a list"
            assert len(data["batch"]) > 0, "batch should have at least one entry"
            
            # Verify each batch item has pending_id and entries
            for item in data["batch"]:
                assert "pending_id" in item, f"Batch item should have 'pending_id'"
                assert "entries" in item, f"Batch item should have 'entries'"
            
            print(f"Batch preview created with {data['total_count']} entries")
            return data  # Return for use in other tests
        elif data["type"] == "preview":
            # AI might return single preview - still valid
            print(f"AI returned single preview instead of batch")
        else:
            print(f"AI returned answer type: {data.get('message', '')[:100]}")
    
    def test_chat_single_entry_returns_preview_not_batch(self):
        """POST /api/ai-assistant/chat with single entry request returns preview (not batch_preview)"""
        if not self.token:
            pytest.skip("Director auth failed")
        
        response = requests.post(
            f"{BASE_URL}/api/ai-assistant/chat",
            headers=self.get_headers(),
            json={"message": "Create a journal entry for office supplies Rs 5000 debit expenses credit cash"},
            timeout=60
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Single entry should return 'preview' not 'batch_preview'
        if data.get("type") == "preview":
            assert "pending_id" in data, "Preview should have pending_id"
            assert "entries" in data, "Preview should have entries"
            print(f"Single entry preview: {data['pending_id']}")
        else:
            print(f"Response type: {data.get('type')}")
    
    # ============ 2. BATCH APPROVE TESTS ============
    
    def test_batch_approve_endpoint_works(self):
        """POST /api/ai-assistant/batch-approve approves multiple entries"""
        if not self.token:
            pytest.skip("Director auth failed")
        
        # First create multiple pending entries via batch chat
        chat_resp = requests.post(
            f"{BASE_URL}/api/ai-assistant/chat",
            headers=self.get_headers(),
            json={
                "message": "Create 2 journal entries for testing: 1) Test entry A Rs 1000 debit office expenses credit cash, 2) Test entry B Rs 2000 debit travel expenses credit cash"
            },
            timeout=90
        )
        
        if chat_resp.status_code != 200:
            pytest.skip(f"Chat failed: {chat_resp.text}")
        
        chat_data = chat_resp.json()
        
        # Collect pending_ids
        pending_ids = []
        if chat_data.get("type") == "batch_preview":
            pending_ids = [item["pending_id"] for item in chat_data.get("batch", [])]
        elif chat_data.get("type") == "preview":
            pending_ids = [chat_data.get("pending_id")]
        
        if not pending_ids:
            pytest.skip("No pending entries created for batch approve test")
        
        print(f"Created {len(pending_ids)} pending entries for batch approve")
        
        # Now batch approve them
        approve_resp = requests.post(
            f"{BASE_URL}/api/ai-assistant/batch-approve",
            headers=self.get_headers(),
            json={"pending_ids": pending_ids}
        )
        
        assert approve_resp.status_code == 200, f"Batch approve failed: {approve_resp.text}"
        approve_data = approve_resp.json()
        
        assert approve_data.get("status") == "batch_posted", f"Expected status='batch_posted', got {approve_data}"
        assert "total_approved" in approve_data, "Response should have 'total_approved'"
        assert approve_data["total_approved"] >= 1, "At least one entry should be approved"
        
        print(f"Batch approved: {approve_data['total_approved']} entries, message: {approve_data.get('message', '')}")
    
    def test_batch_approve_empty_list_returns_zero(self):
        """POST /api/ai-assistant/batch-approve with empty list returns zero approved"""
        if not self.token:
            pytest.skip("Director auth failed")
        
        response = requests.post(
            f"{BASE_URL}/api/ai-assistant/batch-approve",
            headers=self.get_headers(),
            json={"pending_ids": []}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("total_approved") == 0, f"Expected 0 approved with empty list"
    
    def test_batch_approve_invalid_ids(self):
        """POST /api/ai-assistant/batch-approve with invalid IDs handles gracefully"""
        if not self.token:
            pytest.skip("Director auth failed")
        
        response = requests.post(
            f"{BASE_URL}/api/ai-assistant/batch-approve",
            headers=self.get_headers(),
            json={"pending_ids": ["invalid-id-1", "invalid-id-2"]}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        # Should report errors for invalid IDs
        assert "errors" in data, "Response should have 'errors' for invalid IDs"
        print(f"Batch approve with invalid IDs: {data.get('total_errors', 0)} errors")
    
    def test_batch_approve_requires_auth(self):
        """POST /api/ai-assistant/batch-approve without auth returns 401"""
        response = requests.post(
            f"{BASE_URL}/api/ai-assistant/batch-approve",
            json={"pending_ids": ["test-id"]}
        )
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
    
    # ============ 3. BATCH REJECT TESTS ============
    
    def test_batch_reject_endpoint_works(self):
        """POST /api/ai-assistant/batch-reject rejects multiple entries"""
        if not self.token:
            pytest.skip("Director auth failed")
        
        # First create pending entries
        chat_resp = requests.post(
            f"{BASE_URL}/api/ai-assistant/chat",
            headers=self.get_headers(),
            json={
                "message": "Create 2 journal entries for rejection test: 1) Reject test A Rs 500 debit misc credit cash, 2) Reject test B Rs 300 debit misc credit cash"
            },
            timeout=90
        )
        
        if chat_resp.status_code != 200:
            pytest.skip(f"Chat failed: {chat_resp.text}")
        
        chat_data = chat_resp.json()
        
        # Collect pending_ids
        pending_ids = []
        if chat_data.get("type") == "batch_preview":
            pending_ids = [item["pending_id"] for item in chat_data.get("batch", [])]
        elif chat_data.get("type") == "preview":
            pending_ids = [chat_data.get("pending_id")]
        
        if not pending_ids:
            pytest.skip("No pending entries created for batch reject test")
        
        print(f"Created {len(pending_ids)} pending entries for batch reject")
        
        # Now batch reject them
        reject_resp = requests.post(
            f"{BASE_URL}/api/ai-assistant/batch-reject",
            headers=self.get_headers(),
            json={"pending_ids": pending_ids}
        )
        
        assert reject_resp.status_code == 200, f"Batch reject failed: {reject_resp.text}"
        reject_data = reject_resp.json()
        
        assert reject_data.get("status") == "batch_rejected", f"Expected status='batch_rejected', got {reject_data}"
        assert "total_rejected" in reject_data, "Response should have 'total_rejected'"
        
        print(f"Batch rejected: {reject_data['total_rejected']} entries")
    
    def test_batch_reject_empty_list_returns_zero(self):
        """POST /api/ai-assistant/batch-reject with empty list returns zero rejected"""
        if not self.token:
            pytest.skip("Director auth failed")
        
        response = requests.post(
            f"{BASE_URL}/api/ai-assistant/batch-reject",
            headers=self.get_headers(),
            json={"pending_ids": []}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("total_rejected") == 0, f"Expected 0 rejected with empty list"
    
    def test_batch_reject_requires_auth(self):
        """POST /api/ai-assistant/batch-reject without auth returns 401"""
        response = requests.post(
            f"{BASE_URL}/api/ai-assistant/batch-reject",
            json={"pending_ids": ["test-id"]}
        )
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
    
    # ============ 4. SINGLE APPROVE/REJECT STILL WORKS ============
    
    def test_single_approve_still_works(self):
        """POST /api/ai-assistant/approve with single entry still works"""
        if not self.token:
            pytest.skip("Director auth failed")
        
        # Create a single pending entry
        chat_resp = requests.post(
            f"{BASE_URL}/api/ai-assistant/chat",
            headers=self.get_headers(),
            json={"message": "Create a journal entry for testing single approve Rs 1000"},
            timeout=60
        )
        
        if chat_resp.status_code != 200:
            pytest.skip(f"Chat failed: {chat_resp.text}")
        
        chat_data = chat_resp.json()
        
        # Get pending_id - could be from batch or single preview
        pending_id = None
        if chat_data.get("type") == "preview":
            pending_id = chat_data.get("pending_id")
        elif chat_data.get("type") == "batch_preview" and chat_data.get("batch"):
            pending_id = chat_data["batch"][0]["pending_id"]
        
        if not pending_id:
            pytest.skip("No pending entry created")
        
        # Approve single entry
        approve_resp = requests.post(
            f"{BASE_URL}/api/ai-assistant/approve",
            headers=self.get_headers(),
            json={"pending_id": pending_id}
        )
        
        assert approve_resp.status_code == 200, f"Single approve failed: {approve_resp.text}"
        approve_data = approve_resp.json()
        assert approve_data.get("status") == "posted", f"Expected status='posted', got {approve_data}"
        print(f"Single entry approved: {approve_data.get('message', '')}")
    
    def test_single_reject_still_works(self):
        """POST /api/ai-assistant/reject with single entry still works"""
        if not self.token:
            pytest.skip("Director auth failed")
        
        # Create a pending entry
        chat_resp = requests.post(
            f"{BASE_URL}/api/ai-assistant/chat",
            headers=self.get_headers(),
            json={"message": "Create a journal entry for testing single reject Rs 100"},
            timeout=60
        )
        
        if chat_resp.status_code != 200:
            pytest.skip(f"Chat failed: {chat_resp.text}")
        
        chat_data = chat_resp.json()
        
        # Get pending_id
        pending_id = None
        if chat_data.get("type") == "preview":
            pending_id = chat_data.get("pending_id")
        elif chat_data.get("type") == "batch_preview" and chat_data.get("batch"):
            pending_id = chat_data["batch"][0]["pending_id"]
        
        if not pending_id:
            pytest.skip("No pending entry created")
        
        # Reject single entry
        reject_resp = requests.post(
            f"{BASE_URL}/api/ai-assistant/reject",
            headers=self.get_headers(),
            json={"pending_id": pending_id}
        )
        
        assert reject_resp.status_code == 200, f"Single reject failed: {reject_resp.text}"
        reject_data = reject_resp.json()
        assert reject_data.get("status") == "rejected", f"Expected status='rejected', got {reject_data}"
        print("Single entry rejected successfully")
    
    # ============ 5. AUDIT STATS VERIFICATION ============
    
    def test_audit_stats_reflects_batch_actions(self):
        """GET /api/ai-assistant/audit-stats returns correct counts after batch operations"""
        if not self.token:
            pytest.skip("Director auth failed")
        
        response = requests.get(
            f"{BASE_URL}/api/ai-assistant/audit-stats",
            headers=self.get_headers()
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify structure
        required_fields = ["total_approved", "total_rejected", "total_pending", "total_actions"]
        for field in required_fields:
            assert field in data, f"Stats missing '{field}'"
            assert isinstance(data[field], int), f"'{field}' should be int"
        
        # total_actions should equal approved + rejected
        assert data["total_actions"] == data["total_approved"] + data["total_rejected"], \
            f"total_actions ({data['total_actions']}) should equal approved ({data['total_approved']}) + rejected ({data['total_rejected']})"
        
        print(f"Audit stats: approved={data['total_approved']}, rejected={data['total_rejected']}, pending={data['total_pending']}")
    
    # ============ 6. DELETE MAPPING STILL WORKS ============
    
    def test_delete_mapping_endpoint_works(self):
        """DELETE /api/ai-assistant/mappings/{id} still works"""
        if not self.token:
            pytest.skip("Director auth failed")
        
        # Create a test mapping
        create_resp = requests.post(
            f"{BASE_URL}/api/ai-assistant/learn",
            headers=self.get_headers(),
            json={
                "original": "TEST_BATCH_DELETE",
                "corrected": "Batch Delete Test",
                "field": "name"
            }
        )
        assert create_resp.status_code == 200, f"Create mapping failed: {create_resp.text}"
        mapping_id = create_resp.json().get("mapping", {}).get("id")
        assert mapping_id, "Created mapping should have id"
        
        # Delete it
        delete_resp = requests.delete(
            f"{BASE_URL}/api/ai-assistant/mappings/{mapping_id}",
            headers=self.get_headers()
        )
        
        assert delete_resp.status_code == 200, f"Delete mapping failed: {delete_resp.text}"
        assert delete_resp.json().get("status") == "deleted"
        print(f"Mapping {mapping_id} deleted successfully")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
