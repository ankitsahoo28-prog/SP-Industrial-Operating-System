from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
import io
from datetime import datetime
from typing import List, Dict, Any
import csv

def generate_transaction_pdf(transactions: List[Dict[str, Any]], summary: Dict[str, float]) -> bytes:
    """Generate PDF report for transactions"""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4)
    elements = []
    styles = getSampleStyleSheet()
    
    # Title
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        textColor=colors.HexColor('#0F172A'),
        spaceAfter=30,
        alignment=TA_CENTER
    )
    
    title = Paragraph("SP Industrial OS - Transaction Report", title_style)
    elements.append(title)
    elements.append(Spacer(1, 0.3*inch))
    
    # Summary section
    summary_data = [
        ['Summary', ''],
        ['Total Income', f"₹{summary.get('total_income', 0):.2f}"],
        ['Total Expense', f"₹{summary.get('total_expense', 0):.2f}"],
        ['Net Profit', f"₹{summary.get('net_profit', 0):.2f}"],
        ['Cash Balance', f"₹{summary.get('cash_balance', 0):.2f}"],
        ['Bank Balance', f"₹{summary.get('bank_balance', 0):.2f}"],
    ]
    
    summary_table = Table(summary_data, colWidths=[3*inch, 2*inch])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0F172A')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 14),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
        ('GRID', (0, 0), (-1, -1), 1, colors.black)
    ]))
    
    elements.append(summary_table)
    elements.append(Spacer(1, 0.5*inch))
    
    # Transactions table
    trans_title = Paragraph("Transaction Details", styles['Heading2'])
    elements.append(trans_title)
    elements.append(Spacer(1, 0.2*inch))
    
    if transactions:
        data = [['Date', 'Description', 'Category', 'Type', 'Mode', 'Amount']]
        for trans in transactions:
            data.append([
                datetime.fromisoformat(trans['date']).strftime('%Y-%m-%d'),
                trans['description'][:30],
                trans['category'],
                trans['transaction_type'].title(),
                trans['payment_mode'].title(),
                f"₹{trans['amount']:.2f}"
            ])
        
        trans_table = Table(data, colWidths=[1*inch, 2*inch, 1.2*inch, 0.8*inch, 0.8*inch, 1*inch])
        trans_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#F97316')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('ALIGN', (-1, 0), (-1, -1), 'RIGHT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.white),
            ('GRID', (0, 0), (-1, -1), 1, colors.grey),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.lightgrey])
        ]))
        
        elements.append(trans_table)
    
    # Footer
    elements.append(Spacer(1, 0.5*inch))
    footer = Paragraph(
        f"Generated on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        styles['Normal']
    )
    elements.append(footer)
    
    doc.build(elements)
    buffer.seek(0)
    return buffer.read()

def generate_ledger_csv(ledger_entries: List[Dict[str, Any]]) -> str:
    """Generate CSV for ledger"""
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Header
    writer.writerow(['Date', 'Description', 'Category', 'Debit', 'Credit', 'Balance', 'Payment Mode'])
    
    # Data
    for entry in ledger_entries:
        writer.writerow([
            datetime.fromisoformat(entry['date']).strftime('%Y-%m-%d'),
            entry['description'],
            entry['category'],
            f"₹{entry['amount']:.2f}" if entry['transaction_type'] == 'expense' else '',
            f"₹{entry['amount']:.2f}" if entry['transaction_type'] == 'income' else '',
            f"₹{entry['balance']:.2f}",
            entry['payment_mode'].title()
        ])
    
    return output.getvalue()

def generate_inventory_pdf(inventory_items: List[Dict[str, Any]]) -> bytes:
    """Generate PDF report for inventory"""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4)
    elements = []
    styles = getSampleStyleSheet()
    
    # Title
    title = Paragraph("SP Industrial OS - Inventory Report", styles['Title'])
    elements.append(title)
    elements.append(Spacer(1, 0.3*inch))
    
    if inventory_items:
        data = [['Item Name', 'Category', 'Opening Stock', 'Current Stock', 'Unit', 'Status']]
        for item in inventory_items:
            percentage = (item['current_stock'] / item['opening_stock']) * 100 if item['opening_stock'] > 0 else 0
            status = 'Low' if percentage <= 20 else 'Medium' if percentage <= 50 else 'Good'
            data.append([
                item['item_name'],
                item['category'],
                f"{item['opening_stock']} {item['unit']}",
                f"{item['current_stock']} {item['unit']}",
                item['unit'],
                status
            ])
        
        table = Table(data, colWidths=[1.5*inch, 1.2*inch, 1.2*inch, 1.2*inch, 0.8*inch, 0.8*inch])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0F172A')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.white),
            ('GRID', (0, 0), (-1, -1), 1, colors.grey),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.lightgrey])
        ]))
        
        elements.append(table)
    
    elements.append(Spacer(1, 0.5*inch))
    footer = Paragraph(
        f"Generated on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        styles['Normal']
    )
    elements.append(footer)
    
    doc.build(elements)
    buffer.seek(0)
    return buffer.read()