export const I2Buffer = {
    data: [],
    max: 500
};

export function pushI2(I2, timestamp) {
    if (I2 == null || isNaN(I2)) return;

    I2Buffer.data.push({
        time: timestamp,
        value: I2
    });

    if (I2Buffer.data.length > I2Buffer.max) {
        I2Buffer.data.shift();
    }
}