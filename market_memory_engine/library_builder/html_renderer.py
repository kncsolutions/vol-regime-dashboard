import json

from pathlib import Path

from market_memory_engine.library_builder.templates import PAGE_TEMPLATE


class HTMLRenderer:

    @staticmethod
    def render_table(title, dictionary):

        html = f"<div class='section'><h2>{title}</h2>"

        html += "<table>"

        for k, v in dictionary.items():

            html += f"<tr><td>{k}</td><td>{v}</td></tr>"

        html += "</table></div>"

        return html


    @staticmethod
    def render_monthly(envelope):

        data = envelope["ledger"]

        html = ""

        ####################################################
        # TABLE 1 : Identity
        ####################################################

        identity = {}

        for key, value in data.items():

            if key in ("weekly_breakdown", "daily_dates", "statistics"):
                continue

            identity[key] = value

        html += HTMLRenderer.render_table(

            "Table 1 : Identity",

            identity

        )

        ####################################################
        # TABLE 2 : Weekly Breakdown
        ####################################################

        html += "<div class='section'>"

        html += "<h2>Table 2 : Weekly Breakdown</h2>"

        html += "<table>"

        if len(data["weekly_breakdown"]) > 0:

            headers = list(data["weekly_breakdown"][0].keys())

            html += "<tr>"

            for h in headers:
                html += f"<th>{h}</th>"

            html += "</tr>"

            for row in data["weekly_breakdown"]:

                html += "<tr>"

                for h in headers:
                    html += f"<td>{row[h]}</td>"

                html += "</tr>"

        html += "</table>"

        html += "</div>"

        ####################################################
        # TABLE 3 : Statistics
        ####################################################

        html += HTMLRenderer.render_table(

            "Table 3 : Statistics",

            data["statistics"]

        )

        ####################################################
        # TABLE 4 : Daily Dates
        ####################################################

        html += "<div class='section'>"

        html += "<h2>Table 4 : Daily Dates</h2>"

        html += "<ul>"

        for d in data["daily_dates"]:
            html += f"<li>{d}</li>"

        html += "</ul>"

        html += "</div>"

        return PAGE_TEMPLATE.format(

            title=f'{data["symbol"]} {data["year"]}-{data["month"]:02d}',

            navigation="""
            <div class="navigation">
                <a href="../../../../index.html">Home</a>
            </div>
            """,

            content=html
        )