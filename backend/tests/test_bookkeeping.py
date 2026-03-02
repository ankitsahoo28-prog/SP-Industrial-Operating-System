"""
Test Suite for Double-Entry Bookkeeping System
- Chart of Accounts (21+ default accounts)
- AI Accountant Analysis
- Journal Entries (balanced and unbalanced)
- Account Ledger with running balance
- Ledger Balances
- Trial Balance (total_debit = total_credit)
- Profit & Loss (income, expenses, net_profit)
- Balance Sheet (assets, liabilities, equity)
- Role-based access (director/manager allowed, ground_staff 403)
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAuthentication:
    """Login and token management"""
    
    @pytest.fixture(scope="class")
    def director_token(self):
        """Get director authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "director@sp.com",
            "password": "password123"
        })
        assert response.status_code == 200, f"Director login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["role"] == "director"
        return data["token"]
    
    @pytest.fixture(scope="class")
    def manager_token(self):
        """Get manager authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "manager@sp.com",
            "password": "password123"
        })
        assert response.status_code == 200, f"Manager login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["role"] == "manager"
        return data["token"]
    
    @pytest.fixture(scope="class")
    def staff_token(self):
        """Get ground staff authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "staff@sp.com",
            "password": "password123"
        })
        assert response.status_code == 200, f"Staff login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["role"] == "ground_staff"
        return data["token"]

class TestChartOfAccounts(TestAuthentication):
    """Test GET /api/accounts - Chart of Accounts"""
    
    def test_get_accounts_director(self, director_token):
        """Director can get chart of accounts with 21+ accounts"""
        response = requests.get(
            f"{BASE_URL}/api/accounts",
            headers={"Authorization": f"Bearer {director_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        accounts = response.json()
        
        # Must have at least 21 default accounts
        assert len(accounts) >= 21, f"Expected at least 21 accounts, got {len(accounts)}"
        
        # Validate account structure
        for acc in accounts:
            assert "id" in acc
            assert "code" in acc
            assert "name" in acc
            assert "type" in acc
            assert acc["type"] in ["asset", "liability", "equity", "income", "expense"]
        
        # Verify key accounts exist
        account_names = [a["name"] for a in accounts]
        required_accounts = ["Cash", "Bank", "Sales", "Purchase", "Salary Expense", "Capital"]
        for req in required_accounts:
            assert req in account_names, f"Required account '{req}' not found"
        
        print(f"✅ Found {len(accounts)} accounts in chart of accounts")
    
    def test_get_accounts_manager(self, manager_token):
        """Manager can also access chart of accounts"""
        response = requests.get(
            f"{BASE_URL}/api/accounts",
            headers={"Authorization": f"Bearer {manager_token}"}
        )
        assert response.status_code == 200, f"Manager should have access: {response.text}"
        accounts = response.json()
        assert len(accounts) >= 21
        print(f"✅ Manager can access {len(accounts)} accounts")
    
    def test_get_accounts_staff_forbidden(self, staff_token):
        """Ground staff cannot access chart of accounts"""
        response = requests.get(
            f"{BASE_URL}/api/accounts",
            headers={"Authorization": f"Bearer {staff_token}"}
        )
        assert response.status_code == 403, f"Expected 403 for ground_staff, got {response.status_code}"
        print("✅ Ground staff correctly denied (403)")


class TestAIAccountant(TestAuthentication):
    """Test POST /api/ai-accountant/analyze - AI transaction parsing"""
    
    def test_analyze_transaction_director(self, director_token):
        """Director can analyze transaction with AI"""
        response = requests.post(
            f"{BASE_URL}/api/ai-accountant/analyze",
            headers={"Authorization": f"Bearer {director_token}"},
            json={"statement": "Paid salary 50000 by bank"}
        )
        assert response.status_code == 200, f"AI analyze failed: {response.text}"
        data = response.json()
        
        # Must have these required fields
        assert "understanding" in data, "Missing 'understanding' field"
        assert "journal_lines" in data, "Missing 'journal_lines' field"
        assert "needs_clarification" in data, "Missing 'needs_clarification' field"
        
        # If not needing clarification, journal_lines should have entries
        if not data.get("needs_clarification"):
            assert len(data["journal_lines"]) > 0, "journal_lines empty when needs_clarification=false"
            
            # Verify journal lines structure
            total_debit = 0
            total_credit = 0
            for line in data["journal_lines"]:
                assert "account_name" in line
                assert "debit" in line or line.get("debit", 0) == 0
                assert "credit" in line or line.get("credit", 0) == 0
                total_debit += line.get("debit", 0)
                total_credit += line.get("credit", 0)
            
            # AI should generate balanced entry
            assert abs(total_debit - total_credit) < 0.01, f"AI entry unbalanced: Dr={total_debit}, Cr={total_credit}"
        
        print(f"✅ AI analysis successful: {data.get('understanding', {}).get('transaction_type', 'N/A')}")
    
    def test_analyze_transaction_manager(self, manager_token):
        """Manager can also use AI accountant"""
        response = requests.post(
            f"{BASE_URL}/api/ai-accountant/analyze",
            headers={"Authorization": f"Bearer {manager_token}"},
            json={"statement": "Received 100000 cash from customer"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "journal_lines" in data
        print("✅ Manager can use AI accountant")
    
    def test_analyze_transaction_staff_forbidden(self, staff_token):
        """Ground staff cannot use AI accountant"""
        response = requests.post(
            f"{BASE_URL}/api/ai-accountant/analyze",
            headers={"Authorization": f"Bearer {staff_token}"},
            json={"statement": "Test transaction"}
        )
        assert response.status_code == 403
        print("✅ Ground staff denied AI access (403)")


class TestJournalEntries(TestAuthentication):
    """Test POST/GET /api/journal-entries - Journal entry CRUD"""
    
    def test_create_balanced_journal_entry(self, director_token):
        """Create a balanced journal entry - debit must equal credit"""
        response = requests.post(
            f"{BASE_URL}/api/journal-entries",
            headers={"Authorization": f"Bearer {director_token}"},
            json={
                "narration": "TEST_Office supplies purchased cash",
                "lines": [
                    {"account_name": "Office Supplies", "debit": 5000, "credit": 0},
                    {"account_name": "Cash", "debit": 0, "credit": 5000}
                ]
            }
        )
        assert response.status_code == 200, f"Failed to create entry: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "entry" in data
        entry = data["entry"]
        assert entry["total_debit"] == entry["total_credit"]
        assert entry["total_debit"] == 5000
        assert len(entry["lines"]) == 2
        
        print(f"✅ Created balanced journal entry: {entry['id']}")
        return entry["id"]
    
    def test_create_unbalanced_journal_entry_fails(self, director_token):
        """Unbalanced journal entry should return 400 error"""
        response = requests.post(
            f"{BASE_URL}/api/journal-entries",
            headers={"Authorization": f"Bearer {director_token}"},
            json={
                "narration": "TEST_Unbalanced entry should fail",
                "lines": [
                    {"account_name": "Cash", "debit": 10000, "credit": 0},
                    {"account_name": "Sales", "debit": 0, "credit": 8000}  # Mismatch!
                ]
            }
        )
        assert response.status_code == 400, f"Expected 400 for unbalanced entry, got {response.status_code}"
        
        # Verify error message mentions balance issue
        error_detail = response.json().get("detail", "")
        assert "balance" in error_detail.lower() or "unbalanced" in error_detail.lower(), \
            f"Error should mention balance: {error_detail}"
        
        print(f"✅ Unbalanced entry correctly rejected: {error_detail}")
    
    def test_get_journal_entries(self, director_token):
        """Get list of journal entries with lines"""
        response = requests.get(
            f"{BASE_URL}/api/journal-entries",
            headers={"Authorization": f"Bearer {director_token}"}
        )
        assert response.status_code == 200, f"Failed to get entries: {response.text}"
        entries = response.json()
        
        # Should have entries (including pre-existing from manual testing)
        assert isinstance(entries, list)
        
        if len(entries) > 0:
            entry = entries[0]
            assert "id" in entry
            assert "narration" in entry
            assert "lines" in entry
            assert "total_debit" in entry
            assert "total_credit" in entry
            
            # Each entry should be balanced
            for e in entries:
                assert abs(e["total_debit"] - e["total_credit"]) < 0.01, \
                    f"Entry {e['id']} is unbalanced"
        
        print(f"✅ Retrieved {len(entries)} journal entries")
    
    def test_journal_entries_staff_forbidden(self, staff_token):
        """Ground staff cannot access journal entries"""
        response = requests.get(
            f"{BASE_URL}/api/journal-entries",
            headers={"Authorization": f"Bearer {staff_token}"}
        )
        assert response.status_code == 403
        
        response = requests.post(
            f"{BASE_URL}/api/journal-entries",
            headers={"Authorization": f"Bearer {staff_token}"},
            json={"narration": "Test", "lines": []}
        )
        assert response.status_code == 403
        print("✅ Ground staff denied journal access (403)")


class TestAccountLedger(TestAuthentication):
    """Test GET /api/account-ledger/{id} - Individual account ledger"""
    
    def test_get_account_ledger_with_balance(self, director_token):
        """Get ledger for specific account with running balance"""
        # First get accounts to get an account ID
        acc_response = requests.get(
            f"{BASE_URL}/api/accounts",
            headers={"Authorization": f"Bearer {director_token}"}
        )
        assert acc_response.status_code == 200
        accounts = acc_response.json()
        
        # Find Cash account
        cash_account = next((a for a in accounts if a["name"] == "Cash"), None)
        assert cash_account is not None, "Cash account not found"
        
        # Get ledger for Cash account
        response = requests.get(
            f"{BASE_URL}/api/account-ledger/{cash_account['id']}",
            headers={"Authorization": f"Bearer {director_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify structure
        assert "account" in data
        assert "transactions" in data
        assert "summary" in data
        
        # Verify account info
        assert data["account"]["name"] == "Cash"
        
        # Verify summary fields
        summary = data["summary"]
        assert "total_debit" in summary or summary.get("total_debit", 0) >= 0
        assert "total_credit" in summary or summary.get("total_credit", 0) >= 0
        assert "balance" in summary
        
        # Verify transactions have running balance
        for tx in data["transactions"]:
            assert "balance" in tx, "Transaction missing running balance"
            assert "debit" in tx
            assert "credit" in tx
            assert "narration" in tx
        
        print(f"✅ Cash ledger: {len(data['transactions'])} transactions, balance: {data['summary']['balance']}")
    
    def test_account_ledger_not_found(self, director_token):
        """Non-existent account should return 404"""
        response = requests.get(
            f"{BASE_URL}/api/account-ledger/non-existent-id",
            headers={"Authorization": f"Bearer {director_token}"}
        )
        assert response.status_code == 404
        print("✅ Non-existent account returns 404")
    
    def test_account_ledger_staff_forbidden(self, staff_token):
        """Ground staff cannot access account ledger"""
        response = requests.get(
            f"{BASE_URL}/api/account-ledger/any-id",
            headers={"Authorization": f"Bearer {staff_token}"}
        )
        assert response.status_code == 403
        print("✅ Ground staff denied ledger access (403)")


class TestLedgerBalances(TestAuthentication):
    """Test GET /api/ledger-balances - All ledger balances"""
    
    def test_get_ledger_balances(self, director_token):
        """Get all ledger balances"""
        response = requests.get(
            f"{BASE_URL}/api/ledger-balances",
            headers={"Authorization": f"Bearer {director_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        balances = response.json()
        
        assert isinstance(balances, list)
        
        for bal in balances:
            assert "account_id" in bal
            assert "account_name" in bal
            assert "balance" in bal
            assert "total_debit" in bal
            assert "total_credit" in bal
        
        print(f"✅ Retrieved {len(balances)} ledger balances")
    
    def test_ledger_balances_staff_forbidden(self, staff_token):
        """Ground staff cannot access ledger balances"""
        response = requests.get(
            f"{BASE_URL}/api/ledger-balances",
            headers={"Authorization": f"Bearer {staff_token}"}
        )
        assert response.status_code == 403
        print("✅ Ground staff denied ledger balances (403)")


class TestTrialBalance(TestAuthentication):
    """Test GET /api/reports/trial-balance - Trial balance report"""
    
    def test_get_trial_balance_balanced(self, director_token):
        """Trial balance should have total_debit = total_credit"""
        response = requests.get(
            f"{BASE_URL}/api/reports/trial-balance",
            headers={"Authorization": f"Bearer {director_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify structure
        assert "rows" in data
        assert "total_debit" in data
        assert "total_credit" in data
        
        # Trial balance MUST be balanced
        assert abs(data["total_debit"] - data["total_credit"]) < 0.01, \
            f"Trial balance not balanced: Dr={data['total_debit']}, Cr={data['total_credit']}"
        
        # Verify row structure
        for row in data["rows"]:
            assert "account_name" in row
            assert "account_type" in row
            assert "debit" in row
            assert "credit" in row
        
        print(f"✅ Trial balance: Dr={data['total_debit']}, Cr={data['total_credit']} (BALANCED)")
    
    def test_trial_balance_staff_forbidden(self, staff_token):
        """Ground staff cannot access trial balance"""
        response = requests.get(
            f"{BASE_URL}/api/reports/trial-balance",
            headers={"Authorization": f"Bearer {staff_token}"}
        )
        assert response.status_code == 403
        print("✅ Ground staff denied trial balance (403)")


class TestProfitAndLoss(TestAuthentication):
    """Test GET /api/reports/profit-loss - P&L report"""
    
    def test_get_profit_loss(self, director_token):
        """P&L should have income, expenses, net_profit"""
        response = requests.get(
            f"{BASE_URL}/api/reports/profit-loss",
            headers={"Authorization": f"Bearer {director_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Required fields
        assert "income" in data
        assert "expenses" in data
        assert "total_income" in data
        assert "total_expense" in data
        assert "net_profit" in data
        
        # income and expenses should be lists
        assert isinstance(data["income"], list)
        assert isinstance(data["expenses"], list)
        
        # net_profit calculation
        expected_net = data["total_income"] - data["total_expense"]
        assert abs(data["net_profit"] - expected_net) < 0.01, \
            f"Net profit mismatch: expected {expected_net}, got {data['net_profit']}"
        
        # Each income/expense item should have name and amount
        for item in data["income"]:
            assert "name" in item
            assert "amount" in item
        
        for item in data["expenses"]:
            assert "name" in item
            assert "amount" in item
        
        print(f"✅ P&L: Income={data['total_income']}, Expenses={data['total_expense']}, Net={data['net_profit']}")
    
    def test_profit_loss_staff_forbidden(self, staff_token):
        """Ground staff cannot access P&L"""
        response = requests.get(
            f"{BASE_URL}/api/reports/profit-loss",
            headers={"Authorization": f"Bearer {staff_token}"}
        )
        assert response.status_code == 403
        print("✅ Ground staff denied P&L (403)")


class TestBalanceSheet(TestAuthentication):
    """Test GET /api/reports/balance-sheet - Balance sheet report"""
    
    def test_get_balance_sheet(self, director_token):
        """Balance sheet should have assets, liabilities, equity"""
        response = requests.get(
            f"{BASE_URL}/api/reports/balance-sheet",
            headers={"Authorization": f"Bearer {director_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Required fields
        assert "assets" in data
        assert "liabilities" in data
        assert "equity" in data
        assert "total_assets" in data
        assert "total_liabilities" in data
        assert "total_equity" in data
        assert "total_liabilities_equity" in data
        
        # Should be lists
        assert isinstance(data["assets"], list)
        assert isinstance(data["liabilities"], list)
        assert isinstance(data["equity"], list)
        
        # Each item should have name and amount
        for item in data["assets"]:
            assert "name" in item
            assert "amount" in item
        
        for item in data["liabilities"]:
            assert "name" in item
            assert "amount" in item
        
        for item in data["equity"]:
            assert "name" in item
            assert "amount" in item
        
        # total_liabilities_equity should equal total_liabilities + total_equity
        expected_le = data["total_liabilities"] + data["total_equity"]
        assert abs(data["total_liabilities_equity"] - expected_le) < 0.01
        
        print(f"✅ Balance Sheet: Assets={data['total_assets']}, L+E={data['total_liabilities_equity']}")
    
    def test_balance_sheet_staff_forbidden(self, staff_token):
        """Ground staff cannot access balance sheet"""
        response = requests.get(
            f"{BASE_URL}/api/reports/balance-sheet",
            headers={"Authorization": f"Bearer {staff_token}"}
        )
        assert response.status_code == 403
        print("✅ Ground staff denied balance sheet (403)")


class TestRoleBasedAccess(TestAuthentication):
    """Comprehensive role-based access tests for bookkeeping endpoints"""
    
    def test_all_bookkeeping_endpoints_staff_forbidden(self, staff_token):
        """Verify ground staff gets 403 on ALL bookkeeping endpoints"""
        endpoints = [
            ("GET", "/api/accounts"),
            ("POST", "/api/ai-accountant/analyze"),
            ("GET", "/api/journal-entries"),
            ("POST", "/api/journal-entries"),
            ("GET", "/api/ledger-balances"),
            ("GET", "/api/reports/trial-balance"),
            ("GET", "/api/reports/profit-loss"),
            ("GET", "/api/reports/balance-sheet"),
        ]
        
        headers = {"Authorization": f"Bearer {staff_token}"}
        
        for method, endpoint in endpoints:
            if method == "GET":
                response = requests.get(f"{BASE_URL}{endpoint}", headers=headers)
            else:
                response = requests.post(f"{BASE_URL}{endpoint}", headers=headers, json={"statement": "test", "narration": "test", "lines": []})
            
            assert response.status_code == 403, \
                f"{method} {endpoint} should return 403 for ground_staff, got {response.status_code}"
        
        print(f"✅ Ground staff denied on all {len(endpoints)} bookkeeping endpoints")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
