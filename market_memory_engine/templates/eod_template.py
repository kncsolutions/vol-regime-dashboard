import pandas as pd
from string import Template
from datetime import datetime
from tabulate import tabulate
from fpdf import FPDF

# 1. Daily Document Plain Text Layout Template
DAILY_DOCUMENT_TEMPLATE = """
==================================================================
                        DAILY ASSET SUMMARY
Symbol: $symbol                                   Date: $generated_date
==================================================================

CURRENT SESSION MARKET DEPTH
------------------------------------------------------------------
$market_depth_table

LIVE SESSION PERFORMANCE
------------------------------------------------------------------
$session_perf_table

HISTORICAL VOLATILITY & REFERENCE POINTS
------------------------------------------------------------------
$historical_metrics_table

==================================================================
                    END OF AUTOMATED DAILY REPORT
==================================================================
"""


def generate_daily_dataframe_report(df: pd.DataFrame, output_pdf_filename: str):
    """
    Groups a daily market DataFrame by symbol and compiles a multi-page
    indexed PDF with an interactive Table of Contents on Page 1.
    """
    pdf = FPDF(orientation="P", unit="mm", format="A4")
    pdf.set_auto_page_break(auto=True, margin=12)

    # Extract unique symbols present in the DataFrame to pre-allocate pages
    unique_symbols = sorted(df['symbol'].unique())

    # --- FIRST PASS: Pre-calculate page positions and build navigation link anchors ---
    current_page_pointer = 2
    toc_registry = []

    for symbol in unique_symbols:
        link_id = pdf.add_link()
        toc_registry.append({
            "symbol": str(symbol).upper(),
            "page_num": current_page_pointer,
            "link_obj": link_id
        })
        current_page_pointer += 1

    print(f"Starting Daily compilation process for {len(unique_symbols)} assets...")

    # --- RENDER PAGE 1: Interactive Table of Contents ---
    pdf.add_page()
    pdf.set_font("Courier", style="B", size=14)
    pdf.cell(0, 10, "MASTER DAILY PORTFOLIO INDEX", ln=1, align="C")
    pdf.cell(0, 4, "=" * 66, ln=1, align="C")
    pdf.ln(10)

    pdf.set_font("Courier", style="B", size=10)
    pdf.cell(30, 6, "SYMBOL (LINK)", ln=0)
    pdf.cell(100, 6, "PAGE REFERENCE", ln=1, align="R")
    pdf.set_font("Courier", size=10)
    pdf.cell(0, 4, "-" * 66, ln=1)
    pdf.ln(2)

    for entry in toc_registry:
        pdf.set_text_color(0, 0, 255)
        pdf.set_font("Courier", style="BU", size=10)  # Clickable blue text styling
        pdf.cell(30, 6, entry["symbol"], ln=0, link=entry["link_obj"])

        pdf.set_text_color(0, 0, 0)
        pdf.set_font("Courier", size=10)

        filler_dots = "." * (45)
        pdf.cell(60, 6, filler_dots, ln=0, align="L")
        pdf.cell(40, 6, f"Page {entry['page_num']:02d}", ln=1, align="R")

    pdf.ln(20)
    pdf.set_font("Courier", style="I", size=8)
    current_time_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    pdf.cell(0, 4, f"Generated: {current_time_str} | Total Document Pages: {len(unique_symbols) + 1}", align="C")

    # --- SECOND PASS: Append Individual Symbol Report Layouts ---
    for entry in toc_registry:
        symbol = entry["symbol"]

        # Extract the specific row matching the target symbol
        row = df[df['symbol'] == symbol].iloc[0]

        pdf.add_page()
        pdf.set_link(entry["link_obj"], y=0, page=entry["page_num"])
        pdf.set_font("Courier", size=9)

        # Grid 1: Market Depth (Using requested day buy, sell, and volume columns)
        depth_headers = ["DEPTH METRIC", "VOLUME SHARES"]
        depth_data = [
            ["DAY BUY QUANTITY", f"{row['day_buy_quantity']:,.0f}"],
            ["DAY SELL QUANTITY", f"{row['day_sell_quantity']:,.0f}"],
            ["TOTAL DAY VOLUME", f"{row['day_volume']:,.0f}"]
        ]

        # Grid 2: Live Session Performance (Using requested LTP, daily open/high/low/pct columns)
        perf_headers = ["SESSION PARAMETER", "PRICE VALUE / RANGE MATRIX"]
        perf_data = [
            ["LAST TRADED PRICE (LTP)", f"{row['ltp']:.2f}"],
            ["DAILY OPEN", f"{row['daily_open']:.2f}"],
            ["DAILY HIGH", f"{row['daily_high']:.2f}"],
            ["DAILY LOW", f"{row['daily_low']:.2f}"],
            ["MONTHLY HIGH TO LTP DISTANCE", f"{row['high_to_ltp_pct']:.2f}%"],
            ["MONTHLY LOW TO LTP DISTANCE", f"{row['low_to_ltp_pct']:.2f}%"]
        ]

        # Grid 3: Historical Profile/Volatility Context Elements
        hist_headers = ["HISTORICAL BENCHMARK", "VALUE REFERENCE"]
        hist_data = [
            ["MONTHLY VPOC", f"{row['vpoc']:.2f}"],
            ["MONTHLY VAH", f"{row['vah']:.2f}"],
            ["MONTHLY VAL", f"{row['val']:.2f}"],
            ["ATR (AVERAGE TRUE RANGE)", f"{row['avg_true_range']:.2f}"],
            ["PERIOD VOLATILITY",
             f"{row['volatility'] * 100:.2f}%" if row['volatility'] < 1.0 else f"{row['volatility']:.2f}%"]
        ]

        # Pack matrices into the template dictionary variables
        template_variables = {
            "symbol": symbol,
            "generated_date": datetime.now().strftime('%Y-%m-%d'),
            "market_depth_table": tabulate(depth_data, headers=depth_headers, tablefmt="grid"),
            "session_perf_table": tabulate(perf_data, headers=perf_headers, tablefmt="grid"),
            "historical_metrics_table": tabulate(hist_data, headers=hist_headers, tablefmt="simple")
        }

        # Substitute configuration map fields out into standard text template
        page_text_layout = Template(DAILY_DOCUMENT_TEMPLATE).substitute(template_variables)
        pdf.multi_cell(w=0, h=4.2, txt=page_text_layout, border=0, align="L")
        print(f" -> Compiled interactive daily page generated for: {symbol}")

    pdf.output(output_pdf_filename)
    print(f"\nSuccess! Interactive Daily DataFrame Report saved to: '{output_pdf_filename}'")


# ==================================================================
# PIPELINE DEMO ENVIRONMENT WITH A MOCK DATAFRAME
# ==================================================================
if __name__ == "__main__":
    # Generating mock DataFrame using your exact Index columns schema
    mock_data = {
        'symbol': ['RELIANCE', 'TCS', 'INFY'],
        'year':'2026',
        'month':'07',
        'quarter':'Q3',
        'vpoc': [2450.00, 3850.00, 1620.00],
        'vah': [2510.00, 3920.00, 1660.00],
        'val': [2390.00, 3780.00, 1580.00],
        'avg_true_range': [45.50, 62.10, 28.35],
        'volatility': [0.185, 0.124, 0.215],
        # --- Mandatory Requested Columns Mapped Below ---
        'daily_open': [2420.00, 3880.00, 1605.00],
        'daily_high': [2465.00, 3915.00, 1634.00],
        'daily_low': [2411.00, 3861.00, 1591.00],
        'ltp': [2455.50, 3895.00, 1622.50],
        'high_to_ltp_pct': [-0.38, -0.51, -0.70],
        'low_to_ltp_pct': [1.84, 0.88, 1.97],
        'day_buy_quantity':1,
        'day_sell_quantity':1,
        'day_volume': [863000, 377000, 555000]
        }

    df_market_data = pd.DataFrame(mock_data)

    # Execute PDF engine processing the pandas dataframe
    generate_daily_dataframe_report(df_market_data, "Daily_Stock_Market_Report.pdf")
