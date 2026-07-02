from pathlib import Path
import json

from market_memory_engine.library_builder.html_renderer import HTMLRenderer
from market_memory_engine.library_builder.templates import INDEX_TEMPLATE
from market_memory_engine.library_builder.css import CSS


class MarketMemoryLibraryBuilder:

    def __init__(self, market_memory_root):

        self.market_memory = Path(market_memory_root)

        self.library = self.market_memory / "library"

        self.assets = self.library / "assets"

    #####################################################################

    def create_assets(self):

        self.assets.mkdir(parents=True, exist_ok=True)

        (self.assets / "style.css").write_text(CSS)

    #####################################################################

    def build_ledgers(self):
        print(self.market_memory.resolve())
        for json_file in self.market_memory.rglob("*.json"):
            print(json_file)

        for json_file in self.market_memory.rglob("*.json"):


            # Skip already generated library
            if "library" in json_file.parts:
                continue

            envelope = json.loads(json_file.read_text())

            ledger_type = envelope["ledger_type"]

            if ledger_type == "MONTHLY":

                html = HTMLRenderer.render_monthly(envelope)

            elif ledger_type == "QUARTERLY":

                continue

            else:

                continue

            relative = json_file.relative_to(self.market_memory)

            output = self.library / relative.parent

            output.mkdir(parents=True, exist_ok=True)

            outfile = output / (json_file.stem + ".html")

            outfile.write_text(html)

    #####################################################################

    def build_index(self):

        rows = "<ul>"

        for stock in sorted(self.market_memory.iterdir()):

            if not stock.is_dir():
                continue

            if stock.name == "library":
                continue

            rows += f"<li><b>{stock.name}</b><ul>"

            for html in sorted(
                (self.library / stock.name).rglob("*.html")
            ):

                relative = html.relative_to(self.library)

                rows += (
                    f'<li><a href="{relative.as_posix()}">'
                    f'{html.stem}'
                    f"</a></li>"
                )

            rows += "</ul></li>"

        rows += "</ul>"

        self.library.mkdir(exist_ok=True)

        (self.library / "index.html").write_text(

            INDEX_TEMPLATE.format(content=rows)

        )

    #####################################################################

    def build(self):

        self.library.mkdir(exist_ok=True)

        self.create_assets()

        self.build_ledgers()

        self.build_index()

builder = MarketMemoryLibraryBuilder(

    "market_memory"

)

builder.build()