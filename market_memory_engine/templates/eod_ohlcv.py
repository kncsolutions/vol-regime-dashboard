import pandas as pd
from string import Template
from datetime import datetime
from tabulate import tabulate
from fpdf import FPDF

# 1. Daily Document Plain Text Layout Template
DAILY_DOCUMENT_TEMPLATE = """
========================================================================================================
                                          DAILY OHLCV SUMMARY
Symbol: $symbol                                                                  Date: $generated_date
========================================================================================================

CURRENT MONTH EOD OHLCV
--------------------------------------------------------------------------------------------------------
$ohlcv_table


========================================================================================================
                                      END OF AUTOMATED EOD REPORT
========================================================================================================
"""


def generate_eod_ohlcv_report(df: pd.DataFrame, output_pdf_filename: str):
    """
    Groups a daily market DataFrame by symbol and compiles a multi-page
    indexed PDF with an interactive Table of Contents on Page 1.
    """
    # Create a deep copy to protect the source DataFrame from unexpected manipulation mutations
    df = df.copy()

    # Clean and truncate the date to include only year-month-day
    df['date'] = pd.to_datetime(df['date']).dt.strftime('%Y-%m-%d')

    # Define strict column structure and display priority order
    ohlcv_cols = ["date", "open", "high", "low", "close", "volume", "body", "upper_wick","lower_wick","ema20", "ema50", "ema200", "ATR"]

    # FPDF Init (A4 Landscape is highly recommended to prevent table clipping)
    pdf = FPDF(orientation="L", unit="mm", format="A4")
    pdf.set_auto_page_break(auto=True, margin=12)

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
    pdf.cell(0, 4, "=" * 104, ln=1, align="C")
    pdf.ln(10)

    pdf.set_font("Courier", style="B", size=11)
    pdf.cell(40, 6, "SYMBOL (LINK)", ln=0)
    pdf.cell(200, 6, "PAGE REFERENCE", ln=1, align="R")
    pdf.set_font("Courier", size=11)
    pdf.cell(0, 4, "-" * 104, ln=1)
    pdf.ln(2)

    for entry in toc_registry:
        pdf.set_text_color(0, 0, 255)
        pdf.set_font("Courier", style="BU", size=11)  # Clickable blue text styling
        pdf.cell(40, 6, entry["symbol"], ln=0, link=entry["link_obj"])

        pdf.set_text_color(0, 0, 0)
        pdf.set_font("Courier", size=11)

        filler_dots = "." * (75)
        pdf.cell(160, 6, filler_dots, ln=0, align="L")
        pdf.cell(40, 6, f"Page {entry['page_num']:02d}", ln=1, align="R")

    pdf.ln(20)
    pdf.set_font("Courier", style="I", size=9)
    current_time_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    pdf.cell(0, 4, f"Generated: {current_time_str} | Total Document Pages: {len(unique_symbols) + 1}", align="C")

    # --- SECOND PASS: Append Individual Symbol Report Layouts ---
    for entry in toc_registry:
        symbol = entry["symbol"]

        # 1. Filter out ALL history records matching this symbol
        symbol_df = df[df['symbol'] == symbol].reset_index(drop=True)

        # 2. Match requested display schema and enforce float rounding formatting
        display_df = symbol_df[ohlcv_cols].copy()

        # Round numerical values for pristine alignment presentation
        for col in ["open", "high", "low", "close","body", "upper_wick","lower_wick", "ema20", "ema50", "ema200", "ATR"]:
            if col in display_df.columns:
                display_df[col] = display_df[col].round(2)

        if "volume" in display_df.columns:
            display_df["volume"] = display_df["volume"].round(0)

        pdf.add_page()
        pdf.set_link(entry["link_obj"], y=0, page=entry["page_num"])
        pdf.set_font("Courier", size=9)

        # 3. Construct the clean plain-text table object matching the requested view
        # Using tablefmt="plain" matches your requested target look cleanly
        table_output = tabulate(display_df, headers='keys', tablefmt="plain", showindex=True)

        # Pack matrices into the template dictionary variables
        template_variables = {
            "symbol": symbol,
            "generated_date": datetime.now().strftime('%Y-%m-%d'),
            "ohlcv_table": table_output
        }

        # Substitute configuration map fields out into standard text template
        page_text_layout = Template(DAILY_DOCUMENT_TEMPLATE).substitute(template_variables)
        pdf.multi_cell(w=0, h=4.2, txt=page_text_layout, border=0, align="L")
        print(f" -> Compiled interactive daily page generated for: {symbol}")

    pdf.output(output_pdf_filename)
    print(f"\nSuccess! Interactive Daily DataFrame Report saved to: '{output_pdf_filename}'")
#
#
# import pandas as pd
# from string import Template
# from datetime import datetime
# from tabulate import tabulate
# from fpdf import FPDF
# import mplfinance as mpf
# import os
#
# # 1. Daily Document Plain Text Layout Template
# DAILY_DOCUMENT_TEMPLATE = """
# ========================================================================================================
#                                           DAILY OHLCV SUMMARY
# Symbol: $symbol                                                                  Date: $generated_date
# ========================================================================================================
#
# CURRENT MONTH EOD OHLCV
# --------------------------------------------------------------------------------------------------------
# $ohlcv_table
# """
#
#
# def generate_eod_ohlcv_report(df: pd.DataFrame, output_pdf_filename: str):
#     """
#     Groups a daily market DataFrame by symbol, compiles a multi-page
#     indexed PDF with an interactive Table of Contents, and embeds an OHLCV candlestick chart with volume.
#     """
#     df = df.copy()
#
#     # Save original datetime elements for plotting before standardizing table text strings
#     df['plot_date'] = pd.to_datetime(df['date'])
#     df['date'] = df['plot_date'].dt.strftime('%Y-%m-%d')
#
#     ohlcv_cols = ["date", "open", "high", "low", "close", "volume", "body", "upper_wick","lower_wick","ema20", "ema50", "ema200", "ATR"]
#
#     # FPDF Init (A4 Landscape)
#     pdf = FPDF(orientation="L", unit="mm", format="A4")
#     pdf.set_auto_page_break(auto=True, margin=12)
#
#     unique_symbols = sorted(df['symbol'].unique())
#
#     # --- FIRST PASS: Pre-calculate page positions and build navigation link anchors ---
#     current_page_pointer = 2
#     toc_registry = []
#     for symbol in unique_symbols:
#         link_id = pdf.add_link()
#         toc_registry.append({
#             "symbol": str(symbol).upper(),
#             "page_num": current_page_pointer,
#             "link_obj": link_id
#         })
#         current_page_pointer += 1
#
#     print(f"Starting Daily compilation process for {len(unique_symbols)} assets...")
#
#     # --- RENDER PAGE 1: Interactive Table of Contents ---
#     pdf.add_page()
#     pdf.set_font("Courier", style="B", size=14)
#     pdf.cell(0, 10, "MASTER DAILY PORTFOLIO INDEX", ln=1, align="C")
#     pdf.cell(0, 4, "=" * 104, ln=1, align="C")
#     pdf.ln(10)
#
#     pdf.set_font("Courier", style="B", size=11)
#     pdf.cell(40, 6, "SYMBOL (LINK)", ln=0)
#     pdf.cell(200, 6, "PAGE REFERENCE", ln=1, align="R")
#     pdf.set_font("Courier", size=11)
#     pdf.cell(0, 4, "-" * 104, ln=1)
#     pdf.ln(2)
#
#     for entry in toc_registry:
#         pdf.set_text_color(0, 0, 255)
#         pdf.set_font("Courier", style="BU", size=11)
#         pdf.cell(40, 6, entry["symbol"], ln=0, link=entry["link_obj"])
#
#         pdf.set_text_color(0, 0, 0)
#         pdf.set_font("Courier", size=11)
#         pdf.cell(160, 6, "." * 75, ln=0, align="L")
#         pdf.cell(40, 6, f"Page {entry['page_num']:02d}", ln=1, align="R")
#
#     pdf.ln(20)
#     pdf.set_font("Courier", style="I", size=9)
#     current_time_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
#     pdf.cell(0, 4, f"Generated: {current_time_str} | Total Document Pages: {len(unique_symbols) + 1}", align="C")
#
#     # --- SECOND PASS: Append Individual Symbol Report Layouts & OHLCV Charts ---
#     for entry in toc_registry:
#         symbol = entry["symbol"]
#         symbol_df = df[df['symbol'] == symbol].reset_index(drop=True)
#
#         display_df = symbol_df[ohlcv_cols].copy()
#         for col in ["open", "high", "low", "close", "body", "upper_wick","lower_wick", "ema20", "ema50", "ema200", "ATR"]:
#             if col in display_df.columns:
#                 display_df[col] = display_df[col].round(2)
#         if "volume" in display_df.columns:
#             display_df["volume"] = display_df["volume"].round(0)
#
#         pdf.add_page()
#         pdf.set_link(entry["link_obj"], y=0, page=entry["page_num"])
#         pdf.set_font("Courier", size=9)
#
#         # Generate text table
#         table_output = tabulate(display_df, headers='keys', tablefmt="plain", showindex=True)
#         template_variables = {
#             "symbol": symbol,
#             "generated_date": datetime.now().strftime('%Y-%m-%d'),
#             "ohlcv_table": table_output
#         }
#         page_text_layout = Template(DAILY_DOCUMENT_TEMPLATE).substitute(template_variables)
#         pdf.multi_cell(w=0, h=4.2, txt=page_text_layout, border=0, align="L")
#
#         # --- MPLFINANCE OHLCV CHART GENERATION WORKFLOW ---
#         # 1. Prep data: mplfinance strictly requires a DatetimeIndex
#         chart_df = symbol_df.copy()
#         chart_df.set_index('plot_date', inplace=True)
#         chart_df.index.name = 'Date'
#
#         # 2. Configure EMA lines to overlay onto the candlestick chart
#         moving_averages = []
#         for ema in ['ema20', 'ema50', 'ema200']:
#             if ema in chart_df.columns:
#                 moving_averages.append(mpf.make_addplot(chart_df[ema], linestyle='--', width=1.0))
#
#         chart_filename = f"temp_ohlcv_{symbol}.png"
#
#         # 3. Plot Candlesticks + Volume panels simultaneously
#         mpf.plot(
#             chart_df,
#             type='candle',
#             volume=True,
#             addplot=moving_averages if moving_averages else None,
#             style='charles',  # Green/Red candle style
#             title=f"\n{symbol} Complete OHLCV & Technical Indicator Trend",
#             figsize=(10, 4.2),  # Scaled nicely for layout balance
#             savefig=dict(fname=chart_filename, dpi=200, bbox_inches='tight')
#         )
#
#         # 4. Dynamic layout calculation to append chart right under the text block
#         current_y = pdf.get_y()
#
#         # Insert image (Width=250mm centers it well within Landscape parameters)
#         pdf.image(chart_filename, x=15, y=current_y + 4, w=250)
#
#         # 5. Clean up temporary disk file
#         if os.path.exists(chart_filename):
#             os.remove(chart_filename)
#
#         # Footer boundary line
#         pdf.set_y(-16)
#         pdf.set_font("Courier", size=9)
#         pdf.cell(0, 4, "=" * 104, ln=1, align="C")
#         pdf.cell(0, 4, "END OF AUTOMATED EOD REPORT", ln=1, align="C")
#         print(f" -> Compiled interactive daily page + OHLCV Candlestick chart generated for: {symbol}")
#
#     pdf.output(output_pdf_filename)
#     print(f"\nSuccess! Interactive Daily DataFrame Report saved to: '{output_pdf_filename}'")
