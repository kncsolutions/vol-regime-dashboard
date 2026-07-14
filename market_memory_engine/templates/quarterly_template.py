import json
from string import Template
from datetime import datetime
from tabulate import tabulate
from fpdf import FPDF

# 1. Quarterly Master document text layout structure
QUARTERLY_DOCUMENT_TEMPLATE = """
==================================================================
                        QUARTERLY SUMMARY
Symbol: $symbol                                   Period: $quarter
==================================================================

$market_matrix_table

OTHER IMPORTANT PRICE AREAS:
------------------------------------------------------------------
$price_areas_table

PERFORMANCE & VOLATILITY METRICS:
------------------------------------------------------------------
$metrics_table

MONTHLY BREAKDOWN ANALYSIS:
------------------------------------------------------------------
$monthly_breakdown_table

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


def get_month_name(month_num: int) -> str:
    """Helper to convert an integer month index into its short name."""
    try:
        return datetime(2000, int(month_num), 1).strftime("%b")
    except Exception:
        return f"M{month_num}"


def generate_multi_asset_quarterly_report(json_list: list, output_pdf_filename: str):
    """
    Takes an array list of quarterly market JSON objects and builds a multi-page
    indexed PDF document featuring a clickable Table of Contents on Page 1.
    """
    pdf = FPDF(orientation="P", unit="mm", format="A4")
    pdf.set_auto_page_break(auto=True, margin=12)

    # --- FIRST PASS: Pre-calculate page positions and build navigation link anchors ---
    current_page_pointer = 2
    toc_registry = []

    for item in json_list:
        ledger = item["ledger"]
        symbol = ledger["symbol"]
        quarter_str = f"Q{ledger['quarter']} {ledger['year']}"
        link_id = pdf.add_link()

        toc_registry.append({
            "symbol": symbol,
            "period": quarter_str,
            "page_num": current_page_pointer,
            "link_obj": link_id
        })
        current_page_pointer += 1

    print(f"Starting quarterly compilation process for {len(json_list)} assets...")

    # --- RENDER PAGE 1: Interactive Table of Contents ---
    pdf.add_page()
    pdf.set_font("Courier", style="B", size=14)
    pdf.cell(0, 10, "MASTER QUARTERLY INDEX", ln=1, align="C")
    pdf.cell(0, 4, "=" * 66, ln=1, align="C")
    pdf.ln(10)

    pdf.set_font("Courier", style="B", size=10)
    pdf.cell(30, 6, "SYMBOL (LINK)", ln=0)
    pdf.cell(40, 6, "REPORTING PERIOD", ln=0)
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
        pdf.cell(40, 6, entry["period"], ln=0)

        filler_dots = "." * (35 - len(entry["period"]))
        pdf.cell(60, 6, filler_dots, ln=0, align="L")
        pdf.cell(40, 6, f"Page {entry['page_num']:02d}", ln=1, align="R")

    pdf.ln(20)
    pdf.set_font("Courier", style="I", size=8)
    pdf.cell(0, 4, f"Generated: {datetime.now().strftime('%Y-%m-%d')} | Total Document Pages: {len(json_list) + 1}",
             align="C")

    # --- SECOND PASS: Append Individual Asset Detail Report Layouts ---
    for item in json_list:
        ledger = item["ledger"]
        stats = ledger["statistics"]
        quarter_title = f"Q{ledger['quarter']} {ledger['year']}"

        # Link anchor registration step
        target_meta = next(x for x in toc_registry if x["symbol"] == ledger["symbol"])
        pdf.add_page()
        pdf.set_link(target_meta["link_obj"], y=0, page=target_meta["page_num"])
        pdf.set_font("Courier", size=8)

        # Grid 1: Top 3-Column Quarterly Summary Matrix
        matrix_headers = ["METRIC", "DATA ENGINE", "VOLATILITY STATISTICS"]
        matrix_data = [
            [f"O: {ledger['open']:.2f}", f"AVG DAILY VOL: {ledger['avg_daily_volume']:,.0f}",
             f"% CHANGE:      {ledger['percent_change']:.2f}%"],
            [f"H: {ledger['high']:.2f}", f"UP DAYS:       {ledger['up_days']}",
             f"QUARTERLY RANGE:{ledger['quarterly_range']:.2f}"],
            [f"L: {ledger['low']:.2f}", f"DOWN DAYS:     {ledger['down_days']}", f"VPOC:          {stats['vpoc']:.2f}"],
            [f"C: {ledger['close']:.2f}", f"UNCHANGED:     {ledger['unchanged_days']}", ""]
        ]

        # Grid 2: Profile Key Price Ranges
        price_headers = ["AREA TYPE", "VALUE REFERENCE"]
        price_data = [
            ["VPOC", f"{stats['vpoc']:.2f}"],
            ["VAH", f"{stats['vah']:.2f}"],
            ["VAL", f"{stats['val']:.2f}"]
        ]

        # Grid 3: Analytical Volatility Calculations
        metrics_headers = ["PERFORMANCE PARAMETER", "RECORDED METRIC DATA"]
        metrics_data = [
            ["HIGHEST DAY", f"{extract_date_str(stats['highest_day'])} ({stats['highest']:.2f})"],
            ["LOWEST DAY", f"{extract_date_str(stats['lowest_day'])} ({stats['lowest']:.2f})"],
            ["LARGEST UP DAY", f"{extract_date_str(stats['largest_up_day'])} (+{stats['largest_up'] * 100:.2f}%)"],
            ["LARGEST DOWN DAY", f"{extract_date_str(stats['largest_down_day'])} ({stats['largest_down'] * 100:.2f}%)"],
            ["HIGHEST VOLUME DAY", f"{extract_date_str(stats['highest_volume_day'])} ({stats['highest_volume']:,.0f})"],
            ["ATR QUARTERLY", f"{stats['avg_true_range']:.2f}"],
            ["VOLATILITY (High-Low/Avg Close)", f"{stats['volatility'] * 100:.2f}%"]
        ]

        # Grid 4: Processing Dynamic Monthly Breakdown Rows
        monthly_headers = ["MONTH", "START DATE", "END DATE", "OPEN", "HIGH", "LOW", "CLOSE", "VOLUME", "DAYS", "% CHG"]
        monthly_rows = []

        for m_item in ledger.get("monthly_breakdown", []):
            monthly_rows.append([
                get_month_name(m_item["month"]),
                extract_date_str(m_item["start_date"]),
                extract_date_str(m_item["end_date"]),
                f"{m_item['open']:.2f}",
                f"{m_item['high']:.2f}",
                f"{m_item['low']:.2f}",
                f"{m_item['close']:.2f}",
                f"{m_item['volume']:,.0f}",
                m_item["trading_days"],
                f"{m_item['percent_change']:.2f}%"
            ])

        # Pack matrices parameters into parsing container dictionary
        template_variables = {
            "symbol": ledger["symbol"],
            "quarter": quarter_title,
            "market_matrix_table": tabulate(matrix_data, headers=matrix_headers, tablefmt="grid"),
            "price_areas_table": tabulate(price_data, headers=price_headers, tablefmt="simple"),
            "metrics_table": tabulate(metrics_data, headers=metrics_headers, tablefmt="grid"),
            "monthly_breakdown_table": tabulate(monthly_rows, headers=monthly_headers, tablefmt="grid")
        }

        # Substitute configuration map fields out into standard text template
        page_text_layout = Template(QUARTERLY_DOCUMENT_TEMPLATE).substitute(template_variables)
        pdf.multi_cell(w=0, h=4.0, txt=page_text_layout, border=0, align="L")
        print(f" -> Compiled interactive quarterly page generated for: {ledger['symbol']}")

    pdf.output(output_pdf_filename)
    print(f"\nSuccess! Interactive Quarterly Report saved to: '{output_pdf_filename}'")


# ==================================================================
# ISOLATED FILTERING & SORTING DATA HELPERS (UNTOUCHED)
# ==================================================================
def sort_market_list_by_symbol(market_list: list, reverse: bool = False) -> list:
    """Sorts the market JSON list alphabetically based on the asset symbol."""
    return sorted(market_list, key=lambda x: x.get("ledger", {}).get("symbol", "").upper(), reverse=reverse)


def extract_symbol_sublist(market_list: list, target_symbols: list) -> list:
    """Extracts a subset array preserving the user's targeted sorting query order."""
    normalized_targets = [str(sym).upper() for sym in target_symbols]
    symbol_map = {item.get("ledger", {}).get("symbol", "").upper(): item for item in market_list if
                  item.get("ledger", {}).get("symbol")}
    return [symbol_map[sym] for sym in normalized_targets if sym in symbol_map]


# ==================================================================
# SYSTEM TEST DRIVER EXECUTION
# ==================================================================
if __name__ == "__main__":
    # Your provided sample quarterly payload
    quarterly_sample_data = [
        {
            "schema_version": 1,
            "ledger_type": "QUARTERLY",
            "immutable": True,
            "created_at": "2026-07-08T13:12:12.339039+05:30",
            "source": "MarketMemoryEngine",
            "ledger": {
                "symbol": "ABB",
                "year": 2026,
                "quarter": 2,
                "start_date": "2026-04-01T00:00:00+05:30",
                "end_date": "2026-06-30T00:00:00+05:30",
                "open": 6180.0, "high": 7822.5, "low": 5916.5, "close": 7031.0,
                "volume": 26792052.0, "trading_days": 60, "avg_daily_volume": 446534.2,
                "up_days": 36, "down_days": 23, "unchanged_days": 0, "percent_change": 13.77, "quarterly_range": 1906.0,
                "monthly_breakdown": [{"month": 4, "start_date": "2026-04-01", "end_date": "2026-04-30", "open": 6180.0, "high": 7822.5, "low": 5916.5, "close": 7230.0, "volume": 9595057.0, "trading_days": 20, "percent_change": 16.99},{"month": 5, "start_date": "2026-05-04", "end_date": "2026-05-29", "open": 7269.0, "high": 7389.0, "low": 6171.5, "close": 7253.0, "volume": 10458546.0, "trading_days": 19, "percent_change": -0.22},{"month": 6, "start_date": "2026-06-01", "end_date": "2026-06-30", "open": 7253.0, "high": 7327.0, "low": 6653.0, "close": 7031.0, "volume": 6738449.0, "trading_days": 21, "percent_change": -3.06}],"statistics": {"highest_day": "2026-04-22", "highest": 7822.5, "lowest_day": "2026-04-02", "lowest": 5916.5,"largest_up_day": "2026-05-27", "largest_up": 0.0551, "largest_down_day": "2026-05-11", "largest_down": -0.0412,"highest_volume_day": "2026-05-11", "highest_volume": 2419336.0, "lowest_volume_day": "2026-06-22", "lowest_volume": 150159.0,"avg_true_range": 216.44, "avg_daily_range": 205.92, "volatility": 0.2756, "vpoc": 7203.05, "vah": 7365.06, "val": 6488.3}}}]
    # Run compilation pipeline
    generate_multi_asset_quarterly_report(quarterly_sample_data, "Quarterly_Financial_Report.pdf")