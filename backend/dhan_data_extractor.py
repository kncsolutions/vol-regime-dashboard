from http.client import responses

import requests
from typing import Dict, Any, List, Optional
from dhanhq import dhanhq
import json
import pandas as pd
from datetime import datetime, timedelta
import time


class DhanClient:
    BASE_URL = "https://api.dhan.co"

    def __init__(self, access_token: str, client_id: str):
        self.access_token = access_token
        self.client_id = client_id

        self.dhan = dhanhq(self.client_id, self.access_token)
        # self.dhan = dhanhq(dhan_context)

        self.headers = {
            "access-token": self.access_token,
            "client-id": self.client_id,
            "Content-Type": "application/json"
        }

    def option_chain_to_full_df(self, response, expiry_date=None):

        oc = response["data"]["data"]["oc"]

        rows = []

        for strike, values in oc.items():
            strike = float(strike)

            ce = values.get("ce", {})
            pe = values.get("pe", {})

            ce_greeks = ce.get("greeks", {})
            pe_greeks = pe.get("greeks", {})

            row = {
                "strike": strike,

                # CALL SIDE
                "call_price": ce.get("last_price"),
                "call_oi": ce.get("oi"),
                "call_oi_change": ce.get("oi", 0) - ce.get("previous_oi", 0),
                "call_delta": ce_greeks.get("delta"),
                "call_theta": ce_greeks.get("theta"),

                # PUT SIDE
                "put_price": pe.get("last_price"),
                "put_oi": pe.get("oi"),
                "put_oi_change": pe.get("oi", 0) - pe.get("previous_oi", 0),
                "put_delta": pe_greeks.get("delta"),
                "put_theta": pe_greeks.get("theta"),

                # SHARED / DERIVED
                "gamma": ce_greeks.get("gamma"),  # same for CE/PE theoretically
                "vega": ce_greeks.get("vega"),  # same for CE/PE
                "iv": ce.get("implied_volatility"),

                # META
                "expiry_date": expiry_date
            }

            rows.append(row)

        df = pd.DataFrame(rows)

        return df.sort_values("strike").reset_index(drop=True)

    # -------------------------------
    # 🔹 Fetch Option Chain
    # -------------------------------
    def get_option_chain(
            self,
            under_security_id: int,
            underlying: str,
            exchange_segment: str = "NSE_FNO",
            expiry: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Fetch option chain for a given underlying

        :param underlying: e.g. "NIFTY", "BANKNIFTY"
        :param exchange_segment: default NSE_FNO
        :param expiry: optional expiry date "YYYY-MM-DD"
        """

        endpoint = f"{self.BASE_URL}/optionchain"

        payload = {
            "Underlying": underlying,
            "ExchangeSegment": exchange_segment,
            "security_id": under_security_id
        }
        if underlying == 'NIFTY' or underlying == 'BANKNIFTY':
            exchange_segment = 'IDX_I'


        if expiry:
            payload["Expiry"] = expiry

        print(payload)


        response = self.dhan.option_chain(under_security_id=int(under_security_id),
                                          under_exchange_segment=exchange_segment,
                                          expiry=expiry)

        # import json
        # print(json.dumps(response, indent=2))
        # print(response)
        return response
        df_response = self.option_chain_to_full_df(response, expiry)
        # print(df_response)
        # input('wait')
        time.sleep(0.4)

        return df_response

    # -------------------------------
    # 🔹 Normalize Option Chain
    # -------------------------------
    def normalize_chain(self, raw_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Convert raw chain into structured rows
        """

        chain = raw_data.get("data", [])
        normalized = []

        for strike_data in chain:
            strike = strike_data.get("strikePrice")

            ce = strike_data.get("CE", {})
            pe = strike_data.get("PE", {})

            normalized.append({
                "strike": strike,

                # CALL
                "call_oi": ce.get("openInterest"),
                "call_oi_change": ce.get("changeinOpenInterest"),
                "call_volume": ce.get("totalTradedVolume"),
                "call_ltp": ce.get("lastPrice"),
                "call_iv": ce.get("impliedVolatility"),

                # PUT
                "put_oi": pe.get("openInterest"),
                "put_oi_change": pe.get("changeinOpenInterest"),
                "put_volume": pe.get("totalTradedVolume"),
                "put_ltp": pe.get("lastPrice"),
                "put_iv": pe.get("impliedVolatility"),
            })

        return normalized

    # -------------------------------
    # 🔹 Extract Key Metrics
    # -------------------------------
    def compute_metrics(self, chain: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Compute PCR, max pain, etc.
        """

        total_call_oi = sum([row["call_oi"] or 0 for row in chain])
        total_put_oi = sum([row["put_oi"] or 0 for row in chain])

        pcr = total_put_oi / total_call_oi if total_call_oi else None

        # Max Pain Calculation
        pain = {}

        for row in chain:
            strike = row["strike"]
            total_loss = 0

            for r in chain:
                total_loss += max(0, strike - r["strike"]) * (r["call_oi"] or 0)
                total_loss += max(0, r["strike"] - strike) * (r["put_oi"] or 0)

            pain[strike] = total_loss

        max_pain = min(pain, key=pain.get) if pain else None

        return {
            "PCR": pcr,
            "MaxPain": max_pain,
            "TotalCallOI": total_call_oi,
            "TotalPutOI": total_put_oi
        }

    # -------------------------------
    # 🔹 Filter ATM Region
    # -------------------------------
    def filter_strikes(
            self,
            chain: List[Dict[str, Any]],
            spot: float,
            window: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Extract strikes around ATM
        """

        sorted_chain = sorted(chain, key=lambda x: abs(x["strike"] - spot))
        return sorted_chain[:window]

    # -------------------------------
    # 🔹 Get Expiry List
    # -------------------------------
    def get_expiry_list(
            self,
            under_security_id: int,
            under_security: str,
            under_exchange_segment: str = "NSE_FNO"
    ):

        if under_security == 'NIFTY' or under_security == 'BANKNIFTY':
            under_exchange_segment = "IDX_I"

        response = self.dhan.expiry_list(
            under_security_id=under_security_id,  # Nifty = 13
            under_exchange_segment=under_exchange_segment
        )
        # print(response["data"]["data"])
        return response["data"]["data"]

    def get_futures_contracts(self, df, symbol):
        symbol = symbol.upper()

        fut_df = df[
            (df["SEM_INSTRUMENT_NAME"].isin(["FUTIDX", "FUTSTK"])) &
            (df["SEM_TRADING_SYMBOL"]
             .str.split("-")
             .str[0]
             .str.upper() == symbol)
            ]

        return fut_df.sort_values("SEM_EXPIRY_DATE")

    def get_quote_data(self, securities):
        """
        Fetch quote data from Dhan REST API

        securities example:
        {
            "NSE_EQ": ["10099"]
        }
        """

        url = "https://api.dhan.co/v2/marketfeed/quote"

        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "access-token": self.access_token,
            "client-id": self.client_id
        }
        print(securities)

        payload = {
            "securities": securities
        }

        response = requests.post(url, json=payload, headers=headers)

        if response.status_code != 200:
            print("Error:", response.status_code, response.text)
            return None
        # print(response.json())

        return response.json()

    def get_ohlc_via_quote(self, securities):

        response = self.get_quote_data(securities)

        if not response:
            return None

    def get_realtime_quote_data(
            self, security_id: int,
            under_security: str,
            instrument_type: str = "EQUITY",
            exchange_segment: str = "NSE_EQ"
        ):
        time.sleep(0.4)
        try:
            if under_security == 'NIFTY' or under_security == 'BANKNIFTY':
                exchange_segment = "IDX_I"
                instrument_type = "INDEX"
            securities ={str(exchange_segment): [int(security_id)]}
            print(securities)

            # 🔹 API call
            response = self.dhan.quote_data(securities=securities)

            # 🔹 Check response exists
            if not response:
                print("⚠️ Empty response from API")
                return None

            # 🔹 Ensure dict
            if not isinstance(response, dict):
                print("⚠️ Unexpected response type:", type(response))
                return None

            # 🔹 Check status
            if response.get("status") != "success":
                print("⚠️ API returned failure:", response)
                return None

            # 🔹 Extract nested data safely
            data_block = response.get("data", {}).get("data", {})

            if not data_block:
                print("⚠️ No data in response:", response)
                return None

            # 🔹 Parse into DataFrame
            # print(response)
            return response

        except Exception as e:
            print("❌ Exception in _get_quote_data:", str(e))
            return None

    def _get_quote_data(self, securities):
        time.sleep(0.4)
        try:
            print(securities)

            # 🔹 API call
            response = self.dhan.quote_data(securities=securities)

            # 🔹 Check response exists
            if not response:
                print("⚠️ Empty response from API")
                return None

            # 🔹 Ensure dict
            if not isinstance(response, dict):
                print("⚠️ Unexpected response type:", type(response))
                return None

            # 🔹 Check status
            if response.get("status") != "success":
                print("⚠️ API returned failure:", response)
                return None

            # 🔹 Extract nested data safely
            data_block = response.get("data", {}).get("data", {})

            if not data_block:
                print("⚠️ No data in response:", response)
                return None

            # 🔹 Parse into DataFrame
            print(response)
            df = self.extract_ohlc_from_quote(response)

            # 🔹 Final safety check
            if df is None or df.empty:
                print("⚠️ Extracted dataframe is empty")
                return None

            return df

        except Exception as e:
            print("❌ Exception in _get_quote_data:", str(e))
            return None

    def extract_ohlc_from_quote(self, response):

        records = []

        data_block = response.get("data", {}).get("data", {})

        for exchange, instruments in data_block.items():

            if not isinstance(instruments, dict):
                continue

            for sec_id, values in instruments.items():
                ohlc = values.get("ohlc", {})

                # 🔥 Parse datetime (STRING → datetime)
                dt = pd.to_datetime(
                    values.get("last_trade_time"),
                    format="%d/%m/%Y %H:%M:%S"
                )

                records.append({
                    "exchange": exchange,
                    "security_id": sec_id,
                    "date": dt.date(),
                    "datetime": dt,
                    "open": ohlc.get("open"),
                    "high": ohlc.get("high"),
                    "low": ohlc.get("low"),
                    "close": values.get("last_price"),
                    "volume": values.get("volume"),
                    "open_interest": values.get("oi")
                })

        df = pd.DataFrame(records)

        return df

    def get_daily_spot_data(
            self,
            security_id: int,
            under_security: str,
            instrument_type: str = "EQUITY",
            exchange_segment: str = "NSE_EQ"
    ):
        time.sleep(0.4)
        if under_security == 'NIFTY' or under_security == 'BANKNIFTY':
            exchange_segment = "IDX_I"
            instrument_type = "INDEX"
        # Today's date
        to_date = datetime.today().strftime("%Y-%m-%d")
        # print(to_date)

        # 2 years ago (approx: 730 days)
        from_date = (datetime.today() - timedelta(days=360)).strftime("%Y-%m-%d")
        print(security_id)
        response = self.dhan.historical_daily_data(security_id=security_id,
                                                   exchange_segment=exchange_segment,
                                                   instrument_type=instrument_type,
                                                   from_date=from_date,
                                                   to_date=to_date)
        return response

        d = self._to_dataframe(response)
        # Ensure datetime consistency
        d["date"] = pd.to_datetime(d["date"]).dt.tz_localize(None)
        d = d.sort_values("date")
        print(d.tail(5))
        df_live = pd.DataFrame()
        try:
            df_live = self._get_quote_data({str(exchange_segment): [int(security_id)]})
        except Exception as e:
             pass
        print(df_live)
        if len(df_live) > 0:

            # Normalize live date to daily candle
            df_live["date"] = pd.to_datetime(df_live["date"]).dt.normalize()

            # Add timestamp column to match historical
            df_live["timestamp"] = df_live["date"].astype("int64") // 10 ** 9

            # Align columns
            df_live = df_live[[
                "timestamp", "open", "high", "low", "close",
                "volume", "open_interest", "date"
            ]]
            # --- 🔥 Merge Logic ---

            last_hist_date = d["date"].max().normalize()
            live_date = df_live["date"].iloc[0]

            if live_date > last_hist_date:
                # ✅ New day → append
                d = pd.concat([d, df_live], ignore_index=True)

            elif live_date == last_hist_date:
                # ✅ Same day → update last candle
                d.loc[d.index[-1], ["open", "high", "low", "close", "volume"]] = \
                    df_live.iloc[0][["open", "high", "low", "close", "volume"]].values

        # Final sort
        d = d.sort_values("date").reset_index(drop=True)
        # Replace NaN with 0
        # Smart NaN handling
        d[["open", "high", "low", "close"]] = d[["open", "high", "low", "close"]].ffill()
        d["volume"] = d["volume"].fillna(0)
        d["open_interest"] = d["open_interest"].fillna(0)
        print(d.tail(5))

        # input("press to continue @ spot..")

        return d

    # -------------------------------
    # 🔹 Get Historical Daily Data
    # -------------------------------
    def get_daily_fut_data(
            self,
            security_id: int,
            under_security: str,
            expiry: Any,
            instrument_type: str = "FUTSTK",
            exchange_segment: str = "NSE_FNO"

    ):
        time.sleep(0.4)
        if under_security == 'NIFTY' or under_security == 'BANKNIFTY':
            # exchange_segment = "IDX_I"
            instrument_type = "FUTIDX"
        # Today's date
        to_date = datetime.today().strftime("%Y-%m-%d")

        # 2 years ago (approx: 730 days)
        from_date = (datetime.today() - timedelta(days=350)).strftime("%Y-%m-%d")
        print(security_id)
        # response = self.dhan.historical_daily_data(security_id=security_id,
        #                                            exchange_segment=exchange_segment,
        #                                            instrument_type=instrument_type,
        #                                            from_date=from_date,
        #                                            to_date=to_date,
        #                                            oi=True)
        url = "https://api.dhan.co/v2/charts/historical"

        payload = {
            "securityId": security_id,
            "exchangeSegment": exchange_segment,
            "instrument": instrument_type,
            "interval": "1d",
            "fromDate": from_date,
            "toDate": to_date,
            "oi": True  # ✅ works here
        }

        headers = {
            "access-token": self.access_token,
            "client-id": self.client_id,
            "Content-Type": "application/json"
        }

        response = requests.post(url, json=payload, headers=headers)
        data = response.json()  # ✅ IMPORTANT
        # print(data)

        d = self._fut_to_dataframe(data)
        # print(d.tail(5))
        # Ensure datetime consistency
        d["datetime"] = pd.to_datetime(d["datetime"]).dt.tz_localize(None)
        d = d.sort_values("datetime")
        print(d.tail(5))
        df_live = pd.DataFrame()
        try:
            df_live = self._get_quote_data({str(exchange_segment): [security_id]})
        except Exception as e:
            pass
        print(df_live)
        if len(df_live) > 0:
        # Normalize live date to daily candle
            df_live["datetime"] = pd.to_datetime(df_live["datetime"]).dt.normalize()

            # Add timestamp column to match historical
            df_live["timestamp"] = df_live["datetime"].astype("int64") // 10 ** 9

            # Align columns
            df_live = df_live[[
                "timestamp", "open", "high", "low", "close",
                "volume", "open_interest", "datetime"
            ]]
            # --- 🔥 Merge Logic ---

            last_hist_date = d["datetime"].max().normalize()
            live_date = df_live["datetime"].iloc[0]

            if live_date > last_hist_date:
                # ✅ New day → append
                d = pd.concat([d, df_live], ignore_index=True)

            elif live_date == last_hist_date:
                # ✅ Same day → update last candle
                d.loc[d.index[-1], ["open", "high", "low", "close", "volume"]] = \
                    df_live.iloc[0][["open", "high", "low", "close", "volume"]].values

        # Final sort
        d = d.sort_values("datetime").reset_index(drop=True)
        # Replace NaN with 0
        # Smart NaN handling
        d[["open", "high", "low", "close"]] = d[["open", "high", "low", "close"]].ffill()
        d["volume"] = d["volume"].fillna(0)
        d["open_interest"] = d["open_interest"].fillna(0)
        d['datetime'] = pd.to_datetime(d['datetime'])
        expiry = pd.to_datetime(expiry)
        d['expiry_date'] = expiry.strftime('%d-%b-%Y').upper()
        d['product_type'] = 'Futures'
        print(d.tail(5))

        # input("press to continue @ FNO..")

        return d

    # -------------------------------
    # 🔹 Convert to DataFrame
    # -------------------------------
    def _to_dataframe(self, data):
        candles = data.get("data", [])

        df = pd.DataFrame(candles, columns=[
            "timestamp",
            "open",
            "high",
            "low",
            "close",
            "volume",
            "open_interest"
        ])

        # Convert timestamp → datetime
        # df["datetime"] = pd.to_datetime(df["timestamp"], unit="s")
        df["date"] = pd.to_datetime(df["timestamp"], unit="s", utc=True)
        df["date"] = df["date"].dt.tz_convert("Asia/Kolkata")
        return df

    def _fut_to_dataframe(self, data):

        d = data

        if not d:
            print("No data found")
            return pd.DataFrame()

        # 🔥 Build column-wise
        df = pd.DataFrame({
            "timestamp": d.get("timestamp", []),
            "open": d.get("open", []),
            "high": d.get("high", []),
            "low": d.get("low", []),
            "close": d.get("close", []),
            "volume": d.get("volume", []),
            "open_interest": d.get("open_interest", d.get("oi", []))
        })

        # 🚨 Drop empty rows (important)
        df = df.dropna(subset=["timestamp"])

        # Convert timestamp
        df["datetime"] = pd.to_datetime(df["timestamp"], unit="s", utc=True)
        df["datetime"] = df["datetime"].dt.tz_convert("Asia/Kolkata")

        return df

    #     Get intrday data
    def get_intrday_fut_data(self,
                             security_id: int,
                             under_security: str,
                             expiry: Any,
                             instrument_type: str = "FUTSTK",
                             exchange_segment: str = "NSE_FNO",
                             timeframe: str = "60min", ):
        time.sleep(0.4)

        if under_security == 'NIFTY' or under_security == 'BANKNIFTY':
            # exchange_segment = "IDX_I"
            instrument_type = "FUTIDX"
        print(under_security)
        # Today's date
        to_date = datetime.today().strftime("%Y-%m-%d")

        # 2 years ago (approx: 730 days)
        from_date = (datetime.today() - timedelta(days=30)).strftime("%Y-%m-%d")
        print(security_id)

        import re

        def extract_first_int(s):
            match = re.search(r'\d+', s)
            return int(match.group()) if match else None

        t = extract_first_int(timeframe)
        print('Timeframe:', t)
        print(t)
        print('--------------')

        url = "https://api.dhan.co/v2/charts/intraday"

        payload = {
            "securityId": security_id,
            "exchangeSegment": exchange_segment,
            "instrument": instrument_type,
            "interval": extract_first_int(timeframe),
            "fromDate": from_date,
            "toDate": to_date,
            "oi": True  # ✅ works here
        }

        headers = {
            "access-token": self.access_token,
            "client-id": self.client_id,
            "Content-Type": "application/json"
        }

        response = requests.post(url, json=payload, headers=headers)
        # print(response.json())
        d = self._fut_to_dataframe(response.json())
        expiry = pd.to_datetime(expiry)
        d['expiry_date'] = expiry.strftime('%d-%b-%Y').upper()
        d['product_type'] = 'Futures'
        print(d.tail(5))
        # input("press to continue @ FNO intraday..")
        return d

    def get_intrday_spot_data(self,
                             security_id: int,
                             under_security: str,
                              instrument_type: str = "EQUITY",
                              exchange_segment: str = "NSE_EQ",
                             timeframe: str = "60m"):
        time.sleep(0.4)

        if under_security == 'NIFTY' or under_security == 'BANKNIFTY':
            exchange_segment = "IDX_I"
            instrument_type = "INDEX"
        print(under_security)
        # Today's date
        to_date = datetime.today().strftime("%Y-%m-%d")

        # 2 years ago (approx: 730 days)
        from_date = (datetime.today() - timedelta(days=30)).strftime("%Y-%m-%d")
        print(security_id)

        import re

        def extract_first_int(s):
            match = re.search(r'\d+', s)
            return int(match.group()) if match else None

        t = extract_first_int(timeframe)
        print('Timeframe:', t)
        print(t)
        print('--------------')

        url = "https://api.dhan.co/v2/charts/intraday"

        payload = {
            "securityId": int(security_id),
            "exchangeSegment": exchange_segment,
            "instrument": instrument_type,
            "interval": extract_first_int(timeframe),
            "fromDate": from_date,
            "toDate": to_date,
            "oi": True  # ✅ works here
        }
        print(payload)

        headers = {
            "access-token": self.access_token,
            "client-id": self.client_id,
            "Content-Type": "application/json"
        }

        response = requests.post(url, json=payload, headers=headers)
        print(response.json())
        return response.json()
        # print(response.json())
        d = self._fut_to_dataframe(response.json())
        expiry = pd.to_datetime(expiry)
        d['expiry_date'] = expiry.strftime('%d-%b-%Y').upper()
        d['product_type'] = 'Futures'
        print(d.tail(5))
        # input("press to continue @ FNO intraday..")
        return d
