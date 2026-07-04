"""
query.py

Market Memory Query Language (MMQL)
"""

from __future__ import annotations

import operator


###########################################################################
# Condition
###########################################################################

class Condition:

    OPERATORS = {

        "==": operator.eq,
        "!=": operator.ne,
        ">": operator.gt,
        "<": operator.lt,
        ">=": operator.ge,
        "<=": operator.le,
    }

    #######################################################################

    def __init__(self, field, op, value):

        self.field = field

        self.op = op

        self.value = value

    #######################################################################

    def evaluate(self, memory):

        current = memory.get_nested(self.field)

        return self.OPERATORS[self.op](current, self.value)

    #######################################################################

    def __repr__(self):

        return f"{self.field} {self.op} {self.value}"


###########################################################################
# Field
###########################################################################

class Field:

    def __init__(self, path):

        self.path = path

    #######################################################################

    def __eq__(self, other):

        return Condition(self.path, "==", other)

    #######################################################################

    def __ne__(self, other):

        return Condition(self.path, "!=", other)

    #######################################################################

    def __gt__(self, other):

        return Condition(self.path, ">", other)

    #######################################################################

    def __lt__(self, other):

        return Condition(self.path, "<", other)

    #######################################################################

    def __ge__(self, other):

        return Condition(self.path, ">=", other)

    #######################################################################

    def __le__(self, other):

        return Condition(self.path, "<=", other)

    #######################################################################

    def __repr__(self):

        return self.path


###########################################################################
# Namespace
###########################################################################

class Namespace:

    """
    Allows:

    statistics.volatility

    statistics.avg_true_range

    statistics.highest_day
    """

    def __init__(self, prefix):

        self.prefix = prefix

    #######################################################################

    def __getattr__(self, item):

        return Field(f"{self.prefix}.{item}")


###########################################################################
# Root Fields
###########################################################################

symbol = Field("symbol")

year = Field("year")

month = Field("month")

quarter = Field("quarter")

open_price = Field("open")

high = Field("high")

low = Field("low")

close = Field("close")

volume = Field("volume")

trading_days = Field("trading_days")

avg_daily_volume = Field("avg_daily_volume")

up_days = Field("up_days")

down_days = Field("down_days")

unchanged_days = Field("unchanged_days")

percent_change = Field("percent_change")

monthly_range = Field("monthly_range")

quarterly_range = Field("quarterly_range")


###########################################################################
# Statistics Namespace
###########################################################################

statistics = Namespace("statistics")