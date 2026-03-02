"""
Double-Entry Bookkeeping Engine
Handles Chart of Accounts, Journal Entries, Ledger Updates, and Financial Reports
"""
import uuid
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorDatabase

# Default Chart of Accounts
DEFAULT_ACCOUNTS = [
    # Assets
    {"code": "1000", "name": "Cash", "type": "asset", "group": "Current Assets", "normal_balance": "debit"},
    {"code": "1010", "name": "Bank", "type": "asset", "group": "Current Assets", "normal_balance": "debit"},
    {"code": "1020", "name": "Accounts Receivable", "type": "asset", "group": "Current Assets", "normal_balance": "debit"},
    {"code": "1030", "name": "Inventory", "type": "asset", "group": "Current Assets", "normal_balance": "debit"},
    # Liabilities
    {"code": "2000", "name": "Accounts Payable", "type": "liability", "group": "Current Liabilities", "normal_balance": "credit"},
    {"code": "2010", "name": "Loan", "type": "liability", "group": "Long-term Liabilities", "normal_balance": "credit"},
    {"code": "2020", "name": "GST Payable", "type": "liability", "group": "Current Liabilities", "normal_balance": "credit"},
    # Income
    {"code": "3000", "name": "Sales", "type": "income", "group": "Revenue", "normal_balance": "credit"},
    {"code": "3010", "name": "Other Income", "type": "income", "group": "Revenue", "normal_balance": "credit"},
    # Expenses
    {"code": "4000", "name": "Purchase", "type": "expense", "group": "Cost of Goods", "normal_balance": "debit"},
    {"code": "4010", "name": "Salary Expense", "type": "expense", "group": "Operating Expenses", "normal_balance": "debit"},
    {"code": "4020", "name": "Rent Expense", "type": "expense", "group": "Operating Expenses", "normal_balance": "debit"},
    {"code": "4030", "name": "Fuel Expense", "type": "expense", "group": "Operating Expenses", "normal_balance": "debit"},
    {"code": "4040", "name": "Freight Expense", "type": "expense", "group": "Operating Expenses", "normal_balance": "debit"},
    {"code": "4050", "name": "Electricity Expense", "type": "expense", "group": "Operating Expenses", "normal_balance": "debit"},
    {"code": "4060", "name": "Maintenance Expense", "type": "expense", "group": "Operating Expenses", "normal_balance": "debit"},
    {"code": "4070", "name": "Office Supplies", "type": "expense", "group": "Operating Expenses", "normal_balance": "debit"},
    {"code": "4080", "name": "Insurance Expense", "type": "expense", "group": "Operating Expenses", "normal_balance": "debit"},
    {"code": "4090", "name": "Miscellaneous Expense", "type": "expense", "group": "Operating Expenses", "normal_balance": "debit"},
    # Equity
    {"code": "5000", "name": "Capital", "type": "equity", "group": "Owner's Equity", "normal_balance": "credit"},
    {"code": "5010", "name": "Drawings", "type": "equity", "group": "Owner's Equity", "normal_balance": "debit"},
]


async def seed_chart_of_accounts(db: AsyncIOMotorDatabase):
    """Seed default accounts if none exist"""
    count = await db.accounts.count_documents({})
    if count > 0:
        return
    for acc in DEFAULT_ACCOUNTS:
        acc["id"] = str(uuid.uuid4())
        acc["is_party"] = False
        acc["party_name"] = None
        acc["created_at"] = datetime.now(timezone.utc).isoformat()
    await db.accounts.insert_many(DEFAULT_ACCOUNTS)


async def get_or_create_party_account(db: AsyncIOMotorDatabase, party_name: str, party_type: str = "receivable"):
    """Auto-create customer/vendor ledger if new party appears"""
    existing = await db.accounts.find_one(
        {"is_party": True, "party_name": {"$regex": f"^{party_name}$", "$options": "i"}},
        {"_id": 0}
    )
    if existing:
        return existing

    if party_type == "receivable":
        acc_type = "asset"
        group = "Sundry Debtors"
        normal_balance = "debit"
        code_prefix = "1100"
    else:
        acc_type = "liability"
        group = "Sundry Creditors"
        normal_balance = "credit"
        code_prefix = "2100"

    count = await db.accounts.count_documents({"is_party": True})
    new_account = {
        "id": str(uuid.uuid4()),
        "code": f"{code_prefix}{count + 1:03d}",
        "name": party_name,
        "type": acc_type,
        "group": group,
        "normal_balance": normal_balance,
        "is_party": True,
        "party_name": party_name,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.accounts.insert_one(new_account)
    return new_account


async def create_journal_entry(db: AsyncIOMotorDatabase, narration: str, lines: list, user_id: str, business_type: str = None):
    """
    Create a journal entry with debit/credit lines and update ledger balances.
    lines: [{"account_name": str, "debit": float, "credit": float}]
    Returns the journal entry dict.
    """
    total_debit = sum(l.get("debit", 0) for l in lines)
    total_credit = sum(l.get("credit", 0) for l in lines)

    if abs(total_debit - total_credit) > 0.01:
        raise ValueError(f"Unbalanced entry: Debit={total_debit}, Credit={total_credit}")

    entry_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    journal_lines = []
    for line in lines:
        account = await db.accounts.find_one(
            {"name": {"$regex": f"^{line['account_name']}$", "$options": "i"}},
            {"_id": 0}
        )
        if not account:
            # Auto-create party account
            is_debit = line.get("debit", 0) > 0
            party_type = "receivable" if is_debit else "payable"
            account = await get_or_create_party_account(db, line["account_name"], party_type)

        debit_amt = float(line.get("debit", 0))
        credit_amt = float(line.get("credit", 0))

        journal_line = {
            "id": str(uuid.uuid4()),
            "journal_entry_id": entry_id,
            "account_id": account["id"],
            "account_name": account["name"],
            "account_type": account["type"],
            "debit": debit_amt,
            "credit": credit_amt,
        }
        journal_lines.append(journal_line)

        # Update ledger balance
        await update_ledger_balance(db, account["id"], account["name"], account["type"], account.get("normal_balance", "debit"), debit_amt, credit_amt)

    journal_entry = {
        "id": entry_id,
        "narration": narration,
        "lines": journal_lines,
        "total_debit": total_debit,
        "total_credit": total_credit,
        "created_by": user_id,
        "business_type": business_type,
        "date": now,
        "created_at": now,
    }

    await db.journal_entries.insert_one(journal_entry)
    return journal_entry


async def update_ledger_balance(db: AsyncIOMotorDatabase, account_id: str, account_name: str, account_type: str, normal_balance: str, debit: float, credit: float):
    """Update running ledger balance for an account"""
    existing = await db.ledger_balances.find_one({"account_id": account_id})

    if existing:
        new_debit_total = existing.get("total_debit", 0) + debit
        new_credit_total = existing.get("total_credit", 0) + credit
        if normal_balance == "debit":
            balance = new_debit_total - new_credit_total
        else:
            balance = new_credit_total - new_debit_total

        await db.ledger_balances.update_one(
            {"account_id": account_id},
            {"$set": {
                "total_debit": new_debit_total,
                "total_credit": new_credit_total,
                "balance": balance,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }}
        )
    else:
        if normal_balance == "debit":
            balance = debit - credit
        else:
            balance = credit - debit

        await db.ledger_balances.insert_one({
            "id": str(uuid.uuid4()),
            "account_id": account_id,
            "account_name": account_name,
            "account_type": account_type,
            "normal_balance": normal_balance,
            "opening_balance": 0,
            "total_debit": debit,
            "total_credit": credit,
            "balance": balance,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        })


async def get_trial_balance(db: AsyncIOMotorDatabase):
    """Generate trial balance from ledger balances"""
    balances = await db.ledger_balances.find({}, {"_id": 0}).to_list(1000)
    total_debit = 0
    total_credit = 0
    rows = []
    for b in balances:
        if b["balance"] == 0 and b["total_debit"] == 0 and b["total_credit"] == 0:
            continue
        debit_bal = b["balance"] if b["normal_balance"] == "debit" and b["balance"] > 0 else 0
        credit_bal = b["balance"] if b["normal_balance"] == "credit" and b["balance"] > 0 else 0
        # Handle contra balances
        if b["normal_balance"] == "debit" and b["balance"] < 0:
            credit_bal = abs(b["balance"])
        if b["normal_balance"] == "credit" and b["balance"] < 0:
            debit_bal = abs(b["balance"])

        total_debit += debit_bal
        total_credit += credit_bal
        rows.append({
            "account_name": b["account_name"],
            "account_type": b["account_type"],
            "debit": round(debit_bal, 2),
            "credit": round(credit_bal, 2),
        })
    return {"rows": rows, "total_debit": round(total_debit, 2), "total_credit": round(total_credit, 2)}


async def get_profit_and_loss(db: AsyncIOMotorDatabase):
    """Generate P&L statement"""
    balances = await db.ledger_balances.find(
        {"account_type": {"$in": ["income", "expense"]}},
        {"_id": 0}
    ).to_list(1000)

    income_items = []
    expense_items = []
    total_income = 0
    total_expense = 0

    for b in balances:
        if b["balance"] == 0 and b["total_debit"] == 0:
            continue
        if b["account_type"] == "income":
            income_items.append({"name": b["account_name"], "amount": round(b["balance"], 2)})
            total_income += b["balance"]
        else:
            expense_items.append({"name": b["account_name"], "amount": round(b["balance"], 2)})
            total_expense += b["balance"]

    return {
        "income": income_items,
        "expenses": expense_items,
        "total_income": round(total_income, 2),
        "total_expense": round(total_expense, 2),
        "net_profit": round(total_income - total_expense, 2),
    }


async def get_balance_sheet(db: AsyncIOMotorDatabase):
    """Generate Balance Sheet"""
    balances = await db.ledger_balances.find({}, {"_id": 0}).to_list(1000)
    pnl = await get_profit_and_loss(db)

    assets = []
    liabilities = []
    equity = []
    total_assets = 0
    total_liabilities = 0
    total_equity = 0

    for b in balances:
        if b["balance"] == 0 and b["total_debit"] == 0:
            continue
        amt = round(abs(b["balance"]), 2)
        if b["account_type"] == "asset":
            assets.append({"name": b["account_name"], "amount": amt})
            total_assets += amt
        elif b["account_type"] == "liability":
            liabilities.append({"name": b["account_name"], "amount": amt})
            total_liabilities += amt
        elif b["account_type"] == "equity":
            equity.append({"name": b["account_name"], "amount": amt})
            total_equity += amt

    # Add retained earnings (net profit) to equity
    if pnl["net_profit"] != 0:
        equity.append({"name": "Retained Earnings (Current Period)", "amount": round(pnl["net_profit"], 2)})
        total_equity += pnl["net_profit"]

    return {
        "assets": assets,
        "liabilities": liabilities,
        "equity": equity,
        "total_assets": round(total_assets, 2),
        "total_liabilities": round(total_liabilities, 2),
        "total_equity": round(total_equity, 2),
        "total_liabilities_equity": round(total_liabilities + total_equity, 2),
    }
