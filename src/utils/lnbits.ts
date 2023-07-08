import _LNBits from "lnbits";

let LNBits: any;

if (_LNBits.default) {
    LNBits = _LNBits.default;
} else {
    LNBits = _LNBits;
}

function getWallet (): any {
    return LNBits({
        adminKey: "",
        invoiceReadKey: 'bfbcb5b116c04179bc618ab78265a939',
        endpoint: 'https://legend.lnbits.com'
    });
}

export async function createInvoice(amount: number): Promise<any> {
    const { wallet } = getWallet();

    const newInvoice = await wallet.createInvoice({
        amount: amount,
        memo: 'data vending machine',
        out: false,
    });

    return newInvoice;
}

export async function checkInvoiceStatus(invoice): Promise<any> {
    const { wallet } = getWallet();
    const invoiceStatus = await wallet.checkInvoice({
        payment_hash: invoice.payment_hash,
    });

    return invoiceStatus;
}