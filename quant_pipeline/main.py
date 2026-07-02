# main.py

import asyncio
import pandas as pd
import aiohttp
import time
from datetime import datetime

from quant_pipeline.core.websocket_client import TickStream
from quant_pipeline.core.dhan_client import dhan_client
from quant_pipeline.storage.csv_writer import CSVWriter

from quant_pipeline.features.microstructure import (
    calculate_spread,
    calculate_imbalance,
    calculate_microprice
)

from quant_pipeline.features.flow_metrics import (
    compute_flow,
    compute_dS
)

from quant_pipeline.features.volatility import (
    compute_approx_hv,
    compute_atm_iv
)
from quant_pipeline.features.gamma_metrics import (
    compute_net_gex,
    compute_gamma_flip
)

from quant_pipeline.features.skew_metrics import (
    compute_call_skew,
    compute_put_skew
)

from quant_pipeline.features.instability import (
    I1Engine,
    I2Engine,
    I3Engine
)
from quant_pipeline.core.snapshot_buffer import (
    SnapshotBuffer
)
from quant_pipeline.config.paths import STOCKS_CSV

# =========================================================
# CONFIG
# =========================================================

OPTION_CHAIN_INTERVAL = 10
API_BASE = "http://127.0.0.1:5000"

writer = CSVWriter()


# =========================================================
# GLOBAL STATE
# =========================================================

tick_stream = TickStream()

option_chain_cache = {}

previous_microprice = {}
previous_volume = {}

# =========================================================
# INSTABILITY ENGINE STATE
# =========================================================

I1_engines = {}

I2_engines = {}

I3_engines = {}

last_write_time = {}
CSV_WRITE_INTERVAL = 5

def get_instability_engines(symbol):

    if symbol not in I1_engines:

        I1_engines[symbol] = I1Engine(window=50)

    if symbol not in I2_engines:

        I2_engines[symbol] = I2Engine()

    if symbol not in I3_engines:

        I3_engines[symbol] = I3Engine()

    return (
        I1_engines[symbol],
        I2_engines[symbol],
        I3_engines[symbol]
    )


snapshot_buffers = {}

def get_snapshot_buffer(symbol):

    if symbol not in snapshot_buffers:

        snapshot_buffers[symbol] = (
            SnapshotBuffer(size=200)
        )

    return snapshot_buffers[symbol]

# =========================================================
# LOAD STOCKS
# =========================================================

def load_stocks():

    df = pd.read_csv(STOCKS_CSV)

    return df.to_dict(orient="records")


STOCKS = load_stocks()


# =========================================================
# OPTION CHAIN FETCHER
# =========================================================

async def fetch_option_chain(stock):

    symbol = stock["symbol"]

    security_id = stock["security_id"]

    underlying = stock["underlying"]

    try:

        expiries = dhan_client.get_expiry_list(
            under_security_id=int(security_id),
            under_security=symbol
        )
        if not isinstance(expiries, list):
            return
        if len(expiries) == 0:
            return
        from datetime import date
        today = date.today()
        if datetime.strptime(expiries[0], "%Y-%m-%d").date() <= today:
            expiry = expiries[1]
        else:
            expiry = expiries[0]

        raw_chain = dhan_client.get_option_chain(
            under_security_id=int(security_id),
            underlying=symbol,
            expiry=expiry
        )

        chain_df = dhan_client.option_chain_to_full_df(
            raw_chain,
            expiry
        )
        # print(raw_chain)

        option_chain_cache[symbol] = chain_df



        print(f"✅ Chain updated → {symbol}")

    except Exception as e:

        print(f"❌ Chain fetch failed {symbol}:", e)


# =========================================================
# PERIODIC OPTION CHAIN JOB
# =========================================================

OPTION_CHAIN_RATE_LIMIT = 7.5


async def option_chain_scheduler():

    while True:

        for stock in STOCKS:

            try:

                await fetch_option_chain(stock)

            except Exception as e:

                print(
                    f"❌ Chain scheduler error "
                    f"{stock['symbol']}: {e}"
                )

            # ---------------------------------
            # RATE LIMIT PROTECTION
            # ---------------------------------

            await asyncio.sleep(
                OPTION_CHAIN_RATE_LIMIT
            )

# =========================================================
# FEATURE ENGINE
# =========================================================

def compute_snapshot(symbol, tick, option_chain):

    try:

        # =================================================
        # DEPTH
        # =================================================

        depth = tick.get("depth", [])

        if not depth:
            return None

        best = depth[0]

        bid_price = best["bid_price"]
        ask_price = best["ask_price"]

        bid_qty = best["bid_qty"]
        ask_qty = best["ask_qty"]

        # =================================================
        # CORE TICK DATA
        # =================================================

        ltp = tick.get("ltp", 0)

        ltq = tick.get("ltq", 0)

        volume = tick.get("volume", 0)
        prev_close = tick.get("close", 0)


        # =================================================
        # MICROSTRUCTURE
        # =================================================

        spread = calculate_spread(
            bid_price,
            ask_price
        )

        imbalance = calculate_imbalance(
            depth
        )

        microprice = calculate_microprice(
            depth
        )

        # =================================================
        # FLOW + dS
        # =================================================

        prev_microprice = previous_microprice.get(
            symbol,
            microprice
        )

        dS = compute_dS(
            microprice,
            prev_microprice
        )

        previous_microprice[symbol] = microprice

        flow = compute_flow(
            imbalance,
            ltq
        )





        # =================================================
        # OPTION CHAIN FEATURES
        # =================================================

        chain = option_chain

        # print(type(chain))


        try:
            print(chain)
        except Exception:
            print("⚠️ chain.head() unavailable")

        hv = compute_approx_hv(
            ltp,
            prev_close
        )
        atm_iv = compute_atm_iv(
            chain,
            ltp
        )

        gex = compute_net_gex(chain)
        gamma_flip = compute_gamma_flip(
            chain
        )

        spot = ltp

        call_skew = compute_call_skew(
            chain,
            spot
        )

        put_skew = compute_put_skew(
            chain,
            spot
        )

        # =================================================
        # INSTABILITY
        # =================================================



        I1_engine, I2_engine, I3_engine = (
            get_instability_engines(symbol)
        )

        I1 = I1_engine.update(
            flow,
            dS
        )

        I2 = I2_engine.update(I1)

        I3 = I3_engine.update(I1)

        # =================================================
        # DEBUG PRINTS
        # =================================================
        print("\n================ MARKET SNAPSHOT =================")

        print(f"📌 SYMBOL           : {symbol}")

        print(f"💰 LTP              : {ltp}")

        print(f"⚡ LTQ              : {ltq}")

        print(f"📊 VOLUME           : {volume}")

        print("--------------------------------------------------")

        print(f"🟢 BID PRICE        : {bid_price}")

        print(f"🔴 ASK PRICE        : {ask_price}")

        print(f"🟢 BID QTY          : {bid_qty}")

        print(f"🔴 ASK QTY          : {ask_qty}")

        print("--------------------------------------------------")
        print(f"📉 HV               : {hv}")

        print(f"📏 SPREAD           : {spread}")

        print(f"⚖️ IMBALANCE        : {imbalance}")

        print(f"🎯 MICROPRICE       : {microprice}")

        print(f"🌊 FLOW             : {flow}")

        print(f"📈 dS               : {dS}")

        print("--------------------------------------------------")

        print(f"📞 CALL GEX         : {gex['callGEX']}")

        print(f"📉 PUT GEX          : {gex['putGEX']}")

        print(f"🧲 NET GEX          : {gex['netGEX']}")

        print(f"🧲 GAMMA FLIP      : {gamma_flip}")

        print("--------------------------------------------------")

        print(f"📐 CALL SKEW        : {call_skew}")

        print(f"📐 PUT SKEW         : {put_skew}")

        print("--------------------------------------------------")

        print(f"🔥 I1               : {I1}")

        print(f"⚡ I2               : {I2}")

        print(f"🌀 I3               : {I3}")

        print("==================================================\n")

        # input("wait to debug")

        # =================================================
        # SNAPSHOT
        # =================================================

        snapshot = {

            "time_readable": datetime.now().isoformat(),

            "time": int(time.time()),

            "ltp": ltp,

            "gammaFlip": gamma_flip,

            "imbalance": imbalance,

            "microprice": microprice,

            "spread": spread,

            "flow": flow,

            "dS": dS,

            "IV": atm_iv,
            "HV": hv,

            "callSkew": call_skew,

            "putSkew": put_skew,

            "netGEX": gex["netGEX"],

            "callGEX": gex["callGEX"],

            "putGEX": gex["putGEX"],

            "I1": I1,

            "I2": I2,

            "I3": I3,

            "symbol": symbol
        }

        # =================================================
        # DEBUG SNAPSHOT
        # =================================================

        print("\n================ SNAPSHOT =================")

        for k, v in snapshot.items():

            print(f"{k:15} : {v}")

        print("===========================================\n")

        # input('Wait to debug')

        return snapshot

    except Exception as e:

        print(f"❌ Snapshot error {symbol}:", e)

        import traceback

        traceback.print_exc()

        return None


# =========================================================
# TICK MERGE ENGINE
# =========================================================

async def tick_merge_loop():

    while True:

        try:

            for stock in STOCKS:

                symbol = stock["symbol"]

                sid = str(stock["security_id"])

                # -----------------------------------------
                # INDEX SID REMAP
                # -----------------------------------------

                if symbol == "NIFTY":
                    sid = str(stock["secondary_id"])

                elif symbol == "BANKNIFTY":
                    sid = str(stock["secondary_id"])

                tick = tick_stream.latest_ticks.get(sid)

                option_chain = option_chain_cache.get(symbol)
                # print(option_chain.columns)


                if not tick:
                    continue

                if option_chain is None:
                    continue

                if option_chain.empty:
                    continue

                snapshot = compute_snapshot(
                    symbol,
                    tick,
                    option_chain
                )

                if snapshot:
                    buffer = get_snapshot_buffer(symbol)

                    buffer.append(snapshot)

                    aggregated_snapshot = (
                        buffer.aggregate()
                    )

                    aggregated_snapshot["time"] = (
                        datetime.now().isoformat()
                    )

                    now = time.time()

                    last_ts = last_write_time.get(symbol, 0)

                    if now - last_ts >= CSV_WRITE_INTERVAL:
                        writer.write_snapshot(
                            symbol,
                            snapshot
                        )

                        last_write_time[symbol] = now

                        print(
                            f"💾 Snapshot saved → {symbol}"
                        )

            await asyncio.sleep(1)

        except Exception as e:

            print("❌ Merge loop error:", e)

            await asyncio.sleep(1)


# =========================================================
# MAIN
# =========================================================

async def main():

    # -----------------------------------------------------
    # CONNECT WEBSOCKET
    # -----------------------------------------------------

    await tick_stream.connect()

    await tick_stream.subscribe_from_csv()

    # -----------------------------------------------------
    # START TASKS
    # -----------------------------------------------------

    asyncio.create_task(
        tick_stream.receive_loop()
    )

    asyncio.create_task(
        option_chain_scheduler()
    )

    asyncio.create_task(
        tick_merge_loop()
    )

    # -----------------------------------------------------
    # KEEP ALIVE
    # -----------------------------------------------------

    while True:

        await asyncio.sleep(3600)


# =========================================================
# ENTRY
# =========================================================

if __name__ == "__main__":

    asyncio.run(main())