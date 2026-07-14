## This module is to be used to build the library of stocks
based on price volume information

#### How to use it?
Run ingestion.py to generate the information in json format.
Run build_library.py to generate the HTML files in human readable format.


# Scripts to generate monthly report 
## Update 
MONTHLY_REPORT_YEAR = 2026
MONTHLY_REPORT_MONTH = 7
to set the year and month  for monthly report.

python -m market_memory_engine.report_generation.nifty50_report_monthly
python -m market_memory_engine.report_generation.fno_non_nifty50_report_monthly
python -m market_memory_engine.report_generation.non_fno_report_quarterly

# Scripts to generate quarterly report 
## Update 
QUARTERLY_REPORT_YEAR = 2026
QUARTERLY_REPORT_QUARTER = 2
to set the year and month  for quarterly report.

python -m market_memory_engine.report_generation.nifty50_report_quarterly
python -m market_memory_engine.report_generation.fno_non_nifty50_report_quarterly
python -m market_memory_engine.report_generation.non_fno_report_quarterly

# Scripts to generate eod report for the current month 
## Update 
CURRENT_MONTH_EOD_DATA_REPORT_INCLUDE_CURRENT_SESSION = True
in configuration.py to include the data of running session
nifty_50_watch_current_month_module
python -m market_memory_engine.runners.filters.nifty_50_watch_current_month_module
python -m market_memory_engine.runners.filters.fno_non_nifty_50_watch_current_month_module
python -m market_memory_engine.runners.filters.non_fno_watch_current_month_module


