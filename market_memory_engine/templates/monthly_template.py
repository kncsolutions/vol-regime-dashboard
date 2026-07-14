import json
from string import Template
from datetime import datetime
from tabulate import tabulate
from fpdf import FPDF

# Master plain text structure layout for asset pages
DOCUMENT_TEMPLATE = """
==================================================================
                        MONTHLY SUMMARY
Symbol: $symbol                                   Month: $month
==================================================================

$market_matrix_table

OTHER IMPORTANT PRICE AREAS:
------------------------------------------------------------------
$price_areas_table

PERFORMANCE & VOLATILITY METRICS:
------------------------------------------------------------------
$metrics_table

WEEKLY BREAKDOWN ANALYSIS:
------------------------------------------------------------------
$weekly_breakdown_table

==================================================================
                    END OF AUTOMATED REPORT
==================================================================
"""


def extract_date_str(iso_string: str) -> str:
    """Helper to convert raw ISO timestamps into neat YYYY-MM-DD format."""
    try:
        return iso_string.split("T")[0]
    except Exception:
        return iso_string


def generate_multi_asset_report(json_list: list, output_pdf_filename: str):
    """
    Builds a multi-page PDF document featuring an interactive, clickable
    Table of Contents on Page 1 for seamless navigation.
    """
    pdf = FPDF(orientation="P", unit="mm", format="A4")
    pdf.set_auto_page_break(auto=True, margin=12)

    # --- FIRST PASS: Pre-calculate pages and instantiate link objects ---
    current_page_pointer = 2
    toc_registry = []

    for item in json_list:
        symbol = item["ledger"]["symbol"]
        month_num = item["ledger"]["month"]
        year_num = item["ledger"]["year"]
        month_title = datetime(year_num, month_num, 1).strftime("%B %Y").upper()

        # Create a unique internal destination link object
        link_id = pdf.add_link()

        toc_registry.append({
            "symbol": symbol,
            "period": month_title,
            "page_num": current_page_pointer,
            "link_obj": link_id
        })

        current_page_pointer += 1

    print(f"Starting batch compilation process for {len(json_list)} assets...")

    # --- RENDER PAGE 1: Clickable Table of Contents ---
    pdf.add_page()
    pdf.set_font("Courier", style="B", size=14)
    pdf.cell(0, 10, "MASTER PORTFOLIO INDEX", ln=1, align="C")
    pdf.cell(0, 4, "=" * 66, ln=1, align="C")
    pdf.ln(10)

    pdf.set_font("Courier", style="B", size=10)
    pdf.cell(30, 6, "SYMBOL (LINK)", ln=0)
    pdf.cell(40, 6, "REPORTING PERIOD", ln=0)
    pdf.cell(100, 6, "PAGE REFERENCE", ln=1, align="R")
    pdf.set_font("Courier", size=10)
    pdf.cell(0, 4, "-" * 66, ln=1)
    pdf.ln(2)

    # Populate interactive rows
    for entry in toc_registry:
        # Style the asset symbol as a classic clickable blue hyperlink
        pdf.set_text_color(0, 0, 255)
        pdf.set_font("Courier", style="BU", size=10)  # Bold + Underlined

        # Passing the link object makes this specific text boundary box clickable
        pdf.cell(30, 6, entry["symbol"], ln=0, link=entry["link_obj"])

        # Reset fonts back to neutral black styling for the metadata track
        pdf.set_text_color(0, 0, 0)
        pdf.set_font("Courier", size=10)
        pdf.cell(40, 6, entry["period"], ln=0)

        filler_dots = "." * (35 - len(entry["period"]))
        pdf.cell(60, 6, filler_dots, ln=0, align="L")
        pdf.cell(40, 6, f"Page {entry['page_num']:02d}", ln=1, align="R")

    pdf.ln(20)
    pdf.set_font("Courier", style="I", size=8)
    pdf.cell(0, 4, f"Generated on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} | Total Pages: {len(json_list) + 1}",
             align="C")

    # --- SECOND PASS: Append Asset Reports & Connect Anchor Destinations ---
    for item in json_list:
        ledger = item["ledger"]
        stats = ledger["statistics"]
        month_name = datetime(ledger["year"], ledger["month"], 1).strftime("%B %Y").upper()

        # Match current loop node back to our TOC registry to grab its designated Link ID
        target_meta = next(x for x in toc_registry if x["symbol"] == ledger["symbol"])

        pdf.add_page()

        # CRITICAL: Point the link object directly to the top edge of this newly generated page
        pdf.set_link(target_meta["link_obj"], y=0, page=target_meta["page_num"])

        pdf.set_font("Courier", size=8)

        # Grid 1: Top Summary Matrix
        matrix_headers = ["METRIC", "DATA ENGINE", "VOLATILITY STATISTICS"]
        matrix_data = [
            [f"O: {ledger['open']:.2f}", f"AVG DAILY VOL: {ledger['avg_daily_volume']:,.0f}",
             f"% CHANGE:      {ledger['percent_change']:.2f}%"],
            [f"H: {ledger['high']:.2f}", f"UP DAYS:       {ledger['up_days']}",
             f"MONTHLY RANGE: {ledger['monthly_range']:.2f}"],
            [f"L: {ledger['low']:.2f}", f"DOWN DAYS:     {ledger['down_days']}", f"VPOC:          {stats['vpoc']:.2f}"],
            [f"C: {ledger['close']:.2f}", f"UNCHANGED:     {ledger['unchanged_days']}", ""]
        ]

        # Grid 2: Profile Price Levels
        price_headers = ["AREA TYPE", "VALUE REFERENCE"]
        price_data = [
            ["VPOC", f"{stats['vpoc']:.2f}"],
            ["VAH", f"{stats['vah']:.2f}"],
            ["VAL", f"{stats['val']:.2f}"]
        ]

        # Grid 3: Volatility Metrics
        metrics_headers = ["PERFORMANCE PARAMETER", "RECORDED METRIC DATA"]
        metrics_data = [
            ["HIGHEST DAY", f"{extract_date_str(stats['highest_day'])} ({stats['highest']:.2f})"],
            ["LOWEST DAY", f"{extract_date_str(stats['lowest_day'])} ({stats['lowest']:.2f})"],
            ["LARGEST UP DAY", f"{extract_date_str(stats['largest_up_day'])} (+{stats['largest_up'] * 100:.2f}%)"],
            ["LARGEST DOWN DAY", f"{extract_date_str(stats['largest_down_day'])} ({stats['largest_down'] * 100:.2f}%)"],
            ["HIGHEST VOLUME DAY", f"{extract_date_str(stats['highest_volume_day'])} ({stats['highest_volume']:,.0f})"],
            ["ATR DAILY", f"{stats['avg_true_range']:.2f}"],
            ["VOLATILITY (High-Low/Avg Close)", f"{stats['volatility'] * 100:.2f}%"]
        ]

        # Grid 4: Weekly Breakdown Matrix
        weekly_headers = ["WK", "START DATE", "END DATE", "OPEN", "HIGH", "LOW", "CLOSE", "VOLUME", "DAYS", "% CHG"]
        weekly_rows = []
        for wk in ledger.get("weekly_breakdown", []):
            weekly_rows.append([
                wk["week_number"],
                extract_date_str(wk["start_date"]),
                extract_date_str(wk["end_date"]),
                f"{wk['open']:.2f}",
                f"{wk['high']:.2f}",
                f"{wk['low']:.2f}",
                f"{wk['close']:.2f}",
                f"{wk['volume']:,.0f}",
                wk["trading_days"],
                f"{wk['percent_change']:.2f}%"
            ])

        template_variables = {
            "symbol": ledger["symbol"],
            "month": month_name,
            "market_matrix_table": tabulate(matrix_data, headers=matrix_headers, tablefmt="grid"),
            "price_areas_table": tabulate(price_data, headers=price_headers, tablefmt="simple"),
            "metrics_table": tabulate(metrics_data, headers=metrics_headers, tablefmt="grid"),
            "weekly_breakdown_table": tabulate(weekly_rows, headers=weekly_headers, tablefmt="grid")
        }

        page_text_layout = Template(DOCUMENT_TEMPLATE).substitute(template_variables)
        pdf.multi_cell(w=0, h=4.0, txt=page_text_layout, border=0, align="L")
        print(f" -> Compiled interactive page generated for: {ledger['symbol']}")

    pdf.output(output_pdf_filename)
    print(f"\nCompleted! Interactive file compiled to: '{output_pdf_filename}'")


# ==================================================================
# TEST CONTROLLER
# ==================================================================
if __name__ == "__main__":
    multi_asset_input_dataset = [
        {
            'schema_version': 1, 'ledger_type': 'MONTHLY', 'immutable': True,
            'ledger': {
                'symbol': 'LODHA', 'year': 2026, 'month': 6,
                'open': 941.15, 'high': 972.0, 'low': 848.0, 'close': 955.25,
                'volume': 45279658.0, 'trading_days': 21, 'avg_daily_volume': 2156174.19,
                'up_days': 13, 'down_days': 7, 'unchanged_days': 0, 'percent_change': 1.498, 'monthly_range': 124.0,
                'weekly_breakdown': [
                    {'week_number': 23, 'start_date': '2026-06-01', 'end_date': '2026-06-05', 'open': 941.15,
                     'high': 942.0, 'low': 856.5, 'close': 894.45, 'volume': 9332016.0, 'trading_days': 5,
                     'percent_change': -4.96, 'weekly_range': 85.5}
                ],
                'statistics': {
                    'highest_day': '2026-06-25', 'highest': 972.0, 'lowest_day': '2026-06-11', 'lowest': 848.0,
                    'largest_up_day': '2026-06-24', 'largest_up': 0.0297, 'largest_down_day': '2026-06-01',
                    'largest_down': -0.0511,
                    'highest_volume_day': '2026-06-25', 'highest_volume': 4936333.0, 'lowest_volume_day': '2026-06-10',
                    'lowest_volume': 747498.0,
                    'avg_true_range': 32.26, 'avg_daily_range': 29.82, 'volatility': 0.1365, 'vpoc': 918.06,
                    'vah': 967.04, 'val': 900.08
                }
            }
        },
        {
            'schema_version': 1, 'ledger_type': 'MONTHLY', 'immutable': True,
            'ledger': {
                'symbol': 'HEXAGON', 'year': 2026, 'month': 6,
                'open': 48.25, 'high': 67.9, 'low': 48.1, 'close': 63.41,
                'volume': 41728261.0, 'trading_days': 12, 'avg_daily_volume': 3477355.08,
                'up_days': 7, 'down_days': 4, 'unchanged_days': 0, 'percent_change': 31.41, 'monthly_range': 19.8,
                'weekly_breakdown': [
                    {'week_number': 24, 'start_date': '2026-06-12', 'end_date': '2026-06-12', 'open': 48.25,
                     'high': 50.66, 'low': 48.1, 'close': 50.66, 'volume': 11379734.0, 'trading_days': 1,
                     'percent_change': 4.99, 'weekly_range': 2.55}],
                'statistics': {'highest_day': '2026-06-29', 'highest': 67.9, 'lowest_day': '2026-06-12', 'lowest': 48.1,
                               'largest_up_day': '2026-06-29', 'largest_up': 0.0861, 'largest_down_day': '2026-06-30',
                               'largest_down': -0.0464, 'highest_volume_day': '2026-06-12',
                               'highest_volume': 11379734.0, 'lowest_volume_day': '2026-06-25',
                               'lowest_volume': 321307.0, 'avg_true_range': 3.74, 'avg_daily_range': 3.15,
                               'volatility': 0.3600, 'vpoc': 50.57, 'vah': 59.18, 'val': 48.1}}}]

    generate_multi_asset_report(multi_asset_input_dataset, "Interactive_Market_Report.pdf")
