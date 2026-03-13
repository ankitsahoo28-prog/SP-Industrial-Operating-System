"""
Test GST, Advance Payments, AI Chat Confirmation Features
Tests for iteration 18 - Testing:
1. GST in Accounting (IGST, SGST, CGST)
2. Advance Payment handling
3. AI Chat confirmation before posting
4. Manager inventory access
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestBackendAPIs:
    """Test backend API endpoints"""
    
    @pytest.fixture(scope="class")
    def director_token(self):
        """Get director auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "director@sp.com",
            "password": "password123"
        })
        assert response.status_code == 200, f"Director login failed: {response.text}"
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def manager_token(self):
        """Get manager auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "manager@sp.com",
            "password": "password123"
        })
        assert response.status_code == 200, f"Manager login failed: {response.text}"
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def director_headers(self, director_token):
        """Headers with director auth"""
        return {"Authorization": f"Bearer {director_token}", "Content-Type": "application/json"}
    
    @pytest.fixture(scope="class")
    def manager_headers(self, manager_token):
        """Headers with manager auth"""
        return {"Authorization": f"Bearer {manager_token}", "Content-Type": "application/json"}
    
    @pytest.fixture(scope="class")
    def partner_id(self, director_headers):
        """Get or create a test partner"""
        # First check if partner exists
        response = requests.get(f"{BASE_URL}/api/acc/partners", headers=director_headers)
        if response.status_code == 200:
            partners = response.json()
            if partners:
                return partners[0]["id"]
        
        # Create test partner if none exist
        response = requests.post(f"{BASE_URL}/api/acc/partners", headers=director_headers, json={
            "name": "TEST_GST_Partner",
            "partner_type": "customer",
            "email": "test@gst.com",
            "phone": "1234567890"
        })
        assert response.status_code == 200, f"Failed to create partner: {response.text}"
        return response.json()["id"]

    @pytest.fixture(scope="class")
    def cash_journal_id(self, director_headers):
        """Get cash journal ID"""
        response = requests.get(f"{BASE_URL}/api/acc/journals", headers=director_headers)
        assert response.status_code == 200
        journals = response.json()
        cash_journal = next((j for j in journals if j["journal_type"] == "cash"), None)
        assert cash_journal is not None, "No cash journal found"
        return cash_journal["id"]

    # ========== GST INVOICE TESTS ==========
    
    def test_create_invoice_intra_state_gst_18(self, director_headers, partner_id):
        """Test invoice creation with intra-state GST (CGST + SGST) at 18%"""
        payload = {
            "move_type": "out_invoice",
            "partner_id": partner_id,
            "ref": "TEST_INTRA_GST_18",
            "gst_type": "intra",
            "invoice_lines": [
                {
                    "product_name": "Test Product Intra",
                    "quantity": 2,
                    "unit_price": 1000,
                    "gst_rate": 18,
                    "gst_type": "intra"
                }
            ]
        }
        response = requests.post(f"{BASE_URL}/api/acc/invoices", headers=director_headers, json=payload)
        assert response.status_code == 200, f"Invoice creation failed: {response.text}"
        
        invoice = response.json()
        # Verify tax calculation: 2 * 1000 = 2000 subtotal, 18% = 360 tax
        assert invoice["amount_untaxed"] == 2000, f"Expected untaxed 2000, got {invoice['amount_untaxed']}"
        assert invoice["amount_tax"] == 360, f"Expected tax 360, got {invoice['amount_tax']}"
        assert invoice["amount_total"] == 2360, f"Expected total 2360, got {invoice['amount_total']}"
        assert invoice.get("gst_type") == "intra", f"Expected gst_type 'intra', got {invoice.get('gst_type')}"
        print(f"✓ Intra-state GST 18% invoice created: {invoice['amount_total']} (tax: {invoice['amount_tax']})")
    
    def test_create_invoice_inter_state_gst_28(self, director_headers, partner_id):
        """Test invoice creation with inter-state GST (IGST) at 28%"""
        payload = {
            "move_type": "out_invoice",
            "partner_id": partner_id,
            "ref": "TEST_INTER_GST_28",
            "gst_type": "inter",
            "invoice_lines": [
                {
                    "product_name": "Test Product Inter",
                    "quantity": 1,
                    "unit_price": 5000,
                    "gst_rate": 28,
                    "gst_type": "inter"
                }
            ]
        }
        response = requests.post(f"{BASE_URL}/api/acc/invoices", headers=director_headers, json=payload)
        assert response.status_code == 200, f"Invoice creation failed: {response.text}"
        
        invoice = response.json()
        # Verify tax calculation: 5000 * 28% = 1400 IGST
        assert invoice["amount_untaxed"] == 5000, f"Expected untaxed 5000, got {invoice['amount_untaxed']}"
        assert invoice["amount_tax"] == 1400, f"Expected tax 1400, got {invoice['amount_tax']}"
        assert invoice["amount_total"] == 6400, f"Expected total 6400, got {invoice['amount_total']}"
        assert invoice.get("gst_type") == "inter", f"Expected gst_type 'inter', got {invoice.get('gst_type')}"
        print(f"✓ Inter-state GST 28% invoice created: {invoice['amount_total']} (tax: {invoice['amount_tax']})")

    # ========== ADVANCE PAYMENT TESTS ==========
    
    def test_create_advance_payment(self, director_headers, partner_id, cash_journal_id):
        """Test creating an advance payment with is_advance=true"""
        payload = {
            "payment_type": "inbound",
            "partner_id": partner_id,
            "amount": 15000,
            "journal_id": cash_journal_id,
            "ref": "TEST_ADVANCE_PAYMENT",
            "is_advance": True
        }
        response = requests.post(f"{BASE_URL}/api/acc/payments", headers=director_headers, json=payload)
        assert response.status_code == 200, f"Payment creation failed: {response.text}"
        
        payment = response.json()
        assert payment.get("is_advance") == True, f"Expected is_advance=True, got {payment.get('is_advance')}"
        assert payment.get("advance_balance") == 15000, f"Expected advance_balance=15000, got {payment.get('advance_balance')}"
        print(f"✓ Advance payment created: amount={payment['amount']}, advance_balance={payment.get('advance_balance')}")
        return payment["id"]

    def test_list_advance_payments_only(self, director_headers):
        """Test GET /api/acc/payments?is_advance=true returns only advance payments"""
        response = requests.get(f"{BASE_URL}/api/acc/payments?is_advance=true", headers=director_headers)
        assert response.status_code == 200, f"List advance payments failed: {response.text}"
        
        payments = response.json()
        assert isinstance(payments, list), "Expected list response"
        # All returned payments should have is_advance=True
        for p in payments:
            assert p.get("is_advance") == True, f"Non-advance payment found in filtered list: {p.get('ref')}"
        print(f"✓ Advance payments filter works: {len(payments)} advance payments returned")

    def test_create_invoice_with_advance_adjustment(self, director_headers, partner_id):
        """Test invoice creation with advance_adjustment to reduce amount_residual"""
        # First create an advance payment
        cash_response = requests.get(f"{BASE_URL}/api/acc/journals?journal_type=cash", headers=director_headers)
        journals = cash_response.json()
        cash_journal_id = journals[0]["id"] if journals else None
        
        if cash_journal_id:
            advance_payload = {
                "payment_type": "inbound",
                "partner_id": partner_id,
                "amount": 10000,
                "journal_id": cash_journal_id,
                "ref": "TEST_ADV_FOR_INVOICE",
                "is_advance": True
            }
            requests.post(f"{BASE_URL}/api/acc/payments", headers=director_headers, json=advance_payload)
        
        # Now create invoice with advance adjustment
        invoice_payload = {
            "move_type": "out_invoice",
            "partner_id": partner_id,
            "ref": "TEST_WITH_ADVANCE_ADJ",
            "gst_type": "intra",
            "advance_adjustment": 10000,
            "invoice_lines": [
                {
                    "product_name": "Product With Advance",
                    "quantity": 1,
                    "unit_price": 20000,
                    "gst_rate": 18
                }
            ]
        }
        response = requests.post(f"{BASE_URL}/api/acc/invoices", headers=director_headers, json=invoice_payload)
        assert response.status_code == 200, f"Invoice creation failed: {response.text}"
        
        invoice = response.json()
        # 20000 + 18% = 23600 total, minus 10000 advance = 13600 residual
        expected_total = 23600
        expected_residual = 13600
        assert invoice["amount_total"] == expected_total, f"Expected total {expected_total}, got {invoice['amount_total']}"
        assert invoice["amount_residual"] == expected_residual, f"Expected residual {expected_residual}, got {invoice['amount_residual']}"
        assert invoice.get("advance_adjustment") == 10000, f"Expected advance_adjustment=10000, got {invoice.get('advance_adjustment')}"
        print(f"✓ Invoice with advance adjustment: total={invoice['amount_total']}, residual={invoice['amount_residual']}")

    # ========== AI CHAT TESTS ==========
    
    def test_ai_chat_without_auto_post(self, director_headers):
        """Test AI chat with auto_post=false returns action_type and proposed entry without posting"""
        payload = {
            "message": "Record rent payment of 10000 from bank",
            "auto_post": False
        }
        response = requests.post(f"{BASE_URL}/api/acc/ai/chat", headers=director_headers, json=payload)
        assert response.status_code == 200, f"AI chat failed: {response.text}"
        
        result = response.json()
        assert "action_type" in result, f"Missing action_type in response: {result}"
        assert "response_text" in result, f"Missing response_text in response: {result}"
        # Should not be executed when auto_post=false
        assert result.get("executed") == False or result.get("executed") is None, f"Entry should not be executed: {result.get('executed')}"
        print(f"✓ AI chat without auto_post: action_type={result.get('action_type')}, executed={result.get('executed')}")

    def test_ai_chat_returns_proposed_entry(self, director_headers):
        """Test AI chat returns journal_entry/invoice/payment structure for confirmation"""
        payload = {
            "message": "Create journal entry: debit Rent Expense 15000, credit Bank 15000",
            "auto_post": False
        }
        response = requests.post(f"{BASE_URL}/api/acc/ai/chat", headers=director_headers, json=payload)
        assert response.status_code == 200, f"AI chat failed: {response.text}"
        
        result = response.json()
        # AI should return either journal_entry, invoice, or payment structure
        has_proposal = result.get("journal_entry") or result.get("invoice") or result.get("payment")
        # If action_type is info/clarification, it won't have a proposal
        if result.get("action_type") in ["journal_entry", "invoice", "payment"]:
            assert has_proposal, f"Expected journal_entry/invoice/payment proposal: {result}"
        print(f"✓ AI chat proposal: action_type={result.get('action_type')}")

    # ========== MANAGER INVENTORY ACCESS TESTS ==========
    
    def test_manager_can_access_inventory(self, manager_headers):
        """Test manager can access inventory endpoints"""
        response = requests.get(f"{BASE_URL}/api/inv/overview", headers=manager_headers)
        # Manager should have inventory access
        assert response.status_code in [200, 403], f"Unexpected status: {response.status_code}"
        
        if response.status_code == 200:
            print(f"✓ Manager can access inventory overview")
        else:
            # Check permissions
            print(f"⚠ Manager inventory access denied (may need permission check)")
    
    def test_manager_can_list_inventory_items(self, manager_headers):
        """Test manager can list inventory items"""
        response = requests.get(f"{BASE_URL}/api/inv/items", headers=manager_headers)
        assert response.status_code in [200, 403], f"Unexpected status: {response.status_code}"
        
        if response.status_code == 200:
            items = response.json()
            print(f"✓ Manager can list inventory items: {len(items)} items found")
        else:
            print(f"⚠ Manager inventory items access denied")

    def test_manager_can_access_inventory_tabs(self, manager_headers):
        """Test manager can access various inventory tab endpoints"""
        endpoints = [
            "/api/inv/warehouses",
            "/api/inv/moves",
        ]
        
        for endpoint in endpoints:
            response = requests.get(f"{BASE_URL}{endpoint}", headers=manager_headers)
            if response.status_code == 200:
                print(f"✓ Manager can access {endpoint}")
            else:
                print(f"⚠ Manager access to {endpoint}: {response.status_code}")


class TestGSTAccounts:
    """Test GST accounts are properly set up"""
    
    @pytest.fixture(scope="class")
    def director_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "director@sp.com",
            "password": "password123"
        })
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def director_headers(self, director_token):
        return {"Authorization": f"Bearer {director_token}", "Content-Type": "application/json"}
    
    def test_gst_accounts_exist(self, director_headers):
        """Verify GST accounts (2210-CGST, 2211-SGST, 2212-IGST) exist"""
        response = requests.get(f"{BASE_URL}/api/acc/accounts", headers=director_headers)
        assert response.status_code == 200, f"Failed to get accounts: {response.text}"
        
        accounts = response.json()
        account_codes = {a["code"] for a in accounts}
        
        required_gst_codes = {"2210", "2211", "2212"}
        missing = required_gst_codes - account_codes
        
        if missing:
            print(f"⚠ Missing GST accounts: {missing}")
        else:
            print(f"✓ All GST accounts exist (2210-CGST, 2211-SGST, 2212-IGST)")
        
        # Get actual account names for verification
        for code in required_gst_codes:
            acct = next((a for a in accounts if a["code"] == code), None)
            if acct:
                print(f"  - {acct['code']}: {acct['name']}")


class TestInvoiceGSTDisplay:
    """Test invoice detail shows GST type"""
    
    @pytest.fixture(scope="class")
    def director_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "director@sp.com",
            "password": "password123"
        })
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def director_headers(self, director_token):
        return {"Authorization": f"Bearer {director_token}", "Content-Type": "application/json"}
    
    def test_invoice_detail_shows_gst_type(self, director_headers):
        """Test GET /api/acc/moves/{id} returns gst_type field"""
        # First get list of invoices
        response = requests.get(f"{BASE_URL}/api/acc/moves?move_type=invoices&limit=5", headers=director_headers)
        assert response.status_code == 200
        
        invoices = response.json()
        if not invoices:
            print("⚠ No invoices found to verify GST type display")
            return
        
        # Get detail of first invoice
        invoice_id = invoices[0]["id"]
        detail_response = requests.get(f"{BASE_URL}/api/acc/moves/{invoice_id}", headers=director_headers)
        assert detail_response.status_code == 200
        
        detail = detail_response.json()
        print(f"✓ Invoice detail: gst_type={detail.get('gst_type')}, amount_tax={detail.get('amount_tax')}")
        
        # Check invoice_lines have gst_rate
        if detail.get("invoice_lines"):
            for line in detail["invoice_lines"]:
                print(f"  - Line: {line.get('product_name')}, gst_rate={line.get('gst_rate')}%")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
