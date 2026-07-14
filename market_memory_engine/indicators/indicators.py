import pandas as pd
import numpy as np

class EMACalculator:
    """
    A class to calculate Exponential Moving Average (EMA) using pandas apply().
    """

    def __init__(self, df: pd.DataFrame, period: int = 14, price_col: str = "close"):
        self.df = df.copy()
        self.period = period
        self.price_col = price_col
        self._validate_columns()

    def _validate_columns(self):
        if self.price_col not in self.df.columns:
            raise ValueError(f"DataFrame must contain a '{self.price_col}' column.")

    def calculate_ema(self) -> pd.DataFrame:
        """
        Calculate the EMA using pandas apply() method.
        Formula:
        EMA_today = (Price_today * k) + (EMA_yesterday * (1 - k))
        where k = 2 / (period + 1)
        """
        k = 2 / (self.period + 1)
        ema_prev = None

        def ema_func(price):
            nonlocal ema_prev
            if ema_prev is None:
                ema_prev = price  # initialize with the first price
            else:
                ema_prev = (price * k) + (ema_prev * (1 - k))
            return ema_prev

        self.df[f"ema{self.period}"] = self.df[self.price_col].apply(ema_func)
        # print(self.df[f"ema{self.period}"])
        return self.df[f"ema{self.period}"]

class ATRCalculator:
    """
    A class to calculate Average True Range (ATR) for a stock's OHLC data.

    Attributes:
        df (pd.DataFrame): DataFrame containing columns ['High', 'Low', 'Close'].
        period (int): ATR lookback period (default = 14).
    """

    def __init__(self, df: pd.DataFrame, period: int = 14):
        self.df = df.copy()
        self.period = period
        self._validate_columns()

    def _validate_columns(self):
        required_cols = {'high', 'low', 'close'}
        missing = required_cols - set(self.df.columns)
        if missing:
            raise ValueError(f"Missing columns in DataFrame: {missing}")

    def _calculate_true_range(self, row):
        """
        Compute the True Range for a given row.
        TR = max(High - Low, abs(High - PrevClose), abs(Low - PrevClose))
        """
        prev_close = row['PrevClose']
        return max(
            row['high'] - row['low'],
            abs(row['high'] - prev_close),
            abs(row['low'] - prev_close)
        )

    def calculate_atr(self) -> pd.DataFrame:
        """Calculates ATR and adds it as a new column 'ATR'."""
        self.df['PrevClose'] = self.df['close'].shift(1)
        self.df['TR'] = self.df.apply(self._calculate_true_range, axis=1)
        self.df['ATR'] = self.df['TR'].rolling(window=self.period, min_periods=1).mean()
        # print(self.df)
        return self.df.drop(columns=['PrevClose'])

class RSICalculator:
    """
    A class to calculate Relative Strength Index (RSI) using pandas apply().
    """

    def __init__(self, df: pd.DataFrame, period: int = 14, price_col: str = "close"):
        self.df = df.copy()
        self.period = period
        self.price_col = price_col
        self._validate_columns()

    def _validate_columns(self):
        if self.price_col not in self.df.columns:
            raise ValueError(f"DataFrame must contain a '{self.price_col}' column.")

    def calculate_rsi(self) -> pd.DataFrame:
        """
        Calculate RSI using pandas apply().
        Formula:
        RSI = 100 - (100 / (1 + RS))
        where RS = avg_gain / avg_loss
        """
        # Calculate price differences
        self.df["Change"] = self.df[self.price_col].diff()

        # Extract gains and losses
        self.df["Gain"] = self.df["Change"].apply(lambda x: x if x > 0 else 0)
        self.df["Loss"] = self.df["Change"].apply(lambda x: -x if x < 0 else 0)

        # Initialize variables for recursive average
        avg_gain, avg_loss = None, None

        def rsi_func(row):
            nonlocal avg_gain, avg_loss

            gain, loss = row["Gain"], row["Loss"]

            if avg_gain is None:  # Initialize
                avg_gain = self.df["Gain"].iloc[:self.period].mean()
                avg_loss = self.df["Loss"].iloc[:self.period].mean()
                return None  # RSI not defined for initial period

            # Wilder’s smoothing formula
            avg_gain = (avg_gain * (self.period - 1) + gain) / self.period
            avg_loss = (avg_loss * (self.period - 1) + loss) / self.period

            if avg_loss == 0:
                return 100  # Avoid division by zero

            rs = avg_gain / avg_loss
            return 100 - (100 / (1 + rs))

        # Apply RSI calculation
        self.df["RSI"] = self.df.apply(rsi_func, axis=1)
        return self.df.drop(columns=["Change", "Gain", "Loss"])

class SwingHighLowCalculator:
    """
    A class to calculate Swing Highs and Swing Lows using pandas apply().
    Swing High = High greater than previous N and next N highs
    Swing Low  = Low less than previous N and next N lows
    """

    def __init__(self, df: pd.DataFrame, lookback: int = 2):
        self.df = df.copy()
        self.lookback = lookback
        self._validate_columns()

    def _validate_columns(self):
        required_cols = ["high", "low"]
        for col in required_cols:
            if col not in self.df.columns:
                raise ValueError(f"DataFrame must contain '{col}' column.")

    def calculate_swings(self) -> pd.DataFrame:
        """
        Calculates swing highs and lows.
        Returns DataFrame with 'Swing_High' and 'Swing_Low' columns.
        """

        def detect_swing(row_index):
            if row_index < self.lookback or row_index >= len(self.df) - self.lookback:
                return np.nan, np.nan  # not enough data

            # Define local slices
            current_high = self.df.at[row_index, "high"]
            current_low = self.df.at[row_index, "low"]

            prev_highs = self.df["high"].iloc[row_index - self.lookback: row_index]
            next_highs = self.df["high"].iloc[row_index + 1: row_index + 1 + self.lookback]

            prev_lows = self.df["low"].iloc[row_index - self.lookback: row_index]
            next_lows = self.df["low"].iloc[row_index + 1: row_index + 1 + self.lookback]

            # Swing conditions
            is_swing_high = (current_high > prev_highs.max()) and (current_high > next_highs.max())
            is_swing_low = (current_low < prev_lows.min()) and (current_low < next_lows.min())

            return is_swing_high, is_swing_low

        # Apply function row-wise
        swings = self.df.index.to_series().apply(lambda i: detect_swing(i))

        # Extract results into columns
        self.df["swinghigh"] = swings.apply(lambda x: x[0] if isinstance(x, tuple) else np.nan)
        self.df["swinglow"] = swings.apply(lambda x: x[1] if isinstance(x, tuple) else np.nan)

        # Optional: Label swing points
        self.df["Swing_Label"] = self.df.apply(
            lambda row: "swinghigh" if row["swinghigh"] else ("swinglow" if row["swinglow"] else None),
            axis=1
        )
        # print(self.df)

        return self.df

    def get_alternating_swings(self) -> pd.DataFrame:
        """
        Create a condensed DataFrame containing alternating swing highs and lows.
        Consecutive same-type swings are removed.
        """

        if "Swing_Label" not in self.df.columns:
            self.calculate_swings()

        # Extract only swing points
        swing_points = self.df[self.df["Swing_Label"].notnull()].copy()
        swing_points["price"] = swing_points.apply(
            lambda row: row["high"] if row["Swing_Label"] == "swinghigh" else row["low"],
            axis=1
        )

        # Keep alternating highs and lows
        alternating_swings = []
        last_label = None

        for idx, row in swing_points.iterrows():
            label = row["Swing_Label"]
            if label == last_label:
                # Replace the previous swing if the new one is more extreme
                if label == "swinghigh" and row["price"] > alternating_swings[-1]["price"]:
                    alternating_swings[-1] = {"date": row["date"], "type": label, "price": row["price"]}
                elif label == "swinglow" and row["price"] < alternating_swings[-1]["price"]:
                    alternating_swings[-1] = {"date": row["date"], "type": label, "price": row["price"]}
                # Skip otherwise
                continue
            else:
                alternating_swings.append({"date": row["date"], "type": label, "price": row["price"]})
                last_label = label

        result_df = pd.DataFrame(alternating_swings)

        # Add corresponding date if present
        # if "date" in self.df.columns:
        #     result_df["date"] = result_df["Index"].apply(lambda i: self.df.at[i, "date"])

        # Reorder columns
        cols = ["date", "price", "type"] if "date" in result_df.columns else ["Index", "type", "price"]
        result_df = result_df[cols]
        # Compute structure (HH, HL, LH, LL)
        result_df["micropattern"] = self._calculate_structure(result_df)

        # Compute volume between swings
        result_df["volume"] = self._calculate_swing_volume(result_df)
        result_df["logret"] = np.log(result_df['price'] / result_df['price'].shift(1)) * 100
        classified_df = self._classify_pattern(result_df)
        result_df['structure'] = classified_df['structure']
        result_df['pricespreadprofit'] = classified_df['pricespreadprofit']
        # print(result_df)
        cols = ["date", "price", "type", "logret", "micropattern", "volume","structure", "pricespreadprofit" ]
        return result_df[cols]

    # ---------------------------------------------------------------------
    def _calculate_structure(self, swings_df: pd.DataFrame):
        """Classify swings as HH, HL, LH, or LL."""

        structure = [None, None]  # first two point has no prior comparison

        for i in range(2, len(swings_df)):
            curr = swings_df.iloc[i]
            prev = swings_df.iloc[i - 2]
            if curr["type"] == "swinghigh" and prev["type"] == "swinghigh":
                structure.append("HH" if curr["price"] > prev["price"] else "LH")
            elif curr["type"] == "swinglow" and prev["type"] == "swinglow":
                structure.append("HL" if curr["price"] > prev["price"] else "LL")
            else:
                structure.append(None)  # alternate swings (H→L or L→H)
        # print(structure)
        return structure

    # ---------------------------------------------------------------------
    def _calculate_swing_volume(self, swings_df: pd.DataFrame):
        """Compute total traded volume between consecutive swing points."""

        volumes = [None]

        for i in range(1, len(swings_df)):
            # start_idx = swings_df.iloc[i - 1]["Index"]
            # end_idx = swings_df.iloc[i]["Index"]

            start_idx = \
            self.df[self.df['date'] == swings_df.loc[i - 1, 'date']].index.tolist()[0] + 1
            end_idx = self.df[
                self.df['date'] == swings_df.loc[i, 'date']].index.tolist()[0]

            # ensure proper range direction
            if start_idx < end_idx:
                vol_sum = self.df.loc[start_idx:end_idx, "volume"].sum()
            else:
                vol_sum = self.df.loc[end_idx:start_idx, "volume"].sum()

            volumes.append(vol_sum)

        return volumes

    def _classify_pattern(self, df_legs: pd.DataFrame):
        def classify_sequence(seq, seq_price):
            """
            Classify a 4-element sequence of [HH, HL, LH, LL] into:
            - Uptrend
            - Downtrend
            - Reversal/Transition
            - Sideways/Indecisive

            seq: list or tuple of length 4
            Example: ["HH", "HL", "LH", "LL"]
            """

            first_two = set(seq[:2])
            last_two = set(seq[2:])
            pattern = "Sideways/Indecisive"

            # Rule 1: Uptrend check
            if {"HH", "HL"}.issubset(first_two): # and {"HH", "HL"}.issubset(last_two):
                pattern = "Uptrend"

            # Rule 2: Downtrend check
            if {"LL", "LH"}.issubset(first_two): # and {"LL", "LH"}.issubset(last_two):
                pattern = "Downtrend"

            # Rule Amendment
            if pattern == "Uptrend":
                low_price_up_leg = min(seq_price[0], seq_price[1])
                low_price_second_leg = min(seq_price[2], seq_price[3])
                if low_price_second_leg <= low_price_up_leg:
                    return "Reversal/Transition"

            if pattern == "Downtrend":
                high_price_down_leg = max(seq_price[0], seq_price[1])
                high_price_second_leg = max(seq_price[2], seq_price[3])
                if high_price_second_leg >= high_price_down_leg:
                    return "Reversal/Transition"

            # Rule 3: Reversal check
            if ((first_two & {"HH", "HL"} and last_two <= {"LL", "LH"}) or
                    (first_two & {"LL", "LH"} and last_two <= {"HH", "HL"})):
                pattern =  "Reversal/Transition"

            # Default: Sideways
            return pattern
        def get_price_spread(s):
            return max(s) - min(s)

        df_legs['first'] = df_legs['micropattern'].shift(3)
        df_legs['second'] = df_legs['micropattern'].shift(2)
        df_legs['third'] = df_legs['micropattern'].shift(1)
        df_legs['fourth'] = df_legs['micropattern']
        df_legs['first_price'] = df_legs['price'].shift(3)
        df_legs['second_price'] = df_legs['price'].shift(2)
        df_legs['third_price'] = df_legs['price'].shift(1)
        df_legs['fourth_price'] = df_legs['price']
        df_legs['structure'] = df_legs.apply(
            lambda x: classify_sequence([x['first'],x['second'], x['third'], x['fourth']],
                                        [x['first_price'],x['second_price'], x['third_price'], x['fourth_price']]),
            axis=1, result_type='expand')
        df_legs['pricespreadprofit'] = df_legs.apply(
            lambda x: get_price_spread([x['first_price'], x['second_price'], x['third_price'], x['fourth_price']]),
            axis=1, result_type='expand')
        return df_legs