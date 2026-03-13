"""
Test suite for Odoo-style Accounting System APIs
Tests: Dashboard, Chart of Accounts, Partners, Taxes, Journals, Fiscal Years,
       Invoices, Payments, Journal Entries, Reports
"""

import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://erp-ai-assistant-1.preview.emergentagent.com"


class TestOdooAccountingAPI:
    """Tests for the Odoo Accounting System APIs"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token for director"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "director@sp.com",
            "password": "password123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json().get("token")
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        """Return headers with auth token"""
        return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}
    
    # ========== DASHBOARD ==========
    def test_dashboard_endpoint(self, headers):
        """Test accounting dashboard returns all expected fields"""
        response = requests.get(f"{BASE_URL}/api/acc/dashboard", headers=headers)
        assert response.status_code == 200
        data = response.json()
        # Verify all expected dashboard fields
        expected_fields = [
            "total_receivable", "total_payable", "cash_balance", "bank_balance",
            "draft_invoices", "overdue_invoices", "draft_bills", "total_invoices",
            "total_bills", "total_entries", "total_payments",
            "monthly_income", "monthly_expense", "monthly_profit"
        ]
        for field in expected_fields:
            assert field in data, f"Missing field: {field}"
        print(f"Dashboard data: {data}")
    
    # ========== CHART OF ACCOUNTS ==========
    def test_list_accounts(self, headers):
        """Test listing chart of accounts"""
        response = requests.get(f"{BASE_URL}/api/acc/accounts", headers=headers)
        assert response.status_code == 200
        accounts = response.json()
        assert isinstance(accounts, list)
        assert len(accounts) > 0, "Should have seeded accounts"
        # Check account structure
        first_account = accounts[0]
        assert "id" in first_account
        assert "code" in first_account
        assert "name" in first_account
        assert "account_type" in first_account
        print(f"Found {len(accounts)} accounts")
    
    def test_create_account(self, headers):
        """Test creating a new account"""
        import time
        unique_code = f"99{int(time.time()) % 10000}"
        account_data = {
            "code": unique_code,
            "name": f"TEST_Account_{unique_code}",
            "account_type": "expense",
            "reconcile": False,
            "note": "Test account for automated testing"
        }
        response = requests.post(f"{BASE_URL}/api/acc/accounts", json=account_data, headers=headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        created = response.json()
        assert created["code"] == unique_code
        assert created["account_type"] == "expense"
        print(f"Created account: {created['id']}")
    
    # ========== PARTNERS ==========
    def test_list_partners(self, headers):
        """Test listing partners"""
        response = requests.get(f"{BASE_URL}/api/acc/partners", headers=headers)
        assert response.status_code == 200
        partners = response.json()
        assert isinstance(partners, list)
        print(f"Found {len(partners)} partners")
    
    def test_create_partner(self, headers):
        """Test creating a new partner"""
        partner_data = {
            "name": "TEST_Customer",
            "partner_type": "customer",
            "email": "test@example.com",
            "phone": "1234567890",
            "gst_number": "GST123456",
            "payment_terms_days": 30
        }
        response = requests.post(f"{BASE_URL}/api/acc/partners", json=partner_data, headers=headers)
        assert response.status_code == 200
        created = response.json()
        assert created["name"] == "TEST_Customer"
        assert created["partner_type"] == "customer"
        print(f"Created partner: {created['id']}")
        return created["id"]
    
    def test_partner_crud_flow(self, headers):
        """Test full CRUD on partners"""
        # Create
        partner_data = {
            "name": "TEST_CRUD_Partner",
            "partner_type": "vendor",
            "email": "crud@test.com"
        }
        response = requests.post(f"{BASE_URL}/api/acc/partners", json=partner_data, headers=headers)
        assert response.status_code == 200
        partner_id = response.json()["id"]
        
        # Update
        update_data = {"name": "TEST_CRUD_Partner_Updated"}
        response = requests.put(f"{BASE_URL}/api/acc/partners/{partner_id}", json=update_data, headers=headers)
        assert response.status_code == 200
        assert response.json()["name"] == "TEST_CRUD_Partner_Updated"
        
        # Delete
        response = requests.delete(f"{BASE_URL}/api/acc/partners/{partner_id}", headers=headers)
        assert response.status_code == 200
        print(f"Partner CRUD flow completed")
    
    # ========== TAXES ==========
    def test_list_taxes(self, headers):
        """Test listing taxes"""
        response = requests.get(f"{BASE_URL}/api/acc/taxes", headers=headers)
        assert response.status_code == 200
        taxes = response.json()
        assert isinstance(taxes, list)
        assert len(taxes) > 0, "Should have seeded taxes"
        print(f"Found {len(taxes)} taxes")
    
    def test_create_tax(self, headers):
        """Test creating a new tax"""
        tax_data = {
            "name": "TEST_Tax 5%",
            "amount": 5,
            "tax_type": "percent",
            "tax_group": "GST",
            "include_in_price": False,
            "active": True
        }
        response = requests.post(f"{BASE_URL}/api/acc/taxes", json=tax_data, headers=headers)
        assert response.status_code == 200
        created = response.json()
        assert created["name"] == "TEST_Tax 5%"
        assert created["amount"] == 5
        print(f"Created tax: {created['id']}")
    
    # ========== JOURNALS ==========
    def test_list_journals(self, headers):
        """Test listing journals"""
        response = requests.get(f"{BASE_URL}/api/acc/journals", headers=headers)
        assert response.status_code == 200
        journals = response.json()
        assert isinstance(journals, list)
        assert len(journals) > 0, "Should have seeded journals"
        # Check journal structure
        first_journal = journals[0]
        assert "id" in first_journal
        assert "name" in first_journal
        assert "code" in first_journal
        assert "journal_type" in first_journal
        print(f"Found {len(journals)} journals")
    
    def test_create_journal(self, headers):
        """Test creating a new journal"""
        journal_data = {
            "name": "TEST_Journal",
            "code": "TJ",
            "journal_type": "general"
        }
        response = requests.post(f"{BASE_URL}/api/acc/journals", json=journal_data, headers=headers)
        assert response.status_code == 200
        created = response.json()
        assert created["name"] == "TEST_Journal"
        assert created["code"] == "TJ"
        assert created["journal_type"] == "general"
        print(f"Created journal: {created['id']}")
    
    # ========== FISCAL YEARS ==========
    def test_list_fiscal_years(self, headers):
        """Test listing fiscal years"""
        response = requests.get(f"{BASE_URL}/api/acc/fiscal-years", headers=headers)
        assert response.status_code == 200
        fiscal_years = response.json()
        assert isinstance(fiscal_years, list)
        assert len(fiscal_years) >= 1, "Should have at least 1 fiscal year"
        print(f"Found {len(fiscal_years)} fiscal years")
    
    def test_create_fiscal_year(self, headers):
        """Test creating a new fiscal year"""
        fiscal_data = {
            "name": "FY 2026-2027",
            "start_date": "2026-04-01",
            "end_date": "2027-03-31"
        }
        response = requests.post(f"{BASE_URL}/api/acc/fiscal-years", json=fiscal_data, headers=headers)
        assert response.status_code == 200
        created = response.json()
        assert created["name"] == "FY 2026-2027"
        assert created["start_date"] == "2026-04-01"
        assert created["end_date"] == "2027-03-31"
        assert created["state"] == "open"
        print(f"Created fiscal year: {created['id']}")
    
    # ========== INVOICES ==========
    def test_list_invoices(self, headers):
        """Test listing invoices"""
        response = requests.get(f"{BASE_URL}/api/acc/moves?move_type=invoices", headers=headers)
        assert response.status_code == 200
        invoices = response.json()
        assert isinstance(invoices, list)
        print(f"Found {len(invoices)} invoices")
    
    def test_create_invoice_flow(self, headers):
        """Test creating an invoice end-to-end"""
        # First create a partner
        partner_data = {"name": "TEST_Invoice_Customer", "partner_type": "customer"}
        resp = requests.post(f"{BASE_URL}/api/acc/partners", json=partner_data, headers=headers)
        assert resp.status_code == 200
        partner_id = resp.json()["id"]
        
        # Create invoice
        invoice_data = {
            "move_type": "out_invoice",
            "partner_id": partner_id,
            "ref": "TEST_REF_001",
            "invoice_lines": [
                {"product_name": "Consulting Services", "quantity": 1, "unit_price": 5000}
            ]
        }
        response = requests.post(f"{BASE_URL}/api/acc/invoices", json=invoice_data, headers=headers)
        assert response.status_code == 200
        invoice = response.json()
        assert invoice["partner_id"] == partner_id
        assert invoice["state"] == "draft"
        print(f"Created invoice: {invoice['id']}")
        
        # Post the invoice
        response = requests.post(f"{BASE_URL}/api/acc/moves/{invoice['id']}/post", headers=headers)
        assert response.status_code == 200
        result = response.json()
        assert "name" in result
        print(f"Posted invoice: {result['name']}")
        
        # Verify invoice is posted
        response = requests.get(f"{BASE_URL}/api/acc/moves/{invoice['id']}", headers=headers)
        assert response.status_code == 200
        posted_invoice = response.json()
        assert posted_invoice["state"] == "posted"
        
        return invoice["id"], partner_id
    
    # ========== PAYMENTS ==========
    def test_list_payments(self, headers):
        """Test listing payments"""
        response = requests.get(f"{BASE_URL}/api/acc/payments", headers=headers)
        assert response.status_code == 200
        payments = response.json()
        assert isinstance(payments, list)
        print(f"Found {len(payments)} payments")
    
    def test_create_payment(self, headers):
        """Test creating a payment"""
        # Get a journal for payment (cash or bank)
        response = requests.get(f"{BASE_URL}/api/acc/journals?journal_type=cash", headers=headers)
        assert response.status_code == 200
        journals = response.json()
        assert len(journals) > 0, "Should have cash journal"
        journal_id = journals[0]["id"]
        
        # Create payment
        payment_data = {
            "payment_type": "inbound",
            "amount": 5000,
            "journal_id": journal_id,
            "ref": "TEST_PAY_001"
        }
        response = requests.post(f"{BASE_URL}/api/acc/payments", json=payment_data, headers=headers)
        assert response.status_code == 200
        payment = response.json()
        assert payment["amount"] == 5000
        assert payment["payment_type"] == "inbound"
        print(f"Created payment: {payment['id']}")
    
    # ========== JOURNAL ENTRIES ==========
    def test_list_journal_entries(self, headers):
        """Test listing journal entries"""
        response = requests.get(f"{BASE_URL}/api/acc/moves?move_type=entry", headers=headers)
        assert response.status_code == 200
        entries = response.json()
        assert isinstance(entries, list)
        print(f"Found {len(entries)} journal entries")
    
    def test_create_journal_entry(self, headers):
        """Test creating a manual journal entry"""
        # Get accounts for the entry
        response = requests.get(f"{BASE_URL}/api/acc/accounts", headers=headers)
        accounts = response.json()
        cash_account = next((a for a in accounts if a["account_type"] == "cash"), None)
        expense_account = next((a for a in accounts if a["account_type"] == "expense"), None)
        
        assert cash_account, "Should have cash account"
        assert expense_account, "Should have expense account"
        
        # Get a general journal
        response = requests.get(f"{BASE_URL}/api/acc/journals?journal_type=general", headers=headers)
        journals = response.json()
        journal_id = journals[0]["id"] if journals else None
        
        if not journal_id:
            # Create one
            resp = requests.post(f"{BASE_URL}/api/acc/journals", 
                json={"name": "TEST_Gen", "code": "TG", "journal_type": "general"}, headers=headers)
            journal_id = resp.json()["id"]
        
        # Create balanced journal entry
        entry_data = {
            "journal_id": journal_id,
            "narration": "TEST_Manual_Entry",
            "lines": [
                {"account_id": expense_account["id"], "debit": 1000, "credit": 0, "name": "Office expense"},
                {"account_id": cash_account["id"], "debit": 0, "credit": 1000, "name": "Cash payment"}
            ]
        }
        response = requests.post(f"{BASE_URL}/api/acc/moves", json=entry_data, headers=headers)
        assert response.status_code == 200
        entry = response.json()
        assert entry["state"] == "draft"
        assert entry["total_debit"] == 1000
        assert entry["total_credit"] == 1000
        print(f"Created journal entry: {entry['id']}")
    
    # ========== REPORTS ==========
    def test_trial_balance_report(self, headers):
        """Test trial balance report"""
        response = requests.get(f"{BASE_URL}/api/acc/reports/trial-balance", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "rows" in data
        assert "total_debit" in data
        assert "total_credit" in data
        assert "is_balanced" in data
        print(f"Trial balance - Debit: {data['total_debit']}, Credit: {data['total_credit']}, Balanced: {data['is_balanced']}")
    
    def test_profit_loss_report(self, headers):
        """Test profit & loss report"""
        response = requests.get(f"{BASE_URL}/api/acc/reports/profit-loss", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "income" in data
        assert "expenses" in data
        assert "total_income" in data
        assert "total_expense" in data
        assert "net_profit" in data
        print(f"P&L - Income: {data['total_income']}, Expense: {data['total_expense']}, Profit: {data['net_profit']}")
    
    def test_balance_sheet_report(self, headers):
        """Test balance sheet report"""
        response = requests.get(f"{BASE_URL}/api/acc/reports/balance-sheet", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "assets" in data
        assert "liabilities" in data
        assert "equity" in data
        assert "total_assets" in data
        assert "total_liabilities" in data
        assert "total_equity" in data
        print(f"Balance Sheet - Assets: {data['total_assets']}, Liabilities: {data['total_liabilities']}, Equity: {data['total_equity']}")
    
    def test_general_ledger_report(self, headers):
        """Test general ledger report"""
        response = requests.get(f"{BASE_URL}/api/acc/reports/general-ledger", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"General Ledger - {len(data)} accounts with transactions")
    
    def test_aged_receivables_report(self, headers):
        """Test aged receivables report"""
        response = requests.get(f"{BASE_URL}/api/acc/reports/aged-receivables", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "buckets" in data
        assert "total" in data
        print(f"Aged Receivables - Total: {data['total']}")
    
    def test_aged_payables_report(self, headers):
        """Test aged payables report"""
        response = requests.get(f"{BASE_URL}/api/acc/reports/aged-payables", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "buckets" in data
        assert "total" in data
        print(f"Aged Payables - Total: {data['total']}")
    
    def test_cash_flow_report(self, headers):
        """Test cash flow report"""
        response = requests.get(f"{BASE_URL}/api/acc/reports/cash-flow", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "operating" in data
        assert "investing" in data
        assert "financing" in data
        assert "net_change" in data
        print(f"Cash Flow - Operating: {data['operating']}, Net Change: {data['net_change']}")
    
    def test_tax_report(self, headers):
        """Test tax report"""
        response = requests.get(f"{BASE_URL}/api/acc/reports/tax-report", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "taxes" in data
        assert "gst_output" in data
        assert "gst_input" in data
        assert "net_gst_payable" in data
        print(f"Tax Report - GST Output: {data['gst_output']}, GST Input: {data['gst_input']}, Net: {data['net_gst_payable']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
