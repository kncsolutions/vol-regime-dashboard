import numpy as np

DEBUG = False
class VolumeProfileCalculator:

    @staticmethod
    def calculate(
        data,
        bins=100,
        value_area=0.70
    ):
        """
        Calculates

        VPOC
        VAH
        VAL

        from Daily OHLCV
        """

        lows = data["low"].to_numpy()

        highs = data["high"].to_numpy()

        volumes = data["volume"].to_numpy()

        #####################################################
        # Price Grid
        #####################################################

        price_min = lows.min()

        price_max = highs.max()

        edges = np.linspace(

            price_min,

            price_max,

            bins + 1

        )

        profile = np.zeros(bins)

        #####################################################
        # Distribute volume uniformly
        #####################################################

        for low, high, volume in zip(

                lows,

                highs,

                volumes
        ):

            mask = (

                (edges[:-1] <= high)

                &

                (edges[1:] >= low)

            )

            count = mask.sum()

            if count > 0:

                profile[mask] += volume / count

        #####################################################
        # VPOC
        #####################################################

        vpoc_index = np.argmax(profile)

        vpoc = (

            edges[vpoc_index]

            +

            edges[vpoc_index + 1]

        ) / 2

        #####################################################
        # Value Area
        #####################################################

        total_volume = profile.sum()

        target = total_volume * value_area

        included = {vpoc_index}

        current = profile[vpoc_index]

        left = vpoc_index - 1

        right = vpoc_index + 1

        while current < target:

            left_vol = (

                profile[left]

                if left >= 0

                else -1

            )

            right_vol = (

                profile[right]

                if right < bins

                else -1

            )

            if left_vol >= right_vol:

                included.add(left)

                current += left_vol

                left -= 1

            else:

                included.add(right)

                current += right_vol

                right += 1

        val = edges[min(included)]

        vah = edges[max(included)+1]
        if DEBUG:
            print("=" * 80)



            print("Price Range :", price_min, price_max)

            print("Profile Sum :", profile.sum())

            print("Profile Max :", profile.max())

            print("Included :", len(included))

            print("Target :", target)

            print("Current :", current)

            print("VPOC :", vpoc)

            print("VAH :", vah)

            print("VAL :", val)

        return vpoc, vah, val