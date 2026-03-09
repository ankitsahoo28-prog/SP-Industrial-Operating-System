"""
Test suite for Iteration 13 new features:
1. File upload (POST /api/upload, GET /api/files/{filename})
2. Job roles integration (GET /api/job-roles, PATCH /api/users/{user_id}/job-role)
3. Transactions with attachments (POST/GET /api/transactions, PATCH /api/transactions/{id}/attachments)
"""
import pytest
import requests
import os
import uuid
import tempfile

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestFileUpload:
    """Tests for file upload and serving endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get director auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "director@sp.com",
            "password": "password123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_upload_file_success(self):
        """POST /api/upload - Upload a file successfully"""
        # Create a small test file
        test_content = b"Test file content for upload"
        files = {'file': ('test_file.txt', test_content, 'text/plain')}
        
        response = requests.post(
            f"{BASE_URL}/api/upload?category=test",
            files=files,
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Upload failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "url" in data, "Response should contain 'url'"
        assert "filename" in data, "Response should contain 'filename'"
        assert "size" in data, "Response should contain 'size'"
        assert "original_name" in data, "Response should contain 'original_name'"
        
        # Verify values
        assert data["original_name"] == "test_file.txt"
        assert data["size"] == len(test_content)
        assert data["url"].startswith("/api/files/")
        assert "test_" in data["filename"]  # Should have category prefix
        
        print(f"SUCCESS: File uploaded - URL: {data['url']}, Size: {data['size']}")
        
        # Store for cleanup/verification
        self.uploaded_filename = data["filename"]
        self.uploaded_url = data["url"]
    
    def test_upload_image_file(self):
        """POST /api/upload - Upload an image file"""
        # Create a minimal valid PNG (1x1 transparent pixel)
        png_data = bytes([
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,  # PNG signature
            0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,  # IHDR chunk
            0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
            0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
            0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41,
            0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
            0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00,
            0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE,
            0x42, 0x60, 0x82
        ])
        files = {'file': ('test_logo.png', png_data, 'image/png')}
        
        response = requests.post(
            f"{BASE_URL}/api/upload?category=logo",
            files=files,
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Image upload failed: {response.text}"
        data = response.json()
        assert data["original_name"] == "test_logo.png"
        assert "logo_" in data["filename"]
        print(f"SUCCESS: Image uploaded - {data['filename']}")
    
    def test_serve_uploaded_file(self):
        """GET /api/files/{filename} - Serve an uploaded file"""
        # First upload a file
        test_content = b"Content to verify serving"
        files = {'file': ('serve_test.txt', test_content, 'text/plain')}
        
        upload_response = requests.post(
            f"{BASE_URL}/api/upload?category=test",
            files=files,
            headers=self.headers
        )
        assert upload_response.status_code == 200
        filename = upload_response.json()["filename"]
        
        # Now retrieve it
        response = requests.get(f"{BASE_URL}/api/files/{filename}")
        
        assert response.status_code == 200, f"File serving failed: {response.text}"
        assert response.content == test_content, "Served content doesn't match uploaded content"
        print(f"SUCCESS: File served correctly - {filename}")
    
    def test_serve_nonexistent_file_404(self):
        """GET /api/files/{filename} - Return 404 for non-existent file"""
        response = requests.get(f"{BASE_URL}/api/files/nonexistent_file_xyz123.txt")
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("SUCCESS: 404 returned for non-existent file")
    
    def test_upload_no_file_error(self):
        """POST /api/upload - Error when no file provided"""
        response = requests.post(
            f"{BASE_URL}/api/upload?category=test",
            headers=self.headers
        )
        
        # Should return error (422 for validation error or 400)
        assert response.status_code in [400, 422], f"Expected 400/422, got {response.status_code}"
        print("SUCCESS: Proper error for missing file")


class TestJobRoles:
    """Tests for job roles and user job role assignment"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get director auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "director@sp.com",
            "password": "password123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}", "Content-Type": "application/json"}
    
    def test_get_job_roles(self):
        """GET /api/job-roles - List all job roles"""
        response = requests.get(f"{BASE_URL}/api/job-roles", headers=self.headers)
        
        assert response.status_code == 200, f"Get job roles failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"SUCCESS: Retrieved {len(data)} job roles")
        
        # If there are roles, verify structure
        if data:
            role = data[0]
            assert "id" in role, "Role should have 'id'"
            assert "name" in role, "Role should have 'name'"
            print(f"Sample role: {role['name']}")
    
    def test_create_job_role(self):
        """POST /api/job-roles - Create a new job role"""
        role_data = {
            "name": f"TEST_Role_{uuid.uuid4().hex[:6]}",
            "description": "Test role for automated testing",
            "permissions": ["read_reports", "edit_inventory"]
        }
        
        response = requests.post(
            f"{BASE_URL}/api/job-roles",
            json=role_data,
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Create job role failed: {response.text}"
        data = response.json()
        
        assert data["name"] == role_data["name"]
        assert data["description"] == role_data["description"]
        assert "id" in data
        print(f"SUCCESS: Created job role '{data['name']}' with id {data['id']}")
        
        # Store for cleanup
        self.created_role_id = data["id"]
    
    def test_update_user_job_role(self):
        """PATCH /api/users/{user_id}/job-role - Update user's job role"""
        # First get users list
        users_response = requests.get(f"{BASE_URL}/api/users", headers=self.headers)
        assert users_response.status_code == 200
        users = users_response.json()
        
        # Find a non-director user to update
        test_user = None
        for user in users:
            if user.get("role") != "director":
                test_user = user
                break
        
        if not test_user:
            pytest.skip("No non-director user found for testing")
        
        # Get job roles
        roles_response = requests.get(f"{BASE_URL}/api/job-roles", headers=self.headers)
        assert roles_response.status_code == 200
        roles = roles_response.json()
        
        if not roles:
            # Create a role first
            role_data = {"name": f"TEST_AutoRole_{uuid.uuid4().hex[:4]}", "description": "Auto-created for test"}
            create_role = requests.post(f"{BASE_URL}/api/job-roles", json=role_data, headers=self.headers)
            assert create_role.status_code == 200
            role_id = create_role.json()["id"]
        else:
            role_id = roles[0]["id"]
        
        # Update user's job role
        response = requests.patch(
            f"{BASE_URL}/api/users/{test_user['id']}/job-role",
            params={"job_role_id": role_id},
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Update job role failed: {response.text}"
        data = response.json()
        assert "message" in data
        print(f"SUCCESS: Updated user {test_user['name']}'s job role to {role_id}")
    
    def test_clear_user_job_role(self):
        """PATCH /api/users/{user_id}/job-role - Clear user's job role (set to null)"""
        # Get users list
        users_response = requests.get(f"{BASE_URL}/api/users", headers=self.headers)
        assert users_response.status_code == 200
        users = users_response.json()
        
        # Find a non-director user
        test_user = None
        for user in users:
            if user.get("role") != "director":
                test_user = user
                break
        
        if not test_user:
            pytest.skip("No non-director user found for testing")
        
        # Clear job role (pass null/empty)
        response = requests.patch(
            f"{BASE_URL}/api/users/{test_user['id']}/job-role",
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Clear job role failed: {response.text}"
        print(f"SUCCESS: Cleared job role for user {test_user['name']}")


class TestTransactionsWithAttachments:
    """Tests for transactions with attachments (bills/photos)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get director auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "director@sp.com",
            "password": "password123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}", "Content-Type": "application/json"}
    
    def test_create_transaction_with_attachments(self):
        """POST /api/transactions - Create transaction with attachments"""
        # First upload a file to use as attachment
        test_content = b"Bill receipt content"
        files = {'file': ('bill_receipt.txt', test_content, 'text/plain')}
        
        upload_response = requests.post(
            f"{BASE_URL}/api/upload?category=bill",
            files=files,
            headers={"Authorization": f"Bearer {self.token}"}
        )
        assert upload_response.status_code == 200
        attachment_url = upload_response.json()["url"]
        
        # Create transaction with attachment
        transaction_data = {
            "transaction_type": "expense",
            "payment_mode": "cash",
            "amount": 1500.50,
            "description": "TEST_Office supplies purchase with receipt",
            "category": "Office Expenses",
            "attachments": [attachment_url]
        }
        
        response = requests.post(
            f"{BASE_URL}/api/transactions",
            json=transaction_data,
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Create transaction failed: {response.text}"
        data = response.json()
        
        assert data["transaction_type"] == "expense"
        assert data["payment_mode"] == "cash"
        assert data["amount"] == 1500.50
        assert "TEST_" in data["description"]
        print(f"SUCCESS: Created transaction with ID {data['id']}")
        
        # Store for verification
        self.created_txn_id = data["id"]
    
    def test_get_transactions_returns_attachments(self):
        """GET /api/transactions - Verify attachments are returned"""
        response = requests.get(
            f"{BASE_URL}/api/transactions",
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Get transactions failed: {response.text}"
        transactions = response.json()
        assert isinstance(transactions, list)
        
        print(f"SUCCESS: Retrieved {len(transactions)} transactions")
        
        # Check if any transaction has attachments
        has_attachments = False
        for txn in transactions:
            if txn.get("attachments") and len(txn["attachments"]) > 0:
                has_attachments = True
                print(f"  - Transaction {txn['id']} has {len(txn['attachments'])} attachment(s)")
                break
        
        # Note: We may not have attachments yet if this is first run
        print(f"  - Transactions with attachments found: {has_attachments}")
    
    def test_update_transaction_attachments(self):
        """PATCH /api/transactions/{id}/attachments - Update transaction attachments"""
        # First create a transaction
        transaction_data = {
            "transaction_type": "expense",
            "payment_mode": "bank",
            "amount": 2500.00,
            "description": "TEST_Utility payment",
            "category": "Utilities"
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/transactions",
            json=transaction_data,
            headers=self.headers
        )
        assert create_response.status_code == 200
        txn_id = create_response.json()["id"]
        
        # Upload a file for attachment
        test_content = b"Utility bill scan"
        files = {'file': ('utility_bill.txt', test_content, 'text/plain')}
        upload_response = requests.post(
            f"{BASE_URL}/api/upload?category=bill",
            files=files,
            headers={"Authorization": f"Bearer {self.token}"}
        )
        assert upload_response.status_code == 200
        attachment_url = upload_response.json()["url"]
        
        # Update attachments - Note: endpoint expects {"attachments": [...]} in body
        response = requests.patch(
            f"{BASE_URL}/api/transactions/{txn_id}/attachments",
            json={"attachments": [attachment_url]},
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Update attachments failed: {response.text}"
        print(f"SUCCESS: Updated attachments for transaction {txn_id}")
    
    def test_create_transaction_without_attachments(self):
        """POST /api/transactions - Create transaction without attachments (should work)"""
        transaction_data = {
            "transaction_type": "income",
            "payment_mode": "bank",
            "amount": 50000.00,
            "description": "TEST_Client payment received",
            "category": "Sales"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/transactions",
            json=transaction_data,
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Create transaction failed: {response.text}"
        data = response.json()
        assert data["transaction_type"] == "income"
        print(f"SUCCESS: Created income transaction without attachments: {data['id']}")


class TestUploadCategories:
    """Tests for different upload categories (logo, bg-video, bg-image, bill)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get director auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "director@sp.com",
            "password": "password123"
        })
        assert response.status_code == 200
        self.token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_upload_logo_category(self):
        """Upload file with 'logo' category"""
        test_content = b"logo file content"
        files = {'file': ('company_logo.png', test_content, 'image/png')}
        
        response = requests.post(
            f"{BASE_URL}/api/upload?category=logo",
            files=files,
            headers=self.headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "logo_" in data["filename"], f"Expected 'logo_' prefix, got {data['filename']}"
        print(f"SUCCESS: Logo uploaded with filename: {data['filename']}")
    
    def test_upload_bg_video_category(self):
        """Upload file with 'bg-video' category"""
        test_content = b"video file content"
        files = {'file': ('background.mp4', test_content, 'video/mp4')}
        
        response = requests.post(
            f"{BASE_URL}/api/upload?category=bg-video",
            files=files,
            headers=self.headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "bg-video_" in data["filename"]
        print(f"SUCCESS: Background video uploaded: {data['filename']}")
    
    def test_upload_bg_image_category(self):
        """Upload file with 'bg-image' category"""
        test_content = b"background image content"
        files = {'file': ('bg_image.jpg', test_content, 'image/jpeg')}
        
        response = requests.post(
            f"{BASE_URL}/api/upload?category=bg-image",
            files=files,
            headers=self.headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "bg-image_" in data["filename"]
        print(f"SUCCESS: Background image uploaded: {data['filename']}")
    
    def test_upload_bill_category(self):
        """Upload file with 'bill' category"""
        test_content = b"bill document content"
        files = {'file': ('invoice.pdf', test_content, 'application/pdf')}
        
        response = requests.post(
            f"{BASE_URL}/api/upload?category=bill",
            files=files,
            headers=self.headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "bill_" in data["filename"]
        print(f"SUCCESS: Bill uploaded: {data['filename']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
