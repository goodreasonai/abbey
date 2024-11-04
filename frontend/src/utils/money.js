

export function formatCents(cents){
      // Check if the input is a valid number
    if (isNaN(cents) || cents < 0) {
        throw Error(`Cents is not valid (${cents})`);
    }

    // Calculate the dollar and cent values
    const dollars = Math.floor(cents / 100);
    const centValue = cents % 100;

    // Format the dollar and cent values
    const dollarString = dollars.toLocaleString("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    });
    const centString = centValue.toLocaleString("en-US", {
        minimumIntegerDigits: 2,
        useGrouping: false,
    });

    // Combine the dollar and cent values with the currency symbol
    return `$${dollarString}.${centString}`;
}
